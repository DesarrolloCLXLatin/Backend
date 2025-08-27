// server/routes/tickets.js
import express from 'express';
import { TicketsController } from '../controllers/TicketsController.js';
import { authenticateToken, requirePermission, requireAnyPermission, enrichUserData } from '../middleware/auth.js';

const router = express.Router();
const ticketsController = new TicketsController();

// Get tickets dashboard statistics (admin, boss)
router.get('/stats', 
  authenticateToken, 
  requireAnyPermission(
  { resource: 'tickets', action: 'manage' },
  { resource: 'dashboard', action: 'view_boss' }
const ticketsController = new TicketsController();

// ===== RUTAS USANDO CONTROLADORES =====

// Rutas públicas
router.get('/payment-methods', ticketsController.getPaymentMethods);
router.get('/inventory', ticketsController.getInventory);

// Rutas administrativas
router.get('/stats', 
  authenticateToken, 
  requireAnyPermission(
    { resource: 'tickets', action: 'manage' },
    { resource: 'dashboard', action: 'view_boss' }
  ), 
  ticketsController.getStats
);

router.get('/quick-stats', 
  authenticateToken, 
  enrichUserData, 
  ticketsController.getQuickStats
);

// CRUD de tickets
router.post('/', 
  authenticateToken, 
  requireAnyPermission(
    { resource: 'tickets', action: 'create' },
    { resource: 'tickets', action: 'sell' }
  ), 
  ticketsController.createTickets
);

router.get('/', 
  authenticateToken, 
  requireAnyPermission(
    { resource: 'tickets', action: 'read' },
    { resource: 'tickets', action: 'manage' },
    { resource: 'payments', action: 'read' }
  ), 
  ticketsController.getTickets
);

router.get('/my-tickets', 
  authenticateToken, 
  ticketsController.getMyTickets
);

router.get('/:ticketId', 
  authenticateToken, 
  enrichUserData, 
  ticketsController.getTicketDetails
);

// Operaciones de tickets
router.patch('/:ticketId/payment', 
  authenticateToken, 
  requireAnyPermission(
    { resource: 'tickets', action: 'update' },
    { resource: 'payments', action: 'confirm' }
  ), 
  ticketsController.updatePaymentStatus
);

router.post('/:ticketId/redeem', 
  authenticateToken, 
  requireAnyPermission(
    { resource: 'tickets', action: 'update' },
    { resource: 'tickets', action: 'sell' }
  ), 
  ticketsController.redeemTicket
);

router.post('/verify', 
  authenticateToken, 
  requireAnyPermission(
    { resource: 'tickets', action: 'read' },
    { resource: 'tickets', action: 'sell' }
  ), 
  ticketsController.verifyTicket
);

// Get store dashboard for tickets
router.get('/store', authenticateToken, requirePermission('tickets', 'sell'), async (req, res) => {
  try {
    // Get tickets sold by this store user
    const { data: storeTickets, count } = await req.supabase
      .from('concert_tickets')
      .select('*', { count: 'exact' })
      .eq('sold_by', req.user.id)
      .order('created_at', { ascending: false });

    // Count by payment status
    const statusCounts = {
      pendiente: 0,
      confirmado: 0,
      rechazado: 0
    };

    storeTickets?.forEach(ticket => {
      if (ticket.payment_status in statusCounts) {
        statusCounts[ticket.payment_status]++;
      }
    });

    // Calculate revenue for this store
    const TICKET_PRICE = 15.00;
    const storeRevenue = statusCounts.confirmado * TICKET_PRICE;

    // Get today's sales
    const today = new Date().toISOString().split('T')[0];
    const todaySales = storeTickets?.filter(t => 
      t.created_at.startsWith(today)
    ).length || 0;

    // Get this week's sales
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekSales = storeTickets?.filter(t => 
      new Date(t.created_at) >= weekStart
    ).length || 0;

    // Get inventory status
    const { data: inventory } = await req.supabase
      .from('ticket_inventory')
      .select('*')
      .single();

    res.json({
      totalSales: count || 0,
      confirmedSales: statusCounts.confirmado,
      pendingSales: statusCounts.pendiente,
      rejectedSales: statusCounts.rechazado,
      
      // Revenue
      storeRevenueUSD: storeRevenue,
      ticketPrice: TICKET_PRICE,
      
      // Time-based stats
      todaySales,
      weekSales,
      
      // Inventory status
      availableTickets: inventory?.available_tickets || 0,
      
      // Recent sales (últimos 20 tickets)
      recentTickets: storeTickets?.slice(0, 20).map(t => ({
        id: t.id,
        ticket_number: t.ticket_number,
        buyer_name: t.buyer_name,
        buyer_email: t.buyer_email,
        payment_status: t.payment_status,
        payment_method: t.payment_method,
        created_at: t.created_at
      })) || []
    });

  } catch (error) {
    console.error('Store tickets dashboard error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

    const { data: currentTicket } = await req.supabase
      .from('concert_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (!currentTicket) {
      return res.status(404).json({ message: 'Entrada no encontrada' });
    }

    const updateData = {
      payment_status,
      payment_reference: payment_reference || null,
      notes
    };

    // If confirming payment
    if (payment_status === 'confirmado' && currentTicket.payment_status !== 'confirmado') {
      updateData.confirmed_by = req.user.id;
      updateData.confirmed_at = new Date().toISOString();

      // Convert reservation to sale
      await req.supabase.rpc('confirm_ticket_sale', { quantity: 1 });
    }

    // Update ticket
    const { data: ticket, error } = await req.supabase
      .from('concert_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      console.error('Error updating ticket:', error);
      return res.status(500).json({ 
        message: 'Error al actualizar entrada' 
      });
    }

    // Create/update payment record
    if (payment_status === 'confirmado') {
      await req.supabase
        .from('ticket_payments')
        .upsert({
          ticket_id: ticketId,
          payment_method: ticket.payment_method,
          payment_reference,
          status: 'confirmado',
          confirmed_by: req.user.id,
          confirmed_at: new Date().toISOString(),
          notes
        });

      // Send email if not already sent
      if (!ticket.receipt_sent) {
        try {
          const receiptBuffer = await generateTicketReceipt(ticket);
          await sendTicketEmail(ticket.buyer_email, ticket.buyer_name, [ticket], receiptBuffer);
          
          // Mark receipt as sent
          await req.supabase
            .from('concert_tickets')
            .update({ receipt_sent: true })
            .eq('id', ticketId);
        } catch (emailError) {
          console.error('Error sending ticket email:', emailError);
        }
      }
    }

    res.json({
      message: 'Estado de pago actualizado',
      ticket
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Redeem ticket (admin, boss, tienda)
router.post('/:ticketId/redeem', authenticateToken, requireAnyPermission(
  { resource: 'tickets', action: 'update' },
  { resource: 'tickets', action: 'sell' }
), async (req, res) => {
  try {
    const { ticketId } = req.params;

    // Get ticket
    const { data: ticket, error: fetchError } = await req.supabase
      .from('concert_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (fetchError || !ticket) {
      return res.status(404).json({ message: 'Entrada no encontrada' });
    }

    // Check if already redeemed
    if (ticket.ticket_status === 'canjeado') {
      return res.status(400).json({ 
        message: 'Esta entrada ya fue canjeada',
        redeemed_at: ticket.redeemed_at
      });
    }

    // Check if payment is confirmed
    if (ticket.payment_status !== 'confirmado') {
      return res.status(400).json({ 
        message: 'No se puede canjear una entrada sin pago confirmado' 
      });
    }

    // Update ticket status
    const { data: updatedTicket, error: updateError } = await req.supabase
      .from('concert_tickets')
      .update({
        ticket_status: 'canjeado',
        redeemed_at: new Date().toISOString(),
        redeemed_by: req.user.id
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (updateError) {
      console.error('Error redeeming ticket:', updateError);
      return res.status(500).json({ 
        message: 'Error al canjear entrada' 
      });
    }

    res.json({
      message: 'Entrada canjeada exitosamente',
      ticket: updatedTicket
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Verify ticket by QR or barcode
router.post('/verify', authenticateToken, requireAnyPermission(
  { resource: 'tickets', action: 'read' },
  { resource: 'tickets', action: 'sell' }
), async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ 
        message: 'Código es requerido' 
      });
    }

    // Search ticket by QR or barcode
    const { data: ticket, error } = await req.supabase
      .from('concert_tickets')
      .select('*')
      .or(`qr_code.eq.${code},barcode.eq.${code}`)
      .single();

    if (error || !ticket) {
      return res.status(404).json({ 
        message: 'Entrada no encontrada',
        valid: false 
      });
    }

    const response = {
      valid: ticket.payment_status === 'confirmado' && ticket.ticket_status !== 'cancelado',
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        buyer_name: ticket.buyer_name,
        payment_status: ticket.payment_status,
        ticket_status: ticket.ticket_status,
        redeemed_at: ticket.redeemed_at
      }
    };

    // Add warning if already redeemed
    if (ticket.ticket_status === 'canjeado') {
      response.warning = 'Esta entrada ya fue canjeada';
      response.redeemed_at = ticket.redeemed_at;
    }

    res.json(response);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Resend ticket email - accesible por todos los usuarios autenticados
router.post('/:ticketId/resend-email', authenticateToken, enrichUserData, async (req, res) => {
  try {
    const { ticketId } = req.params;

    // Get ticket
    const { data: ticket, error } = await req.supabase
      .from('concert_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (error || !ticket) {
      return res.status(404).json({ message: 'Entrada no encontrada' });
    }

    // Check permissions
    const hasManagePermission = req.user.permissions.some(p => 
      ['tickets:manage', 'tickets:sell'].includes(p)
    );

    if (!hasManagePermission && ticket.buyer_email !== req.user.email) {
      return res.status(403).json({ 
        message: 'No tienes permisos para reenviar esta entrada' 
      });
    }

    // Only send confirmed tickets
    if (ticket.payment_status !== 'confirmado') {
      return res.status(400).json({ 
        message: 'Solo se pueden enviar entradas confirmadas' 
      });
    }

    // Send email
    try {
      const receiptBuffer = await generateTicketReceipt(ticket);
      await sendTicketEmail(ticket.buyer_email, ticket.buyer_name, [ticket], receiptBuffer);
      
      // Update receipt sent status
      await req.supabase
        .from('concert_tickets')
        .update({ receipt_sent: true })
        .eq('id', ticketId);

      res.json({
        message: 'Email enviado exitosamente',
        sent_to: ticket.buyer_email
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      res.status(500).json({ 
        message: 'Error al enviar email',
        error: emailError.message 
      });
    }

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get charts data for tickets (admin, boss)
router.get('/charts', authenticateToken, requireAnyPermission(
  { resource: 'tickets', action: 'manage' },
  { resource: 'dashboard', action: 'view_boss' }
), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Get tickets for the period
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const { data: tickets } = await req.supabase
      .from('concert_tickets')
      .select('created_at, payment_status, payment_method')
      .gte('created_at', startDate.toISOString());

    // Group by day
    const dailySales = {};
    const today = new Date();
    for (let i = parseInt(days) - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailySales[dateStr] = {
        date: dateStr,
        total: 0,
        confirmed: 0,
        pending: 0
      };
    }

    tickets?.forEach(ticket => {
      const dateStr = ticket.created_at.split('T')[0];
      if (dailySales[dateStr]) {
        dailySales[dateStr].total++;
        if (ticket.payment_status === 'confirmado') {
          dailySales[dateStr].confirmed++;
        } else if (ticket.payment_status === 'pendiente') {
          dailySales[dateStr].pending++;
        }
      }
    });

    // Payment methods distribution
    const methodCount = {};
    tickets?.forEach(ticket => {
      if (ticket.payment_status === 'confirmado') {
        methodCount[ticket.payment_method] = (methodCount[ticket.payment_method] || 0) + 1;
      }
    });

    // Hourly distribution (for today)
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: todayTickets } = await req.supabase
      .from('concert_tickets')
      .select('created_at')
      .gte('created_at', todayStr);

    const hourlyDistribution = Array(24).fill(0);
    todayTickets?.forEach(ticket => {
      const hour = new Date(ticket.created_at).getHours();
      hourlyDistribution[hour]++;
    });

    res.json({
      dailySales: Object.values(dailySales),
      paymentMethods: methodCount,
      hourlyDistribution: hourlyDistribution.map((count, hour) => ({
        hour: `${hour}:00`,
        sales: count
      })),
      chartData: {
        daily: Object.values(dailySales)
      }
    });

  } catch (error) {
    console.error('Charts data error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Quick stats for tickets - accesible por todos los usuarios autenticados
router.get('/quick-stats', authenticateToken, enrichUserData, async (req, res) => {
  try {
    let stats = {};
    const userPermissions = req.user.permissions || [];

    if (userPermissions.some(p => ['tickets:manage', 'dashboard:view_boss'].includes(p))) {
      // Admin/Boss sees global tickets stats
      const { data: inventory } = await req.supabase
        .from('ticket_inventory')
        .select('*')
        .single();

      const { count: pendingTickets } = await req.supabase
        .from('concert_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'pendiente');

      const { count: todaySales } = await req.supabase
        .from('concert_tickets')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().split('T')[0]);

      stats = {
        availableTickets: inventory?.available_tickets || 0,
        soldTickets: inventory?.sold_tickets || 0,
        pendingTickets: pendingTickets || 0,
        todaySales: todaySales || 0,
        capacity: inventory?.total_tickets || 5000
      };

    } else if (userPermissions.includes('tickets:sell')) {
      // Store sees their tickets stats
      const { count: storeSales } = await req.supabase
        .from('concert_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('sold_by', req.user.id);

      const { count: todayStoreSales } = await req.supabase
        .from('concert_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('sold_by', req.user.id)
        .gte('created_at', new Date().toISOString().split('T')[0]);

      stats = {
        totalSales: storeSales || 0,
        todaySales: todayStoreSales || 0
      };

    } else {
      // Regular user sees their tickets
      const { count: myTickets } = await req.supabase
        .from('concert_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_email', req.user.email);

      const { count: pendingPayments } = await req.supabase
        .from('concert_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_email', req.user.email)
        .eq('payment_status', 'pendiente');

      stats = {
        myTickets: myTickets || 0,
        pendingPayments: pendingPayments || 0
      };
    }

    res.json(stats);

  } catch (error) {
    console.error('Quick stats error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

export default router;