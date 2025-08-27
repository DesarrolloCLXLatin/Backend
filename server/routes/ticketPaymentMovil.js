// server/routes/ticketPaymentMovil.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { 
  authenticateToken, 
  authenticateIframe, 
  requirePermission, 
  requireAnyPermission,
  enrichUserData
} from '../middleware/auth.js';
import { validateCaptcha, requireCaptcha } from '../utils/captcha.js';
import { publicPurchaseRateLimiter, checkTokenTransactionLimit, logPurchaseAttempt } from '../utils/rateLimiter.js';
import axios from 'axios';
import xml2js from 'xml2js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import megasoftService from '../services/megasoftService.js';
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

// Parser para XML
const xmlParser = new xml2js.Parser({ explicitArray: false });
const xmlBuilder = new xml2js.Builder({ headless: true });

// Configuración CORS específica para iframe
const configureCorsForIframe = (req, res, next) => {
  const allowedOrigins = process.env.IFRAME_ALLOWED_ORIGINS?.split(',') || [];
  const origin = req.headers.origin;

  // Siempre permitir OPTIONS
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Iframe-Token, X-Captcha-Response');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // Cache preflight por 24 horas
    return res.sendStatus(200);
  }

  // Para otros métodos, verificar origen
  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Iframe-Token, X-Captcha-Response');
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  next();
};

// Aplicar CORS a todas las rutas del iframe
router.use('/iframe', configureCorsForIframe);
router.use('/public', configureCorsForIframe);

// ===== ENDPOINTS PARA ADMINISTRADORES =====

router.get('/public/payment-methods/:tokenType', async (req, res) => {
  try {
    const { tokenType } = req.params;
    
    // Obtener todos los métodos de pago disponibles
    const { data: allMethods, error } = await supabaseAdmin
      .from('payment_methods_configuration')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) {
      throw error;
    }

    let filteredMethods = allMethods;

    // Si es token público, filtrar solo métodos online
    if (tokenType === 'public_token') {
      const onlineMethods = [
        'pago_movil',
        'tarjeta_debito', 
        'tarjeta_credito',
        'zelle',
        'paypal',
        'transferencia_internacional'
      ];
      
      filteredMethods = allMethods.filter(method => 
        onlineMethods.includes(method.payment_method)
      );
    }

    res.json(filteredMethods);

  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ 
      message: 'Error al obtener métodos de pago' 
    });
  }
});

// Generar token para iframe (admin, boss, tienda)
router.post('/generate-iframe-token', 
  authenticateToken, 
  enrichUserData, // AGREGAR ESTO para asegurar que los permisos estén completos
  requireAnyPermission(
    { resource: 'tickets', action: 'manage' },
    { resource: 'tickets', action: 'sell' }
  ), 
  async (req, res) => {
    try {
      const { 
        origin,
        allowed_domains = [],
        expires_in = 86400,
        token_type = 'seller_token',
        max_transactions = null,
        metadata = {}
      } = req.body;

    // Verificar permisos específicos para tipos de token
    const userPermissions = req.user.permissions || [];
    
    console.log('User permissions:', userPermissions, 'for user:', req.user.id);
    console.log('=== DEBUG PERMISOS ===');
    console.log('Usuario:', req.user.email);
    console.log('Role:', req.user.role);
    console.log('Permissions (raw):', req.user.permissions);
    console.log('PermissionsList:', req.user.permissionsList);
    console.log('Es Array permissions?:', Array.isArray(req.user.permissions));
    console.log('Token type solicitado:', token_type);

    // Para tokens públicos, solo usuarios con permisos de gestión completa
      if (token_type === 'public_token') {
        // Verificar múltiples formas de permisos admin
        const hasAdminAccess = 
          req.user.role === 'admin' || 
          (Array.isArray(req.user.permissions) && req.user.permissions.includes('system:manage_all')) ||
          (Array.isArray(req.user.permissionsList) && req.user.permissionsList.includes('system:manage_all')) ||
          (Array.isArray(req.user.permissions) && req.user.permissions.includes('tickets:manage')) ||
          (Array.isArray(req.user.permissionsList) && req.user.permissionsList.includes('tickets:manage'));
          
        console.log('Has admin access?:', hasAdminAccess);
        
        if (!hasAdminAccess) {
          return res.status(403).json({ 
            success: false,
            message: 'Solo administradores pueden generar tokens públicos',
            debug: {
              role: req.user.role,
              permissions: req.user.permissions,
              permissionsList: req.user.permissionsList
            }
          });
        }
      }

    // Validar dominios permitidos
    if (allowed_domains.length === 0 && !origin) {
      return res.status(400).json({ 
        message: 'Debe especificar al menos un dominio permitido' 
      });
    }

    // Generar token único
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Preparar datos para insertar
    const tokenData = {
      token,
      user_id: token_type === 'seller_token' ? req.user.id : null,
      origin: origin || allowed_domains[0],
      allowed_domains: allowed_domains.length > 0 ? allowed_domains : [origin],
      expires_at: expiresAt,
      is_active: true,
      token_type,
      max_transactions,
      transactions_count: 0,
      metadata: {
        ...metadata,
        form_type: metadata.form_type || 'ticket', // Guardar el tipo de formulario
        created_by: req.user.email,
        created_at: new Date().toISOString()
      }
    };

    // Guardar token en la base de datos
    const { data: iframeToken, error } = await supabaseAdmin
      .from('iframe_tokens')
      .insert(tokenData)
      .select()
      .single();

    if (error) {
      console.error('Error creating iframe token:', error);
      throw error;
    }

    // Generar URL de embed
    const embedUrl = `${process.env.FRONTEND_URL}/iframe/ticket-purchase?token=${token}`;

    res.json({
      success: true,
      token,
      token_type,
      expires_at: expiresAt,
      embed_url: embedUrl,
      allowed_domains,
      max_transactions,
      instructions: {
        iframe_code: `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0"></iframe>`,
        security_notes: [
          'Este token debe mantenerse privado',
          'Solo funcionará en los dominios especificados',
          token_type === 'public_token' ? 
            `Límite de ${max_transactions || 'ilimitadas'} transacciones` : 
            'Transacciones ilimitadas para vendedor autorizado'
        ]
      }
    });

  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ 
      message: 'Error al generar token de iframe' 
    });
  }
});

// ===== ENDPOINTS PÚBLICOS PARA IFRAME =====

// Obtener información del token (público)
router.get('/public/token-info', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ 
        message: 'Token requerido' 
      });
    }

    const { data: tokenInfo, error } = await supabaseAdmin
      .from('iframe_tokens')
      .select('*') // Seleccionar todo para obtener metadata
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (error || !tokenInfo) {
      return res.status(404).json({ 
        message: 'Token no válido' 
      });
    }

    // Verificar expiración
    if (new Date(tokenInfo.expires_at) < new Date()) {
      return res.status(410).json({ 
        message: 'Token expirado' 
      });
    }

    // Extraer métodos de pago permitidos de metadata
    const allowedPaymentMethods = tokenInfo.metadata?.allowed_payment_methods || [];

    res.json({
      valid: true,
      token_type: tokenInfo.token_type,
      transactions_remaining: tokenInfo.max_transactions ? 
        Math.max(0, tokenInfo.max_transactions - tokenInfo.transactions_count) : 
        'unlimited',
      requires_captcha: tokenInfo.token_type === 'public_token',
      captcha_site_key: process.env.HCAPTCHA_SITE_KEY,
      // NUEVO: incluir métodos de pago permitidos
      allowed_payment_methods: allowedPaymentMethods,
      // Para compatibilidad, indicar si tiene restricciones
      has_payment_restrictions: allowedPaymentMethods.length > 0
    });

  } catch (error) {
    console.error('Token info error:', error);
    res.status(500).json({ 
      message: 'Error al verificar token' 
    });
  }
});

