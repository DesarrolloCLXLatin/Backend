import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticateToken, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import { generateAndSendTicketEmails, generateValidationPendingEmail, handlePaymentEmailFlow,
  processManualPaymentConfirmation,
  resendTicketEmail } from '../utils/ticketUtils.js';
import { sendConfirmationEmail, sendRejectionEmail, sendPendingVerificationEmail } from '../utils/emailService.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'payment-proofs');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedFilename}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and PDF are allowed.'));
    }
  }
});

router.post('/manual-payment', authenticateToken, upload.single('proof'), async (req, res) => {
  const supabase = req.supabase;
  
  try {
    const {
      activities, // Array of { activityId, quantity, participants }
      referenceNumber,
      bankCode,
      phone,
      cedula,
      paymentDate,
      amount
    } = req.body;

    // Validate required fields
    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      throw new Error('No activities provided');
    }

    if (!referenceNumber || !bankCode || !amount) {
      throw new Error('Missing required payment information');
    }

    if (!req.file) {
      throw new Error('Payment proof file is required');
    }

    // Parse activities if it's a string (from form-data)
    const parsedActivities = typeof activities === 'string' ? JSON.parse(activities) : activities;

    // Create payment transaction
    const { data: paymentTransaction, error: paymentError } = await supabase
      .from('payment_transactions')
      .insert({
        id: uuidv4(),
        user_id: req.user.userId,
        amount: amount,
        currency: 'VES',
        payment_method: 'manual_transfer',
        status: 'pending_validation',
        reference_number: referenceNumber,
        transaction_data: {
          bankCode,
          phone,
          cedula,
          paymentDate,
          proofFile: req.file.filename,
          uploadedBy: req.user.userId,
          uploadedAt: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    const ticketsCreated = [];

    // Create tickets for each activity
    for (const activityData of parsedActivities) {
      const { activityId, quantity, participants } = activityData;

      // Verify activity exists and has spots
      const { data: activity, error: activityError } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .gte('available_spots', quantity)
        .single();

      if (activityError || !activity) {
        throw new Error(`Activity ${activityId} not available or insufficient spots`);
      }

      // Reserve spots
      const { error: updateError } = await supabase
        .from('activities')
        .update({ available_spots: activity.available_spots - quantity })
        .eq('id', activityId);

      if (updateError) throw updateError;

      // Create tickets
      for (let i = 0; i < quantity; i++) {
        const participant = participants[i] || {};
        const ticketNumber = `T${Date.now()}${Math.random().toString(36).substr(2, 9)}`.toUpperCase();

        const { data: ticket, error: ticketError } = await supabase
          .from('tickets')
          .insert({
            id: uuidv4(),
            ticket_number: ticketNumber,
            user_id: req.user.userId,
            activity_id: activityId,
            purchase_date: new Date().toISOString(),
            status: 'pending_payment',
            amount: activity.price,
            participant_name: participant.name || null,
            participant_email: participant.email || null,
            participant_phone: participant.phone || null
          })
          .select()
          .single();

        if (ticketError) throw ticketError;

        ticketsCreated.push(ticket);

        // Create ticket payment transaction
        const { error: tptError } = await supabase
          .from('ticket_payment_transactions')
          .insert({
            id: uuidv4(),
            ticket_id: ticket.id,
            payment_transaction_id: paymentTransaction.id,
            amount: activity.price,
            status: 'pending_validation'
          });

        if (tptError) throw tptError;
      }
    }

    try {
      const paymentInfo = {
        payment_method: 'manual_transfer',
        reference: referenceNumber,
        amount_usd: amount,
        amount_bs: amount,
        totalAmount: amount, 
        bank_code: bankCode,
        payment_date: paymentDate,
        created_at: new Date().toISOString()
      };

      await handlePaymentEmailFlow(ticketsCreated, paymentInfo, 'transferencia');
    } catch (emailError) {
      console.error('Error sending pending verification email:', emailError);
    }

    // Send validation pending email
    try {
      await generateValidationPendingEmail({
        user: req.user,
        tickets: ticketsCreated,
        paymentInfo: {
          reference: referenceNumber,
          amount: amount,
          bankCode: bankCode,
          date: paymentDate
        }
      });
    } catch (emailError) {
      console.error('Error sending validation pending email:', emailError);
    }

    res.json({
      success: true,
      message: 'Pago registrado. Será validado en las próximas horas.',
      transaction: {
        id: paymentTransaction.id,
        reference: referenceNumber,
        status: 'pending_validation',
        amount: amount
      },
      tickets: ticketsCreated.map(t => ({
        id: t.id,
        ticketNumber: t.ticket_number,
        status: t.status
      }))
    });

  } catch (error) {
    // Delete uploaded file if transaction failed
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }

    console.error('Manual payment error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error processing manual payment'
    });
  }
});

