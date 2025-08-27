// src/components/tickets/IframeTicketPurchase/constants.ts

import { TicketZone } from './types';

// Zonas mock por defecto
export const MOCK_ZONES: TicketZone[] = [
  {
    id: '1',
    zone_code: 'GENERAL',
    zone_name: 'Entrada General',
    zone_type: 'general',
    price_usd: 35.00,
    total_capacity: 4970,
    available: 3245,
    is_numbered: false,
    zone_color: '#FD8D6A',
    description: 'Acceso general al concierto, área de pie cerca del escenario'
  },
  {
    id: '2',
    zone_code: 'VIP',
    zone_name: 'Zona VIP',
    zone_type: 'vip',
    price_usd: 75.00,
    total_capacity: 30,
    available: 20,
    is_numbered: true,
    zone_color: '#FD8D6A',
    description: 'Asientos numerados con vista preferencial, servicio de bebidas y acceso exclusivo'
  }
];

// Información del evento REAL
export const EVENT_INFO = {
  name: 'Caramelos de Cianuro',
  subtitle: 'Concierto post-carrera',
  postSubtitle: 'Experiencia Única',
  date: '08-NOV',
  time: '7:00 PM',
  location: 'Wynwood Park',
  venueName: 'CLX Group',
  logoPath: '/logo-concierto.png',
  audioPath: '/soundtrack-concierto.mp3'
};

// Configuración de asientos VIP
export const VIP_SEAT_CONFIG = {
  rows: ['A', 'B', 'C', 'D', 'E', 'F'],
  seatsPerRow: 5,
  maxSeatsPerPurchase: 5,
  soldSeats: [
    'VA01', 'VA03', 'VB02', 'VB04', 'VC01', 
    'VC05', 'VD03', 'VE02', 'VE04', 'VF01'
  ]
};

// Configuración de Boxes (desde el backend)
export const BOX_CONFIG = {
  totalBoxes: 30,
  capacityPerBox: 10,
  pricePerBox: 750.00, // USD
  amenities: ['Servicio VIP', 'Bar exclusivo', 'Área privada', 'Baños privados'],
  levels: ['Nivel 1', 'Nivel 2', 'Nivel 3']
};

// Configuración de límites
export const PURCHASE_LIMITS = {
  maxGeneralTickets: 10,
  maxBoxTickets: 10,
  minTickets: 1,
  maxTicketsPerTransaction: 10,
  maxTicketsPublicToken: 5 // Límite más estricto para tokens públicos
};

// Métodos de pago disponibles
export const PAYMENT_METHODS = [
  { 
    value: 'pago_movil', 
    label: 'Pago Móvil P2C', 
    available: true,
    icon: '📱',
    description: 'Instantáneo'
  },
  { 
    value: 'transferencia_nacional', 
    label: 'Transferencia Nacional', 
    available: true,
    icon: '🏦',
    description: 'Validación en 24h'
  },
  { 
    value: 'zelle', 
    label: 'Zelle', 
    available: true,
    icon: '💳',
    description: 'Validación en 24h'
  },
  { 
    value: 'paypal', 
    label: 'PayPal', 
    available: true,
    icon: '💰',
    description: 'Instantáneo'
  }
];

// Métodos de pago disponibles REALES (se actualizan desde la API)
export const DEFAULT_PAYMENT_METHODS = [
  { 
    value: 'pago_movil', 
    label: 'Pago Móvil P2C', 
    available: true,
    icon: '📱',
    description: 'Confirmación instantánea',
    requiresValidation: false
  },
  { 
    value: 'transferencia', 
    label: 'Transferencia Bancaria', 
    available: true,
    icon: '🏦',
    description: 'Verificación manual en 2-4 horas',
    requiresValidation: true
  },
  { 
    value: 'zelle', 
    label: 'Zelle', 
    available: true,
    icon: '💳',
    description: 'Verificación manual en 2-4 horas',
    requiresValidation: true
  },
  { 
    value: 'paypal', 
    label: 'PayPal', 
    available: true,
    icon: '💰',
    description: 'Verificación manual en 2-4 horas',
    requiresValidation: true
  }
];

