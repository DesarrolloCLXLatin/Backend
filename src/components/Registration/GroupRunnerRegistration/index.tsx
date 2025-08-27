// GroupRunnerRegistrationForm/index.tsx
import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Users, ArrowRight, ArrowLeft, Loader, Shield, Check, Circle, Sparkles, CreditCard, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types & Constants
import { FormData, Runner } from './types';
import { PRICE_USD, API_BASE_URL, MESSAGES } from './constants';

// Hooks
import { useApiData } from './hooks/useApiData';
import { usePaymentProcess } from './hooks/usePaymentProcessing';
import { useFormValidation } from './hooks/useFormValidation';
import { usePaymentMethods } from './hooks/usePaymentMethods';

// Utils
import { registrationSchema } from './utils/validation';

// Components
import { RegistrantSection } from './components/RegistrantSection';
import { PaymentSection } from './components/PaymentSection';
import { RunnersSection } from './components/RunnersSection';
import { PaymentSummary } from './components/PaymentSummary';
import { PaymentStatusModal } from './components/modals/PaymentStatusModal';
import PaymentVoucherModal from './components/modals/PaymentVoucherModal';
import { RegistrationConfirmationModal } from './components/modals/RegistrationConfirmationModal';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorList } from '../shared/ErrorMessage';

interface GroupRunnerRegistrationFormProps {
  onSuccess?: () => void;
  isEmbedded?: boolean;
  token?: string;
  tokenType?: 'public_token' | 'seller_token' | null;
}

// Definir los pasos del formulario
const FORM_STEPS = [
  { id: 1, title: 'Corredores', icon: Users, color: 'orange' },
  { id: 2, title: 'Datos del Pagador', icon: Users, color: 'purple' },
  { id: 3, title: 'Método de Pago', icon: CreditCard, color: 'green' },
];

// Animaciones
const pageTransition = {
  initial: { opacity: 0, x: 100 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -100 },
  transition: { duration: 0.3, ease: 'easeInOut' }
};

const scaleIn = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { duration: 0.2 }
};

