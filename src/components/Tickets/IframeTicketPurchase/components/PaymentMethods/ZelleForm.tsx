// src/components/tickets/IframeTicketPurchase/components/PaymentMethods/ZelleForm.tsx

import React from 'react';
import { PaymentFormProps } from '../../types';
import PaymentInstructions from './PaymentInstructions';
import FileUploadField from './FileUploadField';

const ZelleForm: React.FC<PaymentFormProps> = ({ 
  data, 
  onChange, 
  errors 
}) => {
  return (
    <div className="space-y-4 animate-fadeIn">
      <PaymentInstructions method="zelle" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            Email desde el que envía
          </label>
          <input
            type="email"
            value={data.email_from || ''}
            onChange={(e) => onChange('email_from', e.target.value)}
            placeholder="su-email@gmail.com"
            className={`
              w-full px-4 py-3 bg-gray-800 border rounded-xl text-white
              transition-all duration-300 outline-none
              ${errors.email_from 
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/50' 
                : 'border-gray-700 focus:border-[#FD8D6A] focus:ring-2 focus:ring-[#FD8D6A]/20'
              }
            `}
          />
          {errors.email_from && (
            <p className="text-red-400 text-sm">{errors.email_from}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            Número de Confirmación
          </label>
          <input
            type="text"
            value={data.reference || ''}
            onChange={(e) => onChange('reference', e.target.value)}
            placeholder="Zelle confirmation #"
            className={`
              w-full px-4 py-3 bg-gray-800 border rounded-xl text-white
              transition-all duration-300 outline-none
              ${errors.reference 
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/50' 
                : 'border-gray-700 focus:border-[#FD8D6A] focus:ring-2 focus:ring-[#FD8D6A]/20'
              }
            `}
          />
          {errors.reference && (
            <p className="text-red-400 text-sm">{errors.reference}</p>
          )}
        </div>
      </div>

      <FileUploadField
        label="Captura de Pantalla del Pago"
        onChange={(file) => onChange('proof_file', file)}
        accept="image/*"
        error={errors.proof_file}
      />
    </div>
  );
};

export default ZelleForm;