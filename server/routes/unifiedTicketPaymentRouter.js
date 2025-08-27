// server/routes/unifiedTicketPaymentRouter.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import path from 'path';
import { 
  authenticateToken, 
  authenticateIframe, 
  requirePermission, 
  requireAnyPermission,
  enrichUserData
} from '../middleware/auth.js';
import { validateCaptcha, requireCaptcha } from '../utils/captcha.js';
import { publicPurchaseRateLimiter, checkTokenTransactionLimit, logPurchaseAttempt } from '../utils/rateLimiter.js';
import megasoftService from '../services/megasoftService.js';
import exchangeRateService from '../services/exchangeRateService.js';
import { generateAndSendTicketEmails, generateValidationPendingEmail } from '../utils/ticketUtils.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuración de multer para uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads/payment-proofs'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPEG, PNG) o PDF'));
    }
  }
});

// ===== ENDPOINTS PÚBLICOS =====

/**
 * Obtener información completa de pago (tasa, bancos, métodos)
 */
router.get('/payment-info', async (req, res) => {
  try {
    // Obtener tasa de cambio
    const { data: exchangeRate } = await supabaseAdmin
      .from('exchange_rates')
      .select('rate, date, source')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (!exchangeRate) {
      // Intentar actualizar la tasa
      try {
        await exchangeRateService.updateExchangeRate();
      } catch (updateError) {
        console.error('Error updating exchange rate:', updateError);
      }
    }

    // Obtener configuración del comercio
    const { data: commerceConfig } = await supabaseAdmin
      .from('payment_commerce_config')
      .select('*')
      .eq('is_active', true)
      .single();

    // Obtener bancos activos
    const { data: banks } = await supabaseAdmin
      .from('bank_codes')
      .select('code, name')
      .eq('is_active', true)
      .order('name');

    // Obtener métodos de pago disponibles
    const { data: paymentMethods } = await supabaseAdmin
      .from('payment_methods_configuration')
      .select('*')
      .eq('is_active', true)
      .in('payment_method', ['pago_movil', 'transferencia_nacional', 'zelle', 'paypal'])
      .order('display_order');

    res.json({
      success: true,
      ticketPrice: {
        usd: 35.00,
        bs: exchangeRate ? (35.00 * exchangeRate.rate).toFixed(2) : null
      },
      exchangeRate: {
        rate: exchangeRate?.rate,
        date: exchangeRate?.date,
        source: exchangeRate?.source
      },
      commerce: {
        name: commerceConfig?.commerce_name,
        rif: commerceConfig?.commerce_rif,
        phone: commerceConfig?.commerce_phone,
        email: commerceConfig?.commerce_email,
        bank: {
          code: commerceConfig?.commerce_bank_code,
          name: commerceConfig?.commerce_bank_name,
          account: commerceConfig?.commerce_account_number,
          type: commerceConfig?.account_type
        },
        international: {
          zelle: commerceConfig?.zelle_email,
          paypal: commerceConfig?.paypal_email
        }
      },
      banks: banks || [],
      paymentMethods: paymentMethods || []
    });
  } catch (error) {
    console.error('Error getting payment info:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener información de pago' 
    });
  }
});

// ===== PAGO MÓVIL P2C (Ya implementado) =====
// Mantener los endpoints existentes de ticketPaymentMovil.js

// ===== PAGOS MANUALES (Transferencia, Zelle) =====

/**
 * Registrar pago manual para validación
 */
