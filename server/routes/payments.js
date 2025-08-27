// server/routes/payments.js
import express from 'express';
import { authenticateToken, requirePermission, requireAnyPermission, enrichUserData } from '../middleware/auth.js';
import { uploadPaymentProof, handleUploadError } from '../middleware/upload.js';
import { assignRunnerNumbers } from '../utils/runnerNumberAssignment.js';

const router = express.Router();

// Get all payment transactions (admin, administracion, boss)
router.get('/', authenticateToken, requireAnyPermission(
  { resource: 'payments', action: 'manage' },
  { resource: 'payments', action: 'read' },
  { resource: 'dashboard', action: 'view_boss' }
), async (req, res) => {
  try {
    const { status, from_date, to_date, limit = 50, offset = 0 } = req.query;
    
    let query = req.supabase
      .from('payment_transactions')
      .select(`
        *,
        group:registration_groups!group_id(
          id,
          group_code,
          registrant_email,
          registrant_phone,
          total_runners,
          payment_status,
          payment_method,
          payment_confirmed_by,
          runners:runners!group_id(
            id,
            full_name,
            email,
            runner_number
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (from_date) {
      query = query.gte('created_at', from_date);
    }

    if (to_date) {
      query = query.lte('created_at', to_date);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      return res.status(500).json({ 
        message: 'Error al obtener transacciones',
        error: error.message 
      });
    }

    // Calculate totals
    const totals = {
      total: count || 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      failed: 0,
      totalAmountUSD: 0,
      totalAmountBs: 0
    };

    // Get aggregate stats
    const { data: stats } = await req.supabase
      .from('payment_transactions')
      .select('status, amount_usd, amount_bs');

    stats?.forEach(t => {
      if (t.status === 'approved') {
        totals.approved++;
        totals.totalAmountUSD += parseFloat(t.amount_usd || 0);
        totals.totalAmountBs += parseFloat(t.amount_bs || 0);
      } else if (t.status === 'pending') {
        totals.pending++;
      } else if (t.status === 'rejected') {
        totals.rejected++;
      } else if (t.status === 'failed') {
        totals.failed++;
      }
    });

    res.json({ 
      transactions: transactions || [], 
      totals,
      pagination: {
        total: count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Procesar pago según rol del usuario
router.post('/process-by-role', authenticateToken, enrichUserData, async (req, res) => {
  try {
    const { 
      group_id,
      payment_method,
      payment_reference,
      payment_proof_url,
      // Campos específicos para ciertos métodos
      client_phone,
      client_bank_code,
      notes
    } = req.body;

    // Validar método permitido
    const { data: methodAllowed } = await req.supabase
      .from('payment_methods_configuration')
      .select('*')
      .eq('role_name', req.user.role || 'usuario')
      .eq('payment_method', payment_method)
      .eq('is_active', true)
      .single();

    if (!methodAllowed) {
      return res.status(403).json({
        message: 'Método de pago no permitido para tu rol'
      });
    }

    // Verificar grupo existe
    const { data: group } = await req.supabase
      .from('registration_groups')
      .select('*, runners(*)')
      .eq('id', group_id)
      .single();

    if (!group) {
      return res.status(404).json({
        message: 'Grupo no encontrado'
      });
    }

    // Calcular monto
    const pricePerRunner = parseFloat(process.env.RACE_PRICE_USD || '55.00');
    const totalAmount = pricePerRunner * group.runners.length;

    // Procesar según configuración del método
    const PaymentProcessor = new PaymentProcessorService(req.supabase);
    
    const result = await PaymentProcessor.processPayment({
      group_id,
      payment_method,
      reference: payment_reference,
      amount_usd: totalAmount,
      payment_proof_url,
      client_phone,
      client_bank_code,
      notes
    }, req.user.role || 'usuario', req.user.id);

    // Si requiere procesamiento adicional (P2C)
    if (result.requiresGateway && result.gatewayType === 'p2c') {
      // Redirigir al flujo P2C existente
      return res.json({
        success: true,
        requiresAdditionalStep: true,
        nextEndpoint: '/api/payment-gateway/mobile-payment/p2c/init',
        data: {
          groupId: group_id,
          clientPhone: client_phone,
          clientBankCode: client_bank_code,
          amount: totalAmount,
          runnersCount: group.runners.length
        }
      });
    }

    res.json({
      success: true,
      result,
      group_id,
      payment_status: result.payment_status
    });

  } catch (error) {
    console.error('Process payment by role error:', error);
    res.status(500).json({
      message: 'Error procesando el pago',
      error: error.message
    });
  }
});

// Get payment groups (admin, administracion, boss)
router.get('/groups', authenticateToken, requireAnyPermission(
  { resource: 'payments', action: 'manage' },
  { resource: 'payments', action: 'read' },
  { resource: 'runners', action: 'manage' }
), async (req, res) => {
  try {
    const { status, payment_method, search, limit = 100, offset = 0 } = req.query;
    
    let query = req.supabase
      .from('registration_groups')
      .select(`
        *,
        runners:runners!group_id(
          id,
          full_name,
          email,
          identification_type,
          identification,
          runner_number
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('payment_status', status);
    }

    if (payment_method && payment_method !== 'all') {
      query = query.eq('payment_method', payment_method);
    }

    if (search) {
      // Search in group_code, registrant_email, or runner names
      query = query.or(`group_code.ilike.%${search}%,registrant_email.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: groups, error, count } = await query;

    if (error) {
      console.error('Error fetching groups:', error);
      return res.status(500).json({ 
        message: 'Error al obtener grupos',
        error: error.message 
      });
    }

    // Transform the data to match the expected format
    const transformedGroups = groups?.map(group => ({
      group_id: group.id,
      group_code: group.group_code,
      registrant_email: group.registrant_email,
      registrant_phone: group.registrant_phone,
      total_runners: group.total_runners,
      payment_status: group.payment_status,
      payment_method: group.payment_method,
      payment_reference: group.payment_reference,
      payment_proof_url: group.payment_proof_url,
      payment_confirmed_at: group.payment_confirmed_at,
      payment_confirmed_by: group.payment_confirmed_by,
      reserved_until: group.reserved_until,
      created_at: group.created_at,
      runners: group.runners || [],
      // Add runner names for compatibility
      runner_names: group.runners?.map(r => r.full_name).join(', ') || '',
      runners_detail: group.runners?.map(r => ({
        id: r.id,
        name: r.full_name,
        email: r.email,
        identification: `${r.identification_type}-${r.identification}`,
        runner_number: r.runner_number
      })) || []
    })) || [];

    res.json({ 
      groups: transformedGroups,
      pagination: {
        total: count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get payments for a specific group - check permissions
router.get('/group/:groupId', authenticateToken, enrichUserData, async (req, res) => {
  try {
    const { groupId } = req.params;

    // First check if user has permission to view this group's payments
    const { data: group, error: groupError } = await req.supabase
      .from('registration_groups')
      .select('registrant_email')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Check permissions
    const hasManagePermission = req.user.permissions.some(p => 
      ['payments:manage', 'payments:read', 'runners:manage'].includes(p)
    );
    
    const canView = hasManagePermission || 
                    group.registrant_email === req.user.email;

    if (!canView) {
      // Check if tienda registered any runner in this group
      if (req.user.permissions.includes('runners:register_group')) {
        const { data: storeRunner } = await req.supabase
          .from('runners')
          .select('id')
          .eq('group_id', groupId)
          .eq('registered_by', req.user.id)
          .limit(1)
          .single();
        
        if (!storeRunner) {
          return res.status(403).json({ 
            message: 'No tienes permisos para ver estos pagos' 
          });
        }
      } else {
        return res.status(403).json({ 
          message: 'No tienes permisos para ver estos pagos' 
        });
      }
    }

    const { data: transactions, error } = await req.supabase
      .from('payment_transactions')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching group payments:', error);
      return res.status(500).json({ message: 'Error al obtener pagos del grupo' });
    }

    res.json({ transactions: transactions || [] });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get payment transaction by ID - check permissions
router.get('/transaction/:id', authenticateToken, enrichUserData, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: transaction, error } = await req.supabase
      .from('payment_transactions')
      .select(`
        *,
        group:registration_groups!group_id(
          id,
          group_code,
          registrant_email,
          registrant_phone,
          total_runners,
          payment_status,
          payment_method,
          payment_reference,
          payment_proof_url,
          payment_confirmed_at,
          payment_confirmed_by,
          reserved_until,
          runners:runners!group_id(
            id,
            full_name,
            identification_type,
            identification,
            email,
            phone,
            shirt_size,
            gender,
            runner_number
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error || !transaction) {
      return res.status(404).json({ message: 'Transacción no encontrada' });
    }

    // Check permissions
    const hasManagePermission = req.user.permissions.some(p => 
      ['payments:manage', 'payments:read', 'runners:manage'].includes(p)
    );
    
    const canView = hasManagePermission || 
                    transaction.group.registrant_email === req.user.email;

    if (!canView) {
      // Check if tienda registered any runner in this group
      if (req.user.permissions.includes('runners:register_group')) {
        const hasStoreRunner = transaction.group.runners.some(r => 
          r.registered_by === req.user.id
        );
        
        if (!hasStoreRunner) {
          return res.status(403).json({ 
            message: 'No tienes permisos para ver esta transacción' 
          });
        }
      } else {
        return res.status(403).json({ 
          message: 'No tienes permisos para ver esta transacción' 
        });
      }
    }

    res.json({ transaction });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Confirm payment for a group (admin, administracion)
router.put('/group/:groupId/confirm', authenticateToken, requireAnyPermission(
  { resource: 'payments', action: 'manage' },
  { resource: 'payments', action: 'confirm' }
), async (req, res) => {
  try {
    const { groupId } = req.params;
    const { reference, notes } = req.body;

    // Get group details
    const { data: group, error: groupError } = await req.supabase
      .from('registration_groups')
      .select(`
        *,
        runners:runners!group_id(
          id,
          registered_by
        )
      `)
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    if (group.payment_status === 'confirmado') {
      return res.status(400).json({ message: 'Este grupo ya tiene el pago confirmado' });
    }

    // Update group with reference if provided
    if (reference) {
      await req.supabase
        .from('registration_groups')
        .update({ payment_reference: reference })
        .eq('id', groupId);
    }

    // Use the SQL function to confirm the payment
    const { data: result, error: confirmError } = await req.supabase
      .rpc('confirm_group_payment', {
        p_group_id: groupId,
        p_confirmed_by: req.user.id
      });

    if (confirmError) {
      console.error('Error confirming payment:', confirmError);
      return res.status(500).json({ 
        message: 'Error al confirmar el pago',
        error: confirmError.message 
      });
    }

    // NUEVO: Asignar números de corredor después de confirmar
    try {
      const numberAssignment = await assignRunnerNumbers(groupId, req.supabase);
      if (numberAssignment.success) {
        console.log(`Números asignados: ${numberAssignment.assigned} corredores`);
      } else {
        console.error('Error asignando números:', numberAssignment.error);
      }
    } catch (numberError) {
      console.error('Error en asignación de números (no crítico):', numberError);
      // No fallar la confirmación por esto
    }

    // Get updated group info
    const { data: updatedGroup } = await req.supabase
      .from('runner_group_summary')
      .select('*')
      .eq('group_id', groupId)
      .single();

    res.json({
      success: true,
      message: 'Pago confirmado exitosamente',
      group: updatedGroup
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Reject payment for a group (admin, administracion)
router.put('/group/:groupId/reject', authenticateToken, requireAnyPermission(
  { resource: 'payments', action: 'manage' },
  { resource: 'payments', action: 'reject' }
), async (req, res) => {
  try {
    const { groupId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'Se requiere una razón de rechazo' });
    }

    // Get group details
    const { data: group, error: groupError } = await req.supabase
      .from('registration_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    if (group.payment_status === 'rechazado') {
      return res.status(400).json({ message: 'El pago ya está rechazado' });
    }

    // Update group status
    const { error: updateError } = await req.supabase
      .from('registration_groups')
      .update({
        payment_status: 'rechazado',
        reserved_until: null // Clear reservation
      })
      .eq('id', groupId);

    if (updateError) {
      console.error('Error updating group:', updateError);
      return res.status(500).json({ message: 'Error al actualizar grupo' });
    }

    // Update all runners in the group
    await req.supabase
      .from('runners')
      .update({
        payment_status: 'rechazado'
      })
      .eq('group_id', groupId);

    // Update transaction if exists
    await req.supabase
      .from('payment_transactions')
      .update({
        status: 'rejected'
      })
      .eq('group_id', groupId)
      .eq('status', 'pending');

    // Release inventory reservations
    await req.supabase
      .from('inventory_reservations')
      .update({ status: 'released' })
      .eq('group_id', groupId)
      .eq('status', 'active');

    // Log the rejection reason
    await req.supabase
      .from('payment_errors')
      .insert({
        group_id: groupId,
        error_code: 'ADMIN_REJECTION',
        error_message: reason,
        error_details: { rejected_by: req.user.email }
      });

    res.json({
      success: true,
      message: 'Pago rechazado',
      groupId
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get payment statistics (admin, administracion, boss)
router.get('/stats/summary', authenticateToken, requireAnyPermission(
  { resource: 'payments', action: 'manage' },
  { resource: 'payments', action: 'view_reports' },
  { resource: 'dashboard', action: 'view_boss' }
), async (req, res) => {
  try {
    // Get group payment statistics
    const { data: groupStats } = await req.supabase
      .from('registration_groups')
      .select('payment_status, payment_method, total_runners');

    // Get transaction statistics
    const { data: transactionStats } = await req.supabase
      .from('payment_transactions')
      .select('status, amount_usd, amount_bs, exchange_rate');

    // Get price configuration
    const { data: priceConfig } = await req.supabase
      .from('gateway_config')
      .select('config_value')
      .eq('config_key', 'race_price_usd')
      .single();

    const pricePerRunner = parseFloat(priceConfig?.config_value || '55.00');

    // Process statistics
    const stats = {
      groups: {
        total: groupStats?.length || 0,
        byStatus: {
          pendiente: 0,
          confirmado: 0,
          rechazado: 0,
          procesando: 0
        },
        byMethod: {
          tienda: 0,
          zelle: 0,
          transferencia_nacional: 0,
          transferencia_internacional: 0,
          paypal: 0,
          pago_movil_p2c: 0
        },
        totalRunners: 0,
        confirmedRunners: 0
      },
      transactions: {
        total: transactionStats?.length || 0,
        byStatus: {
          pending: 0,
          approved: 0,
          rejected: 0,
          failed: 0,
          cancelled: 0
        },
        totalUSD: 0,
        totalBs: 0,
        avgExchangeRate: 0
      },
      revenue: {
        potentialUSD: 0,
        confirmedUSD: 0,
        pendingUSD: 0
      }
    };

    // Process group data
    groupStats?.forEach(group => {
      // By status
      if (stats.groups.byStatus[group.payment_status] !== undefined) {
        stats.groups.byStatus[group.payment_status]++;
      }
      
      // By method
      if (stats.groups.byMethod[group.payment_method] !== undefined) {
        stats.groups.byMethod[group.payment_method]++;
      }
      
      // Runners count
      stats.groups.totalRunners += group.total_runners;
      if (group.payment_status === 'confirmado') {
        stats.groups.confirmedRunners += group.total_runners;
        stats.revenue.confirmedUSD += group.total_runners * pricePerRunner;
      } else if (group.payment_status === 'pendiente' || group.payment_status === 'procesando') {
        stats.revenue.pendingUSD += group.total_runners * pricePerRunner;
      }
      
      stats.revenue.potentialUSD += group.total_runners * pricePerRunner;
    });

    // Process transaction data
    let totalExchangeRate = 0;
    let exchangeRateCount = 0;

    transactionStats?.forEach(transaction => {
      // By status
      if (stats.transactions.byStatus[transaction.status] !== undefined) {
        stats.transactions.byStatus[transaction.status]++;
      }
      
      // Amounts
      if (transaction.status === 'approved') {
        stats.transactions.totalUSD += parseFloat(transaction.amount_usd || 0);
        stats.transactions.totalBs += parseFloat(transaction.amount_bs || 0);
      }
      
      // Exchange rate average
      if (transaction.exchange_rate) {
        totalExchangeRate += parseFloat(transaction.exchange_rate);
        exchangeRateCount++;
      }
    });

    if (exchangeRateCount > 0) {
      stats.transactions.avgExchangeRate = (totalExchangeRate / exchangeRateCount).toFixed(4);
    }

    // Get current exchange rate
    const { data: currentRate } = await req.supabase
      .from('exchange_rates')
      .select('rate, date, source')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    stats.currentExchangeRate = currentRate;
    stats.pricePerRunner = pricePerRunner;

    res.json(stats);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get payment methods summary (admin, administracion, boss)
router.get('/stats/methods', authenticateToken, requireAnyPermission(
  { resource: 'payments', action: 'manage' },
  { resource: 'payments', action: 'view_reports' },
  { resource: 'dashboard', action: 'view_boss' }
), async (req, res) => {
  try {
    const { data: methodStats } = await req.supabase
      .from('registration_groups')
      .select('payment_method, payment_status, total_runners')
      .eq('payment_status', 'confirmado');

    const summary = {};
    let totalRunners = 0;
    
    methodStats?.forEach(group => {
      if (!summary[group.payment_method]) {
        summary[group.payment_method] = {
          groups: 0,
          runners: 0
        };
      }
      summary[group.payment_method].groups++;
      summary[group.payment_method].runners += group.total_runners;
      totalRunners += group.total_runners;
    });

    // Calculate percentages
    Object.keys(summary).forEach(method => {
      summary[method].percentage = ((summary[method].runners / totalRunners) * 100).toFixed(2);
    });

    res.json({ 
      methods: summary,
      totalRunners 
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get pending payments (admin, administracion, boss)
router.get('/pending', authenticateToken, requireAnyPermission(
  { resource: 'payments', action: 'manage' },
  { resource: 'payments', action: 'read' },
  { resource: 'dashboard', action: 'view_boss' }
), async (req, res) => {
  try {
    const { data: pendingGroups, error } = await req.supabase
      .from('runner_group_summary')
      .select('*')
      .in('payment_status', ['pendiente', 'procesando'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending payments:', error);
      return res.status(500).json({ message: 'Error al obtener pagos pendientes' });
    }

    // Separate active reservations from expired
    const now = new Date();
    const activeReservations = [];
    const expiredReservations = [];

    pendingGroups?.forEach(group => {
      if (group.reserved_until && new Date(group.reserved_until) > now) {
        activeReservations.push(group);
      } else {
        expiredReservations.push(group);
      }
    });

    res.json({ 
      activeReservations,
      expiredReservations,
      total: pendingGroups?.length || 0
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Process manual payment (admin, administracion only)
router.post('/manual', authenticateToken, requireAnyPermission(
  { resource: 'payments', action: 'manage' },
  { resource: 'payments', action: 'confirm' }
), async (req, res) => {
  try {
    const { groupId, paymentMethod, reference, notes } = req.body;

    if (!groupId || !paymentMethod || !reference) {
      return res.status(400).json({ 
        message: 'Grupo, método de pago y referencia son requeridos' 
      });
    }

    // Verify group exists and is pending
    const { data: group, error: groupError } = await req.supabase
      .from('registration_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    if (group.payment_status === 'confirmado') {
      return res.status(400).json({ message: 'Este grupo ya tiene pago confirmado' });
    }

    // Update payment method and reference
    await req.supabase
      .from('registration_groups')
      .update({
        payment_method: paymentMethod,
        payment_reference: reference
      })
      .eq('id', groupId);

    // Create manual transaction record
    const { data: priceConfig } = await req.supabase
      .from('gateway_config')
      .select('config_value')
      .eq('config_key', 'race_price_usd')
      .single();

    const pricePerRunner = parseFloat(priceConfig?.config_value || '55.00');
    const totalAmount = pricePerRunner * group.total_runners;

    await req.supabase
      .from('payment_transactions')
      .insert({
        group_id: groupId,
        amount_usd: totalAmount,
        status: 'approved',
        reference: reference,
        gateway_response: { manual: true, notes, processed_by: req.user.email }
      });

    // Confirm the payment
    const { error: confirmError } = await req.supabase
      .rpc('confirm_group_payment', {
        p_group_id: groupId,
        p_confirmed_by: req.user.id
      });

    if (confirmError) {
      throw confirmError;
    }

    res.json({
      success: true,
      message: 'Pago manual procesado exitosamente',
      groupId
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Procesar pago directo en tienda
router.post('/store/confirm', authenticateToken, requirePermission('runners', 'register_store'), async (req, res) => {
  try {
    const {
      group_id,
      payment_method,
      terminal_reference,
      amount_received_bs,
      amount_received_usd
    } = req.body;

    // Validar que es un método de tienda
    const storePaymentMethods = [
      'tarjeta_debito', 
      'tarjeta_credito', 
      'efectivo_bs', 
      'efectivo_usd',
      'transferencia_nacional_tienda',
      'transferencia_internacional_tienda',
      'zelle_tienda',
      'paypal_tienda'
    ];

    if (!storePaymentMethods.includes(payment_method)) {
      return res.status(400).json({
        message: 'Método de pago inválido para tienda'
      });
    }

    // Procesar pago
    const PaymentProcessor = new PaymentProcessorService(req.supabase);
    const result = await PaymentProcessor.processStorePayment({
      group_id,
      payment_method,
      reference: terminal_reference || `STORE-${Date.now()}`,
      amount_usd: amount_received_usd,
      amount_bs: amount_received_bs
    }, req.user.id);

    res.json({
      success: true,
      message: 'Pago confirmado exitosamente',
      result
    });

  } catch (error) {
    console.error('Store payment error:', error);
    res.status(500).json({
      message: 'Error procesando pago en tienda',
      error: error.message
    });
  }
});

// Registrar obsequio exonerado
router.post('/boss/gift', authenticateToken, requirePermission('runners', 'register_gift'), async (req, res) => {
  try {
    const {
      group_id,
      employee_id,
      authorization_reason
    } = req.body;

    // Verificar que el usuario tiene rol boss
    if (req.user.role !== 'boss') {
      return res.status(403).json({
        message: 'Solo personal de RRHH puede registrar obsequios'
      });
    }

    // Procesar como obsequio
    const PaymentProcessor = new PaymentProcessorService(req.supabase);
    const result = await PaymentProcessor.processGiftPayment(
      group_id, 
      req.user.id
    );

    // Registrar evento especial
    await req.supabase
      .from('payment_events')
      .insert({
        group_id,
        event_type: 'gift_authorized',
        event_data: {
          authorized_by: req.user.email,
          employee_id,
          reason: authorization_reason
        }
      });

    res.json({
      success: true,
      message: 'Obsequio registrado exitosamente',
      result
    });

  } catch (error) {
    console.error('Gift payment error:', error);
    res.status(500).json({
      message: 'Error registrando obsequio',
      error: error.message
    });
  }
});

export default router;