// Instrucciones de pago REALES
export const PAYMENT_INSTRUCTIONS = {
  transferencia: {
    title: 'Transferencia Bancaria Nacional',
    icon: '🏦',
    data: [
      { label: 'Banco', value: 'Banco Plaza', copyable: false },
      { label: 'Cuenta Corriente', value: '0138-0123-4567-8901', copyable: true },
      { label: 'RIF', value: 'J-12345678-9', copyable: true },
      { label: 'Beneficiario', value: 'Eventos Premium C.A.', copyable: false }
    ],
    notes: '⚠️ IMPORTANTE: Use su CÉDULA como referencia. El pago será verificado en 2-4 horas hábiles.'
  },
  zelle: {
    title: 'Zelle',
    icon: '💳',
    data: [
      { label: 'Email', value: 'pagos@eventospremium.com', copyable: true },
      { label: 'Nombre', value: 'Eventos Premium LLC', copyable: false },
      { label: 'Monto', value: 'USD (Dólares)', copyable: false }
    ],
    notes: '⚠️ IMPORTANTE: Incluya su CÉDULA en el memo/nota. Verificación en 2-4 horas hábiles.'
  },
  paypal: {
    title: 'PayPal',
    icon: '💰',
    data: [
      { label: 'Email', value: 'payments@eventospremium.com', copyable: true },
      { label: 'Tipo', value: 'Bienes y Servicios', copyable: false }
    ],
    notes: '⚠️ IMPORTANTE: Agregue su CÉDULA en la nota. Verificación en 2-4 horas hábiles.'
  },
  pago_movil: {
    title: 'Pago Móvil P2C',
    icon: '📱',
    data: [],
    notes: '✅ Confirmación instantánea mediante el sistema bancario'
  }
};

// URLs de API REALES - VERSIÓN FINAL CORREGIDA
export const API_ENDPOINTS = {
  // Endpoints de información
  tokenInfo: '/api/tickets/payment/pago-movil/public/token-info',
  validateToken: '/api/tickets/payment/pago-movil/validate-iframe-token',
  
  // Endpoints de inventario y disponibilidad
  inventory: '/api/tickets/inventory',
  boxesAvailability: '/api/boxes/availability',
  venueStats: '/api/tickets/stats',
  
  // Endpoints de datos auxiliares
  banks: '/api/payment-gateway/banks',
  exchangeRate: '/api/exchange-rates/current',
  paymentMethods: '/api/tickets/payment-methods',
  
  // Endpoints de pago móvil P2C (ya configurados correctamente)
  initiateP2C: '/api/tickets/payment/pago-movil/iframe/initiate',
  confirmP2C: '/api/tickets/payment/pago-movil/iframe/confirm',
  
  // 🎯 ENDPOINTS CORREGIDOS PARA COINCIDIR CON TU ARCHIVO manualPayment.js:
  manualPayment: '/api/tickets/manual/iframe-payment',     
  verifyManualPayment: '/api/tickets/manual/pending-validations',        
  uploadProof: '/api/tickets/manual/payment-proof',          
  cancelTransaction: '/api/tickets/manual/confirm-manual',   
  
  // Endpoints adicionales (ya configurados)
  reserveTickets: '/api/tickets/reserve',
  getZoneInfo: '/api/tickets/zones'
};

