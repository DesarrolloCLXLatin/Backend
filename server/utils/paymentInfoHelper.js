// utils/paymentInfoHelper.js
// Función helper para asegurar que todos los datos del pago móvil estén completos

import megasoftService from '../services/megasoftService.js';

/**
 * Prepara la información completa del pago para emails
 * Asegura que todos los campos críticos del voucher estén presentes
 */
export const preparePaymentInfoForEmail = (baseInfo, megasoftResult = null, exchangeRate = null) => {
  // Datos base que siempre deben estar presentes
  const paymentInfo = {
    payment_method: baseInfo.payment_method,
    reference: baseInfo.reference || megasoftResult?.referencia || '',
    status: baseInfo.status || 'approved',
    amount_usd: parseFloat(baseInfo.amount_usd) || 0,
    amount_bs: parseFloat(baseInfo.amount_bs) || 0,
    totalAmount: parseFloat(baseInfo.totalAmount || baseInfo.amount_usd) || 0,
    transaction_id: baseInfo.transaction_id,
    created_at: baseInfo.created_at || new Date().toISOString(),
    confirmed_at: baseInfo.confirmed_at || new Date().toISOString()
  };

  // Si es pago móvil y tenemos resultado de Megasoft
  if (baseInfo.payment_method === 'pago_movil' && megasoftResult) {
    // Procesar el voucher correctamente
    let voucherText = '';
    let voucherLines = [];
    
    if (megasoftResult.voucherText) {
      voucherText = megasoftResult.voucherText;
      voucherLines = megasoftResult.voucherText.split('\n').filter(line => line.trim());
    } else if (megasoftResult.voucher) {
      if (Array.isArray(megasoftResult.voucher)) {
        voucherLines = megasoftResult.voucher;
        voucherText = megasoftResult.voucher.join('\n');
      } else if (typeof megasoftResult.voucher === 'string') {
        voucherText = megasoftResult.voucher;
        voucherLines = megasoftResult.voucher.split('\n').filter(line => line.trim());
      }
    }

    // Agregar todos los datos de Megasoft
    Object.assign(paymentInfo, {
      // Datos críticos del voucher
      auth_id: megasoftResult.authid || '',
      control: megasoftResult.control || '',
      terminal: megasoftResult.terminal || '',
      lote: megasoftResult.lote || '',
      seqnum: megasoftResult.seqnum || '',
      
      // El voucher formateado
      voucher: voucherText || 'Voucher no disponible',
      voucher_lines: voucherLines,
      
      // Información del comercio
      commerce_phone: process.env.MEGASOFT_COMMERCE_PHONE || '04141234567',
      commerce_bank_code: process.env.MEGASOFT_COMMERCE_BANK_CODE || '0138',
      bank_name: megasoftService.getBankName(
        process.env.MEGASOFT_COMMERCE_BANK_CODE || '0138'
      ),
      commerce_rif: process.env.COMPANY_RIF || 'J-12345678-9',
      
      // Datos adicionales
      factura: megasoftResult.factura || baseInfo.invoice_number || '',
      afiliacion: megasoftResult.afiliacion || process.env.MEGASOFT_COD_AFILIACION || '',
      rifbanco: megasoftResult.rifbanco || '',
      authname: megasoftResult.authname || '',
      
      // Flag para indicar si es duplicado
      isDuplicated: voucherText.includes('DUPLICADO') || false
    });
  }

  // Si tenemos tasa de cambio y no tenemos amount_bs
  if (exchangeRate && !paymentInfo.amount_bs && paymentInfo.amount_usd) {
    paymentInfo.amount_bs = paymentInfo.amount_usd * exchangeRate;
  }

  // Validar que los campos críticos estén presentes para pago móvil
  if (paymentInfo.payment_method === 'pago_movil') {
    const requiredFields = [
      'voucher', 'auth_id', 'control', 'terminal', 
      'reference', 'totalAmount'
    ];
    
    const missingFields = requiredFields.filter(field => !paymentInfo[field]);
    
    if (missingFields.length > 0) {
      console.warn('⚠️ Campos faltantes en paymentInfo para pago móvil:', missingFields);
      console.warn('PaymentInfo actual:', paymentInfo);
    }
  }

  return paymentInfo;
};

/**
 * Extrae datos de Megasoft de una transacción guardada
 */
export const extractMegasoftDataFromTransaction = (transaction) => {
  const megasoftData = {
    authid: transaction.megasoft_authid,
    terminal: transaction.megasoft_terminal,
    lote: transaction.megasoft_lote,
    seqnum: transaction.megasoft_seqnum,
    control: transaction.megasoft_control || transaction.control_number,
    voucher: transaction.megasoft_voucher,
    voucherText: transaction.megasoft_voucher,
    referencia: transaction.reference
  };

  // Intentar obtener datos adicionales del gateway_response
  if (transaction.gateway_response) {
    const response = transaction.gateway_response;
    
    if (response.voucher_data) {
      megasoftData.voucher = response.voucher_data.text || megasoftData.voucher;
      megasoftData.voucherText = response.voucher_data.text || megasoftData.voucherText;
    }
    
    if (response.megasoft_response) {
      Object.assign(megasoftData, {
        afiliacion: response.megasoft_response.afiliacion,
        rifbanco: response.megasoft_response.rifbanco,
        authname: response.megasoft_response.authname,
        factura: response.megasoft_response.factura
      });
    }
  }

  return megasoftData;
};

/**
 * Valida que la información del voucher esté completa
 */
export const validateVoucherData = (paymentInfo) => {
  if (paymentInfo.payment_method !== 'pago_movil') {
    return { isValid: true };
  }

  const errors = [];
  const warnings = [];

  // Campos obligatorios según las normas del proveedor
  const requiredFields = {
    voucher: 'Texto del voucher',
    auth_id: 'ID de autorización',
    control: 'Número de control',
    terminal: 'Terminal',
    reference: 'Referencia',
    commerce_rif: 'RIF del comercio',
    commerce_phone: 'Teléfono del comercio',
    commerce_bank_code: 'Código del banco del comercio'
  };

  for (const [field, description] of Object.entries(requiredFields)) {
    if (!paymentInfo[field]) {
      errors.push(`Falta ${description} (${field})`);
    }
  }

  // Campos opcionales pero recomendados
  const optionalFields = {
    lote: 'Número de lote',
    seqnum: 'Número de secuencia',
    factura: 'Número de factura',
    afiliacion: 'Código de afiliación',
    rifbanco: 'RIF del banco',
    authname: 'Nombre de autorización'
  };

  for (const [field, description] of Object.entries(optionalFields)) {
    if (!paymentInfo[field]) {
      warnings.push(`Falta ${description} (${field})`);
    }
  }

  const isValid = errors.length === 0;

  if (!isValid) {
    console.error('❌ Validación de voucher falló:', errors);
  }

  if (warnings.length > 0) {
    console.warn('⚠️ Advertencias en voucher:', warnings);
  }

  return {
    isValid,
    errors,
    warnings
  };
};

export default {
  preparePaymentInfoForEmail,
  extractMegasoftDataFromTransaction,
  validateVoucherData
};