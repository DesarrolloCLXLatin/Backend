// src/components/tickets/IframeTicketPurchase/components/Steps/PersonalDataStep.tsx

import React from 'react';
import { User, Hash, Mail, Phone, AlertCircle } from 'lucide-react';
import { StepProps } from '../../types';

const PersonalDataStep: React.FC<StepProps> = ({
  formData,
  errors,
  onInputChange
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <User className="w-8 h-8 text-[#FD8D6A]" />
        Datos del Comprador
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <User className="w-4 h-4 text-[#FD8D6A]" />
            Nombre Completo
          </label>
          <input
            type="text"
            value={formData.buyer_name}
            onChange={(e) => onInputChange('buyer_name', e.target.value)}
            className={`
              w-full px-4 py-3 bg-gray-800 border rounded-xl text-white
              transition-all duration-300 outline-none
              ${errors.buyer_name 
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/50' 
                : 'border-gray-700 focus:border-[#FD8D6A] focus:ring-2 focus:ring-[#FD8D6A]/20'
              }
            `}
            placeholder="Juan Pérez"
          />
          {errors.buyer_name && (
            <p className="text-red-400 text-sm flex items-center gap-1 animate-shake">
              <AlertCircle className="w-4 h-4" />
              {errors.buyer_name}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Hash className="w-4 h-4 text-[#FD8D6A]" />
            Cédula/ID
          </label>
          <input
            type="text"
            value={formData.buyer_identification}
            onChange={(e) => onInputChange('buyer_identification', e.target.value)}
            className={`
              w-full px-4 py-3 bg-gray-800 border rounded-xl text-white
              transition-all duration-300 outline-none
              ${errors.buyer_identification 
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/50' 
                : 'border-gray-700 focus:border-[#FD8D6A] focus:ring-2 focus:ring-[#FD8D6A]/20'
              }
            `}
            placeholder="V-12345678"
          />
          {errors.buyer_identification && (
            <p className="text-red-400 text-sm flex items-center gap-1 animate-shake">
              <AlertCircle className="w-4 h-4" />
              {errors.buyer_identification}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Mail className="w-4 h-4 text-[#FD8D6A]" />
            Email
          </label>
          <input
            type="email"
            value={formData.buyer_email}
            onChange={(e) => onInputChange('buyer_email', e.target.value)}
            className={`
              w-full px-4 py-3 bg-gray-800 border rounded-xl text-white
              transition-all duration-300 outline-none
              ${errors.buyer_email 
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/50' 
                : 'border-gray-700 focus:border-[#FD8D6A] focus:ring-2 focus:ring-[#FD8D6A]/20'
              }
            `}
            placeholder="juan@email.com"
          />
          {errors.buyer_email && (
            <p className="text-red-400 text-sm flex items-center gap-1 animate-shake">
              <AlertCircle className="w-4 h-4" />
              {errors.buyer_email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Phone className="w-4 h-4 text-[#FD8D6A]" />
            Teléfono
          </label>
          <input
            type="tel"
            value={formData.buyer_phone}
            onChange={(e) => onInputChange('buyer_phone', e.target.value)}
            className={`
              w-full px-4 py-3 bg-gray-800 border rounded-xl text-white
              transition-all duration-300 outline-none
              ${errors.buyer_phone 
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/50' 
                : 'border-gray-700 focus:border-[#FD8D6A] focus:ring-2 focus:ring-[#FD8D6A]/20'
              }
            `}
            placeholder="0414-123-4567"
          />
          {errors.buyer_phone && (
            <p className="text-red-400 text-sm flex items-center gap-1 animate-shake">
              <AlertCircle className="w-4 h-4" />
              {errors.buyer_phone}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalDataStep;