// =============================================
// NUEVA RUTA: boxesRoutes.js
// Manejo de boxes para concierto
// =============================================

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { 
  authenticateToken, 
  authenticateIframe,
  requirePermission, 
  requireAnyPermission,
  enrichUserData 
} from '../middleware/auth.js';
import { 
  generateTicketReceipt, 
  sendTicketEmail, 
  generateQRCode, 
  generateBarcode,
  generateAndSendTicketEmails, 
  handlePaymentEmailFlow,
  processManualPaymentConfirmation,
  resendTicketEmail
} from '../utils/ticketUtils.js';
import megasoftService from '../services/megasoftService.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ===== ENDPOINTS PÚBLICOS =====

/**
 * GET /api/boxes/availability
 * Obtener disponibilidad de boxes - PÚBLICO
 */
router.get('/availability', async (req, res) => {
  try {
    // Obtener estadísticas del venue
    const { data: stats, error: statsError } = await supabaseAdmin
      .rpc('get_venue_statistics');

    if (statsError) {
      console.error('Error getting venue statistics:', statsError);
      throw statsError;
    }

    // Obtener información detallada de boxes
    const { data: boxes, error: boxesError } = await supabaseAdmin
      .from('box_availability_view')
      .select('*')
      .order('box_code');

    if (boxesError) {
      console.error('Error getting boxes:', boxesError);
      throw boxesError;
    }

    // Obtener información de zonas
    const { data: zones, error: zonesError } = await supabaseAdmin
      .from('ticket_zones')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (zonesError) {
      console.error('Error getting zones:', zonesError);
      throw zonesError;
    }

    res.json({
      success: true,
      venue: {
        total_capacity: stats.summary.total_capacity,
        total_sold: stats.summary.total_sold,
        total_available: stats.summary.total_available
      },
      zones: zones.map(zone => ({
        id: zone.id,
        code: zone.zone_code,
        name: zone.zone_name,
        type: zone.zone_type,
        price_usd: zone.price_usd,
        capacity: zone.total_capacity,
        color: zone.zone_color,
        icon: zone.zone_icon,
        description: zone.description
      })),
      boxes: {
        summary: stats.boxes,
        detail: boxes.map(box => ({
          id: box.id,
          code: box.box_code,
          number: box.box_number,
          status: box.status,
          capacity: box.capacity,
          price_usd: box.price_usd,
          floor_level: box.floor_level,
          position: {
            x: box.position_x,
            y: box.position_y
          },
          amenities: box.amenities,
          available_seats: box.available_seats,
          sold_to: box.status === 'sold' ? box.sold_to_name : null
        }))
      },
      general: {
        capacity: stats.general_zone.total_capacity,
        sold: stats.general_zone.sold,
        available: stats.general_zone.available,
        price_usd: stats.general_zone.price_usd
      }
    });

  } catch (error) {
    console.error('Box availability error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener disponibilidad de boxes' 
    });
  }
});

/**
 * GET /api/boxes/:boxCode
 * Obtener información de un box específico - PÚBLICO
 */
router.get('/:boxCode', async (req, res) => {
  try {
    const { boxCode } = req.params;

    const { data: box, error } = await supabaseAdmin
      .from('concert_boxes')
      .select(`
        *,
        zone:ticket_zones(*)
      `)
      .eq('box_code', boxCode.toUpperCase())
      .single();

    if (error || !box) {
      return res.status(404).json({
        success: false,
        message: 'Box no encontrado'
      });
    }

    // Obtener asientos del box
    const { data: seats } = await supabaseAdmin
      .from('vip_seats')
      .select('*')
      .eq('metadata->>box_code', boxCode.toUpperCase())
      .order('seat_number');

    res.json({
      success: true,
      box: {
        ...box,
        seats: seats || [],
        available: box.status === 'available',
        zone_info: box.zone
      }
    });

  } catch (error) {
    console.error('Box detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información del box'
    });
  }
});

// ===== ENDPOINTS DE COMPRA =====

/**
 * POST /api/boxes/reserve
 * Reservar un box temporalmente
 */
