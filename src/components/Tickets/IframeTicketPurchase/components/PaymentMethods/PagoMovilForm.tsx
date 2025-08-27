// src/components/tickets/IframeTicketPurchase/components/PaymentMethods/PagoMovilForm.tsx

import React from 'react';
import { Smartphone, Phone, Building, AlertCircle } from 'lucide-react';
import { PaymentFormProps } from '../../types';

const PagoMovilForm: React.FC<PaymentFormProps> = ({ 
  data, 
  onChange, 
  errors, 
  banks = [] 
}) => {
  // Debug temporal - remover después de verificar
  React.useEffect(() => {
    console.log('PagoMovilForm - banks received:', banks);
    console.log('PagoMovilForm - banks length:', banks.length);
    console.log('PagoMovilForm - current selection:', data.client_bank_code);
  }, [banks, data.client_bank_code]);
  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="bg-[#FD8D6A]/10 border border-[#FD8D6A]/30 rounded-xl p-4">
        <p className="text-sm text-[#FD8D6A] flex items-center gap-2">
          <Smartphone className="w-4 h-4" />
          Pago Móvil Persona a Comercio (P2C)
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Phone className="w-4 h-4 text-[#FD8D6A]" />
            Teléfono para Pago Móvil
          </label>
          <input
            type="text"
            value={data.client_phone || ''}
            onChange={(e) => onChange('client_phone', e.target.value)}
            className={`
              w-full px-4 py-3 bg-gray-800 border rounded-xl text-white
              transition-all duration-300 outline-none
              ${errors.client_phone 
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/50' 
                : 'border-gray-700 focus:border-[#FD8D6A] focus:ring-2 focus:ring-[#FD8D6A]/20'
              }
            `}
            placeholder="04121234567"
          />
          {errors.client_phone && (
            <p className="text-red-400 text-sm flex items-center gap-1 animate-shake">
              <AlertCircle className="w-4 h-4" />
              {errors.client_phone}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Building className="w-4 h-4 text-[#FD8D6A]" />
            Banco
          </label>
          <select
            value={data.client_bank_code || ''}
            onChange={(e) => onChange('client_bank_code', e.target.value)}
            className={`
              w-full px-4 py-3 bg-gray-800 border rounded-xl text-white
              transition-all duration-300 outline-none
              ${errors.client_bank_code 
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
          {errors.client_bank_code && (
            <p className="text-red-400 text-sm flex items-center gap-1 animate-shake">
              <AlertCircle className="w-4 h-4" />
              {errors.client_bank_code}
            </p>
          )}
        </div>
      </div>

      <div className="p-6 bg-gradient-to-r from-[#FD8D6A]/10 to-[#ff6b4a]/10 rounded-2xl border border-[#FD8D6A]/30">
        <h4 className="font-bold text-white mb-4 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-[#FD8D6A]" />
          ¿Cómo funciona el Pago Móvil P2C?
        </h4>
        <ol className="space-y-2 text-gray-300 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-[#FD8D6A] font-bold">1.</span>
            <span>Al hacer clic en "Iniciar Pago", recibirá los datos del comercio</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#FD8D6A] font-bold">2.</span>
            <span>Realice la transferencia desde su banco usando esos datos</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#FD8D6A] font-bold">3.</span>
            <span>Ingrese la referencia de la transferencia para confirmar</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#FD8D6A] font-bold">4.</span>
            <span>Recibirá sus entradas por email una vez confirmado el pago</span>
          </li>
        </ol>
      </div>
    </div>
  );
};

export default PagoMovilForm;