// constants.ts
export const COMMERCE_CONFIG = {
  phone: '04141234567',     // REEMPLAZAR: Teléfono del comercio
  bankCode: '0138',         // REEMPLAZAR: Código del banco del comercio
  name: 'CLX Night Run 2025'
};

export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://admin.clxnightrun.com';

export const PRICE_USD = '0.0699';

export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;

export const PAYMENT_METHODS = [
  { value: 'pago_movil_p2c', label: 'Pago Móvil P2C (Automático)' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'transferencia_nacional', label: 'Transferencia Nacional' },
  { value: 'transferencia_internacional', label: 'Transferencia Internacional' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'tienda', label: 'Pago en Tienda' }
] as const;

export const IDENTIFICATION_TYPES = [
  { value: 'V', label: 'V' },
  { value: 'E', label: 'E' },
  { value: 'J', label: 'J' },
  { value: 'P', label: 'P' }
] as const;

export const GENDERS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' }
] as const;

export const MAX_RUNNERS_PER_GROUP = 5;
export const MIN_AGE = 16;
export const RESERVATION_HOURS = 72;

export const FILE_UPLOAD_CONFIG = {
  maxSize: 5 * 1024 * 1024, // 5MB
  acceptedTypes: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
  acceptedExtensions: '.jpg,.jpeg,.png,.pdf'
};

export const DEFAULT_BANKS = [
  { code: '0102', name: 'Banco de Venezuela' },
  { code: '0134', name: 'Banesco' },
  { code: '0105', name: 'Banco Mercantil' },
  { code: '0108', name: 'Banco Provincial' }
];

export const PAYMENT_STATUS = {
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error',
  PENDING: 'pending',
  CONFIRMED: 'confirmado'
} as const;

// Función helper para determinar singular/plural
export const getRunnerText = (count: number) => {
  return {
    runner: count === 1 ? 'Corredor' : 'Corredores',
    group: count === 1 ? 'Registro Individual' : 'Grupo',
    groupCode: count === 1 ? 'Código de Registro' : 'Código de Grupo',
    totalRunners: count === 1 ? 'Corredor Registrado' : 'Total Corredores',
    registration: count === 1 ? 'Su registro individual' : 'Su grupo',
    yourRegistration: count === 1 ? 'Su registro' : 'Su grupo'
  };
};

export const MESSAGES = {
  errors: {
    fileSize: 'El archivo no debe superar 5MB',
    fileType: 'Solo se aceptan imágenes (JPG, PNG) o PDF',
    minAge: 'Debe tener al menos 16 años',
    maxRunners: 'Máximo 5 corredores por grupo',
    genericError: 'Ha ocurrido un error. Por favor intente nuevamente.',
    paymentError: 'Error procesando el pago. Por favor intente nuevamente.'
  },
  success: {
    // Función para generar mensaje de éxito basado en cantidad de corredores
    getRegistrationMessage: (runnerCount: number) => {
      const text = getRunnerText(runnerCount);
      return `${text.registration} ha sido registrado correctamente`;
    },
    payment: 'Pago procesado exitosamente'
  },
  info: {
    processingPayment: 'Por favor espere mientras procesamos su registro...',
    reservationTime: `Su reserva será válida por ${RESERVATION_HOURS} horas`,
    // Función para generar mensaje de reserva basado en cantidad de corredores
    getReservationMessage: (runnerCount: number) => {
      const text = getRunnerText(runnerCount);
      return `${text.yourRegistration} está reservado por ${RESERVATION_HOURS} horas. Por favor complete el pago para confirmar su inscripción.`;
    }
  }
};