router.post('/reserve', authenticateToken, async (req, res) => {
  try {
    const {
      box_code,
      session_id,
      buyer_email,
      buyer_phone,
      minutes = 15
    } = req.body;

    if (!box_code) {
      return res.status(400).json({
        success: false,
        message: 'Código de box requerido'
      });
    }

    // Llamar función de reserva
    const { data: result, error } = await supabaseAdmin
      .rpc('reserve_box', {
        p_box_code: box_code.toUpperCase(),
        p_session_id: session_id || uuidv4(),
        p_buyer_email: buyer_email,
        p_buyer_phone: buyer_phone,
        p_minutes: minutes
      });

    if (error) {
      console.error('Reserve box error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Error al reservar el box'
      });
    }

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Box reservado exitosamente',
      reservation: result,
      expires_at: result.reserved_until
    });

  } catch (error) {
    console.error('Box reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar reserva'
    });
  }
});

/**
 * POST /api/boxes/purchase
 * Comprar un box completo (con integración Megasoft para pago móvil)
 */
router.post('/purchase', authenticateToken, async (req, res) => {
  try {
    const {
      box_code,
      buyer_name,
      buyer_email,
      buyer_phone,
      buyer_identification,
      payment_method,
      payment_reference,
      // Para pago móvil
      client_phone,
      client_bank_code
    } = req.body;

    // Validaciones
    if (!box_code || !buyer_name || !buyer_email || !buyer_phone || !buyer_identification) {
      return res.status(400).json({
        success: false,
        message: 'Todos los datos del comprador son requeridos'
      });
    }

    // Si es pago móvil, validar campos adicionales
    if (payment_method === 'pago_movil' && (!client_phone || !client_bank_code)) {
      return res.status(400).json({
        success: false,
        message: 'Para pago móvil se requiere teléfono y banco del cliente'
      });
    }

    // Verificar disponibilidad del box
    const { data: box, error: boxError } = await supabaseAdmin
      .from('concert_boxes')
      .select('*')
      .eq('box_code', box_code.toUpperCase())
      .single();

    if (boxError || !box) {
      return res.status(404).json({
        success: false,
        message: 'Box no encontrado'
      });
    }

    if (box.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Box no disponible',
        current_status: box.status
      });
    }

    // Variable para almacenar datos de Megasoft
    let megasoftData = null;
    let exchangeRate = null;

    // Si es pago móvil P2C, procesar con Megasoft
    if (payment_method === 'pago_movil') {
      try {
        // Obtener tasa de cambio
        const { data: exchangeRateData } = await supabaseAdmin
          .from('exchange_rates')
          .select('rate')
          .order('date', { ascending: false })
          .limit(1)
          .single();
        
        exchangeRate = exchangeRateData?.rate || 40;
        const amountBs = box.price_usd * exchangeRate;
      
        // Pre-registro con Megasoft
        console.log('[Megasoft] Iniciando pre-registro para box:', box_code);
        const preRegistroResult = await megasoftService.preRegistro();
        
        if (!preRegistroResult.success) {
          throw new Error(`Pre-registro falló: ${preRegistroResult.descripcion}`);
        }
      
        const controlNumber = preRegistroResult.control;
        console.log('[Megasoft] Control number obtenido:', controlNumber);
      
        // Procesar pago P2C
        const paymentData = {
          control: controlNumber,
          telefonoCliente: client_phone,
          codigoBancoCliente: client_bank_code,
          amount: amountBs,
          factura: megasoftService.generateInvoiceNumber(),
          referencia: payment_reference || '',
          cid: buyer_identification
        };
      
        console.log('[Megasoft] Procesando pago P2C...');
        const paymentResult = await megasoftService.procesarCompraP2C(paymentData);
      
        if (!paymentResult.success) {
          // IMPORTANTE: Devolver el voucher incluso en caso de error
          console.log('[Megasoft] Pago rechazado:', paymentResult.descripcion);
          return res.status(400).json({
            success: false,
            message: `Pago rechazado: ${paymentResult.descripcion}`,
            code: paymentResult.codigo,
            voucher: paymentResult.voucherText || paymentResult.voucher,
            control: controlNumber,
            reference: paymentResult.referencia
          });
        }
      
        console.log('[Megasoft] Pago aprobado exitosamente');
        
        // Si el pago fue exitoso, actualizar referencia
        payment_reference = paymentResult.referencia;
        
        // IMPORTANTE: Guardar TODOS los datos de Megasoft
        megasoftData = {
          control: controlNumber,
          authid: paymentResult.authid,
          terminal: paymentResult.terminal,
          lote: paymentResult.lote,
          seqnum: paymentResult.seqnum,
          voucher: paymentResult.voucherText || paymentResult.voucher,
          rifbanco: paymentResult.rifbanco,
          authname: paymentResult.authname,
          afiliacion: paymentResult.afiliacion,
          factura: paymentData.factura
        };
        
        console.log('[Megasoft] Datos guardados para email:', {
          hasVoucher: !!megasoftData.voucher,
          authid: megasoftData.authid,
          terminal: megasoftData.terminal
        });
        
      } catch (megasoftError) {
        console.error('[Megasoft] Error procesando pago:', megasoftError);
        return res.status(500).json({
          success: false,
          message: 'Error procesando pago móvil',
          voucher: megasoftError.voucher || null
        });
      }
    }

    // Llamar función de compra
    const { data: result, error: purchaseError } = await supabaseAdmin
      .rpc('purchase_complete_box', {
        p_box_code: box_code.toUpperCase(),
        p_buyer_name: buyer_name,
        p_buyer_email: buyer_email,
        p_buyer_phone: buyer_phone,
        p_payment_reference: payment_reference
      });

    if (purchaseError) {
      console.error('Purchase box error:', purchaseError);
      return res.status(400).json({
        success: false,
        message: purchaseError.message || 'Error al comprar el box'
      });
    }

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Crear tickets individuales para cada asiento del box
    const tickets = [];
    for (let i = 1; i <= box.capacity; i++) {
      const ticketNumber = await supabaseAdmin.rpc('generate_ticket_number');
      const qrCode = await supabaseAdmin.rpc('generate_qr_code');
      const barcode = await supabaseAdmin.rpc('generate_barcode');

      const ticketData = {
        ticket_number: ticketNumber.data,
        qr_code: qrCode.data,
        barcode: barcode.data,
        buyer_name,
        buyer_email,
        buyer_phone,
        buyer_identification,
        ticket_type: 'box',
        zone_id: box.zone_id,
        zone_name: 'Box Premium',
        seat_number: `${box_code}-${i}`,
        ticket_price: box.price_usd / box.capacity,
        payment_status: 'confirmado',
        payment_method,
        payment_reference,
        ticket_status: 'vendido',
        sold_by: req.user.id,
        confirmed_by: req.user.id,
        confirmed_at: new Date().toISOString(),
        metadata: {
          box_code: box_code,
          box_number: box.box_number,
          box_id: result.box_id
        }
      };

      // Si es pago móvil, agregar datos de Megasoft
      if (payment_method === 'pago_movil' && megasoftData) {
        ticketData.notes = JSON.stringify({
          megasoft_control: megasoftData.control,
          megasoft_authid: megasoftData.authid,
          megasoft_terminal: megasoftData.terminal
        });
      }

      const { data: ticket, error: ticketError } = await supabaseAdmin
        .from('concert_tickets')
        .insert(ticketData)
        .select()
        .single();

      if (!ticketError) {
        tickets.push(ticket);
      }
    }

    // Enviar emails con los tickets
    try {
      // Preparar información completa del pago
      const paymentInfo = {
        payment_method,
        reference: payment_reference,
        status: 'approved',
        amount_usd: box.price_usd,
        amount_bs: exchangeRate ? box.price_usd * exchangeRate : null,
        totalAmount: box.price_usd,
        transaction_id: result.box_id,
        confirmed_at: new Date().toISOString(),
        confirmed_by: req.user.email
      };

      // Si es pago móvil, incluir TODOS los datos de Megasoft
      if (payment_method === 'pago_movil' && megasoftData) {
        Object.assign(paymentInfo, {
          auth_id: megasoftData.authid,
          control: megasoftData.control,
          terminal: megasoftData.terminal,
          lote: megasoftData.lote,
          seqnum: megasoftData.seqnum,
          voucher: megasoftData.voucher, // CRÍTICO: Incluir el voucher
          rifbanco: megasoftData.rifbanco,
          authname: megasoftData.authname,
          afiliacion: megasoftData.afiliacion,
          factura: megasoftData.factura,
          // Datos del comercio
          commerce_phone: process.env.MEGASOFT_COMMERCE_PHONE,
          commerce_bank_code: process.env.MEGASOFT_COMMERCE_BANK_CODE,
          bank_name: megasoftService.getBankName(process.env.MEGASOFT_COMMERCE_BANK_CODE),
          commerce_rif: process.env.COMPANY_RIF
        });
        
        console.log('[Email] Enviando con voucher:', {
          hasVoucher: !!paymentInfo.voucher,
          voucherLength: paymentInfo.voucher?.length
        });
      }

      await handlePaymentEmailFlow(tickets, paymentInfo, payment_method);
      console.log('[Email] Emails enviados exitosamente');
      
    } catch (emailError) {
      console.error('[Email] Error enviando tickets del box:', emailError);
      // No fallar la transacción por error de email
    }

    res.json({
      success: true,
      message: 'Box comprado exitosamente',
      purchase: result,
      tickets: tickets.map(t => ({
        id: t.id,
        ticket_number: t.ticket_number,
        seat_number: t.seat_number
      })),
      total_amount: box.price_usd,
      // Incluir voucher en la respuesta si es pago móvil
      ...(megasoftData && { 
        voucher: megasoftData.voucher,
        payment_details: {
          authid: megasoftData.authid,
          control: megasoftData.control,
          terminal: megasoftData.terminal
        }
      })
    });

  } catch (error) {
    console.error('Box purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar compra'
    });
  }
});

