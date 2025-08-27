// User types
export interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
  permissions?: Permission[];
}

export interface Module {
  id: string;
  key: string;
  name: string;
  description?: string;
  icon?: string;
  path?: string;
  order_index: number;
  is_active: boolean;
  parent_id?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'store' | 'user' | 'boss' | 'administracion'; // Mantener para compatibilidad
  roles: Role[]; // Nuevo: array de roles
  permissions: string[]; // Nuevo: array de permisos en formato "resource:action"
  modules: Module[]; // Nuevo: módulos accesibles
  store_name?: string;
  created_at: string;
  updated_at: string;
}

// Runner types
export interface Runner {
  id: string;
  user_id: string;
  registered_by?: string;
  runner_number?: number;
  full_name: string;
  identification: string;
  identification_type: 'V' | 'E' | 'J' | 'P';
  birth_date: string;
  age?: number;
  email: string;
  phone: string;
  shirt_size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
  gender: 'M' | 'F';
  payment_status: 'pendiente' | 'confirmado' | 'rechazado' | 'procesando';
  payment_method: 'tienda' | 'zelle' | 'transferencia_nacional' | 'transferencia_internacional' | 'paypal' | 'pago_movil_p2c';
  payment_reference?: string;
  payment_date?: string;
  profile_photo_url?: string;
  group_id: string;
  created_at: string;
  updated_at: string;
}

// Group types
export interface RegistrationGroup {
  id: string;
  group_code: string;
  registrant_email: string;
  registrant_phone: string;
  total_runners: number;
  payment_status: 'pendiente' | 'confirmado' | 'rechazado' | 'procesando';
  payment_method: string;
  payment_reference?: string;
  payment_proof_url?: string;
  payment_confirmed_at?: string;
  payment_confirmed_by?: string;
  reserved_until?: string;
  created_at: string;
  updated_at: string;
  runners?: Runner[];
}

// Inventory types
export interface Inventory {
  id: string;
  shirt_size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
  gender: 'M' | 'F';
  stock: number;
  reserved: number;
  available: number;
  status?: 'available' | 'low_stock' | 'out_of_stock';
  created_at: string;
  updated_at: string;
}

// Auth types
export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role: string, full_name?: string) => Promise<any>;
  logout: () => void;
  loading: boolean;
  hasPermission: (resource: string, action: string) => boolean;
  hasAnyPermission: (...permissions: Array<{resource: string, action: string}>) => boolean;
  hasAllPermissions: (...permissions: Array<{resource: string, action: string}>) => boolean;
  canAccessModule: (moduleKey: string) => boolean;
  getUserRoles: () => string[];
  getUserModules: () => string[]; // Nueva función
  refreshUserPermissions: () => Promise<void>;
}

// Dashboard stats types
export interface DashboardStats {
  totalRunners: number;
  confirmedPayments: number;
  pendingPayments: number;
  rejectedPayments: number;
  processingPayments?: number;
  totalRevenue: number;
  totalRevenueBs?: number;
  exchangeRate?: number;
  availableStock: number;
  totalStock?: number;
  totalReserved?: number;
  totalGroups?: number;
  availableRunnerNumbers?: number;
  stats?: {
    paymentStats?: Record<string, number>;
    paymentMethods?: Record<string, number>;
    genderDistribution?: Record<string, number>;
    groupStats?: {
      total: number;
      confirmed: number;
      pending: number;
      withReservation: number;
    };
    todayRegistrations?: number;
    todayConfirmed?: number;
    weeklyTrend?: Array<{
      date: string;
      total: number;
      confirmed: number;
      pending: number;
    }>;
  };
}

// Form types
export interface RunnerFormData {
  full_name: string;
  identification_type: 'V' | 'E' | 'J' | 'P';
  identification: string;
  birth_date: string;
  email: string;
  phone: string;
  shirt_size: string;
  gender: 'M' | 'F';
  payment_method?: string;
  payment_reference?: string;
}

