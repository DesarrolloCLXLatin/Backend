// types.ts
export interface Runner {
  full_name: string;
  identification_type: string;
  identification: string;
  birth_date: string;
  gender: string;
  email: string;
  phone: string;
  shirt_size: string;
  profile_photo_url?: string;
}

export interface FormData {
  registrant_email: string;
  registrant_phone: string;
  registrant_identification_type: string;
  registrant_identification: string;
  payment_method: string;
  terminal_reference?: string;
  registrant_bank_code: string;
  payment_reference?: string;
  client_phone?: string;
  client_bank?: string;
  runners: Runner[];
  employee_id?: string;
  gift_reason?: string;
}

export interface Bank {
  code: string;
  name: string;
  short_name?: string;
}

export interface InventoryItem {
  shirt_size: string;
  gender: string;
  stock: number;
  reserved: number;
  available: number;
}

export interface VoucherLine {
  linea: string;
}

export interface PaymentDetails {
  type?: string;
  clientPhone?: string;
  clientBankCode?: string;
  clientBankName?: string;
  commercePhone?: string;
  commerceBankCode?: string;
  commerceBankName?: string;
}

export interface PaymentModalState {
  isOpen: boolean;
  status: 'processing' | 'success' | 'error';
  data: any;
}

export interface VoucherModalState {
  isOpen: boolean;
  voucher: any[];
  reference: string;
  control: string;
  amount: number;
  amountBs?: number;
  exchangeRate?: number;
  paymentStatus: string;
  paymentDetails: {
    type: string;
    clientPhone: string;
    clientBankCode: string;
    clientBankName: string;
    commercePhone: string;
    commerceBankCode: string;
    commerceBankName: string;
  } | null;
  // NUEVOS CAMPOS para manejar errores
  isError?: boolean;
  errorCode?: string;
  errorMessage?: string;
  paymentMethod?: string;
}

export interface ErrorWithVoucher {
  status: 'error';
  error: string;
  errorCode?: string;
  errorMessage?: string;
  voucher?: any;
  control?: string;
  reference?: string;
  amount?: number;
  payment_method?: string;
  paymentDetails?: {
    type: 'p2c';
    clientPhone: string;
    clientBankCode: string;
    clientBankName: string;
    commercePhone: string;
    commerceBankCode: string;
    commerceBankName: string;
  };
}

export interface GroupRegistrationResult {
  group: {
    group_code: string;
    total_runners: number;
    reserved_until?: string;
  };
  payment_method: string;
  paymentCompleted?: boolean;
}

export type PaymentMethod = 
  | 'pago_movil_p2c' 
  | 'zelle' 
  | 'transferencia_nacional' 
  | 'transferencia_internacional' 
  | 'paypal' 
  | 'tienda';

export type IdentificationType = 'V' | 'E' | 'J' | 'P';
export type Gender = 'M' | 'F';
export type ShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';