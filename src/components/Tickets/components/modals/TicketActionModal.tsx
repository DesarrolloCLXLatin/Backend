// src/components/tickets/ConcertTicketManagement/modals/TicketActionsModal.tsx

import React, { useState } from 'react';
import { 
  X, 
  Eye, 
  CheckCircle, 
  DollarSign, 
  FileText,
  Ticket,
  AlertCircle
} from 'lucide-react';
import { ConcertTicket } from '../../../../types';
import toast from 'react-hot-toast';

interface TicketActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: ConcertTicket;
  userRole?: string;
  onConfirmPayment: (ticketId: string, reference: string, notes: string) => void;
  onRedeemTicket: (ticketId: string) => void;
  onViewDetails: (ticket: ConcertTicket) => void;
}

const TicketActionsModal: React.FC<TicketActionsModalProps> = ({
  isOpen,
  onClose,
  ticket,
  userRole,
  onConfirmPayment,
  onRedeemTicket,
  onViewDetails
}) => {
  const [paymentReference, setPaymentReference] = useState('');
  const [confirmNotes, setConfirmNotes] = useState('');
  const [showConfirmForm, setShowConfirmForm] = useState(false);

  if (!isOpen) return null;

  const handleConfirmPayment = () => {
    if (!paymentReference && ticket.payment_method !== 'tienda') {
      toast.error('La referencia de pago es requerida');
      return;
    }
    onConfirmPayment(ticket.id, paymentReference, confirmNotes);
    setPaymentReference('');
    setConfirmNotes('');
    setShowConfirmForm(false);
    onClose();
  };

  const handleViewDetails = () => {
    onViewDetails(ticket);
    onClose();
  };

  const handleRedeemTicket = () => {
    if (confirm('¿Está seguro de canjear esta entrada? Esta acción no se puede deshacer.')) {
      onRedeemTicket(ticket.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Acciones del Ticket</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Información del ticket */}
        <div className="space-y-3 mb-6">
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600">Ticket</p>
            <p className="font-medium">{ticket.ticket_number}</p>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600">Comprador</p>
            <p className="font-medium">{ticket.buyer_name}</p>
            <p className="text-sm text-gray-500">{ticket.buyer_email}</p>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600">Estado del Pago</p>
            <p className="font-medium capitalize">
              {ticket.payment_status === 'confirmado' && (
                <span className="flex items-center text-green-600">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Confirmado
                </span>
              )}
              {ticket.payment_status === 'pendiente' && (
                <span className="flex items-center text-yellow-600">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Pendiente
                </span>
              )}
              {ticket.payment_status === 'rechazado' && (
                <span className="flex items-center text-red-600">
                  <X className="w-4 h-4 mr-1" />
                  Rechazado
                </span>
              )}
            </p>
          </div>

          {ticket.ticket_status && (
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-600">Estado del Ticket</p>
              <p className="font-medium capitalize">
                {ticket.ticket_status === 'canjeado' ? (
                  <span className="text-orange-600">Canjeado</span>
                ) : (
                  <span className="text-gray-900">{ticket.ticket_status}</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Formulario de confirmación de pago (solo si está pendiente) */}
        {ticket.payment_status === 'pendiente' && userRole === 'admin' && showConfirmForm && (
          <div className="space-y-4 mb-6 border-t pt-4">
            <h4 className="font-medium text-gray-900">Confirmar Pago</h4>
            
            {ticket.payment_method !== 'tienda' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Referencia de Pago *
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Número de referencia bancaria"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  autoFocus
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FileText className="w-4 h-4 inline mr-1" />
                Notas (opcional)
              </label>
              <textarea
                value={confirmNotes}
                onChange={(e) => setConfirmNotes(e.target.value)}
                placeholder="Notas adicionales..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                rows={2}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                📧 Se enviará automáticamente un email de confirmación al comprador
              </p>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="space-y-2">
          {/* Botón Ver Detalles - Siempre visible */}
          <button
            onClick={handleViewDetails}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <Eye className="w-4 h-4 mr-2" />
            Ver Detalles Completos
          </button>
          
          {/* Botón Confirmar Pago - Solo si está pendiente y es admin */}
          {ticket.payment_status === 'pendiente' && userRole === 'admin' && (
            <>
              {!showConfirmForm ? (
                <button
                  onClick={() => setShowConfirmForm(true)}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirmar Pago
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={handleConfirmPayment}
                    disabled={!paymentReference && ticket.payment_method !== 'tienda'}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => {
                      setShowConfirmForm(false);
                      setPaymentReference('');
                      setConfirmNotes('');
                    }}
                    className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </>
          )}

          {/* Botón Canjear Entrada - Solo si está confirmado y no canjeado */}
          {ticket.payment_status === 'confirmado' && 
            ticket.ticket_status === 'vendido' && 
            ['admin', 'tienda'].includes(userRole || '') && (
            <button
              onClick={handleRedeemTicket}
              className="w-full bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition-colors flex items-center justify-center"
            >
              <Ticket className="w-4 h-4 mr-2" />
              Canjear Entrada
            </button>
          )}

          {/* Información adicional según el estado */}
          {ticket.ticket_status === 'canjeado' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Esta entrada ya fue canjeada
                {ticket.redeemed_at && (
                  <span className="block text-xs mt-1">
                    el {new Date(ticket.redeemed_at).toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>
          )}

          {ticket.payment_status === 'rechazado' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">
                <X className="w-4 h-4 inline mr-1" />
                El pago de este ticket fue rechazado
              </p>
            </div>
          )}
        </div>
        
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          className="w-full mt-4 text-gray-600 hover:text-gray-800 py-2 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default TicketActionsModal;