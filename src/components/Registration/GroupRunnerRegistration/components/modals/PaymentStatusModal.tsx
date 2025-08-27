// modals/PaymentStatusModal.tsx
import React from 'react';
import { Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { PAYMENT_STATUS, MESSAGES, RESERVATION_HOURS, getRunnerText } from '../../constants';

interface PaymentStatusModalProps {
  isOpen: boolean;
  status: string;
  onClose: () => void;
  paymentData: any;
}

interface StatusConfig {
  icon: React.ReactNode;
  title: string;
  message: string;
  bgColor: string;
  borderColor: string;
}

export const PaymentStatusModal: React.FC<PaymentStatusModalProps> = ({
  isOpen,
  status,
  onClose,
  paymentData
}) => {
  if (!isOpen) return null;

  // Obtener la cantidad de corredores
  const runnerCount = paymentData?.group?.total_runners || 1;

  const statusConfig: Record<string, StatusConfig> = {
    [PAYMENT_STATUS.PROCESSING]: {
      icon: <Loader className="w-12 h-12 text-blue-600 animate-spin" />,
      title: 'Procesando Registro',
      message: MESSAGES.info.processingPayment,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    [PAYMENT_STATUS.SUCCESS]: {
      icon: <CheckCircle className="w-12 h-12 text-green-600" />,
      title: 'Registro Exitoso',
      message: MESSAGES.success.getRegistrationMessage(runnerCount),
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    [PAYMENT_STATUS.ERROR]: {
      icon: <AlertCircle className="w-12 h-12 text-red-600" />,
      title: 'Error en el Registro',
      message: paymentData?.error || MESSAGES.errors.genericError,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    }
  };

  const config = statusConfig[status] || statusConfig[PAYMENT_STATUS.PROCESSING];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={status !== PAYMENT_STATUS.PROCESSING ? onClose : undefined}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-6 border-b ${config.borderColor} ${config.bgColor}`}>
          <div className="flex flex-col items-center">
            {config.icon}
            <h3 className="text-xl font-bold text-gray-800 mt-4">{config.title}</h3>
            <p className="text-gray-600 text-center mt-2">{config.message}</p>
          </div>
        </div>

        {status === PAYMENT_STATUS.SUCCESS && paymentData && (
          <SuccessDetails paymentData={paymentData} />
        )}

        {status !== PAYMENT_STATUS.PROCESSING && (
          <div className="p-6 border-t">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              {status === PAYMENT_STATUS.SUCCESS ? 'Finalizar' : 'Cerrar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface SuccessDetailsProps {
  paymentData: any;
}

const SuccessDetails: React.FC<SuccessDetailsProps> = ({ paymentData }) => {
  const showPaymentWarning = 
    paymentData.payment_method !== 'pago_movil_p2c' && 
    paymentData.payment_method !== 'tienda' &&
    !paymentData.paymentCompleted;

  // Obtener la cantidad de corredores y los textos apropiados
  const runnerCount = paymentData.group?.total_runners || 1;
  const runnerText = getRunnerText(runnerCount);

  return (
    <div className="p-6 space-y-4">
      <div className="bg-gray-50 p-4 rounded-md">
        <h4 className="font-semibold text-gray-800 mb-2">Detalles del Registro</h4>
        <div className="space-y-2 text-sm">
          <DetailRow 
            label={runnerText.groupCode}
            value={paymentData.group?.group_code} 
          />
          <DetailRow 
            label={runnerText.totalRunners}
            value={paymentData.group?.total_runners} 
          />
          {paymentData.group?.reserved_until && (
            <DetailRow 
              label="Reserva válida hasta" 
              value={new Date(paymentData.group.reserved_until).toLocaleString()} 
            />
          )}
        </div>
      </div>

      {showPaymentWarning && (
        <div className="bg-yellow-50 p-4 rounded-md">
          <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Pago Pendiente</h4>
          <p className="text-sm text-yellow-700">
            {MESSAGES.info.getReservationMessage(runnerCount)}
          </p>
        </div>
      )}

      {paymentData.paymentCompleted && (
        <div className="bg-green-50 p-4 rounded-md">
          <h4 className="font-semibold text-green-800 mb-2">✅ Pago Confirmado</h4>
          <p className="text-sm text-green-700">
            Su pago ha sido procesado exitosamente y su inscripción está confirmada.
          </p>
        </div>
      )}
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: any }> = ({ label, value }) => {
  if (!value) return null;
  
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
};