// utils/ticketUtils.js - Versión corregida con mejoras
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

import emailService from './emailService.js';
const { 
  sendConfirmationEmail, 
  sendPendingVerificationEmail, 
  sendRejectionEmail,
  generateQRCodeBuffer,
  generateBarcodeBuffer
} = emailService;

// Importar helper si existe
let preparePaymentInfoForEmail, validateVoucherData;
try {
  const paymentHelper = await import('./paymentInfoHelper.js');
  preparePaymentInfoForEmail = paymentHelper.preparePaymentInfoForEmail;
  validateVoucherData = paymentHelper.validateVoucherData;
} catch (error) {
  console.warn('paymentInfoHelper.js not found, using fallback functions');
  // Funciones fallback simples
  preparePaymentInfoForEmail = (info) => info;
  validateVoucherData = (info) => ({ isValid: true, errors: [], warnings: [] });
}

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let createCanvas;
try {
  const canvasModule = await import('canvas');
  createCanvas = canvasModule.createCanvas;
} catch (error) {
  console.warn('Canvas module not available, barcode generation disabled');
  createCanvas = null;
}

// Generar número de ticket único
export const generateTicketNumber = () => {
  const prefix = 'TCK';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

// Generar código QR único
export const generateQRCode = () => {
  return `QR-${uuidv4()}`;
};

// Generar código de barras único
export const generateBarcode = () => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BAR-${timestamp}${random}`;
};

// Función principal para generar y enviar emails de tickets
export const generateAndSendTicketEmails = async (tickets) => {
  try {
    if (!tickets || tickets.length === 0) {
      throw new Error('No tickets provided');
    }

    // Agrupar tickets por comprador
    const ticketsByBuyer = {};
    tickets.forEach(ticket => {
      const key = ticket.buyer_email;
      if (!ticketsByBuyer[key]) {
        ticketsByBuyer[key] = [];
      }
      ticketsByBuyer[key].push(ticket);
    });

    // Enviar emails a cada comprador
    const results = [];
    for (const [email, buyerTickets] of Object.entries(ticketsByBuyer)) {
      try {
        // Preparar datos del comprador
        const ticketData = {
          buyer_name: buyerTickets[0].buyer_name,
          buyer_email: email,
          buyer_phone: buyerTickets[0].buyer_phone,
          buyer_identification: buyerTickets[0].buyer_identification,
          ticket_type: buyerTickets[0].ticket_type,
          box_code: buyerTickets[0].metadata?.box_code,
          box_capacity: buyerTickets[0].metadata?.box_capacity,
          floor_level: buyerTickets[0].metadata?.floor_level,
          amenities: buyerTickets[0].metadata?.amenities
        };

        // Preparar datos del pago
        const paymentData = {
          payment_method: buyerTickets[0].payment_method,
          reference: buyerTickets[0].payment_reference,
          auth_id: buyerTickets[0].megasoft_authid,
          amount_usd: buyerTickets.reduce((sum, t) => sum + (t.ticket_price || 35), 0),
          amount_bs: buyerTickets[0].amount_bs,
          transaction_id: buyerTickets[0].transaction_id || buyerTickets[0].id
        };

        // Enviar email de confirmación
        const result = await emailService.sendConfirmationEmail(
          ticketData,
          paymentData,
          buyerTickets
        );

        results.push({
          email,
          success: true,
          messageId: result.messageId
        });

      } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
        results.push({
          email,
          success: false,
          error: error.message
        });
      }
    }

    return results;

  } catch (error) {
    console.error('Error in generateAndSendTicketEmails:', error);
    throw error;
  }
};

// Función para enviar email de validación pendiente
export const generateValidationPendingEmail = async (data) => {
  try {
    const { user, tickets, paymentInfo } = data;

    // Preparar datos del ticket
    const ticketData = {
      buyer_name: user.name || user.full_name || user.email.split('@')[0],
      buyer_email: user.email,
      buyer_phone: tickets[0]?.buyer_phone,
      buyer_identification: tickets[0]?.buyer_identification,
      quantity: tickets.length
    };

    // Preparar datos del pago
    const paymentData = {
      payment_method: paymentInfo.payment_method || tickets[0]?.payment_method,
      reference: paymentInfo.reference,
      amount_usd: paymentInfo.amount,
      created_at: new Date().toISOString()
    };

    // Enviar email de verificación pendiente
    const result = await emailService.sendPendingVerificationEmail(
      ticketData,
      paymentData
    );

    return result;

  } catch (error) {
    console.error('Error sending validation pending email:', error);
    throw error;
  }
};

// Función para generar PDF de tickets (para descarga)
export const generateTicketPDF = async (tickets) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Título principal
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text('ENTRADAS PARA EL CONCIERTO', { align: 'center' });
      
      doc.moveDown();

      // Información del evento
      doc.fontSize(14)
         .font('Helvetica')
         .text(`Fecha: ${process.env.EVENT_DATE || '15 de Marzo, 2025'}`, { align: 'center' })
         .text(`Hora: ${process.env.EVENT_TIME || '8:00 PM'}`, { align: 'center' })
         .text(`Lugar: ${process.env.EVENT_VENUE || 'Estadio Principal'}`, { align: 'center' });

      doc.moveDown(2);

      // Generar página para cada ticket
      for (let i = 0; i < tickets.length; i++) {
        if (i > 0) {
          doc.addPage();
        }

        const ticket = tickets[i];

        // Marco del ticket
        doc.rect(50, 150, 495, 300)
           .stroke();

        // Información del ticket
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text(`ENTRADA #${ticket.ticket_number}`, 70, 170);

        doc.fontSize(12)
           .font('Helvetica')
           .text(`Tipo: ${ticket.ticket_type === 'general' ? 'General' : ticket.ticket_type}`, 70, 200)
           .text(`Asiento: ${ticket.seat_number || 'General'}`, 70, 220)
           .text(`Zona: ${ticket.zone_name || 'General'}`, 70, 240);

        // Información del comprador
        doc.text(`Nombre: ${ticket.buyer_name}`, 70, 280)
           .text(`Email: ${ticket.buyer_email}`, 70, 300)
           .text(`Teléfono: ${ticket.buyer_phone}`, 70, 320)
           .text(`ID: ${ticket.buyer_identification}`, 70, 340);

        // Generar QR Code
        if (ticket.qr_code) {
          try {
            const qrBuffer = await QRCode.toBuffer(ticket.qr_code, {
              width: 150,
              margin: 0
            });
            doc.image(qrBuffer, 350, 200, { width: 150 });
          } catch (qrError) {
            console.error('Error generating QR code:', qrError);
          }
        }

        // Generar código de barras
        if (ticket.barcode && createCanvas) {
          try {
            const canvas = createCanvas(200, 50);
            JsBarcode(canvas, ticket.barcode, {
              format: 'CODE128',
              width: 2,
              height: 40,
              displayValue: false
            });
            const barcodeBuffer = canvas.toBuffer('image/png');
            doc.image(barcodeBuffer, 300, 380, { width: 200 });
          } catch (barcodeError) {
            console.error('Error generating barcode:', barcodeError);
          }
        }

        // Instrucciones
        doc.fontSize(10)
           .font('Helvetica')
           .text('Presente este documento en la entrada del evento', 70, 480)
           .text('No olvide traer su documento de identidad', 70, 495);

        // Pie de página
        doc.fontSize(8)
           .text(`Generado el ${new Date().toLocaleString('es-ES')}`, 70, 550)
           .text(`${process.env.COMPANY_NAME || 'Eventos Premium'} - Todos los derechos reservados`, 70, 565);
      }

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};