/**
 * POST /api/boxes/purchase-general
 * Comprar entradas de zona general/preferencial
 */
router.post('/purchase-general', authenticateToken, async (req, res) => {
  try {
    const {
      quantity = 1,
      buyer_name,
      buyer_email,
      buyer_phone,
      buyer_identification,
      payment_method,
      payment_reference,
      // Para pago móvil
      client_phone,
      client_bank_code
    } = req.body;

    // Validaciones
    if (quantity < 1 || quantity > 10) {
      return res.status(400).json({
        success: false,
        message: 'Cantidad debe estar entre 1 y 10 entradas'
      });
    }

    const tickets = [];
    const PRICE_PER_TICKET = 35.00;
    const totalAmount = quantity * PRICE_PER_TICKET;
    
    // Variables para Megasoft
    let megasoftData = null;
    let exchangeRate = null;
    let processedPaymentReference = payment_reference;

    // Si es pago móvil, procesar con Megasoft
    if (payment_method === 'pago_movil') {
      try {
        // Obtener tasa de cambio
        const { data: exchangeRateData } = await supabaseAdmin
          .from('exchange_rates')
          .select('rate')
          .order('date', { ascending: false })
          .limit(1)
          .single();
        
        exchangeRate = exchangeRateData?.rate || 40;
        const amountBs = totalAmount * exchangeRate;
        
        // Pre-registro con Megasoft
        console.log('[Megasoft] Pre-registro para entradas generales');
        const preRegistroResult = await megasoftService.preRegistro();
        
        if (!preRegistroResult.success) {
          throw new Error(`Pre-registro falló: ${preRegistroResult.descripcion}`);
        }
        
        const controlNumber = preRegistroResult.control;
        
        // Procesar pago P2C
        const paymentData = {
          control: controlNumber,
          telefonoCliente: client_phone,
          codigoBancoCliente: client_bank_code,
          amount: amountBs,
          factura: megasoftService.generateInvoiceNumber(),
          referencia: payment_reference || '',
          cid: buyer_identification
        };
        
        const paymentResult = await megasoftService.procesarCompraP2C(paymentData);
        
        if (!paymentResult.success) {
          return res.status(400).json({
            success: false,
            message: `Pago rechazado: ${paymentResult.descripcion}`,
            code: paymentResult.codigo,
            voucher: paymentResult.voucherText || paymentResult.voucher,
            control: controlNumber,
            reference: paymentResult.referencia
          });
        }
        
        processedPaymentReference = paymentResult.referencia;
        
        // Guardar datos de Megasoft
        megasoftData = {
          control: controlNumber,
          authid: paymentResult.authid,
          terminal: paymentResult.terminal,
          lote: paymentResult.lote,
          seqnum: paymentResult.seqnum,
          voucher: paymentResult.voucherText || paymentResult.voucher,
          rifbanco: paymentResult.rifbanco,
          authname: paymentResult.authname,
          afiliacion: paymentResult.afiliacion,
          factura: paymentData.factura
        };
        
      } catch (megasoftError) {
        console.error('[Megasoft] Error:', megasoftError);
        return res.status(500).json({
          success: false,
          message: 'Error procesando pago móvil',
          voucher: megasoftError.voucher || null
        });
      }
    }

    // Crear las entradas
    for (let i = 0; i < quantity; i++) {
      const { data: ticketResult, error: ticketError } = await supabaseAdmin
        .rpc('purchase_general_ticket', {
          p_buyer_name: buyer_name,
          p_buyer_email: buyer_email,
          p_buyer_phone: buyer_phone,
          p_buyer_identification: buyer_identification,
          p_payment_method: payment_method,
          p_payment_reference: processedPaymentReference,
          p_sold_by: req.user.id
        });

      if (ticketError) {
        console.error('Error creating general ticket:', ticketError);
        continue;
      }

      if (ticketResult.success) {
        tickets.push(ticketResult);
      }
    }

    // Confirmar pagos si es necesario
    if (payment_method === 'tienda' || payment_method === 'pago_movil' || req.user.role === 'admin') {
      for (const ticket of tickets) {
        await supabaseAdmin
          .rpc('confirm_ticket_payment', {
            p_ticket_id: ticket.ticket_id,
            p_confirmed_by: req.user.id
          });
      }
    }

    // Obtener tickets completos para emails
    const { data: fullTickets } = await supabaseAdmin
      .from('concert_tickets')
      .select('*')
      .in('id', tickets.map(t => t.ticket_id));

    // Enviar emails según el método de pago
    try {
      const basePaymentInfo = {
        payment_method,
        reference: processedPaymentReference,
        amount_usd: totalAmount,
        amount_bs: exchangeRate ? totalAmount * exchangeRate : null,
        totalAmount: totalAmount,
        created_at: new Date().toISOString()
      };

      if (payment_method === 'pago_movil' && megasoftData) {
        // Para pago móvil confirmado automáticamente
        const paymentInfo = {
          ...basePaymentInfo,
          status: 'approved',
          auth_id: megasoftData.authid,
          control: megasoftData.control,
          terminal: megasoftData.terminal,
          lote: megasoftData.lote,
          seqnum: megasoftData.seqnum,
          voucher: megasoftData.voucher, // CRÍTICO: Incluir voucher
          rifbanco: megasoftData.rifbanco,
          authname: megasoftData.authname,
          afiliacion: megasoftData.afiliacion,
          factura: megasoftData.factura,
          commerce_phone: process.env.MEGASOFT_COMMERCE_PHONE,
          commerce_bank_code: process.env.MEGASOFT_COMMERCE_BANK_CODE,
          bank_name: megasoftService.getBankName(process.env.MEGASOFT_COMMERCE_BANK_CODE),
          commerce_rif: process.env.COMPANY_RIF,
          confirmed_at: new Date().toISOString()
        };

        console.log('[Email] Enviando confirmación con voucher para pago móvil');
        await handlePaymentEmailFlow(fullTickets, paymentInfo, 'pago_movil');
        
      } else if (payment_method === 'tienda') {
        // Pago en tienda confirmado
        const paymentInfo = {
          ...basePaymentInfo,
          status: 'approved',
          confirmed_at: new Date().toISOString(),
          confirmed_by: req.user.email
        };
        
        await handlePaymentEmailFlow(fullTickets, paymentInfo, 'tienda');
        
      } else if (['zelle', 'transferencia', 'paypal'].includes(payment_method)) {
        // Para métodos que requieren verificación manual
        const paymentInfo = {
          ...basePaymentInfo,
          status: 'pending'
        };

        await handlePaymentEmailFlow(fullTickets, paymentInfo, payment_method);
      }
      
    } catch (emailError) {
      console.error('[Email] Error enviando emails:', emailError);
      // No fallar la transacción por error de email
    }

    res.json({
      success: true,
      message: `${tickets.length} entrada(s) creada(s) exitosamente`,
      tickets: tickets,
      total_amount: totalAmount,
      payment_confirmed: payment_method === 'tienda' || payment_method === 'pago_movil',
      // Incluir voucher si es pago móvil
      ...(megasoftData && {
        voucher: megasoftData.voucher,
        payment_details: {
          authid: megasoftData.authid,
          control: megasoftData.control,
          terminal: megasoftData.terminal
        }
      })
    });

  } catch (error) {
    console.error('General ticket purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar compra de entradas'
    });
  }
});

