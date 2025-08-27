// src/components/tickets/IframeTicketPurchase/components/Steps/StepIndicator.tsx

import React from 'react';
import { CheckCircle } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
  steps?: { number: number; label: string }[];
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ 
  currentStep, 
  totalSteps = 3,
  steps = [
    { number: 1, label: 'Datos Personales' },
    { number: 2, label: 'Tipo de Entrada' },
    { number: 3, label: 'Pago' }
  ]
}) => {
  return (
    <div className="px-8 py-6 bg-gray-800/50">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {steps.map((step) => (
          <div key={step.number} className="flex items-center">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg
              transition-all duration-300 transform
              ${currentStep >= step.number 
                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white scale-110 shadow-lg shadow-red-500/50' 
                : 'bg-gray-700 text-gray-400'
              }
            `}>
              {currentStep > step.number ? <CheckCircle className="w-6 h-6" /> : step.number}
            </div>
            {step.number < totalSteps && (
              <div className={`
                w-20 md:w-32 h-1 mx-2 transition-all duration-500
                ${currentStep > step.number ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gray-700'}
              `} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-sm text-gray-400 mt-3 max-w-2xl mx-auto">
        {steps.map((step) => (
          <span key={step.number}>{step.label}</span>
        ))}
      </div>
    </div>
  );
};

export default StepIndicator;