// Función para generar recibo de compra (legacy - mantener para compatibilidad)
export const generateTicketReceipt = async (mainTicket, allTickets = null) => {
  // Si se necesita generar un PDF específico de recibo, usar esta función
  // Por ahora, redirigir a generateTicketPDF
  const tickets = allTickets || [mainTicket];
  return generateTicketPDF(tickets);
};

// Función para enviar email de tickets (legacy - mantener para compatibilidad)
export const sendTicketEmail = async (email, name, tickets, receiptBuffer = null) => {
  try {
    // Preparar datos para el nuevo sistema
    const ticketData = {
      buyer_name: name,
      buyer_email: email,
      buyer_phone: tickets[0].buyer_phone,
      buyer_identification: tickets[0].buyer_identification,
      ticket_type: tickets[0].ticket_type
    };

    const paymentData = {
      payment_method: tickets[0].payment_method,
      reference: tickets[0].payment_reference,
      amount_usd: tickets.reduce((sum, t) => sum + (t.ticket_price || 35), 0),
      transaction_id: tickets[0].id
    };

    // Usar el nuevo sistema de emails
    return emailService.sendConfirmationEmail(ticketData, paymentData, tickets);

  } catch (error) {
    console.error('Error in sendTicketEmail:', error);
    throw error;
  }
};