// ===== ENDPOINTS IFRAME =====

/**
 * POST /api/boxes/iframe/purchase
 * Compra desde iframe con token
 */
router.post('/iframe/purchase', authenticateIframe, async (req, res) => {
  try {
    const {
      type, // 'box' o 'general'
      box_code, // Solo para boxes
      quantity, // Solo para general
      buyer_name,
      buyer_email,
      buyer_phone,
      buyer_identification,
      payment_method,
      client_phone,
      client_bank_code
    } = req.body;

    // Registrar uso del token
    await supabaseAdmin
      .from('iframe_token_usage')
      .insert({
        token_id: req.iframeToken.id,
        action: `purchase_${type}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        metadata: {
          type,
          box_code,
          quantity,
          payment_method
        }
      });

    // Redirigir a la función apropiada según el tipo
    if (type === 'box') {
      // Delegar a la función de compra de box
      req.user = { id: null, isPublic: true }; // Usuario público
      req.body = {
        ...req.body,
        payment_reference: null // Se generará en el proceso
      };
      return router.handle(req, res, () => {
        req.url = '/purchase';
        req.method = 'POST';
      });
    } else if (type === 'general') {
      // Delegar a la función de compra general
      req.user = { id: null, isPublic: true };
      req.body = {
        ...req.body,
        payment_reference: null
      };
      return router.handle(req, res, () => {
        req.url = '/purchase-general';
        req.method = 'POST';
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Tipo de compra no válido'
      });
    }

  } catch (error) {
    console.error('Iframe purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar compra desde iframe'
    });
  }
});

// ===== ENDPOINTS ADMINISTRATIVOS =====

/**
 * GET /api/boxes/admin/stats
 * Estadísticas de boxes para admin
 */
router.get('/admin/stats', authenticateToken, requireAnyPermission(
  { resource: 'tickets', action: 'manage' },
  { resource: 'dashboard', action: 'view_boss' }
), async (req, res) => {
  try {
    const { data: stats } = await supabaseAdmin
      .rpc('get_venue_statistics');

    // Obtener ventas por día de los últimos 30 días
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: boxSales } = await supabaseAdmin
      .from('concert_boxes')
      .select('box_code, sold_date, price_usd')
      .eq('status', 'sold')
      .gte('sold_date', thirtyDaysAgo.toISOString())
      .order('sold_date');

    const { data: generalSales } = await supabaseAdmin
      .from('concert_tickets')
      .select('created_at, ticket_price')
      .eq('ticket_type', 'general')
      .eq('payment_status', 'confirmado')
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Agrupar ventas por día
    const dailySales = {};
    
    boxSales?.forEach(sale => {
      const date = sale.sold_date.split('T')[0];
      if (!dailySales[date]) {
        dailySales[date] = { boxes: 0, general: 0, total: 0 };
      }
      dailySales[date].boxes += sale.price_usd;
      dailySales[date].total += sale.price_usd;
    });

    generalSales?.forEach(sale => {
      const date = sale.created_at.split('T')[0];
      if (!dailySales[date]) {
        dailySales[date] = { boxes: 0, general: 0, total: 0 };
      }
      dailySales[date].general += sale.ticket_price;
      dailySales[date].total += sale.ticket_price;
    });

    res.json({
      success: true,
      current: stats,
      trends: {
        daily: Object.entries(dailySales).map(([date, data]) => ({
          date,
          ...data
        })).sort((a, b) => a.date.localeCompare(b.date))
      },
      revenue: stats.revenue,
      occupancy: {
        boxes: {
          percentage: (stats.boxes.sold_boxes / stats.boxes.total_boxes) * 100,
          sold: stats.boxes.sold_boxes,
          total: stats.boxes.total_boxes
        },
        general: {
          percentage: (stats.general_zone.sold / stats.general_zone.total_capacity) * 100,
          sold: stats.general_zone.sold,
          total: stats.general_zone.total_capacity
        },
        total: {
          percentage: (stats.summary.total_sold / stats.summary.total_capacity) * 100,
          sold: stats.summary.total_sold,
          total: stats.summary.total_capacity
        }
      }
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
});

/**
 * PUT /api/boxes/:boxCode/status
 * Actualizar estado de un box (admin only)
 */
router.put('/:boxCode/status', authenticateToken, requirePermission('tickets', 'manage'), async (req, res) => {
  try {
    const { boxCode } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['available', 'reserved', 'sold', 'blocked', 'maintenance'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Estado no válido'
      });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('concert_boxes')
      .update({
        status,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('box_code', boxCode.toUpperCase())
      .select()
      .single();

    if (error) {
      console.error('Update box status error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar estado del box'
      });
    }

    // Actualizar asientos del box
    await supabaseAdmin
      .from('vip_seats')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('metadata->>box_code', boxCode.toUpperCase());

    res.json({
      success: true,
      message: 'Estado actualizado exitosamente',
      box: updated
    });

  } catch (error) {
    console.error('Update box status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado'
    });
  }
});

export default router;