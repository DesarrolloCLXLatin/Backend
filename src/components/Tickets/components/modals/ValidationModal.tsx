import React, { useState } from 'react';
import { 
  AlertCircle, 
  XCircle, 
  CheckCircle, 
  Mail, 
  AlertTriangle, 
  RefreshCw 
} from 'lucide-react';
import { PaymentTransaction } from '../../../../types';
import { getPaymentMethodLabel } from '../../utils/ticketHelpers';
import PaymentMethodBadge from '../PaymentMethodBadge';

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  validation: PaymentTransaction | null;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  loading: boolean;
}

const ValidationModal: React.FC<ValidationModalProps> = ({
  isOpen,
  onClose,
  validation,
  onApprove,
  onReject,
  loading
}) => {
  const [rejectionReason, setRejectionReason] = useState('');

  if (!isOpen || !validation) return null;

  const handleApprove = async () => {
    await onApprove(validation.id);
    onClose();
  };

  const handleReject = async () => {
    await onReject(validation.id, rejectionReason);
    setRejectionReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">
              Validar Pago Manual
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Información del pago */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 mb-3">📋 Información del Pago</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Usuario:</span>
              <p className="font-medium">{validation.user_name}</p>
              <p className="text-gray-500 text-xs">{validation.user_email}</p>
            </div>
            <div>
              <span className="text-gray-600">Método:</span>
              <div className="mt-1">
                <PaymentMethodBadge method={validation.payment_method || 'transferencia'} />
              </div>
            </div>
            <div>
              <span className="text-gray-600">Referencia:</span>
              <code className="block bg-gray-100 px-2 py-1 rounded font-mono text-xs mt-1">
                {validation.reference_number}
              </code>
            </div>
            <div>
              <span className="text-gray-600">Monto:</span>
              <p className="font-medium text-green-600">
                ${validation.amount_usd || '35.00'} USD
              </p>
              {validation.amount && (
                <p className="text-xs text-gray-500">
                  Bs. {parseFloat(validation.amount).toLocaleString('es-VE')}
                </p>
              )}
            </div>
            <div>
              <span className="text-gray-600">Entradas:</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {validation.ticket_count} entrada(s)
              </span>
            </div>
            <div>
              <span className="text-gray-600">Fecha:</span>
              <p className="text-sm">{new Date(validation.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Campo de motivo de rechazo */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Motivo de rechazo (opcional)
          </label>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Ej: No se pudo verificar la referencia bancaria, monto incorrecto, etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            rows={3}
          />
          <p className="text-xs text-gray-500 mt-1">
            Este motivo se incluirá en el email de notificación al comprador
          </p>
        </div>

        {/* Información del email */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Mail className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-800">Notificación Automática</h4>
              <p className="text-sm text-blue-700 mt-1">
                Se enviará automáticamente un email al comprador informando sobre la decisión del pago.
              </p>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Aprobando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                ✅ Aprobar Pago
              </>
            )}
          </button>
          
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Rechazando...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                ❌ Rechazar Pago
              </>
            )}
          </button>
          
          <button
            onClick={onClose}
            disabled={loading}
            className="sm:w-auto px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>

        {/* Advertencia */}
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2 mt-0.5" />
            <p className="text-xs text-yellow-800">
              <strong>Importante:</strong> Esta acción no se puede deshacer. 
              Al aprobar, las entradas serán enviadas por email. 
              Al rechazar, se liberará el inventario y se notificará al comprador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ValidationModal;