// Función para manejar el flujo completo de emails según el método de pago
export const handlePaymentEmailFlow = async (tickets, paymentInfo, paymentMethod) => {
  try {
    console.log('=== handlePaymentEmailFlow DEBUG ===');
    console.log('Payment Method:', paymentMethod);
    console.log('Payment Info recibido:', {
      hasVoucher: !!paymentInfo.voucher,
      voucherLength: paymentInfo.voucher?.length,
      hasAuthId: !!paymentInfo.auth_id,
      hasControl: !!paymentInfo.control,
      hasTerminal: !!paymentInfo.terminal,
      hasTotalAmount: !!paymentInfo.totalAmount,
      totalAmount: paymentInfo.totalAmount
    });

    // Asegurar que tickets sea un array
    const ticketsArray = Array.isArray(tickets) ? tickets : [tickets];
    
    // Validar que tengamos tickets
    if (!ticketsArray.length) {
      throw new Error('No hay tickets para procesar');
    }

    // Obtener el primer ticket para datos del comprador
    const primaryTicket = ticketsArray[0];
    
    // IMPORTANTE: Preparar la información del pago correctamente
    const preparedPaymentInfo = {
      ...paymentInfo,
      payment_method: paymentMethod || paymentInfo.payment_method,
      // Asegurar que totalAmount esté presente
      totalAmount: paymentInfo.totalAmount || 
                  paymentInfo.amount_usd || 
                  (ticketsArray.length * 35.00) // Precio por defecto
    };

    // Validar datos del voucher para pago móvil
    if (paymentMethod === 'pago_movil') {
      const validation = validateVoucherData(preparedPaymentInfo);
      
      if (!validation.isValid) {
        console.error('❌ Datos del voucher incompletos:', validation.errors);
        // Continuar de todos modos pero loguear el problema
      }
      
      // Log detallado del voucher
      console.log('📄 Voucher para email:', {
        voucher: preparedPaymentInfo.voucher?.substring(0, 200) + '...',
        hasVoucher: !!preparedPaymentInfo.voucher,
        voucherType: typeof preparedPaymentInfo.voucher,
        authId: preparedPaymentInfo.auth_id,
        control: preparedPaymentInfo.control,
        terminal: preparedPaymentInfo.terminal
      });
    }

    switch (paymentMethod) {
      case 'pago_movil':
        // Para pago móvil siempre es confirmado automáticamente
        console.log('Enviando email de confirmación con voucher para pago móvil');
        
        // CRÍTICO: Asegurar que el voucher esté presente
        if (!preparedPaymentInfo.voucher) {
          console.error('⚠️ WARNING: No hay voucher para pago móvil!');
          preparedPaymentInfo.voucher = 'Voucher no disponible - Contacte soporte';
        }
        
        await sendConfirmationEmail(primaryTicket, preparedPaymentInfo, ticketsArray);
        break;

      case 'tienda':
        // Pago en tienda es confirmado inmediatamente
        console.log('Enviando email de confirmación para pago en tienda');
        await sendConfirmationEmail(primaryTicket, preparedPaymentInfo, ticketsArray);
        break;

      case 'zelle':
      case 'transferencia':
      case 'paypal':
        // Estos métodos requieren verificación manual
        if (preparedPaymentInfo.status === 'approved' || preparedPaymentInfo.status === 'confirmed') {
          console.log('Enviando email de confirmación para', paymentMethod);
          await sendConfirmationEmail(primaryTicket, preparedPaymentInfo, ticketsArray);
        } else {
          console.log('Enviando email de verificación pendiente para', paymentMethod);
          await sendPendingVerificationEmail(primaryTicket, preparedPaymentInfo);
        }
        break;

      case 'tarjeta':
        // Tarjeta de crédito/débito
        if (preparedPaymentInfo.status === 'approved') {
          await sendConfirmationEmail(primaryTicket, preparedPaymentInfo, ticketsArray);
        } else if (preparedPaymentInfo.status === 'rejected') {
          await sendRejectionEmail(
            primaryTicket, 
            preparedPaymentInfo, 
            'La transacción fue rechazada por el banco'
          );
        }
        break;

      default:
        console.warn('Método de pago no reconocido:', paymentMethod);
        // Por defecto enviar confirmación si está aprobado
        if (preparedPaymentInfo.status === 'approved' || preparedPaymentInfo.status === 'confirmed') {
          await sendConfirmationEmail(primaryTicket, preparedPaymentInfo, ticketsArray);
        }
    }

    console.log('✅ Email enviado exitosamente');
    console.log('=== FIN handlePaymentEmailFlow ===');
    
    return { success: true };

  } catch (error) {
    console.error('Error en handlePaymentEmailFlow:', error);
    throw error;
  }
};

