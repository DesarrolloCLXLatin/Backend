// src/components/tickets/IframeTicketPurchase/utils/validators.ts

import { FormData, P2CData, PaymentData, TicketZone, Seat, FormErrors } from '../types';
import { VALIDATION_RULES } from '../constants';

export const validatePersonalData = (formData: FormData): FormErrors => {
  const errors: FormErrors = {};

  // Validar nombre
  if (!formData.buyer_name || formData.buyer_name.length < VALIDATION_RULES.buyer_name.minLength) {
    errors.buyer_name = VALIDATION_RULES.buyer_name.message;
  }

  // Validar identificación
  if (!formData.buyer_identification || formData.buyer_identification.length < VALIDATION_RULES.buyer_identification.minLength) {
    errors.buyer_identification = VALIDATION_RULES.buyer_identification.message;
  }

  // Validar email
  if (!formData.buyer_email || !VALIDATION_RULES.buyer_email.pattern.test(formData.buyer_email)) {
    errors.buyer_email = VALIDATION_RULES.buyer_email.message;
  }

  // Validar teléfono
  if (!formData.buyer_phone || formData.buyer_phone.length < VALIDATION_RULES.buyer_phone.minLength) {
    errors.buyer_phone = VALIDATION_RULES.buyer_phone.message;
  }

  return errors;
};

export const validateZoneSelection = (
  selectedZone: TicketZone | null,
  selectedSeats: Seat[],
  generalQuantity: number
): FormErrors => {
  const errors: FormErrors = {};

  if (!selectedZone) {
    errors.zone = 'Debe seleccionar un tipo de entrada';
  } else if (selectedZone.is_numbered && selectedSeats.length === 0) {
    errors.seats = 'Debe seleccionar al menos un asiento';
  }

  return errors;
};

export const validatePaymentMethod = (
  paymentMethod: string,
  p2cData: P2CData,
  paymentData: PaymentData,
  captchaToken: string,
  requiresCaptcha: boolean
): FormErrors => {
  const errors: FormErrors = {};

  if (!paymentMethod) {
    errors.payment_method = 'Seleccione un método de pago';
  }

  // Validaciones específicas por método de pago
  if (paymentMethod === 'pago_movil') {
    if (!p2cData.client_phone || !VALIDATION_RULES.client_phone.pattern.test(p2cData.client_phone)) {
      errors.client_phone = VALIDATION_RULES.client_phone.message;
    }
    if (!p2cData.client_bank_code) {
      errors.client_bank_code = 'Banco es requerido';
    }
  }

  if (paymentMethod === 'transferencia_nacional') {
    if (!paymentData.bank_code) {
      errors.bank_code = 'Banco es requerido';
    }
    if (!paymentData.reference) {
      errors.reference = 'Referencia es requerida';
    }
    if (!paymentData.proof_file) {
      errors.proof_file = 'Comprobante es requerido';
    }
  }

  if (paymentMethod === 'zelle') {
    if (!paymentData.email_from || !VALIDATION_RULES.buyer_email.pattern.test(paymentData.email_from)) {
      errors.email_from = 'Email válido es requerido';
    }
    if (!paymentData.reference) {
      errors.reference = 'Número de confirmación es requerido';
    }
    if (!paymentData.proof_file) {
      errors.proof_file = 'Captura de pantalla es requerida';
    }
  }

  if (paymentMethod === 'paypal') {
    if (!paymentData.paypal_email || !VALIDATION_RULES.buyer_email.pattern.test(paymentData.paypal_email)) {
      errors.paypal_email = 'Email de PayPal es requerido';
    }
  }

  if (requiresCaptcha && !captchaToken) {
    errors.captcha = 'Por favor complete el captcha';
  }

  return errors;
};

export const validateStep = (
  step: number,
  formData: FormData,
  selectedZone: TicketZone | null,
  selectedSeats: Seat[],
  generalQuantity: number,
  p2cData: P2CData,
  paymentData: PaymentData,
  captchaToken: string,
  requiresCaptcha: boolean
): { isValid: boolean; errors: FormErrors } => {
  let errors: FormErrors = {};

  switch (step) {
    case 1:
      errors = validatePersonalData(formData);
      break;
    
    case 2:
      errors = validateZoneSelection(selectedZone, selectedSeats, generalQuantity);
      break;
    
    case 3:
      errors = validatePaymentMethod(
        formData.payment_method,
        p2cData,
        paymentData,
        captchaToken,
        requiresCaptcha
      );
      break;
    
    default:
      break;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateP2CReference = (reference: string): boolean => {
  return reference.length > 0;
};

export const validateFileUpload = (file: File | null, maxSizeMB: number = 5): string | null => {
  if (!file) {
    return 'Archivo es requerido';
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return `El archivo no debe superar ${maxSizeMB}MB`;
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    return 'Solo se permiten imágenes (JPG, PNG) o PDF';
  }

  return null;
};