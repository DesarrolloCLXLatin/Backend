export const PAYMENT_METHODS = {
  PAGO_MOVIL: 'pago_movil',
  ZELLE: 'zelle',
  TRANSFERENCIA: 'transferencia',
  TRANSFERENCIA_NACIONAL: 'transferencia_nacional',
  PAYPAL: 'paypal',
  TIENDA: 'tienda'
} as const;

export const PAYMENT_STATUS = {
  PENDIENTE: 'pendiente',
  CONFIRMADO: 'confirmado',
  RECHAZADO: 'rechazado'
} as const;

export const TICKET_STATUS = {
  VENDIDO: 'vendido',
  CANJEADO: 'canjeado',
  CANCELADO: 'cancelado'
} as const;

export const USER_ROLES = {
  ADMIN: 'admin',
  TIENDA: 'tienda',
  USER: 'user'
} as const;

export const EVENT_INFO = {
  name: 'Concierto Wynwood Park',
  date: '08 de Noviembre, 2025',
  location: 'Wynwood Park',
  venue: {
    totalCapacity: 5270,
    boxCapacity: 300,
    generalCapacity: 4970,
    totalBoxes: 30
  }
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  PAGE_SIZE_OPTIONS: [25, 50, 100, 200]
} as const;

export const REFRESH_INTERVALS = {
  TICKETS: 60000, // 1 minuto
  VALIDATIONS: 30000, // 30 segundos
  STATS: 120000 // 2 minutos
} as const;

export const EMAIL_TEMPLATES = {
  CONFIRMATION: 'ticket_confirmation',
  REJECTION: 'payment_rejection',
  VERIFICATION: 'payment_verification',
  REMINDER: 'payment_reminder'
} as const;

export const COLORS = {
  PRIMARY: 'from-orange-600 to-[#f08772]',
  SUCCESS: 'green',
  WARNING: 'yellow',
  ERROR: 'red',
  INFO: 'blue'
} as const;