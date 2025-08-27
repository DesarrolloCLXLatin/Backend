import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { validateManualPayment, validateIframePayment } from '../utils/api';
import { PaymentTransaction } from '../../../types';
import toast from 'react-hot-toast';

export const usePaymentValidation = (onSuccess?: () => void) => {
  const { token } = useAuth();
  const [isValidating, setIsValidating] = useState(false);

  const validatePayment = async (
    validation: PaymentTransaction,
    approved: boolean,
    rejectionReason?: string
  ): Promise<boolean> => {
    setIsValidating(true);
    
    const loadingToast = toast.loading(
      approved 
        ? '⏳ Aprobando pago y enviando email de confirmación...' 
        : '⏳ Rechazando pago y enviando notificación...'
    );

    try {
      let success = false;
      
      if (validation.type === 'iframe') {
        success = await validateIframePayment(
          token!,
          validation.id,
          approved,
          rejectionReason
        );
      } else {
        success = await validateManualPayment(
          token!,
          validation.id,
          approved,
          rejectionReason
        );
      }

      toast.dismiss(loadingToast);

      if (success) {
        const successMessage = approved 
          ? '✅ Pago aprobado y email de confirmación enviado exitosamente' 
          : '❌ Pago rechazado y email de notificación enviado';
        
        toast.success(successMessage, {
          duration: 5000,
          icon: approved ? '📧' : '📨'
        });
        
        onSuccess?.();
      } else {
        toast.error('Error al procesar pago');
      }
      
      return success;
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Error validating payment:', error);
      toast.error('Error de conexión al validar pago');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  return {
    validatePayment,
    isValidating
  };
};