router.post('/manual-payment/concert-iframe', 
  authenticateIframe,
  upload.single('proof'),
  async (req, res) => {
  try {
    const {
      tickets: ticketsJson,
      payment_method,
      referenceNumber,
      bankCode,
      email_from,
      phone,
      cedula,
      paymentDate,
      amount,
      buyer_info: buyerInfoJson
    } = req.body;

    // Parsear datos JSON
    const tickets = JSON.parse(ticketsJson);
    const buyer_info = JSON.parse(buyerInfoJson);

    // Validaciones básicas
    if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ 
        message: 'Datos de tickets requeridos' 
      });
    }

    if (!payment_method || !referenceNumber) {
      return res.status(400).json({ 
        message: 'Método de pago y referencia son requeridos' 
      });
    }

    // Verificar límite de tickets para usuarios públicos
    const maxTicketsPerTransaction = req.user.isPublic ? 5 : 10;
    if (tickets.length > maxTicketsPerTransaction) {
      return res.status(400).json({ 
        message: `Máximo ${maxTicketsPerTransaction} tickets por transacción` 
      });
    }

    // Verificar inventario
    const { data: inventory } = await supabaseAdmin
      .from('ticket_inventory')
      .select('available_tickets')
      .single();

    if (!inventory || inventory.available_tickets < tickets.length) {
      return res.status(400).json({ 
        message: `Solo quedan ${inventory?.available_tickets || 0} entradas disponibles` 
      });
    }

    // Calcular montos
    const TICKET_PRICE = 35.00;
    const totalUSD = tickets.length * TICKET_PRICE;

    // Obtener tasa de cambio
    const { data: exchangeRate } = await supabaseAdmin
      .from('exchange_rates')
      .select('rate')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    const totalBs = exchangeRate ? totalUSD * exchangeRate.rate : 0;

    // Crear transacción principal
    const transactionId = uuidv4();
    const invoiceNumber = megasoftService.generateInvoiceNumber();

    const { data: transaction, error: transError } = await supabaseAdmin
      .from('ticket_payment_transactions')
      .insert({
        id: transactionId,
        user_id: req.user.isPublic ? null : req.user.id,
        amount_usd: totalUSD,
        amount_bs: totalBs,
        exchange_rate: exchangeRate?.rate,
        status: 'pending_validation',
        payment_method,
        invoice_number: invoiceNumber,
        payment_reference: referenceNumber,
        metadata: {
          is_public_purchase: req.user.isPublic,
          token_id: req.iframeToken.id,
          token_type: req.iframeToken.token_type,
          origin: req.headers.origin || req.headers.referer,
          buyer_info,
          payment_details: {
            bank_code: bankCode,
            email_from,
            phone,
            cedula,
            payment_date: paymentDate,
            proof_file: req.file ? req.file.filename : null
          }
        }
      })
      .select()
      .single();

    if (transError) {
      console.error('Transaction creation error:', transError);
      throw transError;
    }

    // Reservar inventario
    const { error: reserveError } = await supabaseAdmin
      .rpc('reserve_ticket_inventory', { quantity: tickets.length });

    if (reserveError) {
      // Rollback
      await supabaseAdmin
        .from('ticket_payment_transactions')
        .delete()
        .eq('id', transactionId);
      
      return res.status(400).json({ 
        message: 'No se pudieron reservar las entradas' 
      });
    }

    // Crear tickets temporales
    const createdTickets = [];
    
    for (let i = 0; i < tickets.length; i++) {
      const ticketData = tickets[i];
      
      // Generar códigos únicos
      const { data: ticketNumber } = await supabaseAdmin.rpc('generate_ticket_number');
      const { data: qrCode } = await supabaseAdmin.rpc('generate_qr_code');
      const { data: barcode } = await supabaseAdmin.rpc('generate_barcode');

      const { data: ticket, error: ticketError } = await supabaseAdmin
        .from('concert_tickets')
        .insert({
          ticket_number: ticketNumber,
          qr_code: qrCode,
          barcode,
          buyer_name: buyer_info.name,
          buyer_email: buyer_info.email,
          buyer_phone: buyer_info.phone,
          buyer_identification: buyer_info.identification,
          payment_method,
          payment_status: 'pendiente',
          payment_reference: referenceNumber,
          sold_by: req.user.isPublic ? null : req.user.id,
          transaction_id: transactionId,
          metadata: {
            from_iframe: true,
            token_type: req.iframeToken.token_type,
            is_public_purchase: req.user.isPublic,
            requires_validation: true
          }
        })
        .select()
        .single();

      if (!ticketError) {
        createdTickets.push(ticket);
      }
    }

    // Actualizar transacción con IDs de tickets
    await supabaseAdmin
      .from('ticket_payment_transactions')
      .update({ 
        ticket_ids: createdTickets.map(t => t.id),
        ticket_count: createdTickets.length
      })
      .eq('id', transactionId);

    // Crear notificación para administradores
    await createAdminNotification({
      type: 'payment_validation_required',
      title: 'Nueva validación de pago pendiente',
      message: `Transacción ${transactionId} requiere validación manual (${payment_method})`,
      priority: 'high',
      data: {
        transaction_id: transactionId,
        payment_method,
        amount: totalUSD,
        buyer_email: buyer_info.email
      }
    });

    // Enviar email de confirmación pendiente al comprador
    try {
      await generateValidationPendingEmail({
        user: buyer_info,
        tickets: createdTickets,
        paymentInfo: {
          reference: referenceNumber,
          amount: totalBs,
          bankCode,
          date: paymentDate,
          method: payment_method
        }
      });
    } catch (emailError) {
      console.error('Error sending validation pending email:', emailError);
    }

    res.json({
      success: true,
      message: 'Pago registrado exitosamente. Será validado en las próximas 24 horas.',
      transaction: {
        id: transactionId,
        status: 'pending_validation',
        invoice_number: invoiceNumber,
        amount: {
          usd: totalUSD,
          bs: totalBs
        },
        tickets: createdTickets.length
      }
    });

  } catch (error) {
    console.error('Manual payment error:', error);
    res.status(500).json({ 
      message: 'Error al procesar pago manual',
      error: error.message 
    });
  }
});

