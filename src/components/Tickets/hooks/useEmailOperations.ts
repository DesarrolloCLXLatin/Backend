import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { resendTicketEmail } from '../utils/api';
import toast from 'react-hot-toast';

export const useEmailOperations = (onSuccess?: () => void) => {
  const { token } = useAuth();
  const [sendingEmail, setSendingEmail] = useState(false);

  const resendEmail = async (ticketId: string) => {
    setSendingEmail(true);
    const loadingToast = toast.loading('Reenviando email...');
    
    try {
      const success = await resendTicketEmail(token!, ticketId);
      
      toast.dismiss(loadingToast);
      
      if (success) {
        toast.success('📧 Email reenviado exitosamente', {
          duration: 5000
        });
        onSuccess?.();
      } else {
        toast.error('Error al reenviar email');
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Error resending email:', error);
      toast.error('Error al reenviar email');
    } finally {
      setSendingEmail(false);
    }
  };

  return {
    resendEmail,
    sendingEmail
  };
};