// Mensajes actualizados con el flujo de emails
export const MESSAGES = {
  errors: {
    tokenRequired: 'Este formulario requiere un token de acceso válido',
    tokenInvalid: 'Token inválido o expirado. Por favor, recargue la página.',
    tokenExpired: 'Su sesión ha expirado. Por favor, recargue la página.',
    connectionError: 'Error de conexión. Por favor, intente nuevamente.',
    maxTicketsReached: `Máximo ${PURCHASE_LIMITS.maxGeneralTickets} entradas por compra`,
    maxBoxCapacity: 'El box seleccionado no tiene suficiente capacidad',
    processingError: 'Error al procesar su solicitud. Por favor, intente nuevamente.',
    validationError: 'Por favor complete todos los campos requeridos',
    inventoryError: 'No hay suficientes entradas disponibles',
    paymentRejected: 'El pago fue rechazado. Por favor, verifique los datos.',
    emailRequired: 'El email es requerido para enviar sus entradas'
  },
  success: {
    paymentInitiated: '✅ Proceso de pago iniciado. Complete la transferencia.',
    paymentConfirmed: '🎉 ¡Pago confirmado! Sus entradas han sido enviadas por email.',
    ticketsCopied: '📋 Copiado al portapapeles',
    reservationComplete: '🎫 Reserva completada. Proceda con el pago.',
    emailSent: '📧 Email de confirmación enviado exitosamente',
    verificationPending: '⏳ Su pago está siendo verificado. Recibirá un email en 2-4 horas.'
  },
  info: {
    lastTickets: '🔥 ¡Últimas entradas disponibles!',
    loadingPayment: 'Procesando su pago...',
    confirmingPayment: 'Confirmando con el banco...',
    sendingEmail: 'Enviando entradas por email...',
    lowInventory: '⚠️ Quedan pocas entradas',
    verificationEmail: 'ℹ️ Recibirá un email cuando su pago sea verificado',
    instantConfirmation: '⚡ Este método tiene confirmación instantánea',
    manualVerification: '⏰ Este método requiere verificación manual (2-4 horas)'
  },
  email: {
    confirmationSubject: '🎉 ¡Sus Entradas para el Concierto están Confirmadas!',
    pendingSubject: '⏳ Verificación de Pago en Proceso',
    rejectionSubject: 'Actualización sobre su Compra de Entradas',
    confirmationSent: '✅ Email de confirmación enviado',
    pendingSent: '📧 Email de verificación pendiente enviado',
    rejectionSent: '❌ Email de notificación enviado'
  }
};

// Validaciones actualizadas
export const VALIDATION_RULES = {
  buyer_name: {
    minLength: 3,
    maxLength: 100,
    pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
    message: 'Nombre completo válido (solo letras, mínimo 3 caracteres)'
  },
  buyer_identification: {
    minLength: 6,
    maxLength: 20,
    pattern: /^[VEJ]-?\d{6,15}$/i,
    message: 'Cédula con formato: V-12345678 o E-12345678'
  },
  buyer_email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Email válido es requerido para enviar sus entradas'
  },
  buyer_phone: {
    minLength: 11,
    maxLength: 11,
    pattern: /^(0412|0414|0416|0424|0426)\d{7}$/,
    message: 'Teléfono móvil venezolano (ej: 04141234567)'
  },
  client_phone: {
    pattern: /^(0412|0414|0416|0424|0426)\d{7}$/,
    message: 'Teléfono del pagador móvil (ej: 04141234567)'
  },
  payment_reference: {
    minLength: 4,
    maxLength: 20,
    pattern: /^[0-9A-Z]+$/i,
    message: 'Referencia de pago (solo números y letras)'
  }
};

// Configuración de animaciones mejorada
export const ANIMATION_CONFIG = {
  fadeInDuration: '0.5s',
  shakeDuration: '0.3s',
  pulseDuration: '2s',
  floatDuration: '10s',
  particleCount: 20,
  confettiDuration: '3s',
  successAnimationDuration: '1s'
};

// Colores del tema
export const THEME_COLORS = {
  primary: '#FD8D6A',
  primaryDark: '#ff6b4a',
  primaryLight: '#ff7b5a',
  secondary: '#ff5b3a',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  gray: {
    900: '#111827',
    800: '#1f2937',
    700: '#374151',
    600: '#4b5563',
    500: '#6b7280',
    400: '#9ca3af',
    300: '#d1d5db'
  },
  gradient: {
    purple: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    sunset: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    ocean: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    fire: 'linear-gradient(135deg, #ff6b6b 0%, #ffd93d 100%)'
  }
};

// Estados del formulario
export const FORM_STEPS = {
  PERSONAL_DATA: 1,
  ZONE_SELECTION: 2,
  PAYMENT: 3,
  CONFIRMATION: 4
};

// Configuración de captcha
export const CAPTCHA_CONFIG = {
  scriptUrl: 'https://js.hcaptcha.com/1/api.js',
  theme: 'dark',
  size: 'normal'
};

// Configuración de notificaciones
export const NOTIFICATION_CONFIG = {
  position: 'top-right',
  duration: 5000,
  successIcon: '✅',
  errorIcon: '❌',
  warningIcon: '⚠️',
  infoIcon: 'ℹ️'
};

// Configuración de emails
export const EMAIL_CONFIG = {
  sendConfirmation: true,
  sendPendingVerification: true,
  sendRejection: true,
  includeQR: true,
  includeBarcode: true,
  includeVoucher: true
};