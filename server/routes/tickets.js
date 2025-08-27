// server/routes/tickets.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requirePermission, requireAnyPermission, enrichUserData } from '../middleware/auth.js';
import { 
  generateTicketReceipt, 
  sendTicketEmail, 
  generateQRCode, 
  generateBarcode, 
  handlePaymentEmailFlow,
  processManualPaymentConfirmation,
  resendTicketEmail
} from '../utils/ticketUtils.js';

const router = express.Router();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get payment methods - público
router.get('/payment-methods', async (req, res) => {
  try {
    const methods = [
      { value: 'tienda', label: 'Pago en Tienda', available: true },
      { value: 'zelle', label: 'Zelle', available: true },
      { value: 'transferencia', label: 'Transferencia Bancaria', available: true },
      { value: 'tarjeta', label: 'Tarjeta de Crédito/Débito', available: false },
      { value: 'pago_movil', label: 'Pago Móvil P2C', available: true }
    ];

    // Si el usuario tiene permisos de venta, puede confirmar directamente
    if (req.user?.permissions?.some(p => ['tickets:sell', 'tickets:manage'].includes(p))) {
      methods.forEach(m => {
        if (m.value !== 'tarjeta') {
          m.directConfirmation = true;
        }
      });
    }

    res.json(methods);
  } catch (error) {
    console.error('Payment methods error:', error);
    res.status(500).json({ message: 'Error al obtener métodos de pago' });
  }
});

