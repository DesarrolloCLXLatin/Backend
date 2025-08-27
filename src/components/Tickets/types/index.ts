export type TabType = 'sell' | 'tickets' | 'pending-validations' | 'stats';

export interface FilterState {
  status: string;
  search: string;
  page: number;
  limit: number;
}

export interface EmailStats {
  sent_today: number;
  pending_verification: number;
  confirmed: number;
  rejected: number;
  p2c_confirmed_today: number;
  manual_pending_today: number;
}

export interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  validation: PaymentTransaction | null;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  loading: boolean;
}