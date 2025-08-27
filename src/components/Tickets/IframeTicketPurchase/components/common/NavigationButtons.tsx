// src/components/tickets/IframeTicketPurchase/components/common/NavigationButtons.tsx

import React from 'react';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { NavigationButtonsProps } from '../../types';

const NavigationButtons: React.FC<NavigationButtonsProps> = ({
  currentStep,
  totalSteps,
  isSubmitting,
  canProceed,
  paymentMethod,
  onNext,
  onPrev,
  onSubmit
}) => {
  const isLastStep = currentStep === totalSteps;
  const isFirstStep = currentStep === 1;

  const getSubmitButtonText = () => {
    if (isSubmitting) {
      return (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
          Procesando...
        </>
      );
    }

    if (!isLastStep) {
      return (
        <>
          Siguiente
          <ChevronRight className="w-5 h-5" />
        </>
      );
    }

    switch (paymentMethod) {
      case 'pago_movil':
        return (
          <>
            <CheckCircle className="w-5 h-5" />
            Iniciar Pago
          </>
        );
      case 'paypal':
        return (
          <>
            <CheckCircle className="w-5 h-5" />
            Pagar con PayPal
          </>
        );
      default:
        return (
          <>
            <CheckCircle className="w-5 h-5" />
            Completar Registro
          </>
        );
    }
  };

  return (
    <div className="flex justify-between mt-8">
      {!isFirstStep && (
        <button
          type="button"
          onClick={onPrev}
          className="px-6 py-3 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-700 transition-all duration-300 flex items-center gap-2"
          disabled={isSubmitting}
        >
          <ChevronLeft className="w-5 h-5" />
          Anterior
        </button>
      )}
      
      <div className="ml-auto">
        <button
          type="button"
          onClick={isLastStep ? onSubmit : onNext}
          disabled={isSubmitting || !canProceed}
          className="px-8 py-3 bg-gradient-to-r from-[#FD8D6A] to-[#ff6b4a] text-white rounded-xl font-medium hover:shadow-lg hover:shadow-[#FD8D6A]/30 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {getSubmitButtonText()}
        </button>
      </div>
    </div>
  );
};

export default NavigationButtons;