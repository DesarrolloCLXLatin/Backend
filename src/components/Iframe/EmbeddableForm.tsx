import React, { useState, useEffect } from 'react';
import RunnerRegistrationForm from '../Registration/GroupRunnerRegistration/index';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface TokenInfo {
  token_type: 'public_token' | 'seller_token';
  expires_at: string;
  allowed_payment_methods?: string[];
  commission_rate?: number;
  max_transactions?: number;
  transactions_remaining?: number | 'unlimited';
  // Nuevos campos del endpoint corregido
  id?: string;
  allowed_domains?: string[];
  metadata?: {
    form_type?: string;
    allowed_payment_methods?: string[];
  };
}

interface RegistrationState {
  step: 'form' | 'payment_processing' | 'registration_pending' | 'completed' | 'error';
  transactionId?: string;
  pendingData?: any;
  error?: string;
  groupCode?: string;
}

const EmbeddableForm: React.FC = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenError, setTokenError] = useState<string>('');
  const [registrationState, setRegistrationState] = useState<RegistrationState>({
    step: 'form'
  });

  useEffect(() => {
    if (token) {
      fetchTokenInfo();
    } else {
      setTokenError('Token no proporcionado');
    }
  }, [token]);

  const fetchTokenInfo = async () => {
    try {
      console.log('🔄 Validando token:', token?.substring(0, 12) + '...');
      
      // CAMBIO 1: Usar el endpoint correcto de validación
      const response = await fetch('/api/tickets/payment/pago-movil/validate-iframe-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Iframe-Token': token, // Enviar token en header también
        },
        body: JSON.stringify({ 
          token,
          origin: window.location.origin // Enviar origen actual
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Error de validación:', error);
        throw new Error(error.message || 'Token inválido');
      }
      
      const data = await response.json();
      console.log('✅ Respuesta de validación:', data);
      
      // CAMBIO 2: Verificar estructura de respuesta del nuevo endpoint
      if (!data.success) {
        throw new Error(data.message || 'Token inválido');
      }
      
      // CAMBIO 3: Extraer información del token de la nueva estructura
      const tokenData = data.token_info;
      
      // Verificar si el token ha expirado
      if (new Date(tokenData.expires_at) < new Date()) {
        throw new Error('El token ha expirado');
      }
      
      // Verificar límite de transacciones si aplica
      if (tokenData.transactions_remaining !== 'unlimited' && tokenData.transactions_remaining <= 0) {
        throw new Error('Se ha alcanzado el límite de transacciones para este token');
      }
      
      // CAMBIO 4: Mapear la respuesta a la estructura esperada
      const mappedTokenInfo: TokenInfo = {
        token_type: tokenData.token_type,
        expires_at: tokenData.expires_at,
        transactions_remaining: tokenData.transactions_remaining,
        allowed_payment_methods: tokenData.metadata?.allowed_payment_methods || [],
        commission_rate: 0, // Valor por defecto
        max_transactions: tokenData.max_transactions,
        id: tokenData.id,
        allowed_domains: tokenData.allowed_domains,
        metadata: tokenData.metadata
      };
      
      console.log('✅ Token validado correctamente:', mappedTokenInfo);
      setTokenInfo(mappedTokenInfo);
      
    } catch (error) {
      console.error('❌ Error fetching token info:', error);
      setTokenError(error.message || 'Error al validar el token');
    }
  };

  // Manejar el éxito del formulario (esto se llama después del pago P2C)
  const handleFormSuccess = async (paymentData: any) => {
    console.log('📄 Form success data:', paymentData);
    
    // Si es un pago P2C, el componente hijo ya procesó el pago
    // y tenemos los datos de la transacción
    if (paymentData.transactionId && paymentData.needsRegistration) {
      setRegistrationState({
        step: 'registration_pending',
        transactionId: paymentData.transactionId,
        pendingData: paymentData.formData
      });
      
      // Completar el registro
      await completeRegistration(paymentData.transactionId, paymentData.formData);
    } else {
      // Otros métodos de pago o flujo normal
      handleSuccess(paymentData.groupCode);
    }
  };

  const completeRegistration = async (transactionId: string, formData: any) => {
    try {
      console.log('🔄 Completando registro para transacción:', transactionId);
      setRegistrationState(prev => ({ ...prev, step: 'payment_processing' }));

      const runnersWithGender = formData.runners.map(runner => ({
        ...runner,
        gender: runner.gender || 'M' // Por defecto masculino si no se especifica
      }))
      
      const response = await fetch('/api/payment-gateway/iframe/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Iframe-Token': token
        },
        body: JSON.stringify({
          token,
          transactionId,
          registrant_email: formData.registrant_email,
          registrant_phone: formData.registrant_phone,
          registrant_identification_type: formData.registrant_identification_type,
          registrant_identification: formData.registrant_identification,
          runners: runnersWithGender // Enviar con género
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('❌ Error en complete-registration:', result);
        throw new Error(result.message || 'Error al completar el registro');
      }

      console.log('✅ Registro completado:', result);
      handleSuccess(result.group.group_code);
      
    } catch (error) {
      console.error('❌ Error completando registro:', error);
      setRegistrationState({
        step: 'error',
        error: error.message || 'Error al completar el registro'
      });
    }
  };

  const handleSuccess = (groupCode: string) => {
    console.log('🎉 Registro exitoso con código:', groupCode);
    setRegistrationState({
      step: 'completed',
      groupCode
    });
    
    // Notificar al padre
    try {
      window.parent.postMessage({ 
        type: 'REGISTRATION_SUCCESS',
        data: {
          groupCode,
          token,
          timestamp: new Date().toISOString()
        }
      }, '*');
      console.log('📤 Mensaje enviado al padre');
    } catch (error) {
      console.error('❌ Error enviando mensaje al padre:', error);
    }
  };

  const handleRetry = () => {
    console.log('🔄 Intentando nuevamente...');
    setRegistrationState({ step: 'form' });
    setTokenError('');
    if (token) {
      fetchTokenInfo();
    }
  };

  // Si hay error de token
  if (tokenError) {
    return (
      <div className="min-h-screen bg-black p-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-500 mr-3" />
            <h2 className="text-xl font-bold text-gray-900">Error de Acceso</h2>
          </div>
          <p className="text-gray-600 mb-4">{tokenError}</p>
          
          {/* CAMBIO 6: Mostrar información de debug en desarrollo */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-3 bg-gray-100 rounded text-xs">
              <strong>Debug Info:</strong><br/>
              Token: {token?.substring(0, 12)}...<br/>
              Origin: {window.location.origin}<br/>
              URL: {window.location.href}
            </div>
          )}
          
          <div className="flex gap-2">
            <button
              onClick={handleRetry}
              className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 transition-colors"
            >
              Intentar nuevamente
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
            >
              Recargar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Si no hay token info todavía
  if (!tokenInfo) {
    return (
      <div className="min-h-screen bg-black p-4 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 text-orange-600 animate-spin mx-auto mb-4" />
          <p className="text-white">Validando acceso...</p>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-gray-400 text-xs mt-2">
              Token: {token?.substring(0, 12)}...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Estado de procesamiento
  if (registrationState.step === 'payment_processing') {
    return (
      <div className="min-h-screen bg-black p-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <Loader className="w-12 h-12 text-orange-600 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Completando tu registro...
          </h3>
          <p className="text-gray-600">
            Por favor no cierres esta ventana
          </p>
        </div>
      </div>
    );
  }

  // Estado de error
  if (registrationState.step === 'error') {
    return (
      <div className="min-h-screen bg-black p-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-500 mr-3" />
            <h2 className="text-xl font-bold text-gray-900">Error en el Registro</h2>
          </div>
          <p className="text-gray-600 mb-6">{registrationState.error}</p>
          <button
            onClick={handleRetry}
            className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 transition-colors"
          >
            Intentar nuevamente
          </button>
        </div>
      </div>
    );
  }

  // Estado completado
  if (registrationState.step === 'completed') {
    return (
      <div className="min-h-screen bg-black p-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            ¡Registro Exitoso!
          </h2>
          <p className="text-gray-600 mb-4">
            Tu grupo ha sido registrado correctamente
          </p>
          {registrationState.groupCode && (
            <div className="bg-gray-100 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-1">Código de grupo:</p>
              <p className="text-2xl font-bold text-orange-600">
                {registrationState.groupCode}
              </p>
            </div>
          )}
          <p className="text-sm text-gray-500">
            Guarda este código para futuras referencias
          </p>
        </div>
      </div>
    );
  }

  // Formulario principal
  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-4xl mx-auto">
        {/* CAMBIO 7: Mostrar información del token solo si es relevante */}
        {tokenInfo.commission_rate && tokenInfo.commission_rate > 0 && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-700">
              Este enlace incluye una comisión del {(tokenInfo.commission_rate * 100).toFixed(0)}%
            </p>
          </div>
        )}

        {/* Mostrar información de transacciones restantes para tokens públicos */}
        {tokenInfo.token_type === 'public_token' && 
         tokenInfo.transactions_remaining !== 'unlimited' && 
         tokenInfo.transactions_remaining < 10 && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-700">
              ⚠️ Quedan {tokenInfo.transactions_remaining} usos disponibles en este enlace
            </p>
          </div>
        )}
        
        <RunnerRegistrationForm 
          isEmbedded={true}
          token={token}
          tokenType={tokenInfo.token_type}
          onSuccess={handleFormSuccess}
          // CAMBIO 8: Pasar más información del token al formulario
          config={{
            allowedPaymentMethods: tokenInfo.metadata?.allowed_payment_methods || tokenInfo.allowed_payment_methods,
            showHeader: false, // No mostrar header en iframe
            compactMode: true,  // Modo compacto para iframe
            formType: tokenInfo.metadata?.form_type || 'runner',
            tokenInfo: tokenInfo // Pasar toda la info del token
          }}
        />
      </div>
    </div>
  );
};

export default EmbeddableForm;