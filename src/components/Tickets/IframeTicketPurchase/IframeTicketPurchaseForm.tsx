// src/components/tickets/IframeTicketPurchase/IframeTicketPurchaseForm.tsx

import React, { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useTicketPurchase } from './hooks/useTicketPurchase';
import { FORM_STEPS } from './constants';
import { calculateTotalPrice, calculateBsAmount } from './utils/calculations';

// Components
import EventHeader from './components/Header/EventHeader';
import StepIndicator from './components/Steps/StepIndicator';
import PersonalDataStep from './components/Steps/PersonalDataStep';
import ZoneSelectionStep from './components/Steps/ZoneSelectionStep';
import PaymentStep from './components/Steps/PaymentStep';
import NavigationButtons from './components/common/NavigationButtons';
import ErrorMessage from './components/common/ErrorMessage';
import P2CConfirmationForm from './components/Confirmation/P2CConfirmationForm';

// Styles
import './styles/animations.css';
import './styles/effects.css';

// Tipo para el ticket que se pasa al onSuccess
interface ConcertTicket {
  id: string;
  ticket_number: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string;
  buyer_identification?: string;
  payment_method: string;
  payment_status: 'pendiente' | 'confirmado' | 'rechazado';
  ticket_status: 'vendido' | 'canjeado' | 'cancelado';
  zone_name?: string;
  ticket_price?: number;
  price?: number;
  quantity?: number;
  total_price?: number;
  created_at: string;
  redeemed_at?: string;
  email_sent?: boolean;
  email_sent_at?: string;
  receipt_sent?: boolean;
  is_box_purchase?: boolean;
  box_full_purchase?: boolean;
  box_code?: string;
  voucher_data?: any;
}

export interface IframeTicketPurchaseFormProps {
  isEmbedded?: boolean;
  onSuccess?: (ticketData?: ConcertTicket) => void;
  token: string | null;
}

