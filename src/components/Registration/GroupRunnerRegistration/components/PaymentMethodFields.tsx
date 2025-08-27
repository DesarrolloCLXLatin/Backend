// components/PaymentMethodFields.tsx
import React from 'react';
import { UseFormRegister, FieldErrors, UseFormWatch } from 'react-hook-form';
import { CreditCard, AlertCircle } from 'lucide-react';
import { FormData, Bank, PaymentMethod } from '../types';
import { FormField } from '../../shared/FormField';

interface PaymentMethodFieldsProps {
  paymentMethod: PaymentMethod;
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
  watch: UseFormWatch<FormData>;
  banks: Bank[];
}

export const PaymentMethodFields: React.FC<PaymentMethodFieldsProps> = ({
  paymentMethod,
  register,
  errors,
  watch,
  banks
}) => {
  if (paymentMethod !== 'pago_movil_p2c') return null;

  const registrantIdType = watch('registrant_identification_type');
  const registrantId = watch('registrant_identification');

  return (
    <div className="space-y-4 p-4 bg-orange-50 rounded-md">
      <h4 className="text-md font-medium text-orange-700 flex items-center">
        <CreditCard className="w-5 h-5 mr-2 text-orange-600" />
        Datos para Pago Móvil Automático
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="Su Teléfono Bancario"
          error={errors.client_phone}
          required
          helpText="Formato: 04121234567"
        >
          <input
            {...register('client_phone')}
            type="text"
            placeholder="04121234567"
            className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </FormField>

        <FormField
          label="Su Banco"
          error={errors.client_bank}
          required
        >
          <select
            {...register('client_bank')}
            className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Seleccionar banco</option>
            {banks.map(bank => (
              <option key={bank.code} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <PaymentInfoAlert
        registrantIdType={registrantIdType}
        registrantId={registrantId}
      />
    </div>
  );
};

interface PaymentInfoAlertProps {
  registrantIdType: string;
  registrantId: string;
}

const PaymentInfoAlert: React.FC<PaymentInfoAlertProps> = ({
  registrantIdType,
  registrantId
}) => {
  const hasRegistrantInfo = registrantIdType && registrantId;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
      <p className="text-sm text-orange-800 flex items-start">
        <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0 mt-0.5 text-orange-600" />
        <span>
          {hasRegistrantInfo ? (
            <>
              Se utilizará la cédula del registrante ({registrantIdType}{registrantId}) para el pago.
            </>
          ) : (
            'Complete los datos del registrante para procesar el pago móvil.'
          )}
        </span>
      </p>
    </div>
  );
};