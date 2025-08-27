import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { confirmPayment as confirmPaymentAPI, redeemTicket as redeemTicketAPI } from '../utils/api';
import toast from 'react-hot-toast';

export const useTicketOperations = (onSuccess?: () => void) => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);

  const confirmPayment = async (
    ticketId: string,
    paymentReference?: string,
    notes?: string
  ) => {
    if (!paymentReference) {
      toast.error('La referencia de pago es requerida');
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading('Confirmando pago y enviando email...');

    try {
      const success = await confirmPaymentAPI(token!, ticketId, {
        payment_status: 'confirmado',
        payment_reference: paymentReference,
        notes: notes,
        send_email: true
      });

      toast.dismiss(loadingToast);

      if (success) {
        toast.success('✅ Pago confirmado y email enviado exitosamente', {
          duration: 5000,
          icon: '📧'
        });
        onSuccess?.();
      } else {
        toast.error('Error al confirmar pago');
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Error confirming payment:', error);
      toast.error('Error al confirmar pago');
    } finally {
      setLoading(false);
    }
  };

  const redeemTicket = async (ticketId: string) => {
    if (!confirm('¿Está seguro de canjear esta entrada? Esta acción no se puede deshacer.')) {
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading('Canjeando entrada...');
    
    try {
      const success = await redeemTicketAPI(
        token!,
        ticketId,
        user?.email || user?.username || '',
        user?.role || ''
      );

      toast.dismiss(loadingToast);

      if (success) {
        toast.success('Entrada canjeada exitosamente');
        onSuccess?.();
      } else {
        toast.error('Error al canjear entrada');
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Error redeeming ticket:', error);
      toast.error('Error al canjear entrada');
    } finally {
      setLoading(false);
    }
  };

  return {
    confirmPayment,
    redeemTicket,
    loading
  };
};
