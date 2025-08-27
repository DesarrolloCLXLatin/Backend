// components/StorePaymentFields.tsx
import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { CreditCard, DollarSign, Receipt } from 'lucide-react';
import { FormData } from '../types';
import { FormField } from '../../shared/FormField';

interface StorePaymentFieldsProps {
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
  paymentMethod: string;
}

export const StorePaymentFields: React.FC<StorePaymentFieldsProps> = ({
  register,
  errors,
  paymentMethod
}) => {
  const getPaymentIcon = () => {
    if (paymentMethod.includes('tarjeta')) return <CreditCard className="w-5 h-5" />;
    if (paymentMethod.includes('efectivo')) return <DollarSign className="w-5 h-5" />;
    return <Receipt className="w-5 h-5" />;
  };

  const getPaymentTitle = () => {
    const titles: Record<string, string> = {
      'tarjeta_debito': 'Tarjeta de Débito',
      'tarjeta_credito': 'Tarjeta de Crédito',
      'efectivo_bs': 'Efectivo en Bolívares',
      'efectivo_usd': 'Efectivo en USD',
      'transferencia_nacional_tienda': 'Transferencia Nacional',
      'transferencia_internacional_tienda': 'Transferencia Internacional',
      'zelle_tienda': 'Zelle',
      'paypal_tienda': 'PayPal'
    };
    return titles[paymentMethod] || 'Pago en Tienda';
  };

  return (
    <div className="space-y-4 p-4 bg-blue-50 rounded-md">
      <h4 className="text-md font-medium text-blue-700 flex items-center">
        {getPaymentIcon()}
        <span className="ml-2">{getPaymentTitle()}</span>
      </h4>

      {(paymentMethod === 'tarjeta_debito' || paymentMethod === 'tarjeta_credito') && (
        <FormField
          label="Número de Aprobación del Terminal"
          error={errors.terminal_reference}
        >
          <input
            {...register('terminal_reference')}
            type="text"
            placeholder="Ej: 123456"
            className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </FormField>
      )}

      {(paymentMethod === 'transferencia_nacional_tienda' || 
        paymentMethod === 'transferencia_internacional_tienda' ||
        paymentMethod === 'zelle_tienda' ||
        paymentMethod === 'paypal_tienda') && (
        <FormField
          label="Referencia de la Transacción"
          error={errors.payment_reference}
        >
          <input
            {...register('payment_reference')}
            type="text"
            placeholder="Número de referencia"
            className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </FormField>
      )}

      <div className="bg-white border border-blue-200 rounded-md p-3">
        <p className="text-sm text-blue-600 flex items-start">
          <Receipt className="w-4 h-4 mr-1 flex-shrink-0 mt-0.5" />
          <span>
            El pago será confirmado inmediatamente al completar el registro.
            {paymentMethod.includes('efectivo') && ' Asegúrese de recibir el monto exacto.'}
          </span>
        </p>
      </div>
    </div>
  );
};