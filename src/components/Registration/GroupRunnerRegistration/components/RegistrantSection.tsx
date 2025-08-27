// components/RegistrantSection.tsx
import React from 'react';
import { UseFormRegister, FieldErrors, UseFormWatch } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import { FormData, IdentificationType } from '../types';
import { FormField } from '../../shared/FormField';

interface RegistrantSectionProps {
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
  watch: UseFormWatch<FormData>;
}

export const RegistrantSection: React.FC<RegistrantSectionProps> = ({
  register,
  errors,
  watch
}) => {
  return (
    <div className="space-y-4 bg-orange-50 p-4 rounded-md">
      <h3 className="text-lg font-semibold text-orange-700 border-b border-orange-200 pb-2">
        Datos del Registrante (Pagador)
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="Email del Registrante"
          error={errors.registrant_email}
          required
        >
          <input
            {...register('registrant_email')}
            type="email"
            className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="pagador@email.com"
          />
        </FormField>

        <FormField
          label="Teléfono del Registrante"
          error={errors.registrant_phone}
          required
        >
          <input
            {...register('registrant_phone')}
            type="tel"
            className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="0414 123 4567"
          />
        </FormField>

        <div className="md:col-span-2">
          <FormField
            label="Cédula del Registrante"
            error={errors.registrant_identification}
            required
            helpText="Esta cédula se usará para el Pago Móvil P2C"
          >
            <div className="flex space-x-2">
              <select
                {...register('registrant_identification_type')}
                className="w-20 px-2 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="V">V</option>
                <option value="E">E</option>
                <option value="J">J</option>
                <option value="P">P</option>
              </select>
              <input
                {...register('registrant_identification')}
                type="text"
                className="flex-1 px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="12345678"
              />
            </div>
          </FormField>
        </div>
      </div>
    </div>
  );
};