const IframeTicketPurchaseForm: React.FC<IframeTicketPurchaseFormProps> = ({ 
  isEmbedded = false, 
  onSuccess,
  token 
}) => {
  const {
    // Estados
    inventory,
    isSubmitting,
    currentStep,
    paymentMethods,
    banks,
    exchangeRate,
    showP2CForm,
    transactionId,
    tokenInfo,
    captchaSiteKey,
    captchaToken,
    zones,
    selectedZone,
    vipSeats,
    selectedSeats,
    generalQuantity,
    p2cData,
    paymentData,
    formData,
    errors,
    mousePosition,
    ticketDetails,
    paymentDetails,
    voucherData,
    
    // Funciones
    handleInputChange,
    handleP2CInputChange,
    handlePaymentDataChange,
    handleSeatSelection,
    handleZoneSelection,
    handleCaptchaVerify,
    handleNextStep,
    handlePrevStep,
    handleSubmit,
    confirmP2CPayment,
    setGeneralQuantity,
    setShowP2CForm,
    setTransactionId,
    setVoucherData
  } = useTicketPurchase(token, onSuccess);

  // Configurar callback de captcha global
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).onCaptchaVerify = function(token: string) {
        window.dispatchEvent(new CustomEvent('captchaVerified', { detail: token }));
      };
    }
  }, []);

  // Cálculos
  const totalPrice = calculateTotalPrice(selectedZone, selectedSeats, generalQuantity);
  const totalBs = calculateBsAmount(totalPrice, exchangeRate);

  // Validación de token
  if (!token) {
    return (
      <ErrorMessage
        title="Token de acceso requerido"
        message="Este formulario requiere un token de acceso válido."
      />
    );
  }

  // Formulario de confirmación P2C
  if (showP2CForm && transactionId) {
    return (
      <>
        <Toaster position="top-right" />
        <P2CConfirmationForm
          transactionId={transactionId}
          totalPrice={totalPrice}
          totalBs={totalBs}
          exchangeRate={exchangeRate}
          isSubmitting={isSubmitting}
          isEmbedded={isEmbedded}
          ticketDetails={ticketDetails || {
            zone_name: selectedZone?.zone_name,
            quantity: selectedZone?.is_numbered ? selectedSeats.length : generalQuantity,
            price_per_ticket: selectedZone?.price_usd,
            seat_numbers: selectedSeats.map(s => s.seat_number),
            ticket_type: selectedZone?.zone_type
          }}
          paymentDetails={paymentDetails}
          transactionData={voucherData}
          onConfirm={confirmP2CPayment}
          onCancel={() => {
            setShowP2CForm(false);
            setTransactionId(null);
            // Opcionalmente, limpiar los datos del voucher
            setVoucherData(null);
          }}
        />
      </>
    );
  }

  // Formulario principal
  return (
    <>
      <Toaster position="top-right" />
      <div className={`${isEmbedded ? '' : 'max-w-4xl mx-auto'} relative`}>
        {/* Efectos de fondo animados */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl">
          <div 
            className="absolute w-96 h-96 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-full blur-3xl transition-all duration-1000"
            style={{
              transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`,
              left: '-20%',
              top: '-20%'
            }}
          />
        </div>

        <div className="relative bg-gray-900/95 backdrop-blur-xl rounded-3xl border border-red-500/20 shadow-2xl shadow-red-500/10 overflow-hidden">
          {/* Header */}
          <EventHeader inventory={inventory} />

          {/* Indicador de pasos */}
          <StepIndicator currentStep={currentStep} />

          {/* Contenido del formulario */}
          <div className="p-8">
            <div className="max-w-4xl mx-auto">
              {/* Paso 1: Datos personales */}
              {currentStep === FORM_STEPS.PERSONAL_DATA && (
                <PersonalDataStep
                  formData={formData}
                  errors={errors}
                  onInputChange={handleInputChange}
                />
              )}

              {/* Paso 2: Selección de zona y asientos */}
              {currentStep === FORM_STEPS.ZONE_SELECTION && (
                <ZoneSelectionStep
                  formData={formData}
                  errors={errors}
                  zones={zones}
                  selectedZone={selectedZone}
                  selectedSeats={selectedSeats}
                  generalQuantity={generalQuantity}
                  vipSeats={vipSeats}
                  exchangeRate={exchangeRate}
                  onInputChange={handleInputChange}
                  onZoneSelect={handleZoneSelection}
                  onSeatSelect={handleSeatSelection}
                  onQuantityChange={setGeneralQuantity}
                />
              )}

              {/* Paso 3: Pago */}
              {currentStep === FORM_STEPS.PAYMENT && (
                <PaymentStep
                  formData={formData}
                  errors={errors}
                  paymentMethods={paymentMethods}
                  banks={banks}
                  exchangeRate={exchangeRate}
                  p2cData={p2cData}
                  paymentData={paymentData}
                  tokenInfo={tokenInfo}
                  captchaToken={captchaToken}
                  totalPrice={totalPrice}
                  selectedZone={selectedZone}
                  selectedSeats={selectedSeats}
                  generalQuantity={generalQuantity}
                  onInputChange={handleInputChange}
                  onP2CInputChange={handleP2CInputChange}
                  onPaymentDataChange={handlePaymentDataChange}
                  onCaptchaVerify={handleCaptchaVerify}
                />
              )}

              {/* Botones de navegación */}
              <NavigationButtons
                currentStep={currentStep}
                totalSteps={3}
                isSubmitting={isSubmitting}
                canProceed={
                  currentStep === FORM_STEPS.PAYMENT 
                    ? !!formData.payment_method 
                    : currentStep === FORM_STEPS.ZONE_SELECTION
                    ? !!selectedZone && (selectedZone.is_numbered ? selectedSeats.length > 0 : true)
                    : true
                }
                paymentMethod={formData.payment_method}
                onNext={handleNextStep}
                onPrev={handlePrevStep}
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default IframeTicketPurchaseForm;