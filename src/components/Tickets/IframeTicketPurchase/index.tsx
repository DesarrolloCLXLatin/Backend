// src/components/tickets/IframeTicketPurchase/index.tsx

export { default as IframeTicketPurchaseForm } from './IframeTicketPurchaseForm';
export type { IframeTicketPurchaseFormProps } from './types';

// Exportar tipos adicionales si son necesarios en otros lugares
export type {
  FormData,
  TicketZone,
  Seat,
  PaymentData,
  P2CData,
  Inventory,
  TokenInfo,
  Bank,
  PaymentMethod
} from './types';

// Exportar constantes útiles
export { 
  EVENT_INFO,
  PAYMENT_METHODS,
  FORM_STEPS 
} from './constants';

// Exportar utilidades si son reutilizables
export {
  calculateTotalPrice,
  calculateBsAmount,
  calculateAvailablePercentage
} from './utils/calculations';

export {
  validateStep,
  validatePersonalData,
  validateZoneSelection,
  validatePaymentMethod
} from './utils/validators';