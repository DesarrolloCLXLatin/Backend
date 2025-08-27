// server/controllers/TicketsController.js
import { BaseController } from './BaseController.js';
import { TicketModel } from '../models/Ticket.js';
import { handlePaymentEmailFlow } from '../utils/ticketUtils.js';

export class TicketsController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Obtener métodos de pago disponibles
   */
  getPaymentMethods = this.handleAsync(async (req, res) => {
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

    this.success(res, methods);
  });

  /**
   * Obtener estadísticas de tickets
   */
  getStats = this.handleAsync(async (req, res) => {
    try {
      const ticketModel = new TicketModel(req.supabase);

      // Obtener estadísticas básicas
      const stats = await ticketModel.getTicketStats();

      // Obtener estadísticas del venue usando RPC
      const { data: venueStats } = await req.supabase
        .rpc('get_venue_statistics');

      // Obtener inventario de tickets
      const { data: inventory } = await req.supabase
        .from('ticket_inventory')
        .select('*')
        .single();

      // Obtener tasa de cambio actual
      const { data: currentRate } = await req.supabase
        .from('exchange_rates')
        .select('rate, date')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      // Calcular revenue
      const TICKET_PRICE_GENERAL = 35.00;
      const BOX_PRICE = 75.00;
      
      const boxRevenue = (venueStats?.boxes?.sold_boxes || 0) * BOX_PRICE;
      const generalRevenue = (venueStats?.general_zone?.sold || 0) * TICKET_PRICE_GENERAL;
      const totalRevenueUSD = boxRevenue + generalRevenue;
      const totalRevenueBs = currentRate ? totalRevenueUSD * currentRate.rate : 0;

      // Obtener ventas de hoy
      const today = new Date().toISOString().split('T')[0];
      const { data: todayTickets } = await ticketModel.findAll({}, {
        select: 'id, payment_status, ticket_type',
        filters: { created_at: { gte: today } }
      });

      const todaySales = todayTickets.data?.length || 0;
      const todayConfirmed = todayTickets.data?.filter(t => t.payment_status === 'confirmado').length || 0;

      // Construir respuesta completa
      const response = {
        // Estadísticas principales
        totalTickets: stats.total,
        confirmedTickets: stats.byPaymentStatus.confirmado,
        pendingTickets: stats.byPaymentStatus.pendiente,
        rejectedTickets: stats.byPaymentStatus.rechazado,
        redeemedTickets: stats.byTicketStatus.canjeado,
        
        // Revenue
        totalRevenueUSD,
        totalRevenueBs,
        exchangeRate: currentRate?.rate || 0,
        
        // Capacidad del venue
        totalCapacity: venueStats?.summary?.total_capacity || 5270,
        soldTickets: venueStats?.summary?.total_sold || 0,
        availableTickets: venueStats?.summary?.total_available || 5170,
        
        // Estadísticas de boxes
        boxes: {
          total: venueStats?.boxes?.total_boxes || 30,
          sold: venueStats?.boxes?.sold_boxes || 0,
          available: venueStats?.boxes?.available_boxes || 20,
          revenue: boxRevenue
        },
        
        // Zona general
        general: {
          capacity: venueStats?.general_zone?.total_capacity || 4970,
          sold: venueStats?.general_zone?.sold || 0,
          available: venueStats?.general_zone?.available || 4970,
          price: TICKET_PRICE_GENERAL,
          revenue: generalRevenue
        },
        
        // Estadísticas detalladas
        stats: {
          paymentStatus: stats.byPaymentStatus,
          ticketStatus: stats.byTicketStatus,
          paymentMethods: stats.byPaymentMethod,
          ticketTypes: stats.byTicketType,
          
          // Estadísticas de hoy
          today: {
            totalSales: todaySales,
            confirmed: todayConfirmed
          }
        }
      };

      this.success(res, response);

    } catch (error) {
      console.error('Tickets dashboard error:', error);
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Obtener inventario de tickets
   */
  getInventory = this.handleAsync(async (req, res) => {
    try {
      const { data: inventory, error } = await req.supabase
        .from('ticket_inventory')
        .select('*')
        .single();

      if (error) {
        console.error('Error fetching inventory:', error);
        return this.error(res, 'Error obteniendo inventario');
      }

      this.success(res, inventory || {
        total_tickets: 5000,
        sold_tickets: 0,
        reserved_tickets: 0,
        available_tickets: 5000
      });

    } catch (error) {
      console.error('Inventory error:', error);
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Crear nuevos tickets
   */
  createTickets = this.handleAsync(async (req, res) => {
    try {
      const {
        buyer_name,
        buyer_email,
        buyer_phone,
        buyer_identification,
        payment_method,
        payment_reference,
        quantity = 1,
        client_phone,
        client_bank_code
      } = req.body;

      // Validar campos requeridos
      this.validateRequired(req.body, [
        'buyer_name', 'buyer_email', 'buyer_phone', 
        'buyer_identification', 'payment_method'
      ]);

      // Validar cantidad
      if (quantity < 1 || quantity > 10) {
        return this.validationError(res, {
          quantity: 'La cantidad debe estar entre 1 y 10 entradas'
        });
      }

      const ticketModel = new TicketModel(req.supabase);

      // Verificar disponibilidad
      const availability = await ticketModel.checkAvailability(quantity);
      if (!availability.canPurchase) {
        return this.error(res, 
          `No hay suficientes entradas disponibles. Disponibles: ${availability.available}`, 
          400
        );
      }

      // Reservar inventario
      const reserved = await ticketModel.reserveInventory(quantity);
      if (!reserved) {
        return this.error(res, 'No se pudieron reservar las entradas', 400);
      }

      const createdTickets = [];
      const isConfirmed = payment_method === 'tienda' || 
                          (payment_method === 'pago_movil' && this.hasPermission(req, 'tickets', 'sell'));

      try {
        // Crear múltiples tickets
        for (let i = 0; i < quantity; i++) {
          const ticket = await ticketModel.createTicket({
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
            ticket_type: 'general',
            ticket_price: 35.00
          });

          createdTickets.push(ticket);
        }

        // Si el pago está confirmado, procesar
        if (isConfirmed) {
          await ticketModel.confirmSale(quantity);
          
          // Enviar emails de confirmación
          try {
            const paymentInfo = {
              payment_method,
              reference: payment_reference,
              status: 'approved',
              amount_usd: createdTickets.length * 35.00,
              totalAmount: createdTickets.length * 35.00,
              confirmed_by: req.user.email,
              confirmed_at: new Date().toISOString(),
              transaction_id: createdTickets[0].id
            };

            await handlePaymentEmailFlow(createdTickets, paymentInfo, payment_method);
            
            // Marcar recibos como enviados
            const ticketIds = createdTickets.map(t => t.id);
            await req.supabase
              .from('concert_tickets')
              .update({ receipt_sent: true })
              .in('id', ticketIds);

          } catch (emailError) {
            console.error('Error sending ticket email:', emailError);
          }
        }

        this.success(res, {
          tickets: createdTickets,
          total: createdTickets.length * 35.00,
          paymentConfirmed: isConfirmed,
          emailSent: isConfirmed
        }, `${quantity} entrada(s) creada(s) exitosamente`, 201);

      } catch (error) {
        // Rollback: liberar reserva y eliminar tickets creados
        await ticketModel.releaseReservation(quantity);
        
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
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Obtener todos los tickets con filtros
   */
  getTickets = this.handleAsync(async (req, res) => {
    try {
      const { page, limit, offset } = this.getPaginationParams(req);
      const { search, payment_status, ticket_status, payment_method, sold_by } = req.query;

      const ticketModel = new TicketModel(req.supabase);

      const filters = {};
      if (payment_status) filters.payment_status = payment_status;
      if (ticket_status) filters.ticket_status = ticket_status;
      if (payment_method) filters.payment_method = payment_method;
      if (sold_by) filters.sold_by = sold_by;

      const { data: tickets, count } = await ticketModel.searchTickets(search, filters, {
        limit,
        offset
      });

      this.paginatedResponse(res, tickets, count, page, limit);

    } catch (error) {
      console.error('Error fetching tickets:', error);
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Obtener detalles de un ticket
   */
  getTicketDetails = this.handleAsync(async (req, res) => {
    try {
      const { ticketId } = req.params;

      const { data: ticket, error } = await req.supabase
        .from('concert_tickets')
        .select('*, users!sold_by(full_name), payments:ticket_payments(*)')
        .eq('id', ticketId)
        .single();

      if (error || !ticket) {
        return this.notFound(res, 'Entrada');
      }

      // Verificar permisos
      const hasViewAllPermission = this.hasPermission(req, 'tickets', 'read') ||
                                   this.hasPermission(req, 'tickets', 'manage') ||
                                   this.hasPermission(req, 'payments', 'read');

      if (!hasViewAllPermission && 
          !this.hasPermission(req, 'tickets', 'sell') && 
          ticket.buyer_email !== req.user.email) {
        return this.forbidden(res);
      }

      this.success(res, ticket);

    } catch (error) {
      console.error('Ticket details error:', error);
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Actualizar estado de pago de ticket
   */
  updatePaymentStatus = this.handleAsync(async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { payment_status, payment_reference, notes } = req.body;

      if (!payment_status) {
        return this.validationError(res, {
          payment_status: 'Estado de pago es requerido'
        });
      }

      const ticketModel = new TicketModel(req.supabase);

      // Obtener ticket actual
      const currentTicket = await ticketModel.findById(ticketId);
      if (!currentTicket) {
        return this.notFound(res, 'Entrada');
      }

      // Actualizar ticket
      const updatedTicket = await ticketModel.updatePaymentStatus(
        ticketId, 
        payment_status, 
        req.user.id
      );

      // Si se confirma el pago, procesar venta
      if (payment_status === 'confirmado' && currentTicket.payment_status !== 'confirmado') {
        await ticketModel.confirmSale(1);

        // Crear/actualizar registro de pago
        await req.supabase
          .from('ticket_payments')
          .upsert({
            ticket_id: ticketId,
            payment_method: currentTicket.payment_method,
            payment_reference,
            status: 'confirmado',
            confirmed_by: req.user.id,
            confirmed_at: new Date().toISOString(),
            notes
          });

        // Enviar email si no se ha enviado
        if (!currentTicket.receipt_sent) {
          try {
            const paymentInfo = {
              payment_method: currentTicket.payment_method,
              reference: payment_reference,
              status: 'approved',
              amount_usd: currentTicket.ticket_price || 35,
              totalAmount: currentTicket.ticket_price || 35,
              confirmed_by: req.user.email,
              confirmed_at: new Date().toISOString(),
              transaction_id: ticketId
            };

            await handlePaymentEmailFlow([updatedTicket], paymentInfo, currentTicket.payment_method);
            
            // Marcar como enviado
            await req.supabase
              .from('concert_tickets')
              .update({ receipt_sent: true })
              .eq('id', ticketId);

          } catch (emailError) {
            console.error('Error sending ticket email:', emailError);
          }
        }
      }

      this.success(res, { ticket: updatedTicket }, 'Estado de pago actualizado');

    } catch (error) {
      console.error('Error updating payment status:', error);
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Canjear ticket
   */
  redeemTicket = this.handleAsync(async (req, res) => {
    try {
      const { ticketId } = req.params;

      const ticketModel = new TicketModel(req.supabase);

      // Obtener ticket
      const ticket = await ticketModel.findById(ticketId);
      if (!ticket) {
        return this.notFound(res, 'Entrada');
      }

      // Verificar si ya fue canjeado
      if (ticket.ticket_status === 'canjeado') {
        return this.error(res, 'Esta entrada ya fue canjeada', 400);
      }

      // Verificar que el pago esté confirmado
      if (ticket.payment_status !== 'confirmado') {
        return this.error(res, 'No se puede canjear una entrada sin pago confirmado', 400);
      }

      // Canjear ticket
      const updatedTicket = await ticketModel.redeemTicket(ticketId, req.user.id);

      this.success(res, { ticket: updatedTicket }, 'Entrada canjeada exitosamente');

    } catch (error) {
      console.error('Error redeeming ticket:', error);
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Verificar ticket por código
   */
  verifyTicket = this.handleAsync(async (req, res) => {
    try {
      const { code } = req.body;

      if (!code) {
        return this.validationError(res, { code: 'Código es requerido' });
      }

      const ticketModel = new TicketModel(req.supabase);

      // Buscar ticket por QR o código de barras
      const ticket = await ticketModel.findByCode(code);

      if (!ticket) {
        return this.success(res, {
          valid: false,
          message: 'Entrada no encontrada'
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

      // Agregar advertencia si ya fue canjeado
      if (ticket.ticket_status === 'canjeado') {
        response.warning = 'Esta entrada ya fue canjeada';
        response.redeemed_at = ticket.redeemed_at;
      }

      this.success(res, response);

    } catch (error) {
      console.error('Error verifying ticket:', error);
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Obtener tickets del usuario actual
   */
  getMyTickets = this.handleAsync(async (req, res) => {
    try {
      const ticketModel = new TicketModel(req.supabase);

      const { data: tickets } = await ticketModel.findByBuyer(req.user.email, {
        orderBy: { column: 'created_at', ascending: false }
      });

      // Calcular resumen
      const summary = {
        totalTickets: tickets.length,
        confirmed: tickets.filter(t => t.payment_status === 'confirmado').length,
        pending: tickets.filter(t => t.payment_status === 'pendiente').length,
        redeemed: tickets.filter(t => t.ticket_status === 'canjeado').length
      };

      this.success(res, { tickets, summary });

    } catch (error) {
      console.error('Error fetching my tickets:', error);
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Obtener estadísticas rápidas
   */
  getQuickStats = this.handleAsync(async (req, res) => {
    try {
      const userPermissions = req.user.permissions || [];
      let stats = {};

      if (userPermissions.some(p => ['tickets:manage', 'dashboard:view_boss'].includes(p))) {
        // Admin/Boss ve estadísticas globales
        const { data: inventory } = await req.supabase
          .from('ticket_inventory')
          .select('*')
          .single();

        const pendingCount = await new TicketModel(req.supabase).count({ payment_status: 'pendiente' });
        const todayCount = await this.getTodayTicketCount(req.supabase);

        stats = {
          availableTickets: inventory?.available_tickets || 0,
          soldTickets: inventory?.sold_tickets || 0,
          pendingTickets: pendingCount,
          todaySales: todayCount,
          capacity: inventory?.total_tickets || 5000
        };

      } else if (userPermissions.includes('tickets:sell')) {
        // Tienda ve sus estadísticas
        const ticketModel = new TicketModel(req.supabase);
        
        const { data: storeSales } = await ticketModel.findBySeller(req.user.id);
        const todayStoreSales = await this.getTodayTicketCount(req.supabase, req.user.id);

        stats = {
          totalSales: storeSales.length,
          todaySales: todayStoreSales
        };

      } else {
        // Usuario regular ve sus tickets
        const ticketModel = new TicketModel(req.supabase);
        
        const { data: myTickets } = await ticketModel.findByBuyer(req.user.email);
        const pendingPayments = myTickets.filter(t => t.payment_status === 'pendiente').length;

        stats = {
          myTickets: myTickets.length,
          pendingPayments
        };
      }

      this.success(res, stats);

    } catch (error) {
      console.error('Quick stats error:', error);
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Helper para obtener conteo de tickets de hoy
   */
  async getTodayTicketCount(supabase, sellerId = null) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('concert_tickets')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

      if (sellerId) {
        query = query.eq('sold_by', sellerId);
      }

      const { count } = await query;
      return count || 0;
    } catch (error) {
      console.error('Error getting today ticket count:', error);
      return 0;
    }
  }
}

export default TicketsController;