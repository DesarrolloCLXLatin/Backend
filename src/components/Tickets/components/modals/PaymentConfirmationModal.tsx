import React, { useState } from 'react';
import { X, CheckCircle, DollarSign, FileText } from 'lucide-react';
import { ConcertTicket } from '../../../../types';
import toast from 'react-hot-toast';

interface PaymentConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: ConcertTicket;
  onConfirm: (ticketId: string, reference: string, notes: string) => Promise<void>;
}

const PaymentConfirmationModal: React.FC<PaymentConfirmationModalProps> = ({
  isOpen,
  onClose,
  ticket,
  onConfirm
}) => {
  const [paymentReference, setPaymentReference] = useState('');
  const [confirmNotes, setConfirmNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!paymentReference && ticket.payment_method !== 'tienda') {
      toast.error('La referencia de pago es requerida');
      return;
    }

    setLoading(true);
    try {
      await onConfirm(ticket.id, paymentReference, confirmNotes);
      setPaymentReference('');
      setConfirmNotes('');
      onClose();
    } catch (error) {
      console.error('Error confirming payment:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            Confirmar Pago
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Información del ticket */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Ticket:</span>
            <span className="text-sm font-medium">{ticket.ticket_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Comprador:</span>
            <span className="text-sm font-medium">{ticket.buyer_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Email:</span>
            <span className="text-sm font-medium">{ticket.buyer_email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Método:</span>
            <span className="text-sm font-medium capitalize">
              {ticket.payment_method.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Monto:</span>
            <span className="text-sm font-medium text-green-600">
              ${ticket.ticket_price || ticket.price || '35.00'} USD
            </span>
          </div>
        </div>

        {/* Campos del formulario */}
        <div className="space-y-4">
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
              placeholder="Notas adicionales sobre el pago..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* Información sobre el email */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            📧 Se enviará automáticamente un email de confirmación al comprador
          </p>
        </div>

        {/* Botones de acción */}
        <div className="mt-6 flex space-x-3">
          <button
            onClick={handleConfirm}
            disabled={loading || (!paymentReference && ticket.payment_method !== 'tienda')}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Confirmando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar Pago
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentConfirmationModal;
