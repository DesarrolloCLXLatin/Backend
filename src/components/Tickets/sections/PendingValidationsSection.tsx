import React, { useState } from 'react';
import { RefreshCw, CheckCheck } from 'lucide-react';
import { PaymentTransaction } from '../../../types';
import PendingValidationsTable from '../components/PendingValidationsTable';
import ValidationModal from '../components/modals/ValidationModal';
import { usePaymentValidation } from '../hooks/usePaymentValidation';
import toast from 'react-hot-toast';

interface PendingValidationsSectionProps {
  pendingValidations: PaymentTransaction[];
  pendingCount: number;
  loading: boolean;
  onRefresh: () => void;
}

const PendingValidationsSection: React.FC<PendingValidationsSectionProps> = ({
  pendingValidations,
  pendingCount,
  loading,
  onRefresh
}) => {
  const [selectedValidation, setSelectedValidation] = useState<PaymentTransaction | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  
  const { validatePayment, isProcessing } = usePaymentValidation(onRefresh);

  const handleRefresh = () => {
    onRefresh();
    toast.success('📋 Lista actualizada');
  };

  const handleValidation = async (validation: PaymentTransaction, approved: boolean, reason?: string) => {
    const success = await validatePayment(validation, approved, reason);
    if (success) {
      setShowValidationModal(false);
      setSelectedValidation(null);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Pagos Manuales Pendientes de Validación
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Al validar, se enviará automáticamente un email de confirmación o rechazo al comprador
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefresh}
                className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border rounded-md hover:bg-gray-50 transition-all"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Actualizar
              </button>
              <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                {pendingCount} pendiente(s)
              </span>
            </div>
          </div>
        </div>

        <PendingValidationsTable 
          validations={pendingValidations}
          onSelectValidation={(validation) => {
            setSelectedValidation(validation);
            setShowValidationModal(true);
          }}
          onQuickApprove={(validation) => handleValidation(validation, true)}
          onQuickReject={(validation) => {
            setSelectedValidation(validation);
            setShowValidationModal(true);
          }}
          isProcessing={isProcessing}
        />

        {pendingValidations.length === 0 && (
          <div className="text-center py-12">
            <CheckCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay pagos pendientes
            </h3>
            <p className="text-gray-500">
              Todos los pagos han sido procesados y los emails enviados.
            </p>
          </div>
        )}
      </div>

      <ValidationModal 
        isOpen={showValidationModal}
        onClose={() => {
          setShowValidationModal(false);
          setSelectedValidation(null);
        }}
        validation={selectedValidation}
        onApprove={(id) => handleValidation(selectedValidation!, true)}
        onReject={(id, reason) => handleValidation(selectedValidation!, false, reason)}
        loading={isProcessing}
      />
    </>
  );
};

export default PendingValidationsSection;