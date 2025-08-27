// components/GiftPaymentFields.tsx
import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Gift, User, FileText } from 'lucide-react';
import { FormData } from '../types';
import { FormField } from '../../shared/FormField';

interface GiftPaymentFieldsProps {
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
}

export const GiftPaymentFields: React.FC<GiftPaymentFieldsProps> = ({
  register,
  errors
}) => {
  return (
    <div className="space-y-4 p-4 bg-green-50 rounded-md">
      <h4 className="text-md font-medium text-green-700 flex items-center">
        <Gift className="w-5 h-5 mr-2 text-green-600" />
        Registro de Obsequio Exonerado
      </h4>

      <FormField
        label="ID del Empleado"
        error={errors.employee_id}
        helpText="Número de empleado o cédula"
      >
        <div className="relative">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-400 w-4 h-4" />
          <input
            {...register('employee_id')}
            type="text"
            placeholder="Ej: 12345678"
            className="pl-10 w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </FormField>

      <FormField
        label="Motivo de la Exoneración"
        error={errors.gift_reason}
        helpText="Especifique la razón del obsequio"
      >
        <div className="relative">
          <FileText className="absolute left-3 top-3 text-green-400 w-4 h-4" />
          <textarea
            {...register('gift_reason')}
            rows={3}
            placeholder="Ej: Empleado del mes, Premio por desempeño, etc."
            className="pl-10 w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </FormField>

      <div className="bg-white border border-green-200 rounded-md p-3">
        <p className="text-sm text-green-600">
          <Gift className="w-4 h-4 inline mr-1" />
          Este registro no generará ningún cobro. Se deducirá del inventario disponible.
        </p>
      </div>
    </div>
  );
};