// Iniciar proceso de pago (público y vendedores autorizados)
router.post('/iframe/initiate', 
  authenticateIframe,
  publicPurchaseRateLimiter,
  checkTokenTransactionLimit,
  requireCaptcha,
  async (req, res) => {
  try {
    const { 
      tickets,
      client_phone,
      client_bank_code,
      buyer_email,
      buyer_name,
      buyer_phone,
      buyer_identification
    } = req.body;

    // Log del intento
    await logPurchaseAttempt(req, 'initiate_start');

    // Registrar uso del token
    await supabaseAdmin
      .from('iframe_token_usage')
      .insert({
        token_id: req.iframeToken.id,
        action: 'payment_initiate',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        origin: req.headers.origin || req.headers.referer,
        metadata: {
          is_public: req.user.isPublic,
          tickets_count: tickets.length
        }
      });

    // Validaciones
    if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ 
        message: 'Datos de tickets son requeridos' 
      });
    }

    // CORRECCIÓN: Obtener la cantidad real del primer ticket
    const firstTicket = tickets[0];
    const ticketQuantity = firstTicket.quantity || tickets.length;
    
    console.log('Cantidad de tickets solicitada:', ticketQuantity);
    console.log('Datos del primer ticket:', firstTicket);

    // Límite más estricto para usuarios públicos
    const maxTicketsPerTransaction = req.user.isPublic ? 5 : 10;
    if (ticketQuantity > maxTicketsPerTransaction) {
      return res.status(400).json({ 
        message: `Máximo ${maxTicketsPerTransaction} tickets por transacción` 
      });
    }

    // Validaciones adicionales para usuarios públicos
    if (req.user.isPublic) {
      if (!buyer_email || !buyer_name || !buyer_phone || !buyer_identification) {
        return res.status(400).json({ 
          message: 'Todos los datos del comprador son requeridos' 
        });
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(buyer_email)) {
        return res.status(400).json({ 
          message: 'Email inválido' 
        });
      }
    }

    if (!client_phone || !client_bank_code) {
      return res.status(400).json({ 
        message: 'Teléfono y banco del cliente son requeridos' 
      });
    }

    // Obtener información de la zona
    let actualZoneId = null;
    let ticketPrice = firstTicket.price_usd || 35.00; // Usar el precio que viene del frontend
    let zoneName = firstTicket.zone_name || 'Zona Preferencial';
    let ticketType = firstTicket.ticket_type || 'general';
    
    // Si se pasa un zone_code o zone_name, buscar el UUID correspondiente
    if (firstTicket.zone_id && !firstTicket.zone_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      console.log('Buscando zona por código:', firstTicket.zone_id);
      
      const { data: zoneData, error: zoneError } = await supabaseAdmin
        .from('ticket_zones')
        .select('*')
        .or(`zone_code.eq.${firstTicket.zone_id},zone_name.ilike.%${firstTicket.zone_id}%`)
        .single();
      
      if (zoneData) {
        actualZoneId = zoneData.id;
        ticketPrice = zoneData.price_usd || ticketPrice;
        zoneName = zoneData.zone_name;
        ticketType = zoneData.zone_type === 'vip' ? 'box' : 'general';
        console.log('Zona encontrada:', { id: actualZoneId, name: zoneName, price: ticketPrice });
      } else {
        console.log('Zona no encontrada, usando valores por defecto');
        actualZoneId = null;
      }
    } else if (firstTicket.zone_id) {
      actualZoneId = firstTicket.zone_id;
      
      const { data: zoneData } = await supabaseAdmin
        .from('ticket_zones')
        .select('*')
        .eq('id', actualZoneId)
        .single();
        
      if (zoneData) {
        ticketPrice = zoneData.price_usd || ticketPrice;
        zoneName = zoneData.zone_name;
        ticketType = zoneData.zone_type === 'vip' ? 'box' : 'general';
      }
    }
    
    const isBoxPurchase = ticketType === 'box';
    
    console.log('Verificando disponibilidad para:', {
      zone_type: ticketType,
      zone_id: actualZoneId,
      zone_name: zoneName,
      quantity: ticketQuantity, // Usar la cantidad correcta
      isBoxPurchase
    });

    // Verificar disponibilidad
    if (isBoxPurchase && actualZoneId) {
      const { data: box, error: boxError } = await supabaseAdmin
        .from('concert_boxes')
        .select('*')
        .eq('zone_id', actualZoneId)
        .eq('status', 'available')
        .single();

      if (boxError || !box) {
        return res.status(400).json({ 
          message: 'Box no disponible' 
        });
      }
      
      ticketPrice = box.price_usd / box.capacity;
    } else {
      const { data: venueStats, error: statsError } = await supabaseAdmin
        .rpc('get_venue_statistics');

      if (statsError) {
        console.error('Error getting venue stats:', statsError);
        const { data: inventory } = await supabaseAdmin
          .from('ticket_inventory')
          .select('available_count')
          .single();
          
        const availableTickets = inventory?.available_count || 0;
        
        if (availableTickets < ticketQuantity) {
          return res.status(400).json({ 
            message: `Solo quedan ${availableTickets} entradas disponibles` 
          });
        }
      } else {
        const availableGeneral = venueStats?.general_zone?.available || 0;
        
        console.log('Disponibilidad zona general:', availableGeneral);
        
        if (availableGeneral < ticketQuantity) {
          return res.status(400).json({ 
            message: `Solo quedan ${availableGeneral} entradas disponibles en zona general` 
          });
        }
      }
    }

    // CORRECCIÓN: Calcular el total con la cantidad correcta
    const totalUSD = ticketQuantity * ticketPrice;
    console.log(`Calculando total: ${ticketQuantity} tickets x $${ticketPrice} = $${totalUSD}`);

    // Obtener tasa de cambio actual
    const { data: exchangeRate } = await supabaseAdmin
      .from('exchange_rates')
      .select('rate')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (!exchangeRate) {
      return res.status(500).json({ 
        message: 'No se pudo obtener la tasa de cambio' 
      });
    }

    const totalBs = totalUSD * exchangeRate.rate;
    console.log(`Total en Bs: ${totalBs} (tasa: ${exchangeRate.rate})`);

    // CORRECCIÓN: Crear la cantidad correcta de tickets
    const createdTickets = [];
    
    for (let i = 0; i < ticketQuantity; i++) {
      // Generar códigos únicos
      const ticketNumber = `TCK-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}`;
      const qrCode = `QR-${uuidv4()}`;
      const barcode = `BAR-${Date.now()}${Math.random().toString(36).substring(2, 9)}`;

      const ticketInsertData = {
        ticket_number: ticketNumber,
        qr_code: qrCode,
        barcode: barcode,
        buyer_name: req.user.isPublic ? buyer_name : firstTicket.buyer_name,
        buyer_email: req.user.isPublic ? buyer_email : firstTicket.buyer_email,
        buyer_phone: req.user.isPublic ? buyer_phone : firstTicket.buyer_phone,
        buyer_identification: req.user.isPublic ? buyer_identification : firstTicket.buyer_identification,
        payment_method: 'pago_movil',
        payment_status: 'pendiente',
        sold_by: req.user.isPublic ? null : req.user.id,
        ticket_price: ticketPrice,
        ticket_type: ticketType,
        zone_name: zoneName,
        seat_number: firstTicket.seat_ids?.[i] || null,
        notes: JSON.stringify({
          zone_info: {
            zone_code: firstTicket.zone_id,
            zone_name: zoneName,
            zone_uuid: actualZoneId
          },
          is_iframe_purchase: true,
          purchase_session: Date.now(),
          ticket_index: i + 1,
          total_quantity: ticketQuantity
        })
      };

      // Solo agregar zone_id si es un UUID válido
      if (actualZoneId) {
        ticketInsertData.zone_id = actualZoneId;
      }

      const { data: ticket, error: ticketError } = await supabaseAdmin
        .from('concert_tickets')
        .insert(ticketInsertData)
        .select()
        .single();

      if (ticketError) {
        console.error('Ticket creation error:', ticketError);
        // Si falla la creación de un ticket, hacer rollback de los anteriores
        if (createdTickets.length > 0) {
          await supabaseAdmin
            .from('concert_tickets')
            .delete()
            .in('id', createdTickets.map(t => t.id));
        }
        throw new Error('Error creando tickets: ' + ticketError.message);
      }

      createdTickets.push(ticket);
    }

    console.log(`Creados ${createdTickets.length} tickets exitosamente`);

    // Crear la transacción
    const invoiceNumber = megasoftService.generateInvoiceNumber();
    const controlNumber = uuidv4();

    const transactionData = {
      user_id: req.user.isPublic ? 
        req.iframeToken.user_id || '00000000-0000-0000-0000-000000000000' : 
        req.user.id,
      ticket_ids: createdTickets.map(t => t.id),
      control_number: controlNumber,
      invoice_number: invoiceNumber,
      amount_usd: totalUSD,
      amount_bs: totalBs,
      exchange_rate: exchangeRate.rate,
      client_phone: client_phone,
      client_bank_code: client_bank_code,
      status: 'pending',
      gateway_response: {
        is_public_purchase: req.user.isPublic,
        token_id: req.iframeToken.id,
        token_type: req.iframeToken.token_type,
        origin: req.headers.origin || req.headers.referer,
        payment_method: 'pago_movil',
        ticket_count: createdTickets.length, // Usar el count real
        ticket_type: ticketType,
        zone_id: actualZoneId,
        zone_name: zoneName,
        zone_code: firstTicket.zone_id,
        buyer_info: req.user.isPublic ? {
          email: buyer_email,
          name: buyer_name,
          phone: buyer_phone,
          identification: buyer_identification
        } : null,
        from_iframe: true,
        created_at: new Date().toISOString()
      }
    };

    const { data: transaction, error: transError } = await supabaseAdmin
      .from('ticket_payment_transactions')
      .insert(transactionData)
      .select()
      .single();

    if (transError) {
      console.error('Transaction creation error:', transError);
      
      if (createdTickets.length > 0) {
        await supabaseAdmin
          .from('concert_tickets')
          .delete()
          .in('id', createdTickets.map(t => t.id));
      }
      
      throw transError;
    }

    // Actualizar tickets con transaction_id
    for (const ticket of createdTickets) {
      const currentNotes = typeof ticket.notes === 'string' ? 
        JSON.parse(ticket.notes) : 
        ticket.notes || {};
      
      const updatedNotes = {
        ...currentNotes,
        transaction_id: transaction.id
      };
      
      await supabaseAdmin
        .from('concert_tickets')
        .update({ 
          notes: JSON.stringify(updatedNotes)
        })
        .eq('id', ticket.id);
    }

    // Reservar en inventario
    if (!isBoxPurchase) {
      try {
        const INVENTORY_ID = '00000000-0000-0000-0000-000000000001';
        
        const { data: currentInventory, error: fetchError } = await supabaseAdmin
          .from('ticket_inventory')
          .select('*')
          .eq('id', INVENTORY_ID)
          .single();
          
        if (fetchError || !currentInventory) {
          console.error('Could not fetch inventory:', fetchError);
        } else {
          const available = currentInventory.available_count || currentInventory.available_tickets || 0;
          const currentReserved = currentInventory.reserved_count || currentInventory.reserved_tickets || 0;
          
          if (available >= ticketQuantity) {
            const { data: updatedInventory, error: updateError } = await supabaseAdmin
              .from('ticket_inventory')
              .update({
                reserved_tickets: currentReserved + ticketQuantity, // Usar cantidad correcta
                updated_at: new Date().toISOString()
              })
              .eq('id', INVENTORY_ID)
              .select()
              .single();
              
            if (updateError) {
              console.error('Inventory update error:', updateError);
            } else {
              console.log(`Reserved ${ticketQuantity} tickets in inventory`);
            }
          }
        }
      } catch (e) {
        console.log('Error reserving inventory:', e.message);
      }
    }

    // Obtener configuración del comercio
    const { data: commerceConfig } = await supabaseAdmin
      .from('payment_config')
      .select('*')
      .eq('payment_method', 'pago_movil')
      .eq('is_active', true)
      .single();

    // Log exitoso
    await logPurchaseAttempt(req, 'initiate_success');

    res.json({
      success: true,
      transactionId: transaction.id,
      invoiceNumber,
      controlNumber,
      paymentDetails: {
        commerce_phone: commerceConfig?.commerce_phone || process.env.MEGASOFT_COMMERCE_PHONE || '04141234567',
        commerce_bank_code: commerceConfig?.commerce_bank_code || process.env.MEGASOFT_COMMERCE_BANK_CODE || '0138',
        commerce_bank_name: commerceConfig?.commerce_bank_name || 'Banco Plaza',
        commerce_rif: commerceConfig?.commerce_rif || 'J-12345678-9',
        amount: {
          usd: totalUSD,
          bs: totalBs,
          exchangeRate: exchangeRate.rate
        }
      },
      tickets: createdTickets.map(t => ({
        id: t.id,
        ticket_number: t.ticket_number,
        buyer_name: t.buyer_name
      })),
      message: `Proceso de pago iniciado para ${ticketQuantity} entrada(s). Complete la transferencia y confirme.`,
      iframe: {
        tokenId: req.iframeToken.id,
        origin: req.iframeToken.origin,
        isPublic: req.user.isPublic
      }
    });

  } catch (error) {
    console.error('Payment initiation error:', error);
    await logPurchaseAttempt(req, 'initiate_error');
    
    res.status(500).json({ 
      message: 'Error al iniciar proceso de pago',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Corrección del endpoint /iframe/confirm
router.post('/iframe/confirm', 
  authenticateIframe,
  async (req, res) => {
  try {
    const { 
      transactionId,
      reference,
      cedula 
    } = req.body;

    // Registrar uso del token
    await supabaseAdmin
      .from('iframe_token_usage')
      .insert({
        token_id: req.iframeToken.id,
        action: 'payment_confirm',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        metadata: { transactionId, reference }
      });

    // Verificar que la transacción existe
    const { data: transaction, error: transError } = await supabaseAdmin
      .from('ticket_payment_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (transError || !transaction) {
      return res.status(404).json({ 
        message: 'Transacción no encontrada' 
      });
    }

    // Verificar que la transacción pertenece al token correcto
    // Como no hay metadata, verificamos en gateway_response
    const transactionMetadata = transaction.gateway_response || {};
    if (transactionMetadata.token_id !== req.iframeToken.id) {
      return res.status(403).json({ 
        message: 'No autorizado para confirmar esta transacción' 
      });
    }

    // Verificar que no esté ya confirmada
    if (transaction.status === 'approved') {
      return res.status(400).json({ 
        message: 'Esta transacción ya fue confirmada' 
      });
    }

    // INTEGRACIÓN CON MEGASOFT
     try {
      // Step 1: Pre-registro con Megasoft
      console.log('[Megasoft] Starting pre-registro...');
      const preRegistroResult = await megasoftService.preRegistro();
      
      if (!preRegistroResult.success) {
        throw new Error(`Pre-registro failed: ${preRegistroResult.descripcion}`);
      }

      const controlNumber = preRegistroResult.control;
      console.log('[Megasoft] Control number obtained:', controlNumber);

      // Step 2: Process P2C payment
      console.log('[Megasoft] Processing P2C payment...');
      const paymentData = {
        control: controlNumber,
        telefonoCliente: transaction.client_phone,
        codigoBancoCliente: transaction.client_bank_code,
        amount: transaction.amount_bs,
        factura: transaction.invoice_number,
        referencia: reference,
        cid: cedula || transactionMetadata.buyer_info?.identification || 'V00000000'
      };

      const paymentResult = await megasoftService.procesarCompraP2C(paymentData);

      // IMPORTANTE: Loguear el voucher recibido
      console.log('[Megasoft] Voucher recibido:', {
        hasVoucher: !!paymentResult.voucher,
        hasVoucherText: !!paymentResult.voucherText,
        voucherType: typeof paymentResult.voucher,
        voucherTextType: typeof paymentResult.voucherText
      });

      // Actualizar transacción con respuesta de Megasoft
      const updateData = {
        megasoft_authid: paymentResult.authid,
        megasoft_terminal: paymentResult.terminal,
        megasoft_lote: paymentResult.lote,
        megasoft_seqnum: paymentResult.seqnum,
        // CORRECCIÓN: Guardar el voucher correctamente
        megasoft_voucher: paymentResult.voucherText || 
                         (Array.isArray(paymentResult.voucher) ? 
                           paymentResult.voucher.join('\n') : 
                           paymentResult.voucher),
        status: paymentResult.success ? 'approved' : 'failed',
        reference: reference,
        gateway_response: {
          ...transactionMetadata,
          megasoft_response: paymentResult.rawResponse,
          confirmed_at: new Date().toISOString(),
          confirmed_by: req.user.isPublic ? 'public_user' : req.user.id,
          error_message: paymentResult.success ? null : paymentResult.descripcion,
          // NUEVO: Guardar el voucher también en gateway_response
          voucher_data: {
            text: paymentResult.voucherText,
            lines: paymentResult.voucher,
            isDuplicated: paymentResult.voucherText?.includes('DUPLICADO') || false
          }
        }
      };

      if (paymentResult.success) {
        updateData.completed_at = new Date().toISOString();
        console.log('[Megasoft] Payment approved!');

        try {
          const ticketsData = await supabaseAdmin
            .from('concert_tickets')
            .select('*')
            .in('id', transaction.ticket_ids);
          
          // CORRECCIÓN COMPLETA: Preparar TODOS los datos del pago incluyendo el voucher
          const paymentInfo = {
            payment_method: 'pago_movil',
            reference: reference,
            status: 'approved',
            amount_usd: transaction.amount_usd,
            amount_bs: transaction.amount_bs,
            totalAmount: transaction.amount_usd, // IMPORTANTE: totalAmount debe estar presente
            
            // DATOS CRÍTICOS DE MEGASOFT PARA EL VOUCHER
            auth_id: paymentResult.authid,
            control: controlNumber,
            terminal: paymentResult.terminal,
            lote: paymentResult.lote,
            seqnum: paymentResult.seqnum,
            
            // VOUCHER - ASEGURAR QUE SIEMPRE SE INCLUYA
            voucher: paymentResult.voucherText || 
                    (Array.isArray(paymentResult.voucher) ? 
                      paymentResult.voucher.join('\n') : 
                      paymentResult.voucher) || 
                    'Sin voucher disponible',
            
            // Información adicional del voucher
            voucher_lines: Array.isArray(paymentResult.voucher) ? 
                          paymentResult.voucher : 
                          (paymentResult.voucherText ? 
                            paymentResult.voucherText.split('\n') : []),
            
            // Datos del comercio para el voucher
            commerce_phone: process.env.MEGASOFT_COMMERCE_PHONE,
            commerce_bank_code: process.env.MEGASOFT_COMMERCE_BANK_CODE,
            bank_name: megasoftService.getBankName(process.env.MEGASOFT_COMMERCE_BANK_CODE),
            commerce_rif: process.env.COMPANY_RIF || 'J-12345678-9',
            
            // Metadata adicional
            transaction_id: transactionId,
            factura: transaction.invoice_number,
            afiliacion: paymentResult.afiliacion || process.env.MEGASOFT_COD_AFILIACION,
            rifbanco: paymentResult.rifbanco,
            authname: paymentResult.authname,
            
            // Timestamp
            confirmed_at: new Date().toISOString()
          };
          
          // IMPORTANTE: Loguear lo que se enviará al email
          console.log('[Email] Enviando confirmación con voucher:', {
            hasVoucher: !!paymentInfo.voucher,
            voucherLength: paymentInfo.voucher?.length,
            voucherPreview: paymentInfo.voucher?.substring(0, 100),
            terminal: paymentInfo.terminal,
            control: paymentInfo.control,
            authId: paymentInfo.auth_id
          });
          
          await handlePaymentEmailFlow(ticketsData.data, paymentInfo, 'pago_movil');
          
          console.log('Confirmation emails sent successfully with voucher');
        } catch (emailError) {
          console.error('Error sending confirmation emails:', emailError);
          // No fallar la transacción por error de email
        }
      }

      await supabaseAdmin
        .from('ticket_payment_transactions')
        .update(updateData)
        .eq('id', transactionId);

      if (paymentResult.success) {
        console.log('[Megasoft] Payment approved!');
        
        // Confirmar tickets
        const { error: ticketsError } = await supabaseAdmin
          .from('concert_tickets')
          .update({
            payment_status: 'confirmado',
            payment_reference: reference,
            confirmed_at: new Date().toISOString(),
            confirmed_by: req.user.isPublic ? null : req.user.id,
            // Guardar control y authid en notes ya que no existen columnas específicas
            notes: `Megasoft - Control: ${controlNumber}, AuthID: ${paymentResult.authid}, Transaction: ${transactionId}`
          })
          .in('id', transaction.ticket_ids);

        if (ticketsError) {
          console.error('Error updating tickets:', ticketsError);
        }

        // Confirmar venta en inventario
        const ticketCount = transaction.ticket_ids?.length || transactionMetadata.ticket_count || 0;
        await supabaseAdmin.rpc('confirm_ticket_sale', { 
          quantity: ticketCount 
        });

        // Incrementar contador de transacciones del token
        if (req.iframeToken.token_type === 'public_token') {
          await supabaseAdmin
            .from('iframe_tokens')
            .update({ 
              transactions_count: req.iframeToken.transactions_count + 1 
            })
            .eq('id', req.iframeToken.id);
        }

        // Log exitoso
        await logPurchaseAttempt(req, 'confirm_success');

        // Preparar respuesta exitosa
        const successResponse = {
          success: true,
          message: 'Pago confirmado exitosamente',
          transactionId,
          reference,
          control: controlNumber,
          authId: paymentResult.authid,
          // IMPORTANTE: Incluir el voucher en la respuesta
          voucher: paymentResult.voucherText || paymentResult.voucher,
          terminal: paymentResult.terminal,
          lote: paymentResult.lote,
          seqnum: paymentResult.seqnum,
          tickets: ticketCount,
          downloadUrl: req.user.isPublic ? 
            null : 
            `${process.env.FRONTEND_URL}/download-tickets/${transactionId}?token=${req.iframeToken.token}`
        };

        // Enviar tickets por email si es compra pública
        if (req.user.isPublic && transactionMetadata.buyer_info?.email) {
          try {
            // Obtener tickets completos
            const { data: ticketsData } = await supabaseAdmin
              .from('concert_tickets')
              .select('*')
              .in('id', transaction.ticket_ids);

            await generateAndSendTicketEmails(ticketsData);
            console.log('Tickets sent to:', transactionMetadata.buyer_info.email);
          } catch (emailError) {
            console.error('Error sending tickets:', emailError);
            // No fallar la transacción por error de email
          }
        }

        res.json(successResponse);

      } else {
        // Payment was rejected by Megasoft
        console.log('[Megasoft] Payment rejected:', paymentResult.descripcion);
        
        // Liberar inventario
        const ticketCount = transaction.ticket_ids?.length || transactionMetadata.ticket_count || 0;
        if (ticketCount > 0) {
          await supabaseAdmin.rpc('release_ticket_inventory', { 
            quantity: ticketCount 
          });
        }

        // Actualizar tickets como fallidos
        await supabaseAdmin
          .from('concert_tickets')
          .update({
            payment_status: 'rechazado',
            notes: `Pago rechazado: ${paymentResult.descripcion}`
          })
          .in('id', transaction.ticket_ids);

        await logPurchaseAttempt(req, 'payment_rejected');

        res.status(400).json({
          success: false,
          message: `Pago rechazado: ${paymentResult.descripcion}`,
          code: paymentResult.codigo,
          reference: reference,
          // IMPORTANTE: Incluir voucher incluso en caso de rechazo
          voucher: paymentResult.voucherText || paymentResult.voucher || null
        });
      }

    } catch (megasoftError) {
      console.error('[Megasoft] Error processing payment:', megasoftError);
      
      // Actualizar transacción como fallida
      await supabaseAdmin
        .from('ticket_payment_transactions')
        .update({
          status: 'failed',
          gateway_response: {
            ...transactionMetadata,
            error_message: megasoftError.message,
            error_at: new Date().toISOString()
          }
        })
        .eq('id', transactionId);

      // Liberar inventario
      const ticketCount = transaction.ticket_ids?.length || 0;
      if (ticketCount > 0) {
        await supabaseAdmin.rpc('release_ticket_inventory', { 
          quantity: ticketCount 
        });
      }

      await logPurchaseAttempt(req, 'megasoft_error');

      res.status(500).json({
        success: false,
        message: 'Error procesando el pago. Por favor intente nuevamente.',
        error: process.env.NODE_ENV === 'development' ? megasoftError.message : undefined,
        voucher: megasoftError.voucher || null
      });
    }

  } catch (error) {
    console.error('Payment confirmation error:', error);
    await logPurchaseAttempt(req, 'confirm_error');
    
    res.status(500).json({ 
      message: 'Error al confirmar pago',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/iframe/initiate-box', 
  authenticateIframe,
  publicPurchaseRateLimiter,
  checkTokenTransactionLimit,
  requireCaptcha,
  async (req, res) => {
  try {
    const { 
      box_code,
      client_phone,
      client_bank_code,
      buyer_email,
      buyer_name,
      buyer_phone,
      buyer_identification
    } = req.body;

    // Log del intento
    await logPurchaseAttempt(req, 'box_initiate_start');

    // Registrar uso del token
    await supabaseAdmin
      .from('iframe_token_usage')
      .insert({
        token_id: req.iframeToken.id,
        action: 'box_payment_initiate',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        metadata: {
          box_code,
          is_public: req.user.isPublic
        }
      });

    // Verificar disponibilidad del box
    const { data: box } = await supabaseAdmin
      .from('concert_boxes')
      .select('*')
      .eq('box_code', box_code.toUpperCase())
      .eq('status', 'available')
      .single();

    if (!box) {
      return res.status(400).json({ 
        message: 'Box no disponible' 
      });
    }

    // Reservar el box temporalmente
    const { data: reservation } = await supabaseAdmin
      .rpc('reserve_box', {
        p_box_code: box_code.toUpperCase(),
        p_session_id: uuidv4(),
        p_buyer_email: buyer_email,
        p_buyer_phone: buyer_phone,
        p_minutes: 15
      });

    if (!reservation?.success) {
      return res.status(400).json({ 
        message: 'No se pudo reservar el box' 
      });
    }

    // Calcular montos
    const totalUSD = box.price_usd;

    // Obtener tasa de cambio
    const { data: exchangeRate } = await supabaseAdmin
      .from('exchange_rates')
      .select('rate')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    const totalBs = totalUSD * (exchangeRate?.rate || 40);

    // Crear transacción
    const invoiceNumber = megasoftService.generateInvoiceNumber();
    const controlNumber = uuidv4();

    const { data: transaction, error: transError } = await supabaseAdmin
      .from('ticket_payment_transactions')
      .insert({
        user_id: req.user.isPublic ? null : req.user.id,
        amount_usd: totalUSD,
        amount_bs: totalBs,
        exchange_rate: exchangeRate?.rate || 40,
        status: 'pending',
        payment_method: 'pago_movil',
        invoice_number: invoiceNumber,
        control_number: controlNumber,
        client_phone,
        client_bank_code,
        metadata: {
          type: 'box',
          box_code: box_code.toUpperCase(),
          box_id: box.id,
          reservation_id: reservation.box_id,
          is_public_purchase: req.user.isPublic,
          token_id: req.iframeToken.id,
          buyer_info: {
            email: buyer_email,
            name: buyer_name,
            phone: buyer_phone,
            identification: buyer_identification
          }
        }
      })
      .select()
      .single();

    if (transError) {
      console.error('Transaction creation error:', transError);
      throw transError;
    }

    // Obtener configuración del comercio
    const { data: commerceConfig } = await supabaseAdmin
      .from('payment_commerce_config')
      .select('*')
      .eq('is_active', true)
      .single();

    res.json({
      success: true,
      transactionId: transaction.id,
      invoiceNumber,
      controlNumber,
      boxInfo: {
        code: box.box_code,
        number: box.box_number,
        capacity: box.capacity,
        floor_level: box.floor_level,
        amenities: box.amenities
      },
      paymentDetails: {
        commerce_phone: commerceConfig?.commerce_phone,
        commerce_bank_code: commerceConfig?.commerce_bank_code,
        commerce_bank_name: commerceConfig?.commerce_bank_name,
        amount: {
          usd: totalUSD,
          bs: totalBs,
          exchangeRate: exchangeRate?.rate || 40
        }
      },
      reservation: {
        expires_at: reservation.reserved_until
      },
      message: 'Box reservado. Complete la transferencia en los próximos 15 minutos.'
    });

  } catch (error) {
    console.error('Box payment initiation error:', error);
    await logPurchaseAttempt(req, 'box_initiate_error');
    
    res.status(500).json({ 
      message: 'Error al iniciar proceso de pago del box',
      error: error.message 
    });
  }
});

// Confirmar pago móvil - VERSIÓN IFRAME CON MEGASOFT
router.post('/iframe/confirm', 
  authenticateIframe,
  async (req, res) => {
  try {
    const { 
      transactionId,
      reference,
      cedula 
    } = req.body;

    // Registrar uso del token
    await supabaseAdmin
      .from('iframe_token_usage')
      .insert({
        token_id: req.iframeToken.id,
        action: 'payment_confirm',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        metadata: { transactionId, reference }
      });

    // Verificar que la transacción existe
    const { data: transaction, error: transError } = await supabaseAdmin
      .from('ticket_payment_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (transError || !transaction) {
      return res.status(404).json({ 
        message: 'Transacción no encontrada' 
      });
    }

    // Verificar que la transacción pertenece al token correcto
    // Como no hay metadata, verificamos en gateway_response
    const transactionMetadata = transaction.gateway_response || {};
    if (transactionMetadata.token_id !== req.iframeToken.id) {
      return res.status(403).json({ 
        message: 'No autorizado para confirmar esta transacción' 
      });
    }

    // Verificar que no esté ya confirmada
    if (transaction.status === 'approved') {
      return res.status(400).json({ 
        message: 'Esta transacción ya fue confirmada' 
      });
    }

    // INTEGRACIÓN CON MEGASOFT
    try {
      // Step 1: Pre-registro con Megasoft
      console.log('[Megasoft] Starting pre-registro...');
      const preRegistroResult = await megasoftService.preRegistro();
      
      if (!preRegistroResult.success) {
        throw new Error(`Pre-registro failed: ${preRegistroResult.descripcion}`);
      }

      const controlNumber = preRegistroResult.control;
      console.log('[Megasoft] Control number obtained:', controlNumber);

      // Actualizar transacción con control number
      await supabaseAdmin
        .from('ticket_payment_transactions')
        .update({ 
          megasoft_control: controlNumber,
          control_number: controlNumber 
        })
        .eq('id', transactionId);

      // Step 2: Process P2C payment
      console.log('[Megasoft] Processing P2C payment...');
      const paymentData = {
        control: controlNumber,
        telefonoCliente: transaction.client_phone,
        codigoBancoCliente: transaction.client_bank_code,
        amount: transaction.amount_bs,
        factura: transaction.invoice_number,
        referencia: reference,
        cid: cedula || transactionMetadata.buyer_info?.identification || 'V00000000'
      };

      const paymentResult = await megasoftService.procesarCompraP2C(paymentData);

      // Actualizar transacción con respuesta de Megasoft
      const updateData = {
        megasoft_authid: paymentResult.authid,
        megasoft_terminal: paymentResult.terminal,
        megasoft_lote: paymentResult.lote,
        megasoft_seqnum: paymentResult.seqnum,
        megasoft_voucher: paymentResult.voucherText || JSON.stringify(paymentResult.voucher),
        status: paymentResult.success ? 'approved' : 'failed',
        reference: reference,
        gateway_response: {
          ...transactionMetadata, // Mantener metadata anterior
          megasoft_response: paymentResult.rawResponse,
          confirmed_at: new Date().toISOString(),
          confirmed_by: req.user.isPublic ? 'public_user' : req.user.id,
          error_message: paymentResult.success ? null : paymentResult.descripcion
        }
      };

      if (paymentResult.success) {
        updateData.completed_at = new Date().toISOString();
        console.log('[Megasoft] Payment approved!');

        try {
          const ticketsData = await supabaseAdmin
            .from('concert_tickets')
            .select('*')
            .in('id', transaction.ticket_ids);

          // AQUÍ ESTÁ EL PROBLEMA - FALTA totalAmount
          const paymentInfo = {
            payment_method: 'pago_movil',
            reference: reference,
            status: 'approved',
            amount_usd: transaction.amount_usd,
            amount_bs: transaction.amount_bs,
            totalAmount: transaction.amount_usd || '0', // ← AGREGAR ESTA LÍNEA
            auth_id: paymentResult.authid,
            control: controlNumber,
            terminal: paymentResult.terminal,
            transaction_id: transactionId,
            voucher: paymentResult.voucherText
          };

          await handlePaymentEmailFlow(ticketsData.data, paymentInfo, 'pago_movil');

          console.log('Confirmation emails sent successfully');
        } catch (emailError) {
          console.error('Error sending confirmation emails:', emailError);
          // No fallar la transacción por error de email
        }
      }

      await supabaseAdmin
        .from('ticket_payment_transactions')
        .update(updateData)
        .eq('id', transactionId);

      if (paymentResult.success) {
        console.log('[Megasoft] Payment approved!');
        
        // Confirmar tickets
        const { error: ticketsError } = await supabaseAdmin
          .from('concert_tickets')
          .update({
            payment_status: 'confirmado',
            payment_reference: reference,
            confirmed_at: new Date().toISOString(),
            confirmed_by: req.user.isPublic ? null : req.user.id
          })
          .in('id', transaction.ticket_ids);

        if (ticketsError) {
          console.error('Error updating tickets:', ticketsError);
        }

        // Confirmar venta en inventario
        const ticketCount = transaction.ticket_ids?.length || transactionMetadata.ticket_count || 0;
        await supabaseAdmin.rpc('confirm_ticket_sale', { 
          quantity: ticketCount 
        });

        // Incrementar contador de transacciones del token
        if (req.iframeToken.token_type === 'public_token') {
          await supabaseAdmin
            .from('iframe_tokens')
            .update({ 
              transactions_count: req.iframeToken.transactions_count + 1 
            })
            .eq('id', req.iframeToken.id);
        }

        // Log exitoso
        await logPurchaseAttempt(req, 'confirm_success');

        // Preparar respuesta exitosa
        const successResponse = {
          success: true,
          message: 'Pago confirmado exitosamente',
          transactionId,
          reference,
          control: controlNumber,
          authId: paymentResult.authid,
          voucher: paymentResult.voucherText || paymentResult.voucher,
          tickets: ticketCount,
          downloadUrl: req.user.isPublic ? 
            null : // Para usuarios públicos, enviar por email
            `${process.env.FRONTEND_URL}/download-tickets/${transactionId}?token=${req.iframeToken.token}`
        };

        // Enviar tickets por email si es compra pública
        if (req.user.isPublic && transactionMetadata.buyer_info?.email) {
          try {
            // Obtener tickets completos
            const { data: ticketsData } = await supabaseAdmin
              .from('concert_tickets')
              .select('*')
              .in('id', transaction.ticket_ids);

            await generateAndSendTicketEmails(ticketsData);
            console.log('Tickets sent to:', transactionMetadata.buyer_info.email);
          } catch (emailError) {
            console.error('Error sending tickets:', emailError);
            // No fallar la transacción por error de email
          }
        }

        res.json(successResponse);

      } else {
        // Payment was rejected by Megasoft
        console.log('[Megasoft] Payment rejected:', paymentResult.descripcion);
        
        // Liberar inventario
        const ticketCount = transaction.ticket_ids?.length || transactionMetadata.ticket_count || 0;
        await supabaseAdmin.rpc('release_ticket_inventory', { 
          quantity: ticketCount 
        });

        // Actualizar tickets como fallidos
        await supabaseAdmin
          .from('concert_tickets')
          .update({
            payment_status: 'rechazado',
            notes: `Pago rechazado: ${paymentResult.descripcion}`
          })
          .in('id', transaction.ticket_ids);

        await logPurchaseAttempt(req, 'payment_rejected');

        res.status(400).json({
          success: false,
          message: `Pago rechazado: ${paymentResult.descripcion}`,
          code: paymentResult.codigo,
          reference: reference,
          voucher: paymentResult.voucherText || paymentResult.voucher
        });
      }

    } catch (megasoftError) {
      console.error('[Megasoft] Error processing payment:', megasoftError);
      
      // Actualizar transacción como fallida
      await supabaseAdmin
        .from('ticket_payment_transactions')
        .update({
          status: 'failed',
          gateway_response: {
            ...transactionMetadata,
            error_message: megasoftError.message,
            error_at: new Date().toISOString()
          }
        })
        .eq('id', transactionId);

      // Liberar inventario
      const ticketCount = transaction.ticket_ids?.length || 0;
      if (ticketCount > 0) {
        await supabaseAdmin.rpc('release_ticket_inventory', { 
          quantity: ticketCount 
        });
      }

      await logPurchaseAttempt(req, 'megasoft_error');

      res.status(500).json({
        success: false,
        message: 'Error procesando el pago. Por favor intente nuevamente.',
        error: process.env.NODE_ENV === 'development' ? megasoftError.message : undefined
      });
    }

  } catch (error) {
    console.error('Payment confirmation error:', error);
    await logPurchaseAttempt(req, 'confirm_error');
    
    res.status(500).json({ 
      message: 'Error al confirmar pago',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Endpoint público para verificar estado
router.get('/public/status/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { token } = req.query;

    let isAuthorized = false;

    // Si hay token, verificarlo
    if (token) {
      const { data: iframeToken } = await supabaseAdmin
        .from('iframe_tokens')
        .select('id')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (iframeToken) {
        // Verificar que la transacción pertenece a este token
        const { data: transaction } = await supabaseAdmin
          .from('ticket_payment_transactions')
          .select('gateway_response')
          .eq('id', transactionId)
          .single();

        // Como no hay metadata, verificamos en gateway_response
        if (transaction?.gateway_response?.token_id === iframeToken.id) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ 
        message: 'No autorizado para ver esta transacción' 
      });
    }

    // Obtener información básica de la transacción
    const { data: transaction, error } = await supabaseAdmin
      .from('ticket_payment_transactions')
      .select(`
        id,
        status,
        amount_usd,
        amount_bs,
        created_at,
        completed_at,
        ticket_ids,
        megasoft_control,
        megasoft_authid,
        megasoft_voucher,
        gateway_response
      `)
      .eq('id', transactionId)
      .single();

    if (error || !transaction) {
      return res.status(404).json({ 
        message: 'Transacción no encontrada' 
      });
    }

    // Extraer ticket_count de gateway_response ya que no existe columna directa
    const ticketCount = transaction.ticket_ids?.length || 
                       transaction.gateway_response?.ticket_count || 0;

    res.json({
      transactionId: transaction.id,
      status: transaction.status,
      amount: {
        usd: transaction.amount_usd,
        bs: transaction.amount_bs
      },
      ticketCount: ticketCount,
      createdAt: transaction.created_at,
      completedAt: transaction.completed_at,
      megasoft: {
        control: transaction.megasoft_control,
        authId: transaction.megasoft_authid,
        voucher: transaction.megasoft_voucher
      },
      error: transaction.gateway_response?.error_message || null
    });

  } catch (error) {
    console.error('Public status check error:', error);
    res.status(500).json({ 
      message: 'Error al verificar estado' 
    });
  }
});

// ===== ENDPOINTS DE ADMINISTRACIÓN =====

// Revocar token de iframe
router.post('/revoke-iframe-token', authenticateToken, requireAnyPermission(
  { resource: 'tickets', action: 'manage' },
  { resource: 'tickets', action: 'sell' }
), async (req, res) => {
  try {
    const { token } = req.body;

    // Verificar que el usuario puede revocar este token
    const { data: tokenData } = await supabaseAdmin
      .from('iframe_tokens')
      .select('user_id, token_type')
      .eq('token', token)
      .single();

    if (!tokenData) {
      return res.status(404).json({ 
        message: 'Token no encontrado' 
      });
    }

    // Solo el creador o un admin puede revocar
    const hasManagePermission = req.user.permissions?.includes('tickets:manage');
    if (tokenData.user_id !== req.user.id && !hasManagePermission) {
      return res.status(403).json({ 
        message: 'No autorizado para revocar este token' 
      });
    }

    const { error } = await supabaseAdmin
      .from('iframe_tokens')
      .update({ is_active: false })
      .eq('token', token);

    if (error) {
      throw error;
    }

    res.json({ 
      success: true,
      message: 'Token revocado exitosamente' 
    });

  } catch (error) {
    console.error('Token revocation error:', error);
    res.status(500).json({ 
      message: 'Error al revocar token' 
    });
  }
});

// Listar tokens del usuario
router.get('/my-tokens', authenticateToken, requireAnyPermission(
  { resource: 'tickets', action: 'manage' },
  { resource: 'tickets', action: 'sell' }
), async (req, res) => {
  try {
    let tokens = [];
    
    // Verificar permisos del usuario
    const hasManagePermission = req.user.permissions?.includes('tickets:manage') || 
                                req.user.permissions?.includes('system:manage_all') ||
                                req.user.role === 'admin';

    console.log('[MY-TOKENS] Usuario:', req.user.email);
    console.log('[MY-TOKENS] Tiene permisos de gestión:', hasManagePermission);

    if (hasManagePermission) {
      // Si tiene permisos de gestión, obtener TODOS los tokens
      const { data: allTokens, error } = await supabaseAdmin
        .from('iframe_tokens')
        .select(`
          *,
          users:user_id(id, email, full_name),
          usage_count:iframe_token_usage(count)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[MY-TOKENS] Error obteniendo todos los tokens:', error);
        throw error;
      }

      tokens = allTokens || [];
      console.log(`[MY-TOKENS] Tokens encontrados (TODOS): ${tokens.length}`);
      
    } else {
      // Si NO tiene permisos de gestión, obtener solo sus tokens
      // IMPORTANTE: Los tokens públicos tienen user_id = NULL, por lo que necesitamos
      // una consulta especial para incluirlos si fueron creados por este usuario
      
      // Primero, obtener tokens donde user_id = usuario actual
      const { data: userTokens, error: userError } = await supabaseAdmin
        .from('iframe_tokens')
        .select(`
          *,
          users:user_id(id, email, full_name),
          usage_count:iframe_token_usage(count)
        `)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });

      if (userError) {
        console.error('[MY-TOKENS] Error obteniendo tokens del usuario:', userError);
        throw userError;
      }

      // También buscar tokens públicos creados por este usuario
      // usando metadata.created_by
      const { data: publicTokens, error: publicError } = await supabaseAdmin
        .from('iframe_tokens')
        .select(`
          *,
          users:user_id(id, email, full_name),
          usage_count:iframe_token_usage(count)
        `)
        .is('user_id', null)
        .eq('metadata->>created_by', req.user.email)
        .order('created_at', { ascending: false });

      if (publicError) {
        console.error('[MY-TOKENS] Error obteniendo tokens públicos:', publicError);
        // No lanzar error, continuar sin tokens públicos
        tokens = userTokens || [];
      } else {
        // Combinar ambos resultados
        tokens = [...(userTokens || []), ...(publicTokens || [])];
      }

      console.log(`[MY-TOKENS] Tokens del usuario: ${userTokens?.length || 0}`);
      console.log(`[MY-TOKENS] Tokens públicos creados: ${publicTokens?.length || 0}`);
      console.log(`[MY-TOKENS] Total tokens encontrados: ${tokens.length}`);
    }

    // Log detallado para debug
    tokens.forEach(token => {
      console.log(`[MY-TOKENS] Token:`, {
        id: token.id,
        type: token.token_type,
        user_id: token.user_id,
        created_by: token.metadata?.created_by,
        is_active: token.is_active
      });
    });

    // Agregar estadísticas a cada token
    const tokensWithStats = tokens.map(token => ({
      ...token,
      stats: {
        total_uses: token.usage_count?.[0]?.count || 0,
        transactions_remaining: token.max_transactions ? 
          Math.max(0, token.max_transactions - token.transactions_count) : 
          'unlimited',
        is_expired: new Date(token.expires_at) < new Date(),
        days_until_expiry: Math.ceil(
          (new Date(token.expires_at) - new Date()) / (1000 * 60 * 60 * 24)
        )
      },
      // Agregar información del creador para tokens públicos
      created_by_info: token.token_type === 'public_token' && !token.user_id ? {
        email: token.metadata?.created_by || 'Desconocido',
        created_at: token.metadata?.created_at || token.created_at
      } : null
    }));

    res.json(tokensWithStats);

  } catch (error) {
    console.error('[MY-TOKENS] Error general:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener tokens',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Agregar este endpoint en ticketPaymentMovil.js, después de la línea ~45 (después de los imports)

// ===== NUEVO ENDPOINT: VALIDAR TOKEN DE IFRAME =====
router.post('/validate-iframe-token', async (req, res) => {
  try {
    const { token, origin } = req.body;
    const iframeToken = req.headers['x-iframe-token'] || token;

    console.log('=== VALIDANDO TOKEN IFRAME ===');
    console.log('Token recibido:', iframeToken?.substring(0, 12) + '...');
    console.log('Origin:', origin);
    console.log('Headers:', {
      'x-iframe-token': req.headers['x-iframe-token'],
      'origin': req.headers.origin,
      'referer': req.headers.referer
    });

    if (!iframeToken) {
      return res.status(400).json({
        success: false,
        message: 'Token requerido',
        code: 'TOKEN_MISSING'
      });
    }

    // Buscar el token en la base de datos
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('iframe_tokens')
      .select('*')
      .eq('token', iframeToken)
      .eq('is_active', true)
      .single();

    console.log('Token encontrado en BD:', !!tokenData);
    console.log('Error de BD:', tokenError);

    if (tokenError || !tokenData) {
      console.log('❌ Token no encontrado o inactivo');
      return res.status(401).json({
        success: false,
        message: 'Token inválido o inactivo',
        code: 'TOKEN_INVALID',
        debug: {
          tokenExists: !!tokenData,
          error: tokenError?.message
        }
      });
    }

    // Verificar si el token ha expirado
    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    if (now > expiresAt) {
      console.log('❌ Token expirado:', { now, expiresAt });
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED',
        debug: {
          now: now.toISOString(),
          expires_at: expiresAt.toISOString()
        }
      });
    }

    // Verificar origen si está configurado
    if (origin && tokenData.allowed_domains && tokenData.allowed_domains.length > 0) {
      console.log('Verificando origen:', {
        origin,
        allowed_domains: tokenData.allowed_domains
      });

      const isOriginAllowed = tokenData.allowed_domains.some(allowedDomain => {
        try {
          const allowedUrl = new URL(allowedDomain);
          const requestUrl = new URL(origin);
          return allowedUrl.origin === requestUrl.origin;
        } catch (e) {
          // Si no es una URL válida, comparar directamente
          return allowedDomain === origin;
        }
      });

      if (!isOriginAllowed) {
        console.log('❌ Origen no permitido');
        return res.status(403).json({
          success: false,
          message: 'Origen no permitido para este token',
          code: 'ORIGIN_NOT_ALLOWED',
          debug: {
            origin,
            allowed_domains: tokenData.allowed_domains
          }
        });
      }
    }

    // Verificar límite de transacciones si aplica
    if (tokenData.max_transactions && tokenData.transactions_count >= tokenData.max_transactions) {
      console.log('❌ Límite de transacciones alcanzado');
      return res.status(429).json({
        success: false,
        message: 'Límite de transacciones alcanzado',
        code: 'TRANSACTION_LIMIT_REACHED',
        debug: {
          max_transactions: tokenData.max_transactions,
          current_count: tokenData.transactions_count
        }
      });
    }

    console.log('✅ Token válido');

    // Registrar uso del token para validación
    await supabaseAdmin
      .from('iframe_token_usage')
      .insert({
        token_id: tokenData.id,
        action: 'token_validation',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        origin: origin || req.headers.origin || req.headers.referer,
        metadata: {
          validation_success: true,
          headers: {
            origin: req.headers.origin,
            referer: req.headers.referer,
            'x-iframe-token': !!req.headers['x-iframe-token']
          }
        }
      });

    // Respuesta exitosa
    res.json({
      success: true,
      message: 'Token válido',
      code: 'TOKEN_VALID',
      token_info: {
        id: tokenData.id,
        token_type: tokenData.token_type,
        expires_at: tokenData.expires_at,
        transactions_remaining: tokenData.max_transactions 
          ? Math.max(0, tokenData.max_transactions - tokenData.transactions_count)
          : 'unlimited',
        allowed_domains: tokenData.allowed_domains,
        metadata: {
          form_type: tokenData.metadata?.form_type || 'ticket',
          allowed_payment_methods: tokenData.metadata?.allowed_payment_methods || []
        }
      }
    });

  } catch (error) {
    console.error('❌ Error validando token:', error);
    
    // Si hay token, registrar el error
    if (req.body.token || req.headers['x-iframe-token']) {
      try {
        const failedToken = req.body.token || req.headers['x-iframe-token'];
        const { data: tokenForError } = await supabaseAdmin
          .from('iframe_tokens')
          .select('id')
          .eq('token', failedToken)
          .single();
        
        if (tokenForError) {
          await supabaseAdmin
            .from('iframe_token_usage')
            .insert({
              token_id: tokenForError.id,
              action: 'token_validation_error',
              ip_address: req.ip,
              user_agent: req.headers['user-agent'],
              metadata: { 
                error: error.message,
                stack: error.stack
              }
            });
        }
      } catch (logError) {
        console.error('Error logging validation error:', logError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Error interno validando token',
      code: 'VALIDATION_ERROR',
      debug: process.env.NODE_ENV === 'development' ? {
        error: error.message,
        stack: error.stack
      } : undefined
    });
  }
});

// Obtener estadísticas de un token específico
router.get('/token-stats/:tokenId', authenticateToken, requireAnyPermission(
  { resource: 'tickets', action: 'manage' },
  { resource: 'tickets', action: 'sell' }
), async (req, res) => {
  try {
    const { tokenId } = req.params;

    // Verificar acceso
    const { data: token } = await supabaseAdmin
      .from('iframe_tokens')
      .select('*')
      .eq('id', tokenId)
      .single();

    if (!token) {
      return res.status(404).json({ 
        message: 'Token no encontrado' 
      });
    }

    const hasManagePermission = req.user.permissions?.includes('tickets:manage');
    if (token.user_id !== req.user.id && !hasManagePermission) {
      return res.status(403).json({ 
        message: 'No autorizado para ver estas estadísticas' 
      });
    }

    // Obtener uso detallado
    const { data: usage } = await supabaseAdmin
      .from('iframe_token_usage')
      .select('*')
      .eq('token_id', tokenId)
      .order('created_at', { ascending: false })
      .limit(100);

    // Obtener transacciones
    const { data: transactions } = await supabaseAdmin
      .from('ticket_payment_transactions')
      .select('*')
      .eq('metadata->>token_id', tokenId);

    // Calcular estadísticas
    const stats = {
      token_info: token,
      usage_summary: {
        total_uses: usage?.length || 0,
        unique_ips: [...new Set(usage?.map(u => u.ip_address))].length,
        actions_breakdown: usage?.reduce((acc, u) => {
          acc[u.action] = (acc[u.action] || 0) + 1;
          return acc;
        }, {}),
        origins: [...new Set(usage?.map(u => u.origin).filter(Boolean))]
      },
      transactions_summary: {
        total: transactions?.length || 0,
        completed: transactions?.filter(t => t.status === 'completed').length || 0,
        pending: transactions?.filter(t => t.status === 'pending').length || 0,
        failed: transactions?.filter(t => t.status === 'failed').length || 0,
        total_revenue_usd: transactions
          ?.filter(t => t.status === 'completed')
          .reduce((sum, t) => sum + parseFloat(t.amount_usd), 0) || 0,
        total_revenue_bs: transactions
          ?.filter(t => t.status === 'completed')
          .reduce((sum, t) => sum + parseFloat(t.amount_bs), 0) || 0,
        tickets_sold: transactions
          ?.filter(t => t.status === 'completed')
          .reduce((sum, t) => sum + (t.ticket_count || 0), 0) || 0
      },
      recent_activity: usage?.slice(0, 20)
    };

    res.json(stats);

  } catch (error) {
    console.error('Token stats error:', error);
    res.status(500).json({ 
      message: 'Error al obtener estadísticas' 
    });
  }
});

  // ===== CONFIGURACIÓN DE CORS =====

router.get('/cors-settings', authenticateToken, requireAnyPermission(
  { resource: 'iframe_tokens', action: 'create' },
  { resource: 'tickets', action: 'manage' },
  { resource: 'tickets', action: 'sell' }
), async (req, res) => {
  try {
    // Obtener todos los dominios únicos de los tokens del usuario
    const query = supabaseAdmin
      .from('iframe_tokens')
      .select('allowed_domains, origin')
      .eq('is_active', true);

    // Si no es admin, solo ver sus propios tokens
    if (!req.user.permissions?.includes('tickets:manage')) {
      query.eq('user_id', req.user.id);
    }

    const { data: tokens, error } = await query;

    if (error) {
      throw error;
    }

    // Extraer dominios únicos
    const allowedOrigins = new Set();
    
    tokens?.forEach(token => {
      // Agregar allowed_domains
      if (token.allowed_domains && Array.isArray(token.allowed_domains)) {
        token.allowed_domains.forEach(domain => {
          if (domain) allowedOrigins.add(domain);
        });
      }
      // Agregar origin si existe
      if (token.origin) {
        allowedOrigins.add(token.origin);
      }
    });

    // Agregar dominios del entorno
    const envOrigins = process.env.IFRAME_ALLOWED_ORIGINS?.split(',') || [];
    envOrigins.forEach(origin => {
      if (origin && origin.trim()) {
        allowedOrigins.add(origin.trim());
      }
    });

    res.json({ 
      allowed_origins: Array.from(allowedOrigins).sort()
    });

  } catch (error) {
    console.error('Error fetching CORS settings:', error);
    res.status(500).json({ 
      message: 'Error al obtener configuración CORS' 
    });
  }
});

// Agregar origen CORS global (almacenar en variable de entorno o config)
router.post('/cors-settings', authenticateToken, requireAnyPermission(
  { resource: 'iframe_tokens', action: 'create' },
  { resource: 'tickets', action: 'manage' },
  { resource: 'tickets', action: 'sell' }
), async (req, res) => {
  try {
    const { origin } = req.body;

    if (!origin) {
      return res.status(400).json({ 
        message: 'Origen es requerido' 
      });
    }

    // Validar formato de URL
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Protocolo inválido');
      }
    } catch (e) {
      return res.status(400).json({ 
        message: 'Formato de origen inválido. Use: https://ejemplo.com' 
      });
    }

    // Como no tenemos una tabla cors_settings, almacenaremos en gateway_config
    // Primero obtener configuración actual
    const { data: currentConfig } = await supabaseAdmin
      .from('gateway_config')
      .select('config_value')
      .eq('config_key', 'iframe_allowed_origins')
      .single();

    let allowedOrigins = [];
    if (currentConfig) {
      try {
        allowedOrigins = JSON.parse(currentConfig.config_value);
      } catch (e) {
        allowedOrigins = [];
      }
    }

    // Verificar si ya existe
    if (allowedOrigins.includes(origin)) {
      return res.status(400).json({ 
        message: 'Este origen ya está configurado' 
      });
    }

    // Agregar nuevo origen
    allowedOrigins.push(origin);

    // Guardar o actualizar
    const { error } = await supabaseAdmin
      .from('gateway_config')
      .upsert({
        config_key: 'iframe_allowed_origins',
        config_value: JSON.stringify(allowedOrigins),
        description: 'Dominios permitidos para iframes',
        is_encrypted: false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'config_key'
      });

    if (error) {
      throw error;
    }

    // Actualizar configuración en memoria
    updateCorsMiddleware();

    res.json({ 
      success: true,
      message: 'Origen agregado exitosamente',
      allowed_origins: allowedOrigins
    });

  } catch (error) {
    console.error('Error adding CORS origin:', error);
    res.status(500).json({ 
      message: 'Error al agregar origen CORS' 
    });
  }
});

// Eliminar origen CORS
router.delete('/cors-settings', authenticateToken, requireAnyPermission(
  { resource: 'iframe_tokens', action: 'create' },
  { resource: 'tickets', action: 'manage' },
  { resource: 'tickets', action: 'sell' }
), async (req, res) => {
  try {
    const { origin } = req.body;

    if (!origin) {
      return res.status(400).json({ 
        message: 'Origen es requerido' 
      });
    }

    // Obtener configuración actual
    const { data: currentConfig } = await supabaseAdmin
      .from('gateway_config')
      .select('config_value')
      .eq('config_key', 'iframe_allowed_origins')
      .single();

    if (!currentConfig) {
      return res.status(404).json({ 
        message: 'No hay configuración de orígenes' 
      });
    }

    let allowedOrigins = [];
    try {
      allowedOrigins = JSON.parse(currentConfig.config_value);
    } catch (e) {
      return res.status(500).json({ 
        message: 'Error al leer configuración' 
      });
    }

    // Filtrar origen
    const updatedOrigins = allowedOrigins.filter(o => o !== origin);

    if (updatedOrigins.length === allowedOrigins.length) {
      return res.status(404).json({ 
        message: 'Origen no encontrado' 
      });
    }

    // Actualizar
    const { error } = await supabaseAdmin
      .from('gateway_config')
      .update({ 
        config_value: JSON.stringify(updatedOrigins),
        updated_at: new Date().toISOString()
      })
      .eq('config_key', 'iframe_allowed_origins');

    if (error) {
      throw error;
    }

    // Actualizar configuración en memoria
    updateCorsMiddleware();

    res.json({ 
      success: true,
      message: 'Origen eliminado exitosamente',
      allowed_origins: updatedOrigins
    });

  } catch (error) {
    console.error('Error removing CORS origin:', error);
    res.status(500).json({ 
      message: 'Error al eliminar origen CORS' 
    });
  }
});

export default router;