// Función para procesar confirmación manual de pago
export const processManualPaymentConfirmation = async (
  tickets, 
  paymentInfo, 
  approved = true, 
  rejectionReason = null
) => {
  try {
    const ticketsArray = Array.isArray(tickets) ? tickets : [tickets];
    const primaryTicket = ticketsArray[0];
    
    if (approved) {
      console.log('Procesando confirmación manual de pago');
      
      // Para pagos móviles, intentar recuperar el voucher si no está presente
      if (paymentInfo.payment_method === 'pago_movil' && !paymentInfo.voucher) {
        console.warn('⚠️ Pago móvil confirmado manualmente sin voucher');
        // Podríamos intentar recuperar el voucher de la BD si tenemos transaction_id
      }
      
      await sendConfirmationEmail(primaryTicket, paymentInfo, ticketsArray);
    } else {
      console.log('Procesando rechazo manual de pago');
      await sendRejectionEmail(
        primaryTicket, 
        paymentInfo, 
        rejectionReason || 'El pago no pudo ser verificado'
      );
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('Error en processManualPaymentConfirmation:', error);
    throw error;
  }
};

// Función para reenviar emails de tickets
export const resendTicketEmail = async (ticket) => {
  try {
    // Preparar datos del ticket
    const ticketData = {
      buyer_name: ticket.buyer_name,
      buyer_email: ticket.buyer_email,
      buyer_phone: ticket.buyer_phone,
      buyer_identification: ticket.buyer_identification,
      ticket_type: ticket.ticket_type,
      box_code: ticket.metadata?.box_code
    };

    // Preparar datos del pago
    const paymentData = {
      payment_method: ticket.payment_method,
      reference: ticket.payment_reference,
      auth_id: ticket.megasoft_authid,
      amount_usd: ticket.ticket_price || 35,
      transaction_id: ticket.id
    };

    // Reenviar email de confirmación
    return emailService.sendConfirmationEmail(ticketData, paymentData, [ticket]);

  } catch (error) {
    console.error('Error resending ticket email:', error);
    throw error;
  }
};

// Exportar todas las funciones
export default {
  generateTicketNumber,
  generateQRCode,
  generateBarcode,
  generateAndSendTicketEmails,
  generateValidationPendingEmail,
  generateTicketPDF,
  generateTicketReceipt,
  sendTicketEmail,
  handlePaymentEmailFlow,
  processManualPaymentConfirmation,
  resendTicketEmail
};