// ===== VALIDACIÓN DE PAGOS MANUALES (Admin) =====

/**
 * Obtener pagos pendientes de validación
 */
router.get('/pending-validations', 
  authenticateToken,
  requirePermission('tickets', 'manage'),
  async (req, res) => {
  try {
    const { data: pendingValidations, error } = await supabaseAdmin
      .from('ticket_payment_transactions')
      .select(`
        *,
        concert_tickets!inner(*)
      `)
      .eq('status', 'pending_validation')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Formatear respuesta
    const formattedValidations = pendingValidations?.map(validation => ({
      id: validation.id,
      user_name: validation.metadata?.buyer_info?.name || 'Usuario',
      user_email: validation.metadata?.buyer_info?.email,
      reference_number: validation.payment_reference,
      amount: validation.amount_bs,
      payment_method: validation.payment_method,
      created_at: validation.created_at,
      ticket_count: validation.ticket_count,
      transaction_data: validation.metadata?.payment_details,
      tickets: validation.concert_tickets
    })) || [];

    res.json({
      success: true,
      pendingValidations: formattedValidations
    });

  } catch (error) {
    console.error('Error fetching pending validations:', error);
    res.status(500).json({ 
      message: 'Error al obtener validaciones pendientes' 
    });
  }
});

/**
 * Aprobar o rechazar pago manual
 */
router.put('/:transactionId/confirm-manual', 
  authenticateToken,
  requirePermission('tickets', 'manage'),
  async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { approved, rejectionReason } = req.body;

    // Obtener transacción
    const { data: transaction, error } = await supabaseAdmin
      .from('ticket_payment_transactions')
      .select('*, concert_tickets!inner(*)')
      .eq('id', transactionId)
      .single();

    if (error || !transaction) {
      return res.status(404).json({ 
        message: 'Transacción no encontrada' 
      });
    }

    if (transaction.status !== 'pending_validation') {
      return res.status(400).json({ 
        message: 'Esta transacción ya fue procesada' 
      });
    }

    if (approved) {
      // Aprobar pago
      await supabaseAdmin
        .from('ticket_payment_transactions')
        .update({
          status: 'completed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: req.user.id
        })
        .eq('id', transactionId);

      // Actualizar tickets
      await supabaseAdmin
        .from('concert_tickets')
        .update({
          payment_status: 'confirmado',
          confirmed_at: new Date().toISOString(),
          confirmed_by: req.user.id
        })
        .eq('transaction_id', transactionId);

      // Confirmar venta en inventario
      await supabaseAdmin.rpc('confirm_ticket_sale', { 
        quantity: transaction.ticket_count 
      });

      // Enviar tickets por email
      try {
        await generateAndSendTicketEmails(transaction.concert_tickets);
      } catch (emailError) {
        console.error('Error sending tickets:', emailError);
      }

      res.json({
        success: true,
        message: 'Pago aprobado exitosamente'
      });

    } else {
      // Rechazar pago
      await supabaseAdmin
        .from('ticket_payment_transactions')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: req.user.id,
          rejection_reason: rejectionReason
        })
        .eq('id', transactionId);

      // Actualizar tickets
      await supabaseAdmin
        .from('concert_tickets')
        .update({
          payment_status: 'rechazado',
          error_message: rejectionReason
        })
        .eq('transaction_id', transactionId);

      // Liberar inventario
      await supabaseAdmin.rpc('release_ticket_inventory', { 
        quantity: transaction.ticket_count 
      });

      // TODO: Enviar email de rechazo al comprador

      res.json({
        success: true,
        message: 'Pago rechazado'
      });
    }

  } catch (error) {
    console.error('Error confirming manual payment:', error);
    res.status(500).json({ 
      message: 'Error al procesar validación' 
    });
  }
});

/**
 * Ver comprobante de pago
 */
router.get('/payment-proof/:filename', 
  authenticateToken,
  requireAnyPermission(
    { resource: 'tickets', action: 'manage' },
    { resource: 'payments', action: 'read' }
  ),
  (req, res) => {
    const { filename } = req.params;
    
    // Validar filename para prevenir path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        message: 'Nombre de archivo inválido'
      });
    }
    
    const filePath = path.join(process.cwd(), 'uploads/payment-proofs', filename);
    res.sendFile(filePath);
  }
);

// ===== FUNCIONES AUXILIARES =====

async function createAdminNotification(data) {
  try {
    await supabaseAdmin
      .from('admin_notifications')
      .insert({
        ...data,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error creating admin notification:', error);
  }
}

export default router;