router.get('/pending-validations', authenticateToken, requireAnyPermission(
  { resource: 'payments', action: 'manage' },
  { resource: 'payments', action: 'confirm' },
  { resource: 'tickets', action: 'manage' }
), async (req, res) => {
  const supabase = req.supabase;
  
  try {
    // First get the payment transactions
    const { data: payments, error: paymentsError } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        users!user_id (name, email)
      `)
      .eq('status', 'pending_validation')
      .eq('payment_method', 'manual_transfer')
      .order('created_at', { ascending: false });

    if (paymentsError) throw paymentsError;

    // For each payment, get the related tickets
    const pendingValidations = await Promise.all(payments.map(async (payment) => {
      const { data: tickets, error: ticketsError } = await supabase
        .from('ticket_payment_transactions')
        .select(`
          ticket_id,
          tickets!inner (
            id,
            ticket_number,
            activities!inner (
              name,
              date
            )
          )
        `)
        .eq('payment_transaction_id', payment.id);

      if (ticketsError) throw ticketsError;

      return {
        ...payment,
        user_name: payment.users?.name,
        user_email: payment.users?.email,
        ticket_count: tickets.length,
        tickets: tickets.map(t => ({
          id: t.tickets.id,
          ticket_number: t.tickets.ticket_number,
          activity_name: t.tickets.activities.name,
          activity_date: t.tickets.activities.date
        }))
      };
    }));

    res.json({
      success: true,
      pendingValidations
    });
  } catch (error) {
    console.error('Error fetching pending validations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending validations'
    });
  }
});

router.put('/:transactionId/confirm-manual', authenticateToken, requireAnyPermission(
  { resource: 'payments', action: 'manage' },
  { resource: 'payments', action: 'confirm' },
  { resource: 'tickets', action: 'manage' }
), async (req, res) => {
  const supabase = req.supabase;
  const { transactionId } = req.params;
  const { approved, rejectionReason } = req.body;

  try {
    // Get payment transaction
    const { data: paymentTransaction, error: paymentError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('payment_method', 'manual_transfer')
      .single();

    if (paymentError || !paymentTransaction) {
      throw new Error('Payment transaction not found');
    }

    if (paymentTransaction.status !== 'pending_validation') {
      throw new Error('Payment already processed');
    }

    if (approved) {
      // Approve payment
      const { error: updatePaymentError } = await supabase
        .from('payment_transactions')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId);

      if (updatePaymentError) throw updatePaymentError;

      // Update ticket payment transactions
      const { error: updateTPTError } = await supabase
        .from('ticket_payment_transactions')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('payment_transaction_id', transactionId);

      if (updateTPTError) throw updateTPTError;

      // Get all tickets for this payment
      const { data: ticketData, error: ticketsError } = await supabase
        .from('ticket_payment_transactions')
        .select(`
          tickets!inner (
            *,
            activities!inner (
              name,
              date
            )
          )
        `)
        .eq('payment_transaction_id', transactionId);

      if (ticketsError) throw ticketsError;

      const tickets = ticketData.map(t => ({
        ...t.tickets,
        activity_name: t.tickets.activities.name,
        activity_date: t.tickets.activities.date
      }));

      // Update ticket statuses
      const { error: updateTicketsError } = await supabase
        .from('tickets')
        .update({ status: 'confirmed' })
        .in('id', tickets.map(t => t.id));

      if (updateTicketsError) throw updateTicketsError;

      // ===== NUEVO: Enviar email de confirmación =====
      try {
        // Preparar información del pago para el email
        const paymentInfo = {
          payment_method: paymentTransaction.payment_method,
          reference: paymentTransaction.reference_number,
          status: 'approved',
          amount_usd: paymentTransaction.amount,
          amount_bs: paymentTransaction.transaction_data?.amount_bs,
          totalAmount: paymentTransaction.transaction_data?.totalAmount,
          transaction_id: transactionId,
          confirmed_by: req.user.email,
          confirmed_at: new Date().toISOString(),
          bank_code: paymentTransaction.transaction_data?.bankCode,
          payment_date: paymentTransaction.transaction_data?.paymentDate
        };

        // Usar la función de procesamiento manual que envía el email de confirmación
        await processManualPaymentConfirmation(
          tickets,
          paymentInfo,
          true // aprobado
        );

        console.log(`Confirmation email sent for transaction ${transactionId}`);
      } catch (emailError) {
        console.error('Error sending confirmation emails:', emailError);
        // No fallar la transacción si falla el email
      }

      res.json({
        success: true,
        message: 'Payment approved successfully',
        tickets: tickets.map(t => ({
          id: t.id,
          ticketNumber: t.ticket_number,
          status: 'confirmed'
        }))
      });

    } else {
      // Reject payment
      const { error: updatePaymentError } = await supabase
        .from('payment_transactions')
        .update({ 
          status: 'rejected',
          error_message: rejectionReason || 'Payment rejected by admin',
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId);

      if (updatePaymentError) throw updatePaymentError;

      // Update ticket payment transactions
      const { error: updateTPTError } = await supabase
        .from('ticket_payment_transactions')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('payment_transaction_id', transactionId);

      if (updateTPTError) throw updateTPTError;

      // Get tickets to release inventory
      const { data: ticketData, error: ticketsError } = await supabase
        .from('ticket_payment_transactions')
        .select(`
          tickets!inner (
            *,
            activity_id
          ),
          amount
        `)
        .eq('payment_transaction_id', transactionId);

      if (ticketsError) throw ticketsError;

      const tickets = [];
      
      // Release inventory and update ticket status
      for (const item of ticketData) {
        const ticket = item.tickets;
        tickets.push(ticket); // Guardar para el email
        
        // Get current activity to update spots
        const { data: activity, error: activityError } = await supabase
          .from('activities')
          .select('available_spots')
          .eq('id', ticket.activity_id)
          .single();

        if (!activityError && activity) {
          await supabase
            .from('activities')
            .update({ available_spots: activity.available_spots + 1 })
            .eq('id', ticket.activity_id);
        }

        await supabase
          .from('tickets')
          .update({ status: 'payment_failed' })
          .eq('id', ticket.id);
      }

      // ===== NUEVO: Enviar email de rechazo =====
      try {
        // Preparar información del pago para el email
        const paymentInfo = {
          payment_method: paymentTransaction.payment_method,
          reference: paymentTransaction.reference_number,
          status: 'rejected',
          amount_usd: paymentTransaction.amount,
          amount_bs: paymentTransaction.transaction_data?.amount_bs,
          totalAmount: paymentTransaction.transaction_data?.totalAmount,
          transaction_id: transactionId,
          rejected_by: req.user.email,
          rejected_at: new Date().toISOString(),
          created_at: paymentTransaction.created_at
        };

        // Usar la función de procesamiento manual que envía el email de rechazo
        await processManualPaymentConfirmation(
          tickets,
          paymentInfo,
          false, // rechazado
          rejectionReason || 'El pago no pudo ser verificado'
        );

        console.log(`Rejection email sent for transaction ${transactionId}`);
      } catch (emailError) {
        console.error('Error sending rejection email:', emailError);
        // No fallar la transacción si falla el email
      }

      res.json({
        success: true,
        message: 'Payment rejected successfully'
      });
    }

  } catch (error) {
    console.error('Error processing manual payment confirmation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error processing payment confirmation'
    });
  }
});

router.get('/payment-proof/:filename', authenticateToken, requireAnyPermission(
  { resource: 'payments', action: 'manage' },
  { resource: 'payments', action: 'read' },
  { resource: 'tickets', action: 'manage' }
), async (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = path.join(process.cwd(), 'uploads', 'payment-proofs', filename);
    
    // Check if file exists
    await fs.access(filepath);
    
    res.sendFile(filepath);
  } catch (error) {
    console.error('Error serving payment proof:', error);
    res.status(404).json({
      success: false,
      message: 'File not found'
    });
  }
});

router.post('/iframe-payment', async (req, res) => {
  const supabase = req.supabase;
  
  try {
    console.log('📝 Pago manual iframe recibido:', req.body);
    
    const {
      buyer_name,
      buyer_email,
      buyer_phone,
      buyer_identification,
      payment_method,
      payment_reference,
      bank_code,
      email_from,
      paypal_email,
      quantity,
      zone_id,
      zone_type,
      zone_name,
      price_usd,
      total_price,
      seat_ids,
      is_numbered,
      send_email,
      tickets,
      // Campos para boxes
      is_box_purchase,
      box_full_purchase,
      box_code,
      box_seats_quantity
    } = req.body;

    // 🔧 FUNCIÓN PARA BUSCAR ZONE_ID DINÁMICAMENTE
    const findZoneId = async (zoneIdentifier) => {
      if (!zoneIdentifier) return null;
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(zoneIdentifier)) {
        return zoneIdentifier;
      }
      
      try {
        let { data: zone, error } = await supabase
          .from('ticket_zones')
          .select('id, zone_name, zone_type, price_usd')
          .eq('zone_code', zoneIdentifier.toUpperCase())
          .eq('is_active', true)
          .single();
        
        if (!error && zone) {
          console.log(`✅ Zone encontrada por code: ${zoneIdentifier} -> ${zone.id}`);
          return { id: zone.id, name: zone.zone_name, type: zone.zone_type, price: zone.price_usd };
        }
        
        const { data: zones, error: nameError } = await supabase
          .from('ticket_zones')
          .select('id, zone_name, zone_type, price_usd')
          .ilike('zone_name', `%${zoneIdentifier}%`)
          .eq('is_active', true)
          .limit(1);
        
        if (!nameError && zones && zones.length > 0) {
          const foundZone = zones[0];
          console.log(`✅ Zone encontrada por name: ${zoneIdentifier} -> ${foundZone.id}`);
          return { id: foundZone.id, name: foundZone.zone_name, type: foundZone.zone_type, price: foundZone.price_usd };
        }
        
        console.log(`⚠️ Zone no encontrada: ${zoneIdentifier}, usando null`);
        return null;
        
      } catch (error) {
        console.error('Error buscando zone:', error);
        return null;
      }
    };

    // 🔧 MAPEAR MÉTODOS DE PAGO A VALORES PERMITIDOS
    const mapPaymentMethod = (method) => {
      const paymentMap = {
        'transferencia_nacional': 'transferencia',
        'transferencia': 'transferencia', 
        'zelle': 'zelle',
        'paypal': 'transferencia',
        'pago_movil': 'pago_movil',
        'pago_movil_p2c': 'pago_movil',
        'tarjeta': 'tarjeta',
        'tarjeta_credito': 'tarjeta',
        'tarjeta_debito': 'tarjeta',
        'tienda': 'tienda',
        'efectivo': 'tienda'
      };
      
      const mapped = paymentMap[method] || 'transferencia';
      console.log(`💳 Payment method: ${method} → ${mapped}`);
      return mapped;
    };

    // Validaciones básicas
    if (!buyer_name || !buyer_email || !payment_method) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: nombre, email y método de pago'
      });
    }

    // Generar IDs únicos
    const transactionId = uuidv4();
    const ticketId = uuidv4();
    const ticketNumber = `TK-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // 🔧 BUSCAR INFORMACIÓN REAL DE LA ZONA
    const zoneInfo = await findZoneId(zone_id);
    const actualZoneId = zoneInfo?.id || null;
    const actualZoneName = zoneInfo?.name || zone_name || 'Zona General';
    const actualZoneType = zoneInfo?.type || zone_type || 'general';
    const actualPrice = zoneInfo?.price || price_usd || 35;

    // ✅ CAMPOS QUE COINCIDEN EXACTAMENTE CON TU TABLA
    const ticketData = {
      id: ticketId,
      ticket_number: ticketNumber,
      qr_code: `QR-${ticketNumber}`,
      barcode: `BC-${Date.now()}`,
      buyer_name,
      buyer_email,
      buyer_phone: buyer_phone || null,
      buyer_identification: buyer_identification || null,
      ticket_price: actualPrice,
      payment_status: 'pendiente',
      payment_method: mapPaymentMethod(payment_method), // 🔧 Usar método mapeado
      payment_reference: payment_reference || null,
      ticket_status: 'vendido',
      zone_id: actualZoneId,
      seat_id: null,
      zone_name: actualZoneName,
      ticket_type: actualZoneType,
      is_vip: actualZoneType === 'vip',
      seat_number: is_numbered && seat_ids && seat_ids.length > 0 ? seat_ids[0] : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: JSON.stringify({
        quantity,
        total_price,
        bank_code,
        email_from: email_from || buyer_email,
        paypal_email,
        transaction_id: transactionId,
        source: 'iframe',
        is_box_purchase,
        box_full_purchase,
        box_code,
        box_seats_quantity,
        seat_ids,
        is_numbered,
        payment_date: new Date().toISOString(),
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        original_zone_id: zone_id,
        zone_found: !!zoneInfo
      })
    };

    console.log('🔄 Insertando ticket con datos:', {
      ...ticketData,
      notes: 'JSON data...'
    });

    // Insertar en la tabla concert_tickets
    const { data: insertedTicket, error: insertError } = await supabase
      .from('concert_tickets')
      .insert([ticketData])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error al insertar ticket de concierto:', insertError);
      return res.status(500).json({
        success: false,
        message: 'Error al procesar el ticket',
        debug: process.env.NODE_ENV === 'development' ? {
          error: insertError.message,
          code: insertError.code,
          details: insertError.details
        } : undefined
      });
    }

    console.log('✅ Ticket de concierto creado exitosamente:', insertedTicket.id);

    // 🔧 ACTUALIZAR INVENTARIO DE TICKETS
    try {
      const { error: inventoryError } = await supabase
        .rpc('update_ticket_inventory', {
          sold_increment: 1,
          available_decrement: 1
        });
      
      if (!inventoryError) {
        console.log('✅ Inventario actualizado');
      }
    } catch (invError) {
      console.error('⚠️ Error actualizando inventario:', invError);
    }

    // 📧 ENVIAR EMAIL DE VERIFICACIÓN PENDIENTE
    let emailSent = false;
    try {
      if (send_email) {
        console.log('📧 Enviando email de verificación pendiente...');
        
        // Preparar datos del ticket para el email
        const ticketDataForEmail = {
          buyer_name,
          buyer_email,
          ticket_number: ticketNumber,
          quantity: quantity || 1,
          zone_name: actualZoneName,
          ticket_type: actualZoneType,
          is_box_purchase,
          box_code,
          box_full_purchase,
          box_seats_quantity
        };

        // Preparar datos del pago para el email
        const paymentDataForEmail = {
          payment_method: payment_method, // Usar el método original para el email
          reference: payment_reference,
          amount_usd: total_price,
          bank_code,
          transaction_id: transactionId,
          created_at: new Date().toISOString()
        };

        // Enviar email usando tu servicio existente
        const emailResult = await sendPendingVerificationEmail(
          ticketDataForEmail, 
          paymentDataForEmail
        );

        if (emailResult.success) {
          emailSent = true;
          console.log('✅ Email de verificación pendiente enviado exitosamente');
        } else {
          console.error('❌ Error enviando email:', emailResult.error);
        }
      }
    } catch (emailError) {
      console.error('⚠️ Error al enviar email de verificación:', emailError);
      // No fallar la transacción por error de email
    }

    // 🔧 MENSAJE DE RESPUESTA PERSONALIZADO SEGÚN EL TIPO DE COMPRA
    let successMessage;
    
    if (is_box_purchase) {
      if (box_full_purchase) {
        successMessage = `🎉 Box completo ${box_code} reservado exitosamente. ${emailSent ? 'Recibirá un email de confirmación cuando se verifique el pago.' : 'Su solicitud será procesada en 2-4 horas hábiles.'}`;
      } else {
        successMessage = `🎉 ${box_seats_quantity} puesto(s) en ${box_code} reservado(s) exitosamente. ${emailSent ? 'Recibirá un email de confirmación cuando se verifique el pago.' : 'Su solicitud será procesada en 2-4 horas hábiles.'}`;
      }
    } else {
      successMessage = `✅ Pago registrado exitosamente. ${emailSent ? 'Recibirá un email de confirmación cuando se verifique el pago en 2-4 horas hábiles.' : 'Su solicitud será procesada en 2-4 horas hábiles.'}`;
    }

    // ✅ RESPUESTA EXITOSA COMPLETA
    res.status(200).json({
      success: true,
      message: successMessage,
      transactionId,
      ticketId,
      ticketNumber,
      emailSent,
      paymentStatus: 'pendiente',
      verificationTime: '2-4 horas hábiles',
      ticketInfo: {
        zone_name: actualZoneName,
        zone_type: actualZoneType,
        quantity: quantity || 1,
        total_price: total_price,
        ticket_price: actualPrice,
        payment_method: payment_method,
        is_box_purchase: is_box_purchase || false,
        box_code: box_code,
        is_vip: actualZoneType === 'vip',
        seat_number: is_numbered && seat_ids && seat_ids.length > 0 ? seat_ids[0] : null,
        zone_found: !!zoneInfo
      }
    });

  } catch (error) {
    console.error('❌ Error en pago manual iframe:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
});

router.put('/confirm-iframe-payment', authenticateToken, requireAnyPermission(
  { resource: 'payments', action: 'manage' },
  { resource: 'payments', action: 'confirm' },
  { resource: 'tickets', action: 'manage' }
), async (req, res) => {
  const supabase = req.supabase;
  const { ticketId, approved, rejectionReason } = req.body;

  try {
    console.log(`🔄 Procesando confirmación de pago iframe para ticket ${ticketId}, approved: ${approved}`);

    // Obtener el ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('concert_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error('Ticket no encontrado');
    }

    if (ticket.payment_status !== 'pendiente') {
      throw new Error('El pago ya fue procesado');
    }

    // Parsear datos adicionales del campo notes
    let additionalData = {};
    try {
      additionalData = JSON.parse(ticket.notes || '{}');
    } catch (e) {
      console.warn('No se pudo parsear el campo notes:', e.message);
    }

    if (approved) {
      // ✅ APROBAR PAGO
      console.log('✅ Aprobando pago...');
      
      const { error: updateError } = await supabase
        .from('concert_tickets')
        .update({ 
          payment_status: 'confirmado',
          confirmed_by: req.user.userId,
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      // 📧 ENVIAR EMAIL DE CONFIRMACIÓN
      try {
        console.log('📧 Enviando email de confirmación...');
        
        // Preparar datos del ticket para el email
        const ticketDataForEmail = {
          buyer_name: ticket.buyer_name,
          buyer_email: ticket.buyer_email,
          ticket_number: ticket.ticket_number,
          zone_name: ticket.zone_name,
          ticket_type: ticket.ticket_type,
          ticket_price: ticket.ticket_price,
          qr_code: ticket.qr_code,
          barcode: ticket.barcode,
          seat_number: ticket.seat_number,
          is_box_purchase: additionalData.is_box_purchase || false,
          box_code: additionalData.box_code,
          box_full_purchase: additionalData.box_full_purchase || false,
          box_seats_quantity: additionalData.box_seats_quantity
        };

        // Preparar datos del pago para el email
        const paymentDataForEmail = {
          payment_method: ticket.payment_method,
          reference: ticket.payment_reference,
          amount_usd: additionalData.total_price || ticket.ticket_price,
          amount_bs: additionalData.amount_bs,
          bank_code: additionalData.bank_code,
          transaction_id: additionalData.transaction_id,
          auth_id: additionalData.auth_id,
          created_at: ticket.created_at,
          confirmed_at: new Date().toISOString(),
          confirmed_by: req.user.email || req.user.userId
        };

        // Crear array de tickets para el email (formato requerido por sendConfirmationEmail)
        const ticketsArray = [{
          ...ticketDataForEmail,
          id: ticket.id
        }];

        // Enviar email de confirmación
        const emailResult = await sendConfirmationEmail(
          ticketDataForEmail,
          paymentDataForEmail,
          ticketsArray
        );

        if (emailResult.success) {
          console.log('✅ Email de confirmación enviado exitosamente');
        } else {
          console.error('❌ Error enviando email de confirmación');
        }

      } catch (emailError) {
        console.error('⚠️ Error al enviar email de confirmación:', emailError);
        // No fallar la confirmación por error de email
      }

      // Determinar mensaje de éxito según tipo de compra
      let successMessage = 'Pago aprobado y confirmado exitosamente';
      
      if (additionalData.is_box_purchase) {
        if (additionalData.box_full_purchase) {
          successMessage = `Box completo ${additionalData.box_code} confirmado exitosamente`;
        } else {
          successMessage = `${additionalData.box_seats_quantity} puesto(s) en ${additionalData.box_code} confirmado(s) exitosamente`;
        }
      }

      res.json({
        success: true,
        message: successMessage,
        ticket: {
          id: ticket.id,
          ticket_number: ticket.ticket_number,
          payment_status: 'confirmado',
          buyer_name: ticket.buyer_name,
          buyer_email: ticket.buyer_email,
          zone_name: ticket.zone_name,
          total_amount: additionalData.total_price || ticket.ticket_price
        }
      });

    } else {
      // ❌ RECHAZAR PAGO
      console.log('❌ Rechazando pago...');
      
      const { error: updateError } = await supabase
        .from('concert_tickets')
        .update({ 
          payment_status: 'rechazado',
          ticket_status: 'cancelado',
          notes: JSON.stringify({
            ...additionalData,
            rejection_reason: rejectionReason || 'Pago rechazado por administrador',
            rejected_by: req.user.email || req.user.userId,
            rejected_at: new Date().toISOString()
          }),
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      // 🔧 LIBERAR INVENTARIO
      try {
        const { error: inventoryError } = await supabase
          .rpc('update_ticket_inventory', {
            sold_increment: -1, // Decrementar vendidos
            available_decrement: -1 // Incrementar disponibles
          });
        
        if (!inventoryError) {
          console.log('✅ Inventario liberado');
        }
      } catch (invError) {
        console.error('⚠️ Error liberando inventario:', invError);
      }

      // 📧 ENVIAR EMAIL DE RECHAZO
      try {
        console.log('📧 Enviando email de rechazo...');
        
        // Preparar datos del ticket para el email
        const ticketDataForEmail = {
          buyer_name: ticket.buyer_name,
          buyer_email: ticket.buyer_email,
          ticket_number: ticket.ticket_number
        };

        // Preparar datos del pago para el email
        const paymentDataForEmail = {
          payment_method: ticket.payment_method,
          reference: ticket.payment_reference,
          amount_usd: additionalData.total_price || ticket.ticket_price,
          amount_bs: additionalData.amount_bs,
          created_at: ticket.created_at,
          rejection_reason: rejectionReason || 'No se pudo verificar la información del pago'
        };

        // Enviar email de rechazo
        const emailResult = await sendRejectionEmail(
          ticketDataForEmail,
          paymentDataForEmail,
          rejectionReason
        );

        if (emailResult.success) {
          console.log('✅ Email de rechazo enviado exitosamente');
        } else {
          console.error('❌ Error enviando email de rechazo');
        }

      } catch (emailError) {
        console.error('⚠️ Error al enviar email de rechazo:', emailError);
        // No fallar el rechazo por error de email
      }

      res.json({
        success: true,
        message: 'Pago rechazado exitosamente',
        ticket: {
          id: ticket.id,
          ticket_number: ticket.ticket_number,
          payment_status: 'rechazado',
          rejection_reason: rejectionReason
        }
      });
    }

  } catch (error) {
    console.error('❌ Error procesando confirmación de pago iframe:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error procesando confirmación de pago'
    });
  }
});

router.get('/pending-iframe-payments', authenticateToken, requireAnyPermission(
  { resource: 'payments', action: 'manage' },
  { resource: 'payments', action: 'read' },
  { resource: 'tickets', action: 'manage' }
), async (req, res) => {
  const supabase = req.supabase;
  
  try {
    console.log('📋 Obteniendo pagos iframe pendientes...');

    // Obtener todos los tickets con pago pendiente desde iframe
    const { data: pendingTickets, error: ticketsError } = await supabase
      .from('concert_tickets')
      .select('*')
      .eq('payment_status', 'pendiente')
      .order('created_at', { ascending: false });

    if (ticketsError) throw ticketsError;

    // Filtrar solo los que vienen de iframe y formatear datos
    const pendingIframePayments = pendingTickets
      .map(ticket => {
        let additionalData = {};
        try {
          additionalData = JSON.parse(ticket.notes || '{}');
        } catch (e) {
          // Si no se puede parsear, asumir que no es de iframe
          return null;
        }

        // Solo incluir si viene de iframe
        if (additionalData.source !== 'iframe') {
          return null;
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
          box_full_purchase: additionalData.box_full_purchase || false,
          box_seats_quantity: additionalData.box_seats_quantity,
          created_at: ticket.created_at,
          payment_date: additionalData.payment_date,
          ip_address: additionalData.ip_address,
          user_agent: additionalData.user_agent
        };
      })
      .filter(ticket => ticket !== null); // Remover elementos null

    console.log(`✅ Encontrados ${pendingIframePayments.length} pagos iframe pendientes`);

    res.json({
      success: true,
      pendingPayments: pendingIframePayments,
      count: pendingIframePayments.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo pagos iframe pendientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo pagos pendientes'
    });
  }
});

router.get('/debug-zones', async (req, res) => {
  const supabase = req.supabase;
  
  try {
    const { data: zones, error } = await supabase
      .from('ticket_zones')
      .select('id, zone_code, zone_name, zone_type, price_usd, total_capacity, is_active')
      .order('display_order', { ascending: true });
    
    if (error) {
      console.error('Error obteniendo zonas:', error);
      return res.status(500).json({
        success: false,
        message: 'Error obteniendo zonas'
      });
    }
    
    // Mostrar en consola para fácil copia
    console.log('📋 ZONAS DISPONIBLES:');
    console.log('====================');
    zones.forEach(zone => {
      console.log(`Zone: ${zone.zone_name} (${zone.zone_code})`);
      console.log(`  ID: ${zone.id}`);
      console.log(`  Type: ${zone.zone_type}`);
      console.log(`  Price: $${zone.price_usd}`);
      console.log('  ---');
    });
    
    // También crear el mapeo para fácil copia
    const zoneMapping = {};
    zones.forEach(zone => {
      zoneMapping[zone.zone_code.toLowerCase()] = zone.id;
      zoneMapping[zone.zone_name.toLowerCase().replace(/\s+/g, '_')] = zone.id;
    });
    
    console.log('🗺️ MAPEO SUGERIDO:');
    console.log('==================');
    console.log('const ZONE_MAPPING = {');
    Object.entries(zoneMapping).forEach(([key, value]) => {
      console.log(`  '${key}': '${value}',`);
    });
    console.log('};');
    
    res.json({
      success: true,
      zones,
      mapping: zoneMapping
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno'
    });
  }
});

export default router;