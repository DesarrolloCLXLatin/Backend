// src/components/tickets/IframeTicketPurchase/components/PaymentMethods/TransferenciaNacionalForm.tsx

import React from 'react';
import { PaymentFormProps } from '../../types';
import PaymentInstructions from './PaymentInstructions';
import FileUploadField from './FileUploadField';

const TransferenciaNacionalForm: React.FC<PaymentFormProps> = ({ 
  data, 
  onChange, 
  errors, 
  banks = [] 
}) => {
  return (
    <div className="space-y-4 animate-fadeIn">
      <PaymentInstructions method="transferencia_nacional" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            Banco de Origen
          </label>
          <select
            value={data.bank_code || ''}
            onChange={(e) => onChange('bank_code', e.target.value)}
            className={`
              w-full px-4 py-3 bg-gray-800 border rounded-xl text-white
              transition-all duration-300 outline-none
              ${errors.bank_code 
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/50' 
                : 'border-gray-700 focus:border-[#FD8D6A] focus:ring-2 focus:ring-[#FD8D6A]/20'
              }
            `}
          >
            <option value="">Seleccione su banco</option>
            {banks.map((bank) => (
              <option key={bank.code} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </select>
          {errors.bank_code && (
            <p className="text-red-400 text-sm">{errors.bank_code}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            Número de Referencia
          </label>
          <input
            type="text"
            value={data.reference || ''}
            onChange={(e) => onChange('reference', e.target.value)}
            placeholder="123456789"
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
        label="Comprobante de Pago (Imagen o PDF)"
        onChange={(file) => onChange('proof_file', file)}
        accept="image/*,.pdf"
        error={errors.proof_file}
      />
    </div>
  );
};

export default TransferenciaNacionalForm;