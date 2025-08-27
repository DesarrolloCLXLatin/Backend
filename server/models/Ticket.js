// server/models/Ticket.js
import { BaseModel } from './BaseModel.js';

export class TicketModel extends BaseModel {
  constructor(supabase) {
    super(supabase, 'concert_tickets');
  }

  /**
   * Crear ticket con códigos únicos generados
   */
  async createTicket(ticketData) {
    try {
      // Generar códigos únicos usando funciones de Supabase
      const [ticketNumber, qrCode, barcode] = await Promise.all([
        this.callFunction('generate_ticket_number'),
        this.callFunction('generate_qr_code'),
        this.callFunction('generate_barcode')
      ]);

      const ticketToCreate = {
        ticket_number: ticketNumber,
        qr_code: qrCode,
        barcode,
        ...ticketData,
        created_at: new Date().toISOString()
      };

      return this.create(ticketToCreate);
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw error;
    }
  }

  /**
   * Buscar tickets por comprador
   */
  async findByBuyer(buyerEmail, options = {}) {
    return this.findAll({ buyer_email: buyerEmail }, options);
  }

  /**
   * Buscar tickets por vendedor
   */
  async findBySeller(sellerId, options = {}) {
    return this.findAll({ sold_by: sellerId }, options);
  }

  /**
   * Buscar ticket por número
   */
  async findByTicketNumber(ticketNumber) {
    return this.findOne({ ticket_number: ticketNumber });
  }

