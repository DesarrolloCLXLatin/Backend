// src/components/tickets/IframeTicketPurchase/components/Steps/PaymentStep.tsx

import React from 'react';
import { CreditCard, AlertCircle } from 'lucide-react';
import { PaymentStepProps } from '../../types';
import PurchaseSummary from '../Confirmation/PurchaseSummary';
import PaymentMethodGrid from '../PaymentMethods/PaymentMethodGrid';
import PagoMovilForm from '../PaymentMethods/PagoMovilForm';
import TransferenciaNacionalForm from '../PaymentMethods/TransferenciaNacionalForm';
import ZelleForm from '../PaymentMethods/ZelleForm';
import PayPalForm from '../PaymentMethods/PayPalForm';
import { calculateBsAmount } from '../../utils/calculations';

const PaymentStep: React.FC<PaymentStepProps> = ({
  formData,
  errors,
  paymentMethods,
  banks,
  exchangeRate,
  p2cData,
  paymentData,
  tokenInfo,
  captchaToken,
  totalPrice,
  selectedZone,
  selectedSeats,
  generalQuantity,
  onInputChange,
  onP2CInputChange,
  onPaymentDataChange,
  onCaptchaVerify
}) => {
  const totalBs = calculateBsAmount(totalPrice, exchangeRate);

  return (
    <div className="space-y-6 animate-fadeIn">
      <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <CreditCard className="w-8 h-8 text-[#FD8D6A]" />
        Información de Pago
      </h3>

      {/* Resumen de compra */}
      <PurchaseSummary
        selectedZone={selectedZone}
        selectedSeats={selectedSeats}
        generalQuantity={generalQuantity}
        totalPrice={totalPrice}
        totalBs={totalBs}
        exchangeRate={exchangeRate}
      />

      {/* Grid de métodos de pago */}
      <PaymentMethodGrid
        selectedMethod={formData.payment_method}
        onSelectMethod={(method) => onInputChange('payment_method', method)}
      />

      {errors.payment_method && (
        <p className="text-red-400 text-sm flex items-center gap-1 animate-shake">
          <AlertCircle className="w-4 h-4" />
          {errors.payment_method}
        </p>
      )}

      {/* Formularios específicos por método */}
      {formData.payment_method === 'pago_movil' && (
        <PagoMovilForm 
          data={p2cData}
          onChange={onP2CInputChange}
          errors={errors}
          banks={banks}
        />
      )}

      {formData.payment_method === 'transferencia_nacional' && (
        <TransferenciaNacionalForm
          data={paymentData}
          onChange={onPaymentDataChange}
          errors={errors}
          banks={banks}
        />
      )}

      {formData.payment_method === 'zelle' && (
        <ZelleForm
          data={paymentData}
          onChange={onPaymentDataChange}
          errors={errors}
        />
      )}

      {formData.payment_method === 'paypal' && (
        <PayPalForm
          data={paymentData}
          onChange={onPaymentDataChange}
          errors={errors}
        />
      )}

      {/* hCaptcha */}
      {tokenInfo?.requires_captcha && tokenInfo?.captcha_site_key && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            Verificación de Seguridad
          </label>
          <div 
            className="h-captcha"
            data-sitekey={tokenInfo.captcha_site_key}
            data-callback="onCaptchaVerify"
            data-theme="dark"
          />
          {errors.captcha && (
            <p className="text-red-400 text-sm flex items-center gap-1 animate-shake">
              <AlertCircle className="w-4 h-4" />
              {errors.captcha}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default PaymentStep;