export interface GroupFormData {
  registrant_email: string;
  registrant_phone: string;
  payment_method: string;
  payment_reference?: string;
  payment_proof_url?: string;
  runners: RunnerFormData[];
  bank_id?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Payment types
export interface Payment {
  id: string;
  runner_id: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'rejected';
  method: 'tienda' | 'zelle' | 'transferencia_nacional' | 'transferencia_internacional' | 'paypal' | 'pago_movil_p2c';
  reference?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  group_id?: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  amount_usd: string;
  amount_bs?: string;
  exchange_rate?: number;
  currency: string;
  payment_method: string;
  status: 'pending' | 'pending_validation' | 'completed' | 'rejected' | 'failed' | 'approved';
  reference?: string;
  reference_number?: string;
  gateway_response?: any;
  transaction_data?: {
    bankCode?: string;
    phone?: string;
    cedula?: string;
    paymentDate?: string;
    proofFile?: string;
    uploadedBy?: string;
    uploadedAt?: string;
  };
  ticket_count?: number;
  tickets?: Array<{
    id: string;
    ticket_number: string;
    activity_name?: string;
    activity_date?: string;
  }>;
  created_at: string;
  updated_at: string;
}

// Concert Ticket types
export interface ConcertTicket {
  id: string;
  ticket_number: string;
  qr_code: string;
  barcode: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_identification: string;
  ticket_price?: number;
  payment_status: 'pendiente' | 'confirmado' | 'rechazado';
  payment_method: 'tienda' | 'zelle' | 'transferencia' | 'tarjeta' | 'pago_movil';
  payment_reference?: string;
  ticket_status: 'vendido' | 'canjeado' | 'cancelado';
  sold_by?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  redeemed_at?: string;
  redeemed_by?: string;
  receipt_sent?: boolean;
  notes?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface TicketInventory {
  id: string;
  total_tickets: number;
  sold_tickets: number;
  reserved_tickets: number;
  available_tickets: number;
  created_at: string;
  updated_at: string;
}

export interface VerifyTicketResponse {
  valid: boolean;
  ticket?: {
    id: string;
    ticket_number: string;
    buyer_name: string;
    payment_status: string;
    ticket_status: string;
    redeemed_at?: string;
  };
  warning?: string;
  redeemed_at?: string;
}

// iFrame Token types
export interface IframeToken {
  id: string;
  token: string;
  user_id?: string;
  origin: string;
  allowed_domains: string[];
  expires_at: string;
  is_active: boolean;
  token_type: 'seller_token' | 'public_token';
  max_transactions?: number;
  transactions_count: number;
  metadata?: any;
  created_at: string;
  updated_at: string;
  stats?: {
    total_uses: number;
    transactions_remaining: number | 'unlimited';
    is_expired: boolean;
    days_until_expiry: number;
  };
}

// Exchange Rate types
export interface ExchangeRate {
  id: string;
  rate: number;
  date: string;
  source: string;
  created_at: string;
  updated_at: string;
}

// Bank types
export interface Bank {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// RBAC Management types
export interface RoleWithPermissions extends Role {
  role_permissions?: Array<{
    permission_id: string;
    permissions: Permission;
  }>;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_at: string;
  assigned_by?: string;
  roles?: Role;
}

// Store Dashboard types
export interface StoreStats {
  totalGroups: number;
  totalRunners: number;
  confirmedPayments: number;
  pendingPayments: number;
  rejectedPayments: number;
  processingPayments: number;
  storeRevenueUSD: number;
  pricePerRunner: number;
  todayRegistrations: number;
  weekRegistrations: number;
  inventory: Inventory[];
  recentGroups: Array<{
    group_id: string;
    group_code: string;
    total_runners: number;
    runner_names: string;
    payment_status: string;
    payment_method: string;
    created_at: string;
    reserved_until?: string;
  }>;
}

// User Dashboard types
export interface UserStats {
  groups: RegistrationGroup[];
  runners: Runner[];
  summary: {
    totalGroups: number;
    totalRunners: number;
    confirmed: number;
    pending: number;
    processing: number;
    withReservation: number;
  };
}

// Reports types
export interface ChartData {
  daily: Array<{
    date: string;
    registrations: number;
    confirmed: number;
    pending: number;
  }>;
}

export interface PaymentMethodStats {
  [key: string]: {
    groups: number;
    runners: number;
    percentage: string;
  };
}

// Activity Log types
export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}