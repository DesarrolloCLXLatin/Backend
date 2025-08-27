// hooks/usePaymentProcessing.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { FormData, Bank, PaymentModalState, VoucherModalState } from '../types';
import { 
  apiPayment, 
  apiRunners, 
  uploadPaymentProof, 
  isRetryableError, 
  getErrorMessage,
  createAPIHelpers,
  type APIError 
} from '../utils/api';
import { COMMERCE_CONFIG, PAYMENT_STATUS } from '../constants';
import { toast } from 'react-toastify';

interface UsePaymentProcessProps {
  banks: Bank[];
  totalPriceUSD: number;
  onSuccess?: (data: any) => void;
}

interface PaymentResponse {
  success: boolean;
  paymentResult?: any;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
  shouldContinueRegistration?: boolean;
  transactionId?: string;
  needsRegistration?: boolean;
  groupId?: string;
  emailPending?: boolean;
  emailQueued?: boolean;
}

interface PendingEmailData {
  groupId: string;
  shouldSend: boolean;
  attempts: number;
}

// Constantes para configuración
const EMAIL_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 8000
} as const;

const PAYMENT_CONFIG = {
  emailConfirmationDelay: 3000,
  autoRetryDelay: 1500,
  reloadDelay: 2000
} as const;

// Tipos de errores de pago móvil
const P2C_ERROR_CODES = {
  AG: 'ACCOUNT_NOT_REGISTERED',
  AI: 'PLATFORM_UNAVAILABLE', 
  PC: 'DUPLICATE_REFERENCE',
  COMM_ERROR: 'COMMUNICATION_ERROR'
} as const;

