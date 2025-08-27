import React, { useState } from 'react';
import { Eye, Send, CheckCircle, Ticket as TicketIcon, RefreshCw } from 'lucide-react';
import { ConcertTicket } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import EmailStatus from './EmailStatus';
import PaymentMethodBadge from './PaymentMethodBadge';
import StatusBadge from './StatusBadge';
import TicketDetailsModal from './modals/TicketDetailsModal';
import TicketActionsModal from './modals/TicketActionModal';
import { useEmailOperations } from '../hooks/useEmailOperations';
import { useTicketOperations } from '../hooks/useTicketOperations';

interface TicketTableProps {
  tickets: ConcertTicket[];
  loading: boolean;
  onRefresh: () => void;
}

const TicketTable: React.FC<TicketTableProps> = ({ tickets, loading, onRefresh }) => {
  const { user } = useAuth();
  const [selectedTicket, setSelectedTicket] = useState<ConcertTicket | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  
  const { resendEmail, sending } = useEmailOperations(onRefresh);
  const { confirmPayment, redeemTicket } = useTicketOperations(onRefresh);

  const handleViewDetails = (ticket: ConcertTicket) => {
    setSelectedTicket(ticket);
    setShowDetailsModal(true);
  };

  const handleOpenActions = (ticket: ConcertTicket) => {
    setSelectedTicket(ticket);
    setShowActionsModal(true);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entrada
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Comprador
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Método
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado Pago
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tickets.map((ticket) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  userRole={user?.role}
                  onViewDetails={handleViewDetails}
                  onOpenActions={handleOpenActions}
                  onResendEmail={() => resendEmail(ticket.id)}
                  onConfirmPayment={() => confirmPayment(ticket)}
                  onRedeemTicket={() => redeemTicket(ticket.id)}
                  isSending={sending}
                />
              ))}
            </tbody>
          </table>
        </div>

        {tickets.length === 0 && (
          <EmptyState />
        )}
      </div>

      {selectedTicket && (
        <>
          <TicketDetailsModal
            ticket={selectedTicket}
            isOpen={showDetailsModal}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedTicket(null);
            }}
            userRole={user?.role}
          />
          
          <TicketActionsModal
            ticket={selectedTicket}
            isOpen={showActionsModal}
            onClose={() => {
              setShowActionsModal(false);
              setSelectedTicket(null);
            }}
            onConfirm={() => confirmPayment(selectedTicket)}
            onRedeem={() => redeemTicket(selectedTicket.id)}
            userRole={user?.role}
          />
        </>
      )}
    </>
  );
};

// Componente de fila de ticket
const TicketRow: React.FC<{
  ticket: ConcertTicket;
  userRole?: string;
  onViewDetails: (ticket: ConcertTicket) => void;
  onOpenActions: (ticket: ConcertTicket) => void;
  onResendEmail: () => void;
  onConfirmPayment: () => void;
  onRedeemTicket: () => void;
  isSending: boolean;
}> = ({ 
  ticket, 
  userRole, 
  onViewDetails, 
  onOpenActions,
  onResendEmail, 
  onConfirmPayment, 
  onRedeemTicket,
  isSending 
}) => {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <div className="text-sm font-medium text-gray-900">
            {ticket.ticket_number}
          </div>
          <div className="text-sm text-gray-500">
            ${ticket.ticket_price || ticket.price || '35.00'}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <div className="text-sm font-medium text-gray-900">
            {ticket.buyer_name}
          </div>
          <div className="text-sm text-gray-500">
            {ticket.buyer_email}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <PaymentMethodBadge method={ticket.payment_method} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <StatusBadge status={ticket.payment_status} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <EmailStatus ticket={ticket} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(ticket.created_at).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onViewDetails(ticket)}
            className="text-orange-600 hover:text-orange-900 transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>
          
          {!ticket.receipt_sent && ticket.payment_status === 'confirmado' && (
            <button
              onClick={onResendEmail}
              disabled={isSending}
              className="text-blue-600 hover:text-blue-900 transition-colors disabled:opacity-50"
              title="Enviar email"
            >
              {isSending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          )}
          
          {ticket.payment_status === 'pendiente' && userRole === 'admin' && (
            <button
              onClick={onOpenActions}
              className="text-green-600 hover:text-green-900 transition-colors"
              title="Confirmar pago"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          
          {ticket.payment_status === 'confirmado' && 
           ticket.ticket_status === 'vendido' && 
           ['admin', 'tienda'].includes(userRole || '') && (
            <button
              onClick={onRedeemTicket}
              className="text-orange-600 hover:text-orange-900 transition-colors"
              title="Canjear entrada"
            >
              <TicketIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// Componente de estado vacío
const EmptyState: React.FC = () => (
  <div className="text-center py-12">
    <TicketIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
    <h3 className="text-lg font-medium text-gray-900 mb-2">No hay entradas</h3>
    <p className="text-gray-500">
      No se encontraron entradas con los filtros aplicados.
    </p>
  </div>
);

export default TicketTable;
