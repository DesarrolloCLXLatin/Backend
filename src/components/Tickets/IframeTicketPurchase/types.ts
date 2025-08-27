// src/components/tickets/IframeTicketPurchase/types.ts

import { ReactNode } from 'react';

// Props principales
export interface IframeTicketPurchaseFormProps {
  isEmbedded?: boolean;
  onSuccess?: () => void;
  token?: string | null;
}

// Datos de pago
export interface PaymentData {
  bank_code?: string;
  reference?: string;
  email_from?: string;
  proof_file?: File | null;
  paypal_email?: string;
}

// Zona de tickets
export interface TicketZone {
  id: string;
  zone_code: string;
  zone_name: string;
  zone_type: 'general' | 'vip';
  price_usd: number;
  total_capacity: number;
  available: number;
  is_numbered: boolean;
  zone_color: string;
  description: string;
  icon?: ReactNode;
}

// Asiento
export interface Seat {
  id: string;
  seat_number: string;
  row: string;
  column: number;
  status: 'available' | 'sold' | 'reserved' | 'selected';
  seat_type: 'standard' | 'premium';
  price: number;
  zone_type: string;
}

// Datos del formulario principal
export interface FormData {
  buyer_name: string;
  buyer_identification: string;
  buyer_email: string;
  buyer_phone: string;
  payment_method: string;
  quantity: number;
  ticket_type: 'general' | 'vip';
  zone_id: string;
  seat_ids: string[];
}

// Datos de Pago Móvil P2C
export interface P2CData {
  client_phone: string;
  client_bank_code: string;
}

// Inventario
export interface Inventory {
  total_tickets: number;
  sold_tickets: number;
  reserved_tickets: number;
  available_tickets: number;
}

// Información del token
export interface TokenInfo {
  valid: boolean;
  requires_captcha: boolean;
  captcha_site_key?: string;
  [key: string]: any;
}

// Datos de transacción
export interface TransactionData {
  transactionId: string;
  status: string;
  amount: number;
  [key: string]: any;
}

// Banco
export interface Bank {
  code: string;
  name: string;
}

// Método de pago
export interface PaymentMethod {
  value: string;
  label: string;
  available: boolean;
  icon?: ReactNode;
}

// Estados de error
export interface FormErrors {
  [key: string]: string | null;
}

// Props de componentes internos
export interface StepProps {
  formData: FormData;
  errors: FormErrors;
  onInputChange: (field: string, value: any) => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export interface ZoneSelectionProps extends StepProps {
  zones: TicketZone[];
  selectedZone: TicketZone | null;
  selectedSeats: Seat[];
  generalQuantity: number;
  vipSeats: Seat[];
  onZoneSelect: (zone: TicketZone) => void;
  onSeatSelect: (seat: Seat) => void;
  onQuantityChange: (quantity: number) => void;
  exchangeRate: number | null;
}

export interface PaymentStepProps extends StepProps {
  paymentMethods: PaymentMethod[];
  banks: Bank[];
  exchangeRate: number | null;
  p2cData: P2CData;
  paymentData: PaymentData;
  tokenInfo: TokenInfo | null;
  captchaToken: string;
  totalPrice: number;
  selectedZone: TicketZone | null;
  selectedSeats: Seat[];
  generalQuantity: number;
  onP2CInputChange: (field: string, value: string) => void;
  onPaymentDataChange: (field: string, value: any) => void;
  onCaptchaVerify: (token: string) => void;
}

export interface SeatMapProps {
  seats: Seat[];
  selectedSeats: Seat[];
  onSelectSeat: (seat: Seat) => void;
}

export interface PaymentFormProps {
  data: any;
  onChange: (field: string, value: any) => void;
  errors: FormErrors;
  banks?: Bank[];
}

export interface NavigationButtonsProps {
  currentStep: number;
  totalSteps: number;
  isSubmitting: boolean;
  canProceed: boolean;
  paymentMethod?: string;
  onNext: () => void;
  onPrev: () => void;
  onSubmit: () => void;
}