export const usePaymentProcess = ({ 
  banks, 
  totalPriceUSD, 
  onSuccess 
}: UsePaymentProcessProps) => {
  // Estados principales
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentModal, setPaymentModal] = useState<PaymentModalState>({
    isOpen: false,
    status: 'processing',
    data: null
  });
  const [voucherModal, setVoucherModal] = useState<VoucherModalState>({
    isOpen: false,
    voucher: [],
    reference: '',
    control: '',
    amount: 0,
    paymentStatus: 'procesando',
    paymentDetails: null
  });

  // Estados de contexto
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [pendingRegistrationData, setPendingRegistrationData] = useState<FormData | null>(null);
  const [shouldShowRegistrationAfterVoucher, setShouldShowRegistrationAfterVoucher] = useState(false);
  const [pendingErrorData, setPendingErrorData] = useState<any>(null);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [pendingEmailData, setPendingEmailData] = useState<PendingEmailData | null>(null);

  // Refs para evitar múltiples llamadas
  const emailRetryRef = useRef<NodeJS.Timeout>();
  const paymentProcessingRef = useRef(false);

  // Utilidades
  const showNotification = useCallback((type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    if (typeof window !== 'undefined' && toast) {
      toast[type](message, {
        position: 'top-right',
        autoClose: type === 'error' ? 7000 : 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } else {
      console.log(`[${type.toUpperCase()}]: ${message}`);
    }
  }, []);

  const sleep = useCallback((ms: number): Promise<void> => 
    new Promise(resolve => setTimeout(resolve, ms)), []);

  // Validaciones
  const validateRunnerData = useCallback((runners: any[]): boolean => {
    if (!Array.isArray(runners) || runners.length === 0) {
      showNotification('error', 'Debe registrar al menos un corredor');
      return false;
    }

    for (const [index, runner] of runners.entries()) {
      const missingFields: string[] = [];
      
      if (!runner.birth_date) missingFields.push('fecha de nacimiento');
      if (!runner.email) missingFields.push('email');
      if (!runner.full_name) missingFields.push('nombre completo');
      if (!runner.identification) missingFields.push('identificación');
      if (!runner.shirt_size) missingFields.push('talla de camisa');

      if (missingFields.length > 0) {
        showNotification('error', 
          `Corredor ${index + 1}: Faltan ${missingFields.join(', ')}`);
        return false;
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(runner.email)) {
        showNotification('error', 
          `Corredor ${index + 1}: Formato de email inválido`);
        return false;
      }
    }
    return true;
  }, [showNotification]);

  // Funciones de utilidad
  const isInIframe = useCallback(() => window.self !== window.top, []);
  
  const getIframeToken = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('token');
  }, []);

  const isStorePaymentMethod = useCallback((method: string) => {
    const storeMethods = [
      'tarjeta_debito', 'tarjeta_credito', 'efectivo_bs', 'efectivo_usd',
      'transferencia_nacional_tienda', 'transferencia_internacional_tienda',
      'zelle_tienda', 'paypal_tienda'
    ];
    return storeMethods.includes(method);
  }, []);

  // Función mejorada para envío de emails con reintentos exponenciales
  const triggerConfirmationEmail = useCallback(async (
    groupId: string, 
    retries: number = EMAIL_RETRY_CONFIG.maxRetries
  ): Promise<boolean> => {
    if (!groupId) {
      console.warn('No se puede enviar email sin groupId');
      return false;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Intento ${attempt}/${retries} de envío de email para grupo ${groupId}`);
        
        const response = await fetch(`/api/runners/groups/${groupId}/trigger-confirmation-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('token') && {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            })
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log('Email de confirmación enviado:', result);
        
        showNotification('success', 
          `Email de confirmación enviado${result.emailsSent?.main ? ` a ${result.emailsSent.main}` : ''}`
        );
        
        return true;

      } catch (error: any) {
        console.error(`Error en intento ${attempt}:`, error);
        
        if (attempt === retries) {
          showNotification('error',
            'No se pudo enviar el email de confirmación. Puede solicitarlo posteriormente.'
          );
          return false;
        }
        
        // Espera exponencial con jitter
        const delay = Math.min(
          EMAIL_RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
          EMAIL_RETRY_CONFIG.maxDelay
        );
        await sleep(delay);
      }
    }
    
    return false;
  }, [showNotification, sleep]);

  // Función para crear mensajes de error user-friendly
  const createUserFriendlyErrorMessage = useCallback((
    errorCode: string, 
    clientPhone: string, 
    bankName: string
  ): string => {
    switch (errorCode) {
      case P2C_ERROR_CODES.AG:
      case P2C_ERROR_CODES.COMM_ERROR:
        return `La cuenta no está registrada en Pago Móvil.\n\nVerifica:\n• Teléfono ${clientPhone} activo en ${bankName}\n• Cédula correcta del titular\n• Pago Móvil habilitado en tu banco`;
      
      case P2C_ERROR_CODES.AI:
        return `Servicio de Pago Móvil temporalmente no disponible para ${bankName}.\n\nIntenta con otro banco o más tarde.`;
      
      case P2C_ERROR_CODES.PC:
        return 'La referencia ya fue utilizada. Se generará una nueva automáticamente.';
      
      default:
        return 'Error procesando el pago móvil. Intenta nuevamente.';
    }
  }, []);

  // Handler principal de pago P2C optimizado
  const handleP2CPayment = useCallback(async (
    data: FormData, 
    groupId?: string
  ): Promise<PaymentResponse> => {
    // Prevenir múltiples ejecuciones simultáneas
    if (paymentProcessingRef.current) {
      console.warn('Ya hay un pago en proceso');
      return { success: false, error: 'Ya hay un pago en proceso' };
    }

    paymentProcessingRef.current = true;

    try {
      // Validaciones iniciales
      if (!data.client_phone || !data.client_bank) {
        return { 
          success: false, 
          error: 'Datos bancarios incompletos para pago móvil' 
        };
      }

      if (!validateRunnerData(data.runners)) {
        return {
          success: false,
          error: 'Datos de corredores incompletos'
        };
      }

      const clientBank = banks.find(b => b.code === data.client_bank);
      const commerceBank = banks.find(b => b.code === COMMERCE_CONFIG.bankCode);

      const commonPaymentDetails = {
        type: 'p2c',
        clientPhone: data.client_phone,
        clientBankCode: data.client_bank,
        clientBankName: clientBank?.name || 'Banco desconocido',
        commercePhone: COMMERCE_CONFIG.phone,
        commerceBankCode: COMMERCE_CONFIG.bankCode,
        commerceBankName: commerceBank?.name || 'Banco comercio'
      };

      // Determinar si es iframe y preparar opciones de API
      const isIframe = isInIframe();
      const iframeToken = getIframeToken();
      const apiOptions = isIframe ? { token: iframeToken || '', isEmbedded: true } : {};

      if (groupId) {
        console.log('Procesando pago P2C para grupo existente:', groupId);

        const paymentData = {
          groupId,
          clientPhone: data.client_phone,
          clientBankCode: data.client_bank,
          clientIdentification: data.client_identification || data.registrant_identification,
          amount: totalPriceUSD,
          runnersCount: data.runners.length
        };

        // Usar la nueva API mejorada
        const paymentResult = await apiPayment.initP2C(paymentData, apiOptions);
        console.log('Respuesta del pago con grupo:', paymentResult);

        return await processPaymentResult(
          paymentResult, 
          data, 
          commonPaymentDetails, 
          groupId
        );

      } else {
        // Pre-registro sin grupo
        console.log('Procesando P2C sin grupo (pre-registro)');

        const paymentData = {
          clientPhone: data.client_phone,
          clientBankCode: data.client_bank,
          clientIdentification: data.client_identification || data.registrant_identification,
          amount: totalPriceUSD,
          runnersCount: data.runners.length,
          registrantEmail: data.registrant_email,
          registrantPhone: data.registrant_phone
        };

        const paymentResult = await apiPayment.initP2C(paymentData, apiOptions);
        console.log('Respuesta del pre-registro P2C:', paymentResult);

        if (!paymentResult.success) {
          const errorMessage = getErrorMessage(paymentResult);
          showNotification('error', errorMessage);

          return {
            success: false,
            error: errorMessage,
            errorCode: paymentResult.errorCode,
            paymentResult,
            transactionId: paymentResult.transactionId
          };
        }

        return {
          success: paymentResult.success,
          paymentResult,
          transactionId: paymentResult.transactionId,
          shouldContinueRegistration: true,
          needsRegistration: true
        };
      }

    } catch (error: any) {
      console.error('Error en pago P2C:', error);
      return handlePaymentError(error, groupId);

    } finally {
      paymentProcessingRef.current = false;
    }
  }, [banks, totalPriceUSD, validateRunnerData, showNotification, isInIframe, getIframeToken]);

  // Función auxiliar para procesar resultado de pago
  const processPaymentResult = useCallback(async (
    paymentResult: any,
    data: FormData,
    commonPaymentDetails: any,
    groupId?: string
  ): Promise<PaymentResponse> => {
    const clientBank = banks.find(b => b.code === data.client_bank);

    // Manejo de errores específicos usando la nueva API
    if (paymentResult.errorCode || !paymentResult.success) {
      const userFriendlyMessage = paymentResult.userMessage || 
        createUserFriendlyErrorMessage(
          paymentResult.errorCode || 'UNKNOWN',
          data.client_phone,
          clientBank?.name || 'el banco'
        );

      // Error PC (referencia duplicada) - reintentar automáticamente
      if (paymentResult.errorCode === 'PC') {
        showNotification('info', userFriendlyMessage);
        
        setTimeout(() => {
          handleP2CPayment(data, groupId);
        }, PAYMENT_CONFIG.autoRetryDelay);

        return { 
          success: false, 
          error: userFriendlyMessage,
          errorCode: paymentResult.errorCode,
          errorMessage: userFriendlyMessage,
          groupId,
          autoRetrying: true
        };
      }

      // Otros errores con voucher
      if (paymentResult.voucher) {
        const errorData = {
          error: userFriendlyMessage,
          errorCode: paymentResult.errorCode || 'UNKNOWN',
          errorMessage: paymentResult.errorMessage || userFriendlyMessage,
          voucher: paymentResult.voucher,
          control: paymentResult.control,
          reference: paymentResult.reference,
          amount: paymentResult.amountUSD || totalPriceUSD,
          amountBs: paymentResult.amountBs,
          exchangeRate: paymentResult.exchangeRate,
          payment_method: 'pago_movil_p2c',
          paymentDetails: commonPaymentDetails,
          groupId,
          canRetry: paymentResult.canRetry || isRetryableError(paymentResult),
          suggestedAction: paymentResult.errorCode === 'AG' ? 'verify_bank_data' : 'try_different_bank',
          isVoucherError: paymentResult.isVoucherError
        };

        setPendingErrorData(errorData);
        setVoucherModal({
          isOpen: true,
          voucher: paymentResult.voucher,
          reference: paymentResult.reference || '0',
          control: paymentResult.control || '',
          amount: paymentResult.amountUSD || totalPriceUSD,
          amountBs: paymentResult.amountBs,
          exchangeRate: paymentResult.exchangeRate,
          paymentStatus: 'rechazado',
          paymentDetails: commonPaymentDetails,
          isError: true,
          errorCode: paymentResult.errorCode,
          errorMessage: userFriendlyMessage,
          paymentMethod: 'pago_movil_p2c',
          groupId,
          canRetry: errorData.canRetry
        });

        showNotification('error', userFriendlyMessage);
        return { 
          success: false, 
          error: userFriendlyMessage,
          errorCode: paymentResult.errorCode,
          errorMessage: userFriendlyMessage,
          groupId,
          canRetry: errorData.canRetry
        };
      }

      // Error sin voucher
      showNotification('error', userFriendlyMessage);
      return { 
        success: false, 
        error: userFriendlyMessage, 
        errorCode: paymentResult.errorCode,
        groupId 
      };
    }

    // Pago exitoso
    if (paymentResult.success && paymentResult.voucher) {
      const paymentStatus = (paymentResult.status === 'approved' || paymentResult.success) 
        ? PAYMENT_STATUS.CONFIRMED 
        : paymentResult.status || 'procesando';

      setVoucherModal({
        isOpen: true,
        voucher: paymentResult.voucher,
        reference: paymentResult.reference || '',
        control: paymentResult.control || '',
        amount: paymentResult.amountUSD || totalPriceUSD,
        amountBs: paymentResult.amountBs,
        exchangeRate: paymentResult.exchangeRate,
        paymentStatus: paymentStatus,
        paymentDetails: commonPaymentDetails,
        isError: false,
        paymentMethod: 'pago_movil_p2c',
        groupId
      });

      // Envío diferido de email para pagos confirmados
      if (paymentStatus === PAYMENT_STATUS.CONFIRMED && groupId) {
        console.log('Pago P2C confirmado, programando envío de email...');
        
        emailRetryRef.current = setTimeout(async () => {
          console.log('Enviando email de confirmación después del delay...');
          await triggerConfirmationEmail(groupId);
        }, PAYMENT_CONFIG.emailConfirmationDelay);
      }

      return { 
        success: true, 
        paymentResult,
        transactionId: paymentResult.transactionId,
        shouldContinueRegistration: false,
        needsRegistration: false,
        groupId,
        emailPending: paymentStatus === PAYMENT_STATUS.CONFIRMED
      };
    }

    return { 
      success: false, 
      error: 'Respuesta inesperada del servidor',
      groupId
    };
  }, [banks, totalPriceUSD, createUserFriendlyErrorMessage, handleP2CPayment, 
      showNotification, triggerConfirmationEmail]);

  // Función para manejo de errores de pago
  const handlePaymentError = useCallback((error: any, groupId?: string): PaymentResponse => {
    const friendlyMessage = getErrorMessage(error);
    
    if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR') {
      showNotification('warning', friendlyMessage);
      return { 
        success: false, 
        error: friendlyMessage,
        errorCode: error.code,
        groupId,
        canRetry: true
      };
    }

    showNotification('error', friendlyMessage);
    return { 
      success: false, 
      error: friendlyMessage,
      errorCode: error.code,
      groupId,
      canRetry: isRetryableError(error)
    };
  }, [showNotification]);

  // Handler para pago P2C en iframe (usando nuevas APIs)
  const handleP2CPaymentIframe = useCallback(async (data: FormData): Promise<PaymentResponse> => {
    const token = getIframeToken();

    if (!token) {
      showNotification('error', 'Sesión no válida. Por favor recarga la página.');
      return { 
        success: false, 
        error: 'Token de acceso no encontrado',
        errorCode: 'MISSING_TOKEN'
      };
    }

    if (!data.client_phone || !data.client_bank) {
      return { 
        success: false, 
        error: 'Datos bancarios incompletos para pago móvil' 
      };
    }

    if (!validateRunnerData(data.runners)) {
      return {
        success: false,
        error: 'Datos de corredores incompletos'
      };
    }

    const paymentData = {
      clientPhone: data.client_phone,
      clientBankCode: data.client_bank,
      clientIdentification: data.client_identification || data.registrant_identification,
      amount: totalPriceUSD,
      runnersCount: data.runners.length,
      registrantEmail: data.registrant_email,
      registrantPhone: data.registrant_phone,
      registrantIdentification: data.registrant_identification,
      registrantIdentificationType: data.registrant_identification_type
    };

    console.log('Intentando pago P2C desde iframe:', paymentData);

    try {
      // Usar helpers de API para iframe
      const apiHelpers = createAPIHelpers(token, true);
      const paymentResult = await apiHelpers.initP2CPayment(paymentData);
      console.log('Respuesta del pago P2C iframe:', paymentResult);

      // Manejo de token inválido o expirado
      if (['INVALID_TOKEN', 'EXPIRED_TOKEN'].includes(paymentResult.errorCode)) {
        showNotification('error', 'Sesión expirada. Recargando página...');
        setTimeout(() => window.location.reload(), PAYMENT_CONFIG.reloadDelay);
        return {
          success: false,
          error: 'Sesión expirada',
          errorCode: paymentResult.errorCode
        };
      }

      const clientBank = banks.find(b => b.code === data.client_bank);
      const commerceBank = banks.find(b => b.code === COMMERCE_CONFIG.bankCode);

      const commonPaymentDetails = {
        type: 'p2c',
        clientPhone: data.client_phone,
        clientBankCode: data.client_bank,
        clientBankName: clientBank?.name || '',
        commercePhone: COMMERCE_CONFIG.phone,
        commerceBankCode: COMMERCE_CONFIG.bankCode,
        commerceBankName: commerceBank?.name || ''
      };

      return await processPaymentResult(paymentResult, data, commonPaymentDetails);

    } catch (error: any) {
      console.error('Error en pago P2C iframe:', error);
      return handlePaymentError(error);
    }
  }, [getIframeToken, validateRunnerData, showNotification, totalPriceUSD, 
      banks, processPaymentResult, handlePaymentError]);

  // Procesadores de pagos específicos optimizados
  const processStorePayment = useCallback(async (data: FormData): Promise<PaymentResponse> => {
    try {
      if (!validateRunnerData(data.runners)) {
        return { success: false, error: 'Datos de corredores incompletos' };
      }

      const groupData = {
        registrant_email: data.registrant_email,
        registrant_phone: data.registrant_phone,
        registrant_identification_type: data.registrant_identification_type,
        registrant_identification: data.registrant_identification,
        payment_method: data.payment_method,
        payment_reference: data.payment_reference || data.terminal_reference || `STORE-${Date.now()}`,
        runners: data.runners,
        store_payment: true,
        auto_confirm: true
      };

      const result = await apiRunners.registerGroup(groupData);

      if (!result.group) {
        throw new Error('Error en el registro');
      }

      // Envío diferido de email
      if (result.group.id) {
        setTimeout(() => triggerConfirmationEmail(result.group.id, 2), 1000);
      }

      return { success: true };

    } catch (error: any) {
      const friendlyMessage = getErrorMessage(error);
      return { 
        success: false, 
        error: friendlyMessage
      };
    }
  }, [validateRunnerData, triggerConfirmationEmail]);

  const processGiftPayment = useCallback(async (data: FormData): Promise<PaymentResponse> => {
    try {
      if (!validateRunnerData(data.runners)) {
        return { success: false, error: 'Datos de corredores incompletos' };
      }

      const groupData = {
        registrant_email: data.registrant_email,
        registrant_phone: data.registrant_phone,
        registrant_identification_type: data.registrant_identification_type,
        registrant_identification: data.registrant_identification,
        payment_method: 'obsequio_exonerado',
        payment_reference: `GIFT-${Date.now()}`,
        runners: data.runners,
        is_gift: true,
        employee_id: data.employee_id,
        gift_reason: data.gift_reason,
        auto_confirm: true
      };

      const result = await apiRunners.registerGroup(groupData);

      if (!result.group) {
        throw new Error('Error en el registro de obsequio');
      }

      // Envío diferido de email
      if (result.group.id) {
        setTimeout(() => triggerConfirmationEmail(result.group.id, 2), 1000);
      }

      return { success: true };

    } catch (error: any) {
      const friendlyMessage = getErrorMessage(error);
      return { 
        success: false, 
        error: friendlyMessage
      };
    }
  }, [validateRunnerData, triggerConfirmationEmail]);

  // Procesador principal optimizado
  const processRegistration = useCallback(async (data: FormData, paymentProof: File | null) => {
    if (isSubmitting) {
      console.warn('Ya hay un registro en proceso');
      return;
    }

    setIsSubmitting(true);
    setPaymentModal({ isOpen: true, status: 'processing', data: null });
    
    try {
      if (!validateRunnerData(data.runners)) {
        setPaymentModal({
          isOpen: true,
          status: 'error',
          data: { error: 'Por favor complete todos los datos de los corredores, incluyendo fecha de nacimiento' }
        });
        return;
      }

      const isStorePayment = isStorePaymentMethod(data.payment_method);
      const isGiftPayment = data.payment_method === 'obsequio_exonerado';
      const isIframe = isInIframe();
      const iframeToken = getIframeToken();

      // Procesar obsequio
      if (isGiftPayment) {
        const result = await processGiftPayment(data);
        setPaymentModal({
          isOpen: true,
          status: result.success ? 'success' : 'error',
          data: result.success ? {
            group: { group_code: 'GIFT-' + Date.now() },
            payment_method: 'obsequio_exonerado',
            isGift: true
          } : { error: result.error }
        });
        return;
      }

      // Procesar pago en tienda
      if (isStorePayment) {
        const result = await processStorePayment(data);
        setPaymentModal({
          isOpen: true,
          status: result.success ? 'success' : 'error',
          data: result.success ? {
            group: { group_code: 'STORE-' + Date.now() },
            payment_method: data.payment_method,
            isStorePayment: true
          } : { error: result.error }
        });
        return;
      }

      // Procesar pago móvil P2C
      if (data.payment_method === 'pago_movil_p2c') {
        console.log('Iniciando proceso de pago P2C...');
        
        // Normalizar datos de runners
        const normalizedRunners = data.runners.map(runner => ({
          ...runner,
          birth_date: runner.birth_date || runner.birthDate
        }));

        const groupData = {
          registrant_email: data.registrant_email,
          registrant_phone: data.registrant_phone,
          registrant_identification_type: data.registrant_identification_type,
          registrant_identification: data.registrant_identification,
          payment_method: 'pago_movil_p2c',
          payment_reference: null,
          runners: normalizedRunners
        };
      
        console.log('Creando grupo antes del pago P2C:', groupData);
        
        const groupResult = await apiRunners.registerGroup(groupData);
        console.log('Grupo creado:', groupResult);
      
        if (!groupResult.group?.id) {
          throw new Error('Error creando el grupo antes del pago');
        }
        
        setCurrentGroupId(groupResult.group.id);
      
        // Procesar el pago CON el groupId
        const paymentResponse = isIframe && iframeToken 
          ? await handleP2CPaymentIframe(data)
          : await handleP2CPayment(data, groupResult.group.id);
      
        if (!paymentResponse.success) {
          console.error('Pago P2C falló para el grupo:', groupResult.group.id);
          
          if (!voucherModal.isOpen) {
            setPaymentModal({
              isOpen: true,
              status: 'error',
              data: { 
                error: paymentResponse.error,
                errorCode: paymentResponse.errorCode,
                errorMessage: paymentResponse.errorMessage,
                group: groupResult.group
              }
            });
          }
          return;
        }
      
        console.log('Pago P2C exitoso, grupo confirmado automáticamente');
        
        if (!voucherModal.isOpen) {
          setPaymentModal({
            isOpen: true,
            status: 'success',
            data: {
              group: groupResult.group,
              payment_method: 'pago_movil_p2c',
              paymentCompleted: true,
              transactionId: paymentResponse.transactionId,
              emailSent: paymentResponse.emailPending || false
            }
          });
        } else {
          setPendingRegistrationData({
            ...data,
            groupId: groupResult.group.id,
            groupCode: groupResult.group.group_code
          } as any);
        }
        return;
      }

      // Flujo normal para otros métodos de pago
      let paymentProofUrl = null;
      if (paymentProof) {
        try {
          paymentProofUrl = await uploadPaymentProof(paymentProof);
        } catch (uploadError: any) {
          console.error('Error subiendo comprobante:', uploadError);
          showNotification('warning', 'Error subiendo comprobante, pero continuando con el registro');
        }
      }

      const groupData = {
        registrant_email: data.registrant_email,
        registrant_phone: data.registrant_phone,
        registrant_identification_type: data.registrant_identification_type,
        registrant_identification: data.registrant_identification,
        payment_method: data.payment_method,
        payment_reference: data.payment_reference,
        payment_proof_url: paymentProofUrl,
        runners: data.runners.map(runner => ({
          ...runner,
          birth_date: runner.birth_date || runner.birthDate
        }))
      };

      console.log('Enviando datos del grupo:', groupData);
      const result = await apiRunners.registerGroup(groupData);
      console.log('Respuesta del registro:', result);

      if (!result.group) {
        throw new Error('Error en la respuesta del servidor: no se recibió información del grupo');
      }

      setPaymentModal({
        isOpen: true,
        status: 'success',
        data: {
          group: result.group,
          payment_method: data.payment_method
        }
      });

    } catch (error: any) {
      console.error('Error general:', error);
      const friendlyMessage = getErrorMessage(error);
      setPaymentModal({
        isOpen: true,
        status: 'error',
        data: { error: friendlyMessage }
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, validateRunnerData, isStorePaymentMethod, processGiftPayment, 
      processStorePayment, isInIframe, getIframeToken, handleP2CPaymentIframe, 
      handleP2CPayment, voucherModal.isOpen, showNotification]);

  // Handlers de modales optimizados
  const handleClosePaymentModal = useCallback(() => {
    setPaymentModal({ isOpen: false, status: 'processing', data: null });
    setCurrentGroupId(null);
    setPendingEmailData(null);
  }, []);

  const handleCloseVoucherModal = useCallback(() => {
    const wasPaymentConfirmed = voucherModal.paymentStatus === PAYMENT_STATUS.CONFIRMED;
    const wasError = voucherModal.isError;
    const isIframe = isInIframe();
    
    const savedGroupId = currentGroupId;
    const savedEmailData = pendingEmailData;
    
    // Resetear estado del voucher modal
    setVoucherModal({
      isOpen: false,
      voucher: [],
      reference: '',
      control: '',
      amount: 0,
      paymentStatus: 'procesando',
      paymentDetails: null,
      isError: false,
      errorCode: undefined,
      errorMessage: undefined,
      paymentMethod: undefined
    });

    // Mostrar error si existe
    if (wasError && pendingErrorData) {
      setPaymentModal({
        isOpen: true,
        status: 'error',
        data: pendingErrorData
      });
      setPendingErrorData(null);
      return;
    }

    if (wasError) return;

    // Envío diferido de email si el pago fue confirmado
    if (wasPaymentConfirmed && savedEmailData?.shouldSend && savedEmailData.groupId) {
      console.log('Iniciando envío de email de confirmación...');
      
      setTimeout(async () => {
        const emailSent = await triggerConfirmationEmail(savedEmailData.groupId, 3);
        
        if (emailSent) {
          console.log('Proceso de email completado exitosamente');
        } else {
          console.warn('El email no pudo ser enviado, el usuario fue notificado');
        }
        
        setPendingEmailData(null);
      }, 1500);
    }

    // Mostrar modal de éxito si el pago fue confirmado
    if (wasPaymentConfirmed && savedGroupId && pendingRegistrationData) {
      setPaymentModal({
        isOpen: true,
        status: 'success',
        data: {
          group: {
            id: savedGroupId,
            group_code: (pendingRegistrationData as any).groupCode,
            ...pendingRegistrationData
          },
          payment_method: 'pago_movil_p2c',
          paymentCompleted: true,
          emailSent: savedEmailData?.shouldSend || false
        }
      });
      
      setPendingRegistrationData(null);
      setPaymentReference(null);
      setShouldShowRegistrationAfterVoucher(false);
      setCurrentGroupId(null);
    }

    // Callback para iframe
    if (isIframe && wasPaymentConfirmed && pendingRegistrationData && onSuccess) {
      onSuccess({
        transactionId: paymentReference,
        needsRegistration: true,
        formData: pendingRegistrationData,
        voucherData: {
          voucher: voucherModal.voucher,
          reference: voucherModal.reference,
          control: voucherModal.control,
          amount: voucherModal.amount
        },
        emailQueued: savedEmailData?.shouldSend || false
      });
    }
  }, [voucherModal, isInIframe, currentGroupId, pendingEmailData, pendingErrorData, 
      pendingRegistrationData, triggerConfirmationEmail, paymentReference, onSuccess]);

  const handleVoucherStatusUpdate = useCallback((newStatus: string) => {
    setVoucherModal(prev => ({ ...prev, paymentStatus: newStatus }));
    
    if (newStatus === PAYMENT_STATUS.CONFIRMED && !voucherModal.isError) {
      setTimeout(() => {
        handleCloseVoucherModal();
      }, 1000);
    }
  }, [voucherModal.isError, handleCloseVoucherModal]);

  // Función para reenvío manual de email
  const resendConfirmationEmail = useCallback(async (groupId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/runners/groups/${groupId}/resend-confirmation-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al reenviar email');
      }

      const result = await response.json();
      showNotification('success', 'Email de confirmación reenviado exitosamente');
      return true;

    } catch (error) {
      console.error('Error reenviando email:', error);
      showNotification('error', 'No se pudo reenviar el email de confirmación');
      return false;
    }
  }, [showNotification]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (emailRetryRef.current) {
        clearTimeout(emailRetryRef.current);
      }
      setPendingEmailData(null);
      setPendingErrorData(null);
      setPendingRegistrationData(null);
      paymentProcessingRef.current = false;
    };
  }, []);

  return {
    // Estados
    isSubmitting,
    paymentModal,
    voucherModal,
    pendingEmailData,
    
    // Funciones principales
    processRegistration,
    handleP2CPayment,
    processStorePayment,
    processGiftPayment,
    
    // Handlers de UI
    handleClosePaymentModal,
    handleCloseVoucherModal,
    handleVoucherStatusUpdate,
    
    // Utilidades
    triggerConfirmationEmail,
    resendConfirmationEmail
  };
};