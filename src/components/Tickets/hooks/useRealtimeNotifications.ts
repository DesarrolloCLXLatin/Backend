import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

interface NotificationConfig {
  enabled: boolean;
  pollInterval?: number;
  onNewPayment?: () => void;
  onTicketSold?: () => void;
}

export const useRealtimeNotifications = ({
  enabled,
  pollInterval = 30000, // 30 segundos por defecto
  onNewPayment,
  onTicketSold
}: NotificationConfig) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<Date>(new Date());

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const checkForUpdates = async () => {
      try {
        // Aquí iría la lógica para verificar actualizaciones
        // Por ejemplo, una llamada a la API para verificar nuevos pagos o tickets
        
        // Simulación de notificación (reemplazar con lógica real)
        const hasNewPayments = Math.random() > 0.8;
        const hasNewTickets = Math.random() > 0.9;

        if (hasNewPayments) {
          toast('💰 Nuevo pago pendiente de validación', {
            icon: '🔔',
            duration: 5000
          });
          onNewPayment?.();
        }

        if (hasNewTickets) {
          toast('🎫 Nueva venta de entrada', {
            icon: '✨',
            duration: 5000
          });
          onTicketSold?.();
        }

        lastCheckRef.current = new Date();
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    };

    // Configurar intervalo
    intervalRef.current = setInterval(checkForUpdates, pollInterval);

    // Limpiar al desmontar
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, pollInterval, onNewPayment, onTicketSold]);

  const forceCheck = () => {
    // Forzar una verificación inmediata
    if (enabled) {
      // Implementar lógica de verificación
    }
  };

  return {
    lastCheck: lastCheckRef.current,
    forceCheck
  };
};