  /**
   * Buscar ticket por QR o código de barras
   */
  async findByCode(code) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .or(`qr_code.eq.${code},barcode.eq.${code}`)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw this.handleSupabaseError(error);
      }

      return data;
    } catch (error) {
      console.error('Error finding ticket by code:', error);
      throw error;
    }
  }

  /**
   * Actualizar estado de pago del ticket
   */
  async updatePaymentStatus(ticketId, status, confirmedBy = null) {
    try {
      const updateData = {
        payment_status: status,
        updated_at: new Date().toISOString()
      };

      if (status === 'confirmado' && confirmedBy) {
        updateData.confirmed_by = confirmedBy;
        updateData.confirmed_at = new Date().toISOString();
      }

      return this.updateById(ticketId, updateData);
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw error;
    }
  }

  /**
   * Canjear ticket
   */
  async redeemTicket(ticketId, redeemedBy) {
    try {
      const updateData = {
        ticket_status: 'canjeado',
        redeemed_at: new Date().toISOString(),
        redeemed_by: redeemedBy
      };

      return this.updateById(ticketId, updateData);
    } catch (error) {
      console.error('Error redeeming ticket:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de tickets
   */
  async getTicketStats(filters = {}) {
    try {
      const { data: tickets } = await this.findAll(filters);

      const stats = {
        total: tickets.length,
        byPaymentStatus: {
          pendiente: 0,
          confirmado: 0,
          rechazado: 0
        },
        byTicketStatus: {
          vendido: 0,
          canjeado: 0,
          cancelado: 0
        },
        byPaymentMethod: {},
        byTicketType: {},
        totalRevenue: 0
      };

      tickets.forEach(ticket => {
        // Por estado de pago
        if (stats.byPaymentStatus[ticket.payment_status] !== undefined) {
          stats.byPaymentStatus[ticket.payment_status]++;
        }

        // Por estado de ticket
        if (stats.byTicketStatus[ticket.ticket_status] !== undefined) {
          stats.byTicketStatus[ticket.ticket_status]++;
        }

        // Por método de pago
        const method = ticket.payment_method || 'unknown';
        stats.byPaymentMethod[method] = (stats.byPaymentMethod[method] || 0) + 1;

        // Por tipo de ticket
        const type = ticket.ticket_type || 'general';
        stats.byTicketType[type] = (stats.byTicketType[type] || 0) + 1;

        // Revenue de tickets confirmados
        if (ticket.payment_status === 'confirmado') {
          stats.totalRevenue += parseFloat(ticket.ticket_price || 35);
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting ticket stats:', error);
      throw error;
    }
  }

  /**
   * Buscar tickets con filtros avanzados
   */
  async searchTickets(searchTerm, filters = {}, options = {}) {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*, users!sold_by(full_name)', { count: 'exact' });

      // Búsqueda por texto
      if (searchTerm) {
        query = query.or(`ticket_number.ilike.%${searchTerm}%,buyer_name.ilike.%${searchTerm}%,buyer_email.ilike.%${searchTerm}%`);
      }

      // Filtros específicos
      if (filters.payment_status) {
        query = query.eq('payment_status', filters.payment_status);
      }

      if (filters.ticket_status) {
        query = query.eq('ticket_status', filters.ticket_status);
      }

      if (filters.payment_method) {
        query = query.eq('payment_method', filters.payment_method);
      }

      if (filters.sold_by) {
        query = query.eq('sold_by', filters.sold_by);
      }

      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      // Ordenamiento
      query = query.order(options.orderBy || 'created_at', { 
        ascending: options.ascending || false 
      });

      // Paginación
      if (options.limit && options.offset !== undefined) {
        query = query.range(options.offset, options.offset + options.limit - 1);
      }

      const { data, count, error } = await query;

      if (error) {
        throw this.handleSupabaseError(error);
      }

      return { data: data || [], count };
    } catch (error) {
      console.error('Error searching tickets:', error);
      throw error;
    }
  }

  /**
   * Obtener tickets por transacción
   */
  async findByTransaction(transactionId) {
    return this.findAll({ transaction_id: transactionId });
  }

  /**
   * Verificar disponibilidad de tickets
   */
  async checkAvailability(quantity = 1) {
    try {
      const { data: inventory } = await this.supabase
        .from('ticket_inventory')
        .select('available_tickets')
        .single();

      return {
        available: inventory?.available_tickets || 0,
        canPurchase: (inventory?.available_tickets || 0) >= quantity
      };
    } catch (error) {
      console.error('Error checking availability:', error);
      throw error;
    }
  }

  /**
   * Reservar tickets en inventario
   */
  async reserveInventory(quantity) {
    try {
      return this.callFunction('reserve_ticket_inventory', { quantity });
    } catch (error) {
      console.error('Error reserving inventory:', error);
      throw error;
    }
  }

  /**
   * Confirmar venta en inventario
   */
  async confirmSale(quantity) {
    try {
      return this.callFunction('confirm_ticket_sale', { quantity });
    } catch (error) {
      console.error('Error confirming sale:', error);
      throw error;
    }
  }

  /**
   * Liberar reserva de inventario
   */
  async releaseReservation(quantity) {
    try {
      return this.callFunction('release_ticket_reservation', { quantity });
    } catch (error) {
      console.error('Error releasing reservation:', error);
      throw error;
    }
  }

  /**
   * Obtener tickets pendientes de validación (iframe)
   */
  async getPendingIframePayments() {
    try {
      const { data: tickets } = await this.findAll({ payment_status: 'pendiente' });

      // Filtrar solo los que vienen de iframe
      const iframeTickets = tickets.filter(ticket => {
        try {
          const metadata = JSON.parse(ticket.notes || '{}');
          return metadata.source === 'iframe';
        } catch (e) {
          return false;
        }
      });

      return iframeTickets.map(ticket => {
        let additionalData = {};
        try {
          additionalData = JSON.parse(ticket.notes || '{}');
        } catch (e) {
          additionalData = {};
        }

        return {
          id: ticket.id,
          ticket_number: ticket.ticket_number,
          buyer_name: ticket.buyer_name,
          buyer_email: ticket.buyer_email,
          buyer_phone: ticket.buyer_phone,
          buyer_identification: ticket.buyer_identification,
          payment_method: ticket.payment_method,
          payment_reference: ticket.payment_reference,
          zone_name: ticket.zone_name,
          ticket_type: ticket.ticket_type,
          ticket_price: ticket.ticket_price,
          total_price: additionalData.total_price || ticket.ticket_price,
          quantity: additionalData.quantity || 1,
          bank_code: additionalData.bank_code,
          is_box_purchase: additionalData.is_box_purchase || false,
          box_code: additionalData.box_code,
          created_at: ticket.created_at,
          payment_date: additionalData.payment_date,
          ip_address: additionalData.ip_address
        };
      });
    } catch (error) {
      console.error('Error getting pending iframe payments:', error);
      throw error;
    }
  }
}

export default TicketModel;