// Get tickets dashboard statistics (admin, boss)
router.get('/stats', authenticateToken, requireAnyPermission(
  { resource: 'tickets', action: 'manage' },
  { resource: 'dashboard', action: 'view_boss' }
), async (req, res) => {
  try {
    // Get total tickets with ALL fields needed including ticket_type
    const { data: tickets, count: totalTickets } = await req.supabase
      .from('concert_tickets')
      .select('payment_status, payment_method, ticket_status, ticket_type, ticket_price', { count: 'exact' });
    
    // Get venue statistics (boxes info)
    const { data: venueStats } = await req.supabase
      .rpc('get_venue_statistics');

    // Initialize counters
    const paymentStatusCounts = {
      pendiente: 0,
      confirmado: 0,
      rechazado: 0
    };

    const ticketStatusCounts = {
      vendido: 0,
      canjeado: 0,
      cancelado: 0
    };

    const methodCounts = {
      tienda: 0,
      zelle: 0,
      transferencia: 0,
      tarjeta: 0,
      pago_movil: 0
    };

    const ticketTypeCounts = {
      general: 0,
      box: 0,
      vip: 0
    };

    // Count tickets by different categories
    tickets?.forEach(ticket => {
      // Count by payment status
      if (ticket.payment_status in paymentStatusCounts) {
        paymentStatusCounts[ticket.payment_status]++;
      }
      
      // Count by ticket status
      if (ticket.ticket_status in ticketStatusCounts) {
        ticketStatusCounts[ticket.ticket_status]++;
      }
      
      // Count by payment method
      if (ticket.payment_method in methodCounts) {
        methodCounts[ticket.payment_method]++;
      }
      
      // Count by ticket type (if field exists)
      if (ticket.ticket_type && ticket.ticket_type in ticketTypeCounts) {
        ticketTypeCounts[ticket.ticket_type]++;
      }
    });

    // Calculate revenue based on ticket types and prices
    const TICKET_PRICE_GENERAL = 35.00;
    const BOX_PRICE = 75.00;
    const OLD_TICKET_PRICE = 15.00; // Para tickets antiguos sin tipo
    
    // Calculate revenue from venue stats (más confiable para boxes)
    const boxRevenue = (venueStats?.boxes?.sold_boxes || 0) * BOX_PRICE;
    const generalRevenue = (venueStats?.general_zone?.sold || 0) * TICKET_PRICE_GENERAL;
    
    // Calculate revenue from confirmed tickets (respaldo)
    let ticketBasedRevenue = 0;
    tickets?.forEach(ticket => {
      if (ticket.payment_status === 'confirmado') {
        if (ticket.ticket_price) {
          ticketBasedRevenue += parseFloat(ticket.ticket_price);
        } else if (ticket.ticket_type === 'general') {
          ticketBasedRevenue += TICKET_PRICE_GENERAL;
        } else if (ticket.ticket_type === 'box') {
          ticketBasedRevenue += BOX_PRICE / 10; // Box dividido entre 10 personas
        } else {
          ticketBasedRevenue += OLD_TICKET_PRICE; // Precio antiguo por defecto
        }
      }
    });

    // Usar el mayor entre los dos cálculos (por si hay discrepancias)
    const totalRevenueUSD = Math.max(
      boxRevenue + generalRevenue,
      ticketBasedRevenue
    );

    // Get current exchange rate
    const { data: currentRate } = await req.supabase
      .from('exchange_rates')
      .select('rate, date')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    const totalRevenueBs = currentRate ? totalRevenueUSD * currentRate.rate : 0;

    // Get ticket inventory
    const { data: inventory } = await req.supabase
      .from('ticket_inventory')
      .select('*')
      .single();

    // Get today's sales
    const today = new Date().toISOString().split('T')[0];
    const { data: todayTickets } = await req.supabase
      .from('concert_tickets')
      .select('id, payment_status, ticket_type')
      .gte('created_at', today);

    const todaySales = todayTickets?.length || 0;
    const todayConfirmed = todayTickets?.filter(t => t.payment_status === 'confirmado').length || 0;
    const todayBoxes = todayTickets?.filter(t => t.ticket_type === 'box').length || 0;
    const todayGeneral = todayTickets?.filter(t => t.ticket_type === 'general').length || 0;

    // Get last 7 days sales for trend
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: weekTickets } = await req.supabase
      .from('concert_tickets')
      .select('created_at, payment_status, ticket_type')
      .gte('created_at', sevenDaysAgo.toISOString());

    // Group by day for chart
    const dailySales = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailySales[dateStr] = {
        date: dateStr,
        total: 0,
        confirmed: 0,
        pending: 0,
        boxes: 0,
        general: 0
      };
    }

    weekTickets?.forEach(ticket => {
      const dateStr = ticket.created_at.split('T')[0];
      if (dailySales[dateStr]) {
        dailySales[dateStr].total++;
        if (ticket.payment_status === 'confirmado') {
          dailySales[dateStr].confirmed++;
        } else if (ticket.payment_status === 'pendiente') {
          dailySales[dateStr].pending++;
        }
        // Contar por tipo
        if (ticket.ticket_type === 'box') {
          dailySales[dateStr].boxes++;
        } else if (ticket.ticket_type === 'general') {
          dailySales[dateStr].general++;
        }
      }
    });

    // Get sellers statistics
    const { data: sellers } = await req.supabase
      .from('concert_tickets')
      .select('sold_by, users!sold_by(email, full_name)')
      .not('sold_by', 'is', null);
      
    const sellerStats = {};
    sellers?.forEach(ticket => {
      const sellerId = ticket.sold_by;
      const sellerName = ticket.users?.full_name || ticket.users?.email?.split('@')[0] || 'Unknown';
      if (!sellerStats[sellerId]) {
        sellerStats[sellerId] = {
          name: sellerName,
          email: ticket.users?.email,
          totalSales: 0
        };
      }
      sellerStats[sellerId].totalSales++;
    });

    // Response structure
    res.json({
      // Main dashboard stats
      totalTickets: totalTickets || 0,
      confirmedTickets: paymentStatusCounts.confirmado,
      pendingTickets: paymentStatusCounts.pendiente,
      rejectedTickets: paymentStatusCounts.rechazado,
      redeemedTickets: ticketStatusCounts.canjeado,
      
      // Revenue (usando el cálculo más confiable)
      totalRevenueUSD,
      totalRevenueBs,
      exchangeRate: currentRate?.rate || 0,
      
      // Inventory from venue stats (más confiable)
      totalCapacity: venueStats?.summary?.total_capacity || inventory?.total_capacity || 5270,
      soldTickets: venueStats?.summary?.total_sold || inventory?.sold_count || 0,
      reservedTickets: inventory?.reserved_count || 0,
      availableTickets: venueStats?.summary?.total_available || inventory?.available_count || 5170,

      // Estadísticas de boxes
      boxes: {
        total: venueStats?.boxes?.total_boxes || 30,
        sold: venueStats?.boxes?.sold_boxes || 0,
        reserved: venueStats?.boxes?.reserved_boxes || 0,
        available: venueStats?.boxes?.available_boxes || 20,
        revenue: boxRevenue,
        details: venueStats?.boxes?.boxes_detail || []
      },
      
      // Estadísticas de zona general
      general: {
        capacity: venueStats?.general_zone?.total_capacity || 4970,
        sold: venueStats?.general_zone?.sold || 0,
        available: venueStats?.general_zone?.available || 4970,
        price: TICKET_PRICE_GENERAL,
        revenue: generalRevenue
      },
      
      // Estadísticas por tipo de ticket
      ticketTypes: ticketTypeCounts,
      
      // Capacidad total del venue
      venue: {
        totalCapacity: venueStats?.summary?.total_capacity || 5270,
        totalSold: venueStats?.summary?.total_sold || 0,
        totalAvailable: venueStats?.summary?.total_available || 5170,
        occupancyRate: venueStats?.summary?.total_capacity ? 
          ((venueStats?.summary?.total_sold || 0) / venueStats?.summary?.total_capacity * 100).toFixed(2) : 0
      },
      
      // Revenue breakdown
      revenueBreakdown: {
        general: generalRevenue,
        boxes: boxRevenue,
        total: totalRevenueUSD,
        inBs: totalRevenueBs
      },
      
      // Detailed stats
      stats: {
        paymentStatus: paymentStatusCounts,
        ticketStatus: ticketStatusCounts,
        paymentMethods: methodCounts,
        
        // Today's stats
        today: {
          totalSales: todaySales,
          confirmed: todayConfirmed,
          boxes: todayBoxes,
          general: todayGeneral
        },
        
        // Weekly trend
        weeklyTrend: Object.values(dailySales),
        
        // Top sellers
        topSellers: Object.values(sellerStats)
          .sort((a, b) => b.totalSales - a.totalSales)
          .slice(0, 5)
      }
    });

  } catch (error) {
    console.error('Tickets dashboard error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

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

// Get user's tickets - accesible por todos los usuarios autenticados
router.get('/my-tickets', authenticateToken, async (req, res) => {
  try {
    const { data: tickets, error } = await req.supabase
      .from('concert_tickets')
      .select('*')
      .eq('buyer_email', req.user.email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tickets:', error);
      return res.status(500).json({ message: 'Error obteniendo tus entradas' });
    }

    // Calculate summary
    const summary = {
      totalTickets: tickets?.length || 0,
      confirmed: tickets?.filter(t => t.payment_status === 'confirmado').length || 0,
      pending: tickets?.filter(t => t.payment_status === 'pendiente').length || 0,
      redeemed: tickets?.filter(t => t.ticket_status === 'canjeado').length || 0
    };

    res.json({ 
      tickets: tickets || [],
      summary 
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get inventory - público
router.get('/inventory', async (req, res) => {
  try {
    const { data: inventory, error } = await supabaseAdmin
      .from('ticket_inventory')
      .select('*')
      .single();

    if (error) {
      console.error('Error fetching inventory:', error);
      return res.status(500).json({ message: 'Error obteniendo inventario' });
    }

    res.json(inventory || {
      total_tickets: 5000,
      sold_tickets: 0,
      reserved_tickets: 0,
      available_tickets: 5000
    });

  } catch (error) {
    console.error('Inventory error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Create new ticket(s) (tienda, admin, boss)
router.post('/', authenticateToken, requireAnyPermission(
  { resource: 'tickets', action: 'create' },
  { resource: 'tickets', action: 'sell' }
), async (req, res) => {
  try {
    const {
      buyer_name,
      buyer_email,
      buyer_phone,
      buyer_identification,
      payment_method,
      payment_reference,
      quantity = 1,
      // Nuevos campos para pago móvil
      client_phone,
      client_bank_code
    } = req.body;

    // Validar campos requeridos
    if (!buyer_name || !buyer_email || !buyer_phone || !buyer_identification || !payment_method) {
      return res.status(400).json({ 
        message: 'Todos los campos del comprador son requeridos' 
      });
    }

    // Validar cantidad
    if (quantity < 1 || quantity > 10) {
      return res.status(400).json({ 
        message: 'La cantidad debe estar entre 1 y 10 entradas' 
      });
    }

    // Si es pago móvil y el usuario no tiene permisos de venta directa
    if (payment_method === 'pago_movil' && !req.user.permissions.includes('tickets:sell')) {
      // Validar campos adicionales para pago móvil
      if (!client_phone || !client_bank_code) {
        return res.status(400).json({ 
          message: 'Para pago móvil se requiere teléfono y banco del cliente' 
        });
      }

      // Redirigir al flujo de pago móvil
      return res.status(200).json({
        message: 'Proceda con el pago móvil',
        requiresPayment: true,
        paymentMethod: 'pago_movil',
        ticketData: {
          tickets: Array(quantity).fill({
            buyer_name,
            buyer_email,
            buyer_phone,
            buyer_identification
          }),
          client_phone,
          client_bank_code
        },
        nextStep: '/api/tickets/payment/pago-movil/initiate'
      });
    }

    // Para usuarios con permisos de venta con pago móvil, permitir confirmación directa
    if (payment_method === 'pago_movil' && req.user.permissions.includes('tickets:sell')) {
      if (!payment_reference) {
        return res.status(400).json({ 
          message: 'Referencia de pago es requerida para confirmar pago móvil' 
        });
      }
    }

    // Verificar disponibilidad de tickets
    const { data: inventory } = await req.supabase
      .from('ticket_inventory')
      .select('available_tickets')
      .single();

    if (!inventory || inventory.available_tickets < quantity) {
      return res.status(400).json({ 
        message: `No hay suficientes entradas disponibles. Disponibles: ${inventory?.available_tickets || 0}` 
      });
    }

    // Reservar tickets en inventario
    const { data: reserved, error: reserveError } = await req.supabase
      .rpc('reserve_ticket_inventory', { quantity });

    if (reserveError || !reserved) {
      return res.status(400).json({ 
        message: 'No se pudieron reservar las entradas' 
      });
    }

    const createdTickets = [];
    const isConfirmed = payment_method === 'tienda' || 
                        (payment_method === 'pago_movil' && req.user.permissions.includes('tickets:sell'));

    try {
      // Crear múltiples tickets
      for (let i = 0; i < quantity; i++) {
        // Generar códigos únicos
        const { data: ticketNumber } = await req.supabase.rpc('generate_ticket_number');
        const { data: qrCode } = await req.supabase.rpc('generate_qr_code');
        const { data: barcode } = await req.supabase.rpc('generate_barcode');

        // Crear ticket
        const { data: ticket, error: ticketError } = await req.supabase
          .from('concert_tickets')
          .insert({
            ticket_number: ticketNumber,
            qr_code: qrCode,
            barcode,
            buyer_name,
            buyer_email,
            buyer_phone,
            buyer_identification,
            payment_method,
            payment_reference,
            payment_status: isConfirmed ? 'confirmado' : 'pendiente',
            sold_by: req.user.id,
            confirmed_by: isConfirmed ? req.user.id : null,
            confirmed_at: isConfirmed ? new Date().toISOString() : null,
            ticket_type: 'general', // Agregar tipo de ticket
            ticket_price: 15.00 // Agregar precio
          })
          .select()
          .single();

        if (ticketError) {
          throw ticketError;
        }

        createdTickets.push(ticket);

        // Si el pago está confirmado, crear registro de pago
        if (isConfirmed) {
          const paymentData = {
            ticket_id: ticket.id,
            payment_method,
            payment_reference,
            status: 'confirmado',
            confirmed_by: req.user.id,
            confirmed_at: new Date().toISOString()
          };

          // Si es pago móvil, agregar campos adicionales
          if (payment_method === 'pago_movil') {
            paymentData.payment_phone = client_phone;
            paymentData.payment_bank_code = client_bank_code;
            paymentData.amount = 15.00;
            
            // Obtener tasa de cambio
            const { data: exchangeRate } = await req.supabase
              .from('exchange_rates')
              .select('rate')
              .order('date', { ascending: false })
              .limit(1)
              .single();
              
            if (exchangeRate) {
              paymentData.amount_usd = 15.00;
              paymentData.amount_bs = 15.00 * exchangeRate.rate;
              paymentData.exchange_rate = exchangeRate.rate;
            }
          }

          await req.supabase
            .from('ticket_payments')
            .insert(paymentData);
        }
      }

      // Si todos los tickets se crearon exitosamente y el pago está confirmado
      if (isConfirmed) {
        await req.supabase.rpc('confirm_ticket_sale', { quantity });
        
        // ===== ACTUALIZADO: Usar el nuevo sistema de emails =====
        try {
          // Obtener tasa de cambio para calcular monto en Bs
          const { data: exchangeRate } = await req.supabase
            .from('exchange_rates')
            .select('rate')
            .order('date', { ascending: false })
            .limit(1)
            .single();

          const totalUSD = createdTickets.length * 15.00;
          const totalBs = exchangeRate ? totalUSD * exchangeRate.rate : null;

          // Preparar información del pago
          const paymentInfo = {
            payment_method,
            reference: payment_reference,
            status: 'approved',
            amount_usd: totalUSD,
            amount_bs: totalBs,
            totalAmount: totalUSD,  // ← AGREGADO: totalAmount
            confirmed_by: req.user.email,
            confirmed_at: new Date().toISOString(),
            transaction_id: createdTickets[0].id // Usar el ID del primer ticket como referencia
          };

          // Si es pago móvil, agregar información adicional
          if (payment_method === 'pago_movil') {
            paymentInfo.client_phone = client_phone;
            paymentInfo.client_bank_code = client_bank_code;
          }

          // Enviar email de confirmación usando el nuevo sistema
          await handlePaymentEmailFlow(createdTickets, paymentInfo, payment_method);
          
          // Actualizar tickets para marcar recibo enviado
          const ticketIds = createdTickets.map(t => t.id);
          await req.supabase
            .from('concert_tickets')
            .update({ receipt_sent: true })
            .in('id', ticketIds);

          console.log(`Confirmation email sent for ${createdTickets.length} tickets`);
        } catch (emailError) {
          console.error('Error sending ticket email:', emailError);
          // No fallar la transacción si falla el email
        }
      } else {
        // ===== NUEVO: Para métodos que requieren verificación manual =====
        if (['zelle', 'transferencia', 'paypal'].includes(payment_method)) {
          try {
            const totalUSD = createdTickets.length * 15.00;
            
            // Preparar información del pago pendiente
            const paymentInfo = {
              payment_method,
              reference: payment_reference,
              status: 'pending',
              amount_usd: totalUSD,
              totalAmount: totalUSD,  // ← AGREGADO: totalAmount
              created_at: new Date().toISOString()
            };

            // Enviar email de verificación pendiente
            await handlePaymentEmailFlow(createdTickets, paymentInfo, payment_method);
            
            console.log(`Pending verification email sent for ${createdTickets.length} tickets`);
          } catch (emailError) {
            console.error('Error sending pending verification email:', emailError);
            // No fallar la transacción si falla el email
          }
        }
      }

      res.status(201).json({
        message: `${quantity} entrada(s) creada(s) exitosamente`,
        tickets: createdTickets,
        total: createdTickets.length * 15.00,
        paymentConfirmed: isConfirmed,
        emailSent: true
      });

    } catch (error) {
      // Si falla la creación de tickets, liberar la reserva
      await req.supabase.rpc('release_ticket_reservation', { quantity });
      
      // Eliminar tickets que se hayan creado
      if (createdTickets.length > 0) {
        const ticketIds = createdTickets.map(t => t.id);
        await req.supabase
          .from('concert_tickets')
          .delete()
          .in('id', ticketIds);
      }
      
      throw error;
    }

  } catch (error) {
    console.error('Error creating tickets:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get all tickets (admin, boss, administracion)
router.get('/', authenticateToken, requireAnyPermission(
  { resource: 'tickets', action: 'read' },
  { resource: 'tickets', action: 'manage' },
  { resource: 'payments', action: 'read' }
), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50,
      search,
      payment_status,
      ticket_status,
      payment_method,
      sold_by
    } = req.query;

    let query = req.supabase
      .from('concert_tickets')
      .select('*, users!sold_by(full_name)', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`ticket_number.ilike.%${search}%,buyer_name.ilike.%${search}%,buyer_email.ilike.%${search}%`);
    }

    if (payment_status) {
      query = query.eq('payment_status', payment_status);
    }

    if (ticket_status) {
      query = query.eq('ticket_status', ticket_status);
    }

    if (payment_method) {
      query = query.eq('payment_method', payment_method);
    }

    if (sold_by) {
      query = query.eq('sold_by', sold_by);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data: tickets, count, error } = await query;

    if (error) {
      console.error('Error fetching tickets:', error);
      return res.status(500).json({ message: 'Error al obtener entradas' });
    }

    res.json({
      tickets: tickets || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get ticket details
router.get('/:ticketId', authenticateToken, enrichUserData, async (req, res) => {
  try {
    const { ticketId } = req.params;

    // Get ticket details
    const { data: ticket, error } = await req.supabase
      .from('concert_tickets')
      .select('*, users!sold_by(full_name), payments:ticket_payments(*)')
      .eq('id', ticketId)
      .single();

    if (error || !ticket) {
      return res.status(404).json({ message: 'Entrada no encontrada' });
    }

    // Check permissions
    const hasViewAllPermission = req.user.permissions.some(p => 
      ['tickets:read', 'tickets:manage', 'payments:read'].includes(p)
    );

    if (!hasViewAllPermission && 
        !req.user.permissions.includes('tickets:sell') && 
        ticket.buyer_email !== req.user.email) {
      return res.status(403).json({ 
        message: 'No tienes permisos para ver esta entrada' 
      });
    }

    res.json(ticket);

  } catch (error) {
    console.error('Ticket details error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Update ticket payment status (admin, boss, administracion)
router.patch('/:ticketId/payment', authenticateToken, requireAnyPermission(
  { resource: 'tickets', action: 'update' },
  { resource: 'payments', action: 'confirm' }
), async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { payment_status, payment_reference, notes } = req.body;

    if (!payment_status) {
      return res.status(400).json({ 
        message: 'Estado de pago es requerido' 
      });
    }

    // Get current ticket
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