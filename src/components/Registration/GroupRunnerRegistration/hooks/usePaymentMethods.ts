// hooks/usePaymentMethods.ts
import { useState, useEffect } from 'react';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../../../../contexts/AuthContext';

export interface PaymentMethodConfig {
  payment_method: string;
  display_name: string;
  requires_proof: boolean;
  auto_confirm: boolean;
  requires_reference: boolean;
  display_order: number;
  isStoreMethod?: boolean;
  isGift?: boolean;
  isOnlineOnly?: boolean;
  config?: any;
}

interface UsePaymentMethodsProps {
  tokenType?: 'public_token' | 'seller_token' | null;
  isEmbedded?: boolean;
  token?: string;
}

export const usePaymentMethods = ({ tokenType, isEmbedded, token }: UsePaymentMethodsProps = {}) => {
  const { user } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenConfig, setTokenConfig] = useState<any>(null);

  useEffect(() => {
    const fetchTokenConfig = async () => {
      if (!token) return;
      
      try {
        const response = await fetch(`/api/tickets/payment/pago-movil/public/token-info?token=${token}`);
        if (response.ok) {
          const data = await response.json();
          setTokenConfig(data);
        }
      } catch (error) {
        console.error('Error fetching token config:', error);
      }
    };

    if (token) {
      fetchTokenConfig();
    }
  }, [token]);

  useEffect(() => {
    const fetchPaymentMethods = async () => {
      // Si es un token embebido sin usuario
      if (isEmbedded && !user) {
        // Usar métodos del token si están definidos
        if (tokenConfig?.allowed_payment_methods) {
          setPaymentMethods(getMethodsFromTokenConfig(tokenConfig.allowed_payment_methods));
        } else if (tokenType === 'public_token') {
          setPaymentMethods(getPublicPaymentMethods());
        } else {
          setPaymentMethods(getDefaultPaymentMethods());
        }
        setIsLoading(false);
        return;
      }

      if (!user) {
        setPaymentMethods([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetchAPI('/api/payment-methods/allowed');
        
        if (response.success && response.methods) {
          let methods = response.methods;
          
          // Si hay configuración de token, filtrar según los métodos permitidos
          if (tokenConfig?.allowed_payment_methods && tokenConfig.allowed_payment_methods.length > 0) {
            methods = methods.filter(m => 
              tokenConfig.allowed_payment_methods.includes(m.payment_method)
            );
          } else if (tokenType === 'public_token') {
            // Si es token público sin configuración específica, usar solo online
            methods = filterOnlineOnlyMethods(methods);
          }
          
          setPaymentMethods(methods);
        } else {
          // Fallback según el tipo de token
          if (tokenConfig?.allowed_payment_methods) {
            setPaymentMethods(getMethodsFromTokenConfig(tokenConfig.allowed_payment_methods));
          } else if (tokenType === 'public_token') {
            setPaymentMethods(getPublicPaymentMethods());
          } else {
            setPaymentMethods(getDefaultPaymentMethods());
          }
        }
      } catch (err) {
        console.error('Error fetching payment methods:', err);
        setError('Error cargando métodos de pago');
        // Usar métodos apropiados según el contexto
        if (tokenConfig?.allowed_payment_methods) {
          setPaymentMethods(getMethodsFromTokenConfig(tokenConfig.allowed_payment_methods));
        } else if (tokenType === 'public_token') {
          setPaymentMethods(getPublicPaymentMethods());
        } else {
          setPaymentMethods(getDefaultPaymentMethods());
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaymentMethods();
  }, [user, tokenType, isEmbedded, tokenConfig]);

  const getMethodsFromTokenConfig = (allowedMethods: string[]): PaymentMethodConfig[] => {
    const methodsMap: Record<string, PaymentMethodConfig> = {
      'pago_movil_p2c': {
        payment_method: 'pago_movil_p2c',
        display_name: 'Pago Móvil P2C (Automático)',
        requires_proof: false,
        auto_confirm: true,
        requires_reference: false,
        display_order: 1,
        isOnlineOnly: true
      },
      'tarjeta_debito': {
        payment_method: 'tarjeta_debito',
        display_name: 'Tarjeta de Débito',
        requires_proof: false,
        auto_confirm: true,
        requires_reference: false,
        display_order: 2,
        isOnlineOnly: true,
        isStoreMethod: true
      },
      'tarjeta_credito': {
        payment_method: 'tarjeta_credito',
        display_name: 'Tarjeta de Crédito',
        requires_proof: false,
        auto_confirm: true,
        requires_reference: false,
        display_order: 3,
        isOnlineOnly: true,
        isStoreMethod: true
      },
      'zelle': {
        payment_method: 'zelle',
        display_name: 'Zelle',
        requires_proof: true,
        auto_confirm: false,
        requires_reference: true,
        display_order: 4,
        isOnlineOnly: true
      },
      'paypal': {
        payment_method: 'paypal',
        display_name: 'PayPal',
        requires_proof: true,
        auto_confirm: false,
        requires_reference: true,
        display_order: 5,
        isOnlineOnly: true
      },
      'transferencia_nacional': {
        payment_method: 'transferencia_nacional',
        display_name: 'Transferencia Nacional',
        requires_proof: true,
        auto_confirm: false,
        requires_reference: true,
        display_order: 6
      },
      'transferencia_internacional': {
        payment_method: 'transferencia_internacional',
        display_name: 'Transferencia Internacional',
        requires_proof: true,
        auto_confirm: false,
        requires_reference: true,
        display_order: 7,
        isOnlineOnly: true
      },
      'efectivo_bs': {
        payment_method: 'efectivo_bs',
        display_name: 'Efectivo Bolívares',
        requires_proof: false,
        auto_confirm: true,
        requires_reference: false,
        display_order: 8,
        isStoreMethod: true
      },
      'efectivo_usd': {
        payment_method: 'efectivo_usd',
        display_name: 'Efectivo USD',
        requires_proof: false,
        auto_confirm: true,
        requires_reference: false,
        display_order: 9,
        isStoreMethod: true
      },
      'tienda': {
        payment_method: 'tienda',
        display_name: 'Pago en Tienda',
        requires_proof: false,
        auto_confirm: true,
        requires_reference: false,
        display_order: 10,
        isStoreMethod: true
      },
      'obsequio_exonerado': {
        payment_method: 'obsequio_exonerado',
        display_name: 'Obsequio Exonerado',
        requires_proof: false,
        auto_confirm: true,
        requires_reference: false,
        display_order: 11,
        isGift: true
      }
    };

    return allowedMethods
      .map(method => methodsMap[method])
      .filter(Boolean)
      .sort((a, b) => a.display_order - b.display_order);
  };

  const filterOnlineOnlyMethods = (methods: PaymentMethodConfig[]): PaymentMethodConfig[] => {
    const onlineMethodIds = [
      'pago_movil_p2c',
      'pago_movil',
      'tarjeta_debito',
      'tarjeta_credito',
      'zelle',
      'paypal',
      'transferencia_internacional'
    ];

    return methods.filter(method => 
      onlineMethodIds.includes(method.payment_method) && 
      !method.isGift
    );
  };

  const getPublicPaymentMethods = (): PaymentMethodConfig[] => {
    return getMethodsFromTokenConfig([
      'pago_movil_p2c',
      'tarjeta_debito',
      'tarjeta_credito',
      'zelle',
      'paypal'
    ]);
  };

  const getDefaultPaymentMethods = (): PaymentMethodConfig[] => {
    return getMethodsFromTokenConfig([
      'pago_movil_p2c',
      'transferencia_nacional',
      'transferencia_internacional',
      'zelle',
      'paypal'
    ]);
  };

  return {
    paymentMethods,
    isLoading,
    error,
    userRole: user?.role || 'guest',
    tokenConfig
  };
};