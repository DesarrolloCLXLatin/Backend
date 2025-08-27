import React, { useState } from 'react';
import { 
  Eye, 
  Send, 
  CheckCircle, 
  XCircle,
  Ticket, 
  RefreshCw, 
  Download,
  Mail,
  Edit,
  Trash2,
  MoreVertical,
  QrCode,
  DollarSign,
  Clock,
  AlertCircle
} from 'lucide-react';
import { ConcertTicket } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface TicketActionsProps {
  ticket: ConcertTicket;
  onView: (ticket: ConcertTicket) => void;
  onEdit?: (ticket: ConcertTicket) => void;
  onDelete?: (ticketId: string) => void;
  onConfirmPayment?: (ticketId: string) => void;
  onRejectPayment?: (ticketId: string) => void;
  onRedeem?: (ticketId: string) => void;
  onResendEmail?: (ticketId: string) => void;
  onDownload?: (ticket: ConcertTicket) => void;
  onVerify?: (ticket: ConcertTicket) => void;
  variant?: 'inline' | 'dropdown' | 'expanded';
  disabled?: boolean;
}

const TicketActions: React.FC<TicketActionsProps> = ({
  ticket,
  onView,
  onEdit,
  onDelete,
  onConfirmPayment,
  onRejectPayment,
  onRedeem,
  onResendEmail,
  onDownload,
  onVerify,
  variant = 'inline',
  disabled = false
}) => {
  const { user } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  // Determinar qué acciones están disponibles según el estado y rol
  const getAvailableActions = () => {
    const actions = [];
    
    // Ver siempre está disponible
    actions.push({
      id: 'view',
      label: 'Ver detalles',
      icon: Eye,
      color: 'text-blue-600',
      action: () => onView(ticket)
    });

    // Acciones según el estado del pago
    if (ticket.payment_status === 'pendiente' && user?.role === 'admin') {
      if (onConfirmPayment) {
        actions.push({
          id: 'confirm',
          label: 'Confirmar pago',
          icon: CheckCircle,
          color: 'text-green-600',
          action: () => handleAction('confirm', () => onConfirmPayment(ticket.id))
        });
      }
      
      if (onRejectPayment) {
        actions.push({
          id: 'reject',
          label: 'Rechazar pago',
          icon: XCircle,
          color: 'text-red-600',
          action: () => handleAction('reject', () => onRejectPayment(ticket.id))
        });
      }
    }

    // Reenviar email
    if (ticket.payment_status === 'confirmado' && !ticket.receipt_sent && onResendEmail) {
      actions.push({
        id: 'resend',
        label: 'Enviar email',
        icon: Send,
        color: 'text-blue-600',
        action: () => handleAction('resend', () => onResendEmail(ticket.id))
      });
    }

    // Canjear ticket
    if (
      ticket.payment_status === 'confirmado' && 
      ticket.ticket_status === 'vendido' && 
      ['admin', 'tienda'].includes(user?.role || '') &&
      onRedeem
    ) {
      actions.push({
        id: 'redeem',
        label: 'Canjear entrada',
        icon: Ticket,
        color: 'text-orange-600',
        action: () => handleAction('redeem', () => onRedeem(ticket.id))
      });
    }

    // Descargar
    if (ticket.payment_status === 'confirmado' && onDownload) {
      actions.push({
        id: 'download',
        label: 'Descargar',
        icon: Download,
        color: 'text-gray-600',
        action: () => onDownload(ticket)
      });
    }

    // Verificar
    if (onVerify && ['admin', 'tienda'].includes(user?.role || '')) {
      actions.push({
        id: 'verify',
        label: 'Verificar QR',
        icon: QrCode,
        color: 'text-purple-600',
        action: () => onVerify(ticket)
      });
    }

    // Editar (solo admin)
    if (user?.role === 'admin' && onEdit) {
      actions.push({
        id: 'edit',
        label: 'Editar',
        icon: Edit,
        color: 'text-gray-600',
        action: () => onEdit(ticket)
      });
    }

    // Eliminar (solo admin y ciertos estados)
    if (
      user?.role === 'admin' && 
      ticket.payment_status !== 'confirmado' && 
      onDelete
    ) {
      actions.push({
        id: 'delete',
        label: 'Eliminar',
        icon: Trash2,
        color: 'text-red-600',
        action: () => handleAction('delete', () => onDelete(ticket.id))
      });
    }

    return actions;
  };

  const handleAction = async (actionId: string, callback: () => void | Promise<void>) => {
    setLoading(actionId);
    try {
      await callback();
    } finally {
      setLoading(null);
      setShowDropdown(false);
    }
  };

  const actions = getAvailableActions();

  // Renderizado según variante
  if (variant === 'inline') {
    return (
      <div className="flex items-center space-x-2">
        {actions.slice(0, 3).map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={action.action}
              disabled={disabled || loading === action.id}
              className={`${action.color} hover:opacity-80 transition-colors disabled:opacity-50`}
              title={action.label}
            >
              {loading === action.id ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
            </button>
          );
        })}
        
        {actions.length > 3 && (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {showDropdown && (
              <DropdownMenu 
                actions={actions.slice(3)} 
                onClose={() => setShowDropdown(false)}
                loading={loading}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'dropdown') {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={disabled}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center"
        >
          Acciones
          <MoreVertical className="w-4 h-4 ml-1" />
        </button>
        
        {showDropdown && (
          <DropdownMenu 
            actions={actions} 
            onClose={() => setShowDropdown(false)}
            loading={loading}
          />
        )}
      </div>
    );
  }

  if (variant === 'expanded') {
    return (
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={action.action}
              disabled={disabled || loading === action.id}
              className={`flex items-center px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 transition-all disabled:opacity-50 ${
                loading === action.id ? 'bg-gray-100' : ''
              }`}
            >
              {loading === action.id ? (
                <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Icon className={`w-4 h-4 mr-1.5 ${action.color}`} />
              )}
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return null;
};

// Componente de menú desplegable
const DropdownMenu: React.FC<{
  actions: any[];
  onClose: () => void;
  loading: string | null;
}> = ({ actions, onClose, loading }) => {
  return (
    <>
      <div 
        className="fixed inset-0 z-10" 
        onClick={onClose}
      />
      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border z-20">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={action.action}
              disabled={loading === action.id}
              className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center transition-colors disabled:opacity-50 ${
                index > 0 ? 'border-t' : ''
              }`}
            >
              {loading === action.id ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Icon className={`w-4 h-4 mr-2 ${action.color}`} />
              )}
              <span className="text-sm">{action.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};

export de