const GroupRunnerRegistrationForm: React.FC<GroupRunnerRegistrationFormProps> = ({ 
  onSuccess,
  isEmbedded = false,
  token,
  tokenType
}) => {
  // Estados locales
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Hooks personalizados
  const { banks, inventory, exchangeRate, isLoadingData, getAvailableStock } = useApiData({ 
    token, 
    isEmbedded 
  });
  const { validateForm, customErrors, clearCustomErrors } = useFormValidation({ inventory });
  const { paymentMethods } = usePaymentMethods({ tokenType, isEmbedded, token });
  
  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    control,
    trigger
  } = useForm<FormData>({
    resolver: yupResolver(registrationSchema),
    defaultValues: {
      payment_method: 'pago_movil_p2c',
      registrant_identification_type: 'V',
      registrant_bank_code: '',
      runners: [{
        identification_type: 'V',
        gender: 'M',
        full_name: '',
        identification: '',
        birth_date: '',
        email: '',
        phone: '',
        shirt_size: ''
      }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "runners"
  });

  // Watchers
  const paymentMethod = watch('payment_method');
  const runners = watch('runners');
  const totalPriceUSD = runners.length * PRICE_USD;

  // Obtener configuración del método de pago seleccionado
  const selectedPaymentMethodConfig = paymentMethods.find(
    method => method.payment_method === paymentMethod
  );

  // Payment process hook
  const {
    isSubmitting,
    paymentModal,
    voucherModal,
    processRegistration,
    handleClosePaymentModal,
    handleCloseVoucherModal,
    handleVoucherStatusUpdate
  } = usePaymentProcess({ banks, totalPriceUSD });

  // Efecto de partículas con ajustes de velocidad y tamaño
  useEffect(() => {
    const createParticle = () => {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 3 + 's';
      particle.style.animationDuration = (Math.random() * 4 + 6) + 's';
      document.querySelector('.particles-container')?.appendChild(particle);
      
      setTimeout(() => particle.remove(), 10000);
    };

    const interval = setInterval(createParticle, 500);
    return () => clearInterval(interval);
  }, []);

  // Handlers de navegación
  const handleNextStep = async () => {
    if (isTransitioning) return;
    
    let fieldsToValidate: any[] = [];
    
    switch (currentStep) {
      case 1:
        fieldsToValidate = runners.map((_, index) => [
          `runners.${index}.full_name`,
          `runners.${index}.identification_type`,
          `runners.${index}.identification`,
          `runners.${index}.birth_date`,
          `runners.${index}.gender`,
          `runners.${index}.email`,
          `runners.${index}.phone`,
          `runners.${index}.shirt_size`
        ]).flat();
        break;
      case 2:
        fieldsToValidate = [
          'registrant_email',
          'registrant_phone',
          'registrant_identification_type',
          'registrant_identification'
        ];
        break;
    }
    
    const isValid = await trigger(fieldsToValidate);
    
    if (isValid) {
      setIsTransitioning(true);
      setDirection(1);
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      
      setTimeout(() => {
        if (currentStep < FORM_STEPS.length) {
          setCurrentStep(currentStep + 1);
        }
        setIsTransitioning(false);
      }, 300);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1 && !isTransitioning) {
      setIsTransitioning(true);
      setDirection(-1);
      
      setTimeout(() => {
        setCurrentStep(currentStep - 1);
        setIsTransitioning(false);
      }, 300);
    }
  };

  const goToStep = (step: number) => {
    if ((step <= currentStep || completedSteps.has(step - 1)) && !isTransitioning) {
      setIsTransitioning(true);
      setDirection(step > currentStep ? 1 : -1);
      
      setTimeout(() => {
        setCurrentStep(step);
        setIsTransitioning(false);
      }, 300);
    }
  };

  // Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPaymentProof(e.target.files?.[0] || null);
  };

  const handleRemoveFile = () => {
    setPaymentProof(null);
  };

  const onSubmit = async (data: FormData) => {
    clearCustomErrors();
    
    const validation = validateForm(data, paymentProof);
    
    if (!validation.isValid) {
      return;
    }

    setPendingFormData(data);
    setShowConfirmationModal(true);
  };

  const handleConfirmRegistration = async () => {
    if (!pendingFormData) return;

    setShowConfirmationModal(false);
    await processRegistration(pendingFormData, paymentProof);
    setPendingFormData(null);
  };

  const handleCloseConfirmationModal = () => {
    setShowConfirmationModal(false);
    setPendingFormData(null);
  };

  const handleReset = () => {
    reset();
    setPaymentProof(null);
    setShowConfirmationModal(false);
    setPendingFormData(null);
    setCurrentStep(1);
    setCompletedSteps(new Set());
  };

  const handleSuccessClose = () => {
    handleClosePaymentModal();
    if (paymentModal.status === 'success') {
      handleReset();
      onSuccess?.();
    }
  };

  // Render loading state
  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen -top-96 mb-96 w-11/12 h-96">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="relative">
            <div className="w-24 h-24 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto"></div>
            <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 text-orange-600 animate-pulse" />
          </div>
          <p className="mt-4 text-orange-600 font-medium animate-pulse">Cargando formulario...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes particle-float {
          0% {
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
          }
        }
        
        .particle {
          position: fixed;
          width: 8px;
          height: 8px;
          background: linear-gradient(45deg, #f97316, #ea580c);
          border-radius: 50%;
          pointer-events: none;
          animation: particle-float 8s linear infinite;
          z-index: 1;
          box-shadow: 0 0 6px rgba(249, 115, 22, 0.5);
        }
        
        .particles-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          pointer-events: none;
          z-index: 1;
        }
        
        .glow {
          box-shadow: 0 0 20px rgba(249, 115, 22, 0.3);
        }
        
        .gradient-border {
          background: linear-gradient(135deg, #f97316, #ea580c, #dc2626);
          padding: 2px;
          border-radius: 0.75rem;
        }
        
        .hover-lift {
          transition: all 0.3s ease;
        }
        
        .hover-lift:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
      `}</style>

      <div className="particles-container"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto p-6 relative z-10"
      >
        <div className="gradient-border">
          <div className="bg-black rounded-lg shadow-2xl">
            <div className="p-8">
              {/* Header animado */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <FormHeader 
                  priceUSD={PRICE_USD} 
                  exchangeRate={exchangeRate} 
                  totalPriceUSD={totalPriceUSD}
                  tokenType={tokenType}
                  isEmbedded={isEmbedded}
                />
              </motion.div>

              {/* Step Indicator con animaciones */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <StepIndicator 
                  steps={FORM_STEPS}
                  currentStep={currentStep}
                  completedSteps={completedSteps}
                  onStepClick={goToStep}
                />
              </motion.div>

              {/* Form con animaciones */}
              <form onSubmit={handleSubmit(onSubmit)} className="mt-8">
                {/* Mostrar errores personalizados si existen */}
                <AnimatePresence>
                  {customErrors.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ErrorList 
                        errors={customErrors} 
                        onClose={clearCustomErrors}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Contenido del paso actual con animaciones */}
                <div className="min-h-[400px] relative overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStep}
                      initial={{ opacity: 0, x: direction > 0 ? 100 : -100 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction > 0 ? -100 : 100 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="w-full"
                    >
                      {currentStep === 1 && (
                        <motion.div {...scaleIn}>
                          <RunnersSection 
                            fields={fields}
                            register={register}
                            errors={errors}
                            watch={watch}
                            append={append}
                            remove={remove}
                            getAvailableStock={getAvailableStock}
                            inventory={inventory}
                          />
                        </motion.div>
                      )}

                      {currentStep === 2 && (
                        <motion.div {...scaleIn}>
                          <RegistrantSection 
                            register={register} 
                            errors={errors} 
                            watch={watch} 
                          />
                        </motion.div>
                      )}

                      {currentStep === 3 && (
                        <motion.div {...scaleIn} className="space-y-6">
                          <PaymentSection 
                            register={register}
                            errors={errors}
                            watch={watch}
                            banks={banks}
                            paymentProof={paymentProof}
                            onFileUpload={handleFileUpload}
                            onRemoveFile={handleRemoveFile}
                            tokenType={tokenType}
                            isEmbedded={isEmbedded}
                          />
                          
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.3 }}
                          >
                            <PaymentSummary 
                              runnersCount={runners.length}
                              priceUSD={PRICE_USD}
                              exchangeRate={exchangeRate}
                              paymentMethod={paymentMethod}
                            />
                          </motion.div>
                        </motion.div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
                
                {/* Navegación entre pasos con animaciones */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                >
                  <StepNavigation 
                    currentStep={currentStep}
                    totalSteps={FORM_STEPS.length}
                    isSubmitting={isSubmitting || showConfirmationModal}
                    onPrevious={handlePreviousStep}
                    onNext={handleNextStep}
                    onReset={handleReset}
                    isLastStep={currentStep === FORM_STEPS.length}
                    isTransitioning={isTransitioning}
                  />
                </motion.div>
              </form>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Modal de Confirmación */}
      <RegistrationConfirmationModal
        isOpen={showConfirmationModal}
        onClose={handleCloseConfirmationModal}
        onConfirm={handleConfirmRegistration}
        formData={pendingFormData || {
          registrant_email: '',
          registrant_phone: '',
          registrant_identification_type: 'V',
          registrant_identification: '',
          payment_method: 'pago_movil_p2c',
          runners: []
        }}
        banks={banks}
        exchangeRate={exchangeRate}
        paymentProof={paymentProof}
        isSubmitting={isSubmitting}
        paymentMethodConfig={selectedPaymentMethodConfig}
      />

      {/* Modales */}
      <PaymentStatusModal
        isOpen={paymentModal.isOpen}
        status={paymentModal.status}
        onClose={handleSuccessClose}
        paymentData={{
          ...paymentModal.data,
          // Asegurarse de que estos campos estén disponibles cuando hay error con voucher
          voucher: paymentModal.data?.voucher,
          control: paymentModal.data?.control,
          reference: paymentModal.data?.reference,
          amount: paymentModal.data?.amount || totalPriceUSD,
          payment_method: paymentModal.data?.payment_method || paymentMethod,
          paymentDetails: paymentModal.data?.paymentDetails,
          errorCode: paymentModal.data?.errorCode,
          errorMessage: paymentModal.data?.errorMessage
        }}
      />

      <PaymentVoucherModal
        isOpen={voucherModal.isOpen}
        onClose={handleCloseVoucherModal}
        voucher={voucherModal.voucher}
        reference={voucherModal.reference}
        control={voucherModal.control}
        amount={voucherModal.amount} // USD
        amountBs={voucherModal.amountBs} // NUEVO: Pasar monto en Bs
        exchangeRate={voucherModal.exchangeRate} // NUEVO: Pasar tasa de cambio
        paymentMethod={voucherModal.paymentMethod || "pago_movil_p2c"}
        paymentStatus={voucherModal.paymentStatus}
        paymentDetails={voucherModal.paymentDetails}
        onStatusUpdate={handleVoucherStatusUpdate}
        // NUEVAS PROPS para manejar errores
        isError={voucherModal.isError}
        errorCode={voucherModal.errorCode}
        errorMessage={voucherModal.errorMessage}
      />
    </>
  );
};

// Componente Step Indicator mejorado
interface StepIndicatorProps {
  steps: typeof FORM_STEPS;
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (step: number) => void;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ 
  steps, 
  currentStep, 
  completedSteps,
  onStepClick 
}) => {
  return (
    <div className="flex items-center justify-between mt-8 px-4">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = completedSteps.has(step.id);
        const isClickable = step.id <= currentStep || completedSteps.has(step.id - 1);
        
        return (
          <React.Fragment key={step.id}>
            <motion.div 
              className={`flex flex-col items-center ${isClickable ? 'cursor-pointer' : ''}`}
              onClick={() => isClickable && onStepClick(step.id)}
              whileHover={isClickable ? { scale: 1.05 } : {}}
              whileTap={isClickable ? { scale: 0.95 } : {}}
            >
              <motion.div 
                className={`
                  relative w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-all duration-300
                  ${isActive ? 'bg-gradient-to-br from-orange-500 to-orange-700 text-white shadow-lg glow' : 
                    isCompleted ? 'bg-gradient-to-br from-green-500 to-green-700 text-white shadow-md' : 
                    'bg-gray-200 text-gray-400'}
                `}
                initial={false}
                animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5, repeat: isActive ? Infinity : 0, repeatDelay: 2 }}
              >
                {isCompleted && !isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 10 }}
                  >
                    <Check className="w-8 h-8" />
                  </motion.div>
                )}
                {(isActive || !isCompleted) && (
                  <Icon className="w-8 h-8" />
                )}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-orange-400 opacity-30"
                    animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </motion.div>
              
              <motion.span 
                className={`text-sm font-medium transition-colors duration-300 ${
                  isActive ? 'text-orange-600' : 
                  isCompleted ? 'text-green-600' : 
                  'text-gray-400'
                }`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                {step.title}
              </motion.span>
            </motion.div>
            
            {index < steps.length - 1 && (
              <div className="flex-1 relative mx-4">
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: completedSteps.has(step.id) ? "100%" : "0%" }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  />
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Componente de navegación mejorado
interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  isSubmitting: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onReset: () => void;
  isLastStep: boolean;
  isTransitioning: boolean;
}

const StepNavigation: React.FC<StepNavigationProps> = ({
  currentStep,
  totalSteps,
  isSubmitting,
  onPrevious,
  onNext,
  onReset,
  isLastStep,
  isTransitioning
}) => {
  return (
    <div className="flex justify-between items-center pt-8 mt-8 border-t border-gray-700">
      <div>
        {currentStep > 1 && (
          <motion.button
            type="button"
            onClick={onPrevious}
            disabled={isSubmitting || isTransitioning}
            className="group flex items-center px-6 py-3 border-2 border-gray-600 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Anterior
          </motion.button>
        )}
      </div>
      
      <div className="flex space-x-4">
        <motion.button
          type="button"
          onClick={onReset}
          disabled={isSubmitting || isTransitioning}
          className="px-6 py-3 border-2 border-gray-600 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Limpiar
        </motion.button>
        
        {!isLastStep ? (
          <motion.button
            type="button"
            onClick={onNext}
            disabled={isSubmitting || isTransitioning}
            className="group relative px-8 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg text-sm font-medium hover:from-orange-700 hover:to-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden transition-all duration-200 shadow-lg hover:shadow-xl"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="relative z-10 flex items-center">
              Siguiente
              <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </span>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-orange-700 to-orange-800"
              initial={{ x: "-100%" }}
              whileHover={{ x: 0 }}
              transition={{ duration: 0.3 }}
            />
          </motion.button>
        ) : (
          <motion.button
            type="submit"
            disabled={isSubmitting || isTransitioning}
            className="group relative px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg text-sm font-medium hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden transition-all duration-200 shadow-lg hover:shadow-xl"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader className="w-4 h-4 mr-2" />
                </motion.div>
                Procesando...
              </span>
            ) : (
              <span className="relative z-10 flex items-center">
                <Sparkles className="w-4 h-4 mr-2" />
                Continuar al Resumen
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-green-700 to-green-800"
              initial={{ x: "-100%" }}
              whileHover={{ x: 0 }}
              transition={{ duration: 0.3 }}
            />
          </motion.button>
        )}
      </div>
    </div>
  );
};

// Header mejorado con animaciones
interface FormHeaderProps {
  priceUSD: number;
  exchangeRate: number | null;
  totalPriceUSD: number;
  tokenType?: 'public_token' | 'seller_token' | null;
  isEmbedded?: boolean;
}

const FormHeader: React.FC<FormHeaderProps> = ({ 
  priceUSD, 
  exchangeRate, 
  totalPriceUSD,
  tokenType,
  isEmbedded
}) => {
  const totalPriceBs = exchangeRate ? totalPriceUSD * exchangeRate : null;

  return (
    <div className="mb-6">
      <motion.h2 
        className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent mb-3 flex items-center"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          <Users className="w-10 h-10 mr-3 text-orange-600" />
        </motion.div>
        Registro de Corredores - CLX Night Run 2025
      </motion.h2>
      
      {/* Mostrar aviso si es un token público */}
      <AnimatePresence>
        {tokenType === 'public_token' && isEmbedded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 bg-purple-900/20 border border-purple-700 rounded-lg p-4 backdrop-blur-sm"
          >
            <div className="flex items-start">
              <Shield className="w-5 h-5 text-purple-400 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-purple-300">
                  Formulario con acceso público
                </p>
                <p className="text-sm text-purple-400 mt-1">
                  Solo métodos de pago online disponibles para mayor seguridad
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <motion.div 
        className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 backdrop-blur-sm border border-blue-700 rounded-xl p-5 hover-lift"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        whileHover={{ scale: 1.01 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-300">Precio por Corredor</p>
            <motion.p 
              className="text-3xl font-bold text-white"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
            >
              ${priceUSD} USD
            </motion.p>
          </div>
          {exchangeRate && (
            <div className="text-right">
              <p className="text-sm text-blue-300">Tasa BCV: {exchangeRate.toFixed(4)}</p>
              <motion.p 
                className="text-xl font-semibold text-white"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                Total: ${totalPriceUSD} USD
                {totalPriceBs && (
                  <span className="block text-lg text-blue-300">
                    Bs. {totalPriceBs.toFixed(2)}
                  </span>
                )}
              </motion.p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default GroupRunnerRegistrationForm;