// utils/emailService.js
import { createTransport } from 'nodemailer';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import sharp from 'sharp';
import handlebars from 'handlebars';
import juice from 'juice';
import { v4 as uuidv4 } from 'uuid';
import { 
  getConfirmationEmailHTML, 
  getPendingVerificationHTML, 
  getRejectionHTML,
  getRunnerConfirmationHTML  // <-- AGREGAR ESTA LÍNEA
} from './emailTemplates.js';

// Importación condicional de canvas
let createCanvas;
try {
  const canvasModule = await import('canvas');
  createCanvas = canvasModule.createCanvas;
} catch (error) {
  console.warn('Canvas module not available, barcode generation will be limited');
  createCanvas = null;
}

// Configuración del transporter de email
const createEmailTransporter = () => {
  const emailPort = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 587;
  
  const config = {
    host: process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: emailPort,
    secure: emailPort === 465, // true para 465, false para otros puertos
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_USER,
      pass: process.env.SMTP_PASS || process.env.EMAIL_APP_PASSWORD
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2'
    },
    // Configuración adicional para mejor rendimiento
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
    connectionTimeout: 10000,
    greetingTimeout: 10000
  };

  // Debug en desarrollo
  if (process.env.NODE_ENV !== 'production') {
    console.log('📧 Email config:', {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.auth.user,
      hasPassword: !!config.auth.pass
    });
  }

  // Usar directamente createTransport que fue importado
  try {
    const transporter = createTransport(config);
    return transporter;
  } catch (error) {
    console.error('Error creating email transporter:', error);
    throw error;
  }
};

// Generar QR Code como buffer
const generateQRCodeBuffer = async (data) => {
  try {
    const qrBuffer = await QRCode.toBuffer(data, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrBuffer;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

// Generar código de barras como buffer
const generateBarcodeBuffer = async (data) => {
  try {
    // Verificar si canvas está disponible
    if (!createCanvas) {
      console.warn('Canvas not available, returning placeholder for barcode');
      // Retornar un buffer vacío o placeholder
      return Buffer.from('');
    }

    const canvas = createCanvas(300, 100);
    JsBarcode(canvas, data, {
      format: 'CODE128',
      width: 2,
      height: 80,
      displayValue: true,
      fontSize: 14,
      margin: 10,
      background: '#FFFFFF',
      lineColor: '#000000'
    });
    
    const buffer = canvas.toBuffer('image/png');
    return buffer;
  } catch (error) {
    console.error('Error generating barcode:', error);
    // Retornar buffer vacío en caso de error
    return Buffer.from('');
  }
};

// Template de email de confirmación con diseño animado
const getConfirmationEmailTemplate = () => {
    return getConfirmationEmailHTML();
};

// Helper para formatear monedas
const formatCurrency = (value, decimals = 2) => {
  const num = parseFloat(value) || 0;
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Helper para obtener nombre legible del método de pago
const getPaymentMethodName = (method) => {
  const methods = {
    'pago_movil': 'Pago Móvil P2C',
    'zelle': 'Zelle',
    'transferencia': 'Transferencia Bancaria',
    'tarjeta': 'Tarjeta de Crédito/Débito',
    'tienda': 'Pago en Tienda',
    'efectivo': 'Efectivo',
    'paypal': 'PayPal'
  };
  return methods[method] || method;
};

// Función principal para enviar emails de confirmación - CORREGIDA
export const sendConfirmationEmail = async (ticketData, paymentData, ticketsArray = []) => {
  try {
    console.log('=== DEBUG sendConfirmationEmail ===');
    console.log('paymentData recibido:', JSON.stringify(paymentData, null, 2));
    console.log('ticketsArray length:', ticketsArray.length);
    
    const transporter = createEmailTransporter();
    
    // Calcular TODOS los valores ANTES de usarlos en el template
    const totalAmountValue = parseFloat(paymentData.amount_usd) || 0;
    const amountBsValue = parseFloat(paymentData.amount_bs) || 0;
    
    // Calcular precio por ticket
    const pricePerTicketValue = ticketsArray.length > 0 
      ? (totalAmountValue / ticketsArray.length) 
      : totalAmountValue;
    
    // Calcular service fee y subtotal (5% de cargo por servicio)
    const serviceFeeValue = totalAmountValue * 0.05;
    const subtotalValue = totalAmountValue - serviceFeeValue; // Subtotal sin el service fee
    
    // Obtener nombre de la zona y números de asiento
    const zoneNameValue = ticketData.zone_name || 
                         (ticketsArray[0]?.zone_name) || 
                         'Zona General';
    
    const seatNumbersList = ticketsArray
      .map(t => t.seat_number)
      .filter(s => s && s !== 'General')
      .join(', ');
    
    // Preparar TODOS los datos del template
    const templateData = {
        // Datos básicos del comprador
        buyerName: ticketData.buyer_name,
        buyerEmail: ticketData.buyer_email,
        
        // Información del evento
        concertName: process.env.CONCERT_NAME || 'Concierto Premium',
        eventDate: process.env.EVENT_DATE || '15 de Marzo, 2025',
        eventTime: process.env.EVENT_TIME || '8:00 PM',
        
        // Tipo de ticket
        isBox: ticketData.ticket_type === 'box',
        boxCode: ticketData.box_code,
        boxCapacity: ticketData.box_capacity || 10,
        boxLevel: ticketData.floor_level || 'Nivel Premium',
        amenities: ticketData.amenities || 'Servicio VIP, Bar exclusivo, Área privada',
        
        // Cantidad y tickets
        ticketCount: ticketsArray.length || 1,
        tickets: [],
        
        // IMPORTANTE: Datos para el resumen de compra - TODOS DEBEN ESTAR AQUÍ
        zoneName: zoneNameValue,
        seatNumbers: seatNumbersList,
        pricePerTicket: formatCurrency(pricePerTicketValue, 2),
        subtotal: formatCurrency(subtotalValue, 2),
        serviceFee: serviceFeeValue > 0 ? formatCurrency(serviceFeeValue, 2) : null,
        
        // Datos del voucher (para pago móvil)
        showVoucher: paymentData.payment_method === 'pago_movil' && 
                    (paymentData.auth_id || paymentData.reference || paymentData.voucher),
        commerceRif: process.env.COMPANY_RIF || '',
        commerceBankName: paymentData.bank_name || '',
        commercePhone: paymentData.commerce_phone || '',
        terminal: paymentData.terminal,
        seqnum: paymentData.seqnum,
        control: paymentData.control,
        voucherText: paymentData.voucher, // El texto del voucher formateado
        
        // Información del pago
        paymentMethod: getPaymentMethodName(paymentData.payment_method),
        paymentReference: paymentData.reference,
        authId: paymentData.auth_id || '',
        purchaseDate: new Date().toLocaleDateString('es-ES'),
        purchaseTime: new Date().toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        }),
        
        // Montos totales formateados
        totalAmount: formatCurrency(totalAmountValue, 2),
        amount_usd: formatCurrency(totalAmountValue, 2),
        amountBs: amountBsValue > 0 ? formatCurrency(amountBsValue, 2) : null,
        
        // URLs y datos de la empresa
        downloadUrl: `${process.env.FRONTEND_URL}/tickets/download/${paymentData.transaction_id}`,
        supportEmail: process.env.SUPPORT_EMAIL || 'soporte@eventos.com',
        websiteUrl: process.env.WEBSITE_URL || 'https://eventos.com',
        termsUrl: `${process.env.WEBSITE_URL}/terms`,
        privacyUrl: `${process.env.WEBSITE_URL}/privacy`,
        faqUrl: `${process.env.WEBSITE_URL}/faq`,
        companyName: process.env.COMPANY_NAME || 'Eventos Premium',
        year: new Date().getFullYear(),
        hasBarcode: !!createCanvas
    };
    
    console.log('templateData.pricePerTicket:', templateData.pricePerTicket);
    console.log('templateData.subtotal:', templateData.subtotal);
    console.log('templateData.serviceFee:', templateData.serviceFee);
    console.log('templateData.totalAmount:', templateData.totalAmount);
    console.log('templateData.amountBs:', templateData.amountBs);
    console.log('templateData.zoneName:', templateData.zoneName);
    console.log('templateData.seatNumbers:', templateData.seatNumbers);
    console.log('=== FIN DEBUG ===');
    
    // IMPORTANTE: Compilar el template DESPUÉS de tener los datos
    const template = handlebars.compile(getConfirmationEmailTemplate());
    
    // Preparar archivos adjuntos
    const attachments = [];
    
    // Si no es box, procesar tickets individuales
    if (!templateData.isBox && ticketsArray.length > 0) {
      for (let i = 0; i < ticketsArray.length; i++) {
        const ticket = ticketsArray[i];
        
        // Generar QR
        const qrBuffer = await generateQRCodeBuffer(
          ticket.qr_code || ticket.ticket_number
        );
        
        // Preparar datos del ticket para el template
        const ticketInfo = {
          ticketNumber: ticket.ticket_number,
          ticketType: ticket.ticket_type === 'general' ? 'ENTRADA GENERAL' : 'ENTRADA VIP',
          seatNumber: ticket.seat_number || 'General',
          zone: ticket.zone_name || 'Zona General',
          qrCode: ticket.qr_code,
          barcode: ticket.barcode
        };
        
        templateData.tickets.push(ticketInfo);
        
        // Agregar QR como adjunto
        attachments.push({
          filename: `qr_${i}.png`,
          content: qrBuffer,
          cid: `qr_${i}`
        });
        
        // Solo agregar código de barras si canvas está disponible
        if (createCanvas && ticket.barcode) {
          const barcodeBuffer = await generateBarcodeBuffer(ticket.barcode);
          if (barcodeBuffer.length > 0) {
            attachments.push({
              filename: `barcode_${i}.png`,
              content: barcodeBuffer,
              cid: `barcode_${i}`
            });
          }
        }
      }
    } else if (templateData.isBox) {
      // Para box, generar un QR general
      const qrBuffer = await generateQRCodeBuffer(ticketData.box_code);
      
      attachments.push({
        filename: 'box_qr.png',
        content: qrBuffer,
        cid: 'box_qr'
      });
      
      // Solo agregar código de barras si canvas está disponible
      if (createCanvas) {
        const barcodeBuffer = await generateBarcodeBuffer(ticketData.box_code);
        if (barcodeBuffer.length > 0) {
          attachments.push({
            filename: 'box_barcode.png',
            content: barcodeBuffer,
            cid: 'box_barcode'
          });
        }
      }
    }
    
    // Compilar HTML con los datos
    const html = template(templateData);
    
    // Inline CSS para mejor compatibilidad
    const htmlWithInlineStyles = juice(html);
    
    // Configurar email
    const mailOptions = {
        from: `"${process.env.COMPANY_NAME || 'Eventos Premium'}" <${process.env.SMTP_USER}>`,
        to: ticketData.buyer_email,
        subject: `🎉 ¡Confirmación de Compra! - ${templateData.concertName}`,
        html: htmlWithInlineStyles,
        attachments
    };
    
    // Enviar email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    throw error;
  }
};

// Template para email de verificación pendiente
const getPendingVerificationEmailTemplate = () => {
    return getPendingVerificationHTML();
};

// Template para email de rechazo
const getRejectionEmailTemplate = () => {
    return getRejectionHTML();
};

// Función para enviar email de verificación pendiente
export const sendPendingVerificationEmail = async (ticketData, paymentData) => {
  try {
    const transporter = createEmailTransporter();
    const template = handlebars.compile(getPendingVerificationEmailTemplate());
    
    // Formatear montos
    const totalAmountValue = parseFloat(paymentData.amount_usd) || 0;
    const amountBsValue = parseFloat(paymentData.amount_bs) || 0;
    
    const templateData = {
      buyerName: ticketData.buyer_name,
      ticketCount: Array.isArray(ticketData) ? ticketData.length : ticketData.quantity || 1,
      requestDate: new Date().toLocaleString('es-ES'),
      paymentMethod: getPaymentMethodName(paymentData.payment_method),
      paymentReference: paymentData.reference,
      totalAmount: formatCurrency(totalAmountValue, 2),
      amountBs: amountBsValue > 0 ? formatCurrency(amountBsValue, 2) : null,
      ticketNumbers: Array.isArray(ticketData) ? 
        ticketData.map(t => t.ticket_number).join(', ') : 
        ticketData.ticket_number,
      supportEmail: process.env.SUPPORT_EMAIL || 'soporte@concierto.com',
      companyName: process.env.COMPANY_NAME || 'Eventos Premium',
      year: new Date().getFullYear()
    };
    
    const html = template(templateData);
    const htmlWithInlineStyles = juice(html);
    
    const mailOptions = {
      from: `"${process.env.COMPANY_NAME || 'Eventos Premium'}" <${process.env.SMTP_USER}>`,
      to: ticketData.buyer_email || ticketData[0]?.buyer_email,
      subject: `⏳ Verificación de Pago en Proceso - ${process.env.CONCERT_NAME || 'Concierto'}`,
      html: htmlWithInlineStyles
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Pending verification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('Error sending pending verification email:', error);
    throw error;
  }
};

// Función para enviar email de rechazo
export const sendRejectionEmail = async (ticketData, paymentData, rejectionReason = '') => {
  try {
    const transporter = createEmailTransporter();
    const template = handlebars.compile(getRejectionEmailTemplate());
    
    // Formatear montos
    const totalAmountValue = parseFloat(paymentData.amount_usd) || 0;
    const amountBsValue = parseFloat(paymentData.amount_bs) || 0;
    
    const templateData = {
      buyerName: ticketData.buyer_name,
      paymentReference: paymentData.reference,
      paymentMethod: getPaymentMethodName(paymentData.payment_method),
      totalAmount: formatCurrency(totalAmountValue, 2),
      amountBs: amountBsValue > 0 ? formatCurrency(amountBsValue, 2) : null,
      requestDate: new Date(paymentData.created_at).toLocaleString('es-ES'),
      rejectionReason: rejectionReason || 'No se pudo verificar la información del pago proporcionada',
      purchaseUrl: `${process.env.FRONTEND_URL}/tickets/purchase`,
      supportEmail: process.env.SUPPORT_EMAIL || 'soporte@concierto.com',
      websiteUrl: process.env.WEBSITE_URL || 'https://concierto.com',
      supportUrl: `${process.env.WEBSITE_URL}/support`,
      companyName: process.env.COMPANY_NAME || 'Eventos Premium',
      year: new Date().getFullYear()
    };
    
    const html = template(templateData);
    const htmlWithInlineStyles = juice(html);
    
    const mailOptions = {
      from: `"${process.env.COMPANY_NAME || 'Eventos Premium'}" <${process.env.SMTP_USER}>`,
      to: ticketData.buyer_email || ticketData[0]?.buyer_email,
      subject: `Actualización sobre tu Compra - ${process.env.CONCERT_NAME || 'Concierto'}`,
      html: htmlWithInlineStyles
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Rejection email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('Error sending rejection email:', error);
    throw error;
  }
};

// Función principal para gestionar el envío de emails según el estado
export const handleTicketEmailNotification = async (tickets, paymentInfo, status) => {
  try {
    switch (status) {
      case 'pending_verification':
        // Enviar email de verificación pendiente
        await sendPendingVerificationEmail(tickets[0], paymentInfo);
        break;
        
      case 'confirmed':
        // Enviar email de confirmación con tickets
        await sendConfirmationEmail(tickets[0], paymentInfo, tickets);
        break;
        
      case 'rejected':
        // Enviar email de rechazo
        await sendRejectionEmail(
          tickets[0], 
          paymentInfo, 
          paymentInfo.rejection_reason
        );
        break;
        
      default:
        console.log('Unknown email status:', status);
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('Error handling email notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envía email de confirmación a los corredores registrados
 * @param {Object} groupData - Datos del grupo de registro
 * @param {Array} runnersData - Array con información de los corredores
 * @param {Object} paymentData - Información del pago
 */
export const sendRunnerConfirmationEmail = async (groupData, runnersData, paymentData) => {
  try {
    console.log('=== Enviando confirmación de inscripción de corredores ===');
    console.log('Grupo:', groupData.group_code);
    console.log('Total corredores:', runnersData.length);
    console.log('Datos de pago recibidos:', paymentData);
    
    const transporter = createEmailTransporter();
    
    // Preparar la plantilla de Handlebars
    const template = handlebars.compile(getRunnerConfirmationHTML());
    
    // Registrar helper personalizado para índices que empiezan en 1
    handlebars.registerHelper('index_1', function(index) {
      return index + 1;
    });
    
    // Calcular edad de cada corredor
    const calculateAge = (birthDate) => {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    };
    
    // Formatear datos de los corredores
    const formattedRunners = runnersData.map(runner => ({
      fullName: runner.full_name,
      identificationType: runner.identification_type,
      identification: runner.identification,
      birthDate: runner.birth_date,
      age: calculateAge(runner.birth_date),
      gender: runner.gender,
      genderLabel: runner.gender === 'M' ? 'Masculino' : 'Femenino',
      shirtSize: runner.shirt_size,
      email: runner.email,
      phone: runner.phone,
      runnerNumber: runner.runner_number || null,
      qrCode: runner.runner_number ? `RUN-${groupData.group_code}-${runner.runner_number}` : null
    }));
    
    // Preparar attachments para QR codes
    const attachments = [];
    
    // Generar QR para cada corredor con número asignado
    for (let i = 0; i < formattedRunners.length; i++) {
      const runner = formattedRunners[i];
      
      if (runner.runnerNumber) {
        const qrData = {
          type: 'runner',
          groupCode: groupData.group_code,
          runnerNumber: runner.runnerNumber,
          name: runner.fullName,
          identification: `${runner.identificationType}-${runner.identification}`,
          eventYear: 2025
        };
        
        const qrBuffer = await generateQRCodeBuffer(JSON.stringify(qrData));
        
        attachments.push({
          filename: `qr_runner_${i}.png`,
          content: qrBuffer,
          cid: `qr_runner_${i}`
        });
      }
    }
    
    // QR del grupo completo
    const groupQrData = {
      type: 'group',
      groupCode: groupData.group_code,
      totalRunners: runnersData.length,
      registrant: groupData.registrant_email,
      eventYear: 2025
    };
    
    const groupQrBuffer = await generateQRCodeBuffer(JSON.stringify(groupQrData));
    attachments.push({
      filename: 'qr_group.png',
      content: groupQrBuffer,
      cid: 'qr_group'
    });
    
    // Obtener método de pago legible
    const getPaymentMethodLabel = (method) => {
      const methods = {
        'pago_movil_p2c': 'Pago Móvil P2C',
        'zelle': 'Zelle',
        'transferencia_nacional': 'Transferencia Nacional',
        'transferencia_internacional': 'Transferencia Internacional',
        'paypal': 'PayPal',
        'efectivo_bs': 'Efectivo Bolívares',
        'efectivo_usd': 'Efectivo USD',
        'tarjeta_debito': 'Tarjeta de Débito',
        'tarjeta_credito': 'Tarjeta de Crédito',
        'tienda': 'Pago en Tienda',
        'obsequio_exonerado': 'Obsequio/Exonerado'
      };
      return methods[method] || method;
    };
    
    // Calcular montos
    const pricePerRunner = parseFloat(process.env.RUNNER_PRICE_USD || '25');
    const totalAmount = paymentData.amount_usd || (pricePerRunner * runnersData.length);
    const exchangeRate = parseFloat(paymentData.exchange_rate || process.env.DEFAULT_EXCHANGE_RATE || '40');
    const totalAmountBs = paymentData.amount_bs || (totalAmount * exchangeRate);
    
    // Verificar si todos tienen números asignados
    const hasNumbers = formattedRunners.every(r => r.runnerNumber !== null);
    
    // PREPARAR DATOS DEL VOUCHER P2C
    const hasPaymentVoucher = !!(paymentData.voucher || paymentData.voucher_text) && 
                              paymentData.payment_method === 'pago_movil_p2c';
    
    let paymentVoucherText = null;
    if (hasPaymentVoucher) {
      // Si el voucher es un objeto, extraer el texto
      if (typeof paymentData.voucher === 'object' && paymentData.voucher.text) {
        paymentVoucherText = paymentData.voucher.text;
      } else if (typeof paymentData.voucher === 'string') {
        paymentVoucherText = paymentData.voucher;
      } else if (paymentData.voucher_text) {
        paymentVoucherText = paymentData.voucher_text;
      }
    }
    
    console.log('Procesamiento de voucher P2C:', {
      hasVoucher: hasPaymentVoucher,
      voucherType: typeof paymentData.voucher,
      voucherContent: paymentVoucherText ? 'Voucher presente' : 'Sin voucher'
    });
    
    // Preparar datos del template
    const templateData = {
      // Información del registrante
      registrantName: groupData.registrant_name || groupData.registrant_email.split('@')[0],
      registrantEmail: groupData.registrant_email,
      registrantPhone: groupData.registrant_phone,
      
      // Información del grupo
      isGroup: runnersData.length > 1,
      groupCode: groupData.group_code,
      totalRunners: runnersData.length,
      
      // Información del evento
      eventName: 'CLX Night Run 2025',
      eventDate: process.env.EVENT_DATE || 'Sábado 15 de Marzo, 2025',
      eventTime: process.env.EVENT_TIME || '6:00 PM',
      eventLocation: process.env.EVENT_LOCATION || 'Centro Comercial Metropolis, Valencia',
      
      // Lista de corredores
      runners: formattedRunners,
      hasNumbers: hasNumbers,
      
      // Información del pago
      paymentMethod: paymentData.payment_method,
      paymentMethodLabel: getPaymentMethodLabel(paymentData.payment_method),
      paymentReference: paymentData.payment_reference || paymentData.reference,
      authorizationCode: paymentData.auth_id || paymentData.authId || null,
      paymentDate: new Date(paymentData.payment_confirmed_at || Date.now()).toLocaleDateString('es-ES'),
      
      // DATOS DEL VOUCHER P2C
      hasPaymentVoucher: hasPaymentVoucher,
      paymentVoucher: paymentVoucherText,
      
      // Montos
      pricePerRunner: formatCurrency(pricePerRunner, 2),
      totalAmount: formatCurrency(totalAmount, 2),
      totalAmountBs: formatCurrency(totalAmountBs, 2),
      
      // Información del kit
      kitPickupInfo: process.env.KIT_PICKUP_INFO || 'Del 12 al 14 de Marzo en el Centro Comercial Metropolis de 10:00 AM a 8:00 PM',
      
      // URLs
      downloadUrl: `${process.env.FRONTEND_URL || 'https://clxnightrun.com'}/download/${groupData.group_code}`,
      websiteUrl: process.env.WEBSITE_URL || 'https://clxnightrun.com',
      facebookUrl: process.env.FACEBOOK_URL || 'https://facebook.com/clxnightrun',
      instagramUrl: process.env.INSTAGRAM_URL || 'https://instagram.com/clxnightrun',
      twitterUrl: process.env.TWITTER_URL || 'https://twitter.com/clxnightrun',
      
      // Información de soporte
      supportEmail: process.env.SUPPORT_EMAIL || 'info@clxnightrun.com',
      supportPhone: process.env.SUPPORT_PHONE || '+58 424-1234567',
      
      // Datos de la empresa
      companyName: process.env.COMPANY_NAME || 'CLX Night Run',
      year: new Date().getFullYear()
    };
    
    // Compilar el HTML
    const html = template(templateData);
    
    // Aplicar estilos inline para mejor compatibilidad
    const htmlWithInlineStyles = juice(html);
    
    // Configurar el email
    const mailOptions = {
      from: `"${process.env.COMPANY_NAME || 'CLX Night Run'}" <${process.env.SMTP_USER}>`,
      to: groupData.registrant_email,
      cc: formattedRunners
        .filter(r => r.email && r.email !== groupData.registrant_email)
        .map(r => r.email)
        .filter(Boolean)
        .join(', '),
      subject: `🎉 ¡Inscripción Confirmada! - CLX Night Run 2025 - Grupo ${groupData.group_code}`,
      html: htmlWithInlineStyles,
      attachments
    };
    
    // Verificar si hay destinatarios en CC
    if (!mailOptions.cc || mailOptions.cc.trim() === '') {
      delete mailOptions.cc;
    }
    
    // Enviar el email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email de confirmación enviado:', info.messageId);
    console.log('Destinatario principal:', groupData.registrant_email);
    console.log('Copias enviadas a:', mailOptions.cc || 'Ninguna');
    
    // Opcionalmente, enviar emails individuales a cada corredor
    if (process.env.SEND_INDIVIDUAL_RUNNER_EMAILS === 'true') {
      for (const runner of formattedRunners) {
        if (runner.email && runner.email !== groupData.registrant_email) {
          try {
            const individualMailOptions = {
              from: mailOptions.from,
              to: runner.email,
              subject: `🏃 ¡Tu inscripción está confirmada! - CLX Night Run 2025 ${runner.runnerNumber ? `- Dorsal #${runner.runnerNumber}` : ''}`,
              html: htmlWithInlineStyles,
              attachments: attachments.filter(att => 
                att.cid === 'qr_group' || 
                att.cid === `qr_runner_${formattedRunners.indexOf(runner)}`
              )
            };
            
            await transporter.sendMail(individualMailOptions);
            console.log(`✅ Email individual enviado a ${runner.fullName} (${runner.email})`);
          } catch (individualError) {
            console.error(`⚠️ Error enviando email individual a ${runner.email}:`, individualError);
          }
        }
      }
    }
    
    return {
      success: true,
      messageId: info.messageId,
      emailsSent: {
        main: groupData.registrant_email,
        cc: mailOptions.cc ? mailOptions.cc.split(', ').filter(Boolean) : [],
        total: 1 + (mailOptions.cc ? mailOptions.cc.split(', ').filter(Boolean).length : 0)
      }
    };
    
  } catch (error) {
    console.error('❌ Error enviando email de confirmación de corredores:', error);
    throw error;
  }
};

// Función para enviar notificación cuando se asignan números de dorsal
export const sendRunnerNumberAssignmentEmail = async (groupData, runnersData) => {
  try {
    console.log('=== Enviando notificación de asignación de números ===');
    
    const transporter = createEmailTransporter();
    
    // Template HTML simple para notificación de números
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Números de Dorsal Asignados</title>
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; padding: 30px;">
          <h2 style="color: #FF6B35;">¡Números de Dorsal Asignados!</h2>
          <p>Hola ${groupData.registrant_email.split('@')[0]},</p>
          <p>Los números de dorsal para tu grupo <strong>${groupData.group_code}</strong> han sido asignados exitosamente:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #FF6B35; color: white;">
                <th style="padding: 10px; text-align: left;">Corredor</th>
                <th style="padding: 10px; text-align: center;">Número de Dorsal</th>
              </tr>
            </thead>
            <tbody>
              ${runnersData.map(runner => `
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 10px;">${runner.full_name}</td>
                  <td style="padding: 10px; text-align: center; font-weight: bold; color: #FF6B35; font-size: 18px;">
                    #${runner.runner_number}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <p style="color: #666;">Estos números estarán impresos en los dorsales que recibirán al retirar su kit de corredor.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            CLX Night Run 2025 | ${process.env.SUPPORT_EMAIL || 'info@clxnightrun.com'}
          </p>
        </div>
      </body>
      </html>
    `;
    
    const mailOptions = {
      from: `"CLX Night Run" <${process.env.SMTP_USER}>`,
      to: groupData.registrant_email,
      subject: `📢 Números de Dorsal Asignados - Grupo ${groupData.group_code}`,
      html: htmlTemplate
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Notificación de números enviada:', info.messageId);
    
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Error enviando notificación de números:', error);
    return { success: false, error: error.message };
  }
};

// Exportar todas las funciones
export default {
  sendConfirmationEmail,
  sendRunnerConfirmationEmail,
  sendPendingVerificationEmail,
  sendRunnerNumberAssignmentEmail,
  sendRejectionEmail,
  handleTicketEmailNotification,
  generateQRCodeBuffer,
  generateBarcodeBuffer
};