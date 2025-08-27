// utils/api.ts
import { API_BASE_URL } from '../constants';

// Interfaces
interface FetchAPIOptions extends RequestInit {
  token?: string;
  isEmbedded?: boolean;
}

interface APIError extends Error {
  code?: string;
  details?: any;
  canRetry?: boolean;
  isVoucherError?: boolean;
  voucher?: string | string[];
}

interface UploadResponse {
  success: boolean;
  message: string;
  url?: string;
  filename?: string;
  originalName?: string;
  size?: number;
}

// Utility functions para análisis de errores
const detectVoucherError = (voucher: string | string[]): { isError: boolean; errorType?: string } => {
  if (!voucher) return { isError: false };
  
  const voucherText = Array.isArray(voucher) ? voucher.join('\n') : voucher.toString();
  const errorPatterns = [
    'ERROR_DE_TRANSACCION',
    'COMMUNICATION_ERROR', 
    'TIMEOUT_ERROR',
    'INVALID_REQUEST',
    'SERVICE_UNAVAILABLE',
    'COMM_ERROR'
  ];
  
  for (const pattern of errorPatterns) {
    if (voucherText.includes(pattern)) {
      return { isError: true, errorType: pattern };
    }
  }
  
  return { isError: false };
};

const createUserFriendlyMessage = (errorCode: string, originalMessage?: string): string => {
  const errorMessages: Record<string, string> = {
    'COMM_ERROR': 'Error de comunicación con el servicio de pagos. Intenta nuevamente en unos minutos.',
    'TIMEOUT': 'La operación tardó demasiado tiempo. Intenta nuevamente.',
    'TIMEOUT_ERROR': 'Tiempo de espera agotado. Verifica tu conexión e intenta nuevamente.',
    'ERROR_DE_TRANSACCION': 'Error en la transacción. Verifica los datos bancarios e intenta nuevamente.',
    'TRANSACTION_ERROR': 'Error procesando la transacción. Verifica los datos e intenta nuevamente.',
    'GATEWAY_ERROR': 'Error en el servicio de pagos. Intenta nuevamente en unos minutos.',
    'VALIDATION_ERROR': 'Error de validación. Revisa los datos ingresados.',
    'INVALID_PHONE': 'Formato de teléfono inválido. Debe ser 04XXXXXXXXX.',
    'INVALID_BANK': 'Código de banco inválido. Selecciona un banco válido.',
    'GROUP_NOT_FOUND': 'Grupo de registro no encontrado.',
    'FORBIDDEN': 'No tienes permisos para realizar esta acción.',
    'ALREADY_PAID': 'Este grupo ya tiene un pago confirmado.',
    'PENDING_PAYMENT': 'Ya existe un pago pendiente para este grupo.',
    'INSUFFICIENT_INVENTORY': 'No hay suficiente inventario disponible.',
    'DUPLICATE_REFERENCE': 'Esta referencia ya fue utilizada.',
    'NETWORK_ERROR': 'Error de conexión. Verifica tu internet e intenta nuevamente.',
    'SERVICE_UNAVAILABLE': 'Servicio temporalmente no disponible. Intenta más tarde.',
    'INVALID_TOKEN': 'Sesión inválida. Recarga la página.',
    'EXPIRED_TOKEN': 'Sesión expirada. Recarga la página.',
    'MISSING_TOKEN': 'Sesión requerida. Recarga la página.',
    // Errores P2C específicos
    'AG': 'Cuenta no registrada en Pago Móvil. Verifica teléfono, banco y cédula.',
    'AI': 'Pago Móvil no disponible para este banco. Intenta con otro banco.',
    'PC': 'Referencia duplicada. Se generará una nueva automáticamente.'
  };

  return errorMessages[errorCode] || originalMessage || 'Error desconocido. Intenta nuevamente.';
};

// Función base mejorada para hacer peticiones a la API
export const fetchAPI = async (url: string, options?: FetchAPIOptions) => {
  const startTime = Date.now();
  
  try {
    // Determinar qué tipo de autenticación usar
    const headers: any = {
      'Content-Type': 'application/json',
      ...options?.headers
    };

    // Manejar token de iframe si está presente
    if (options?.isEmbedded && options?.token) {
      headers['X-Iframe-Token'] = options.token;
      console.log(`🔐 API Call con iframe token a: ${url}`);
    } else {
      // Mantener compatibilidad con autenticación normal
      const authToken = localStorage.getItem('token');
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log(`🔐 API Call con auth token a: ${url}`);
      }
    }

    // Timeout por defecto de 30 segundos, 45 para pagos
    const timeout = url.includes('payment') ? 45000 : 30000;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log(`📡 Response from ${url}:`, {
      status: response.status,
      ok: response.ok,
      time: `${Date.now() - startTime}ms`
    });

    // Intentar parsear respuesta
    let data: any;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      data = { message: 'Error en la respuesta del servidor' };
    }

    if (!response.ok) {
      console.error(`❌ Error response from ${url}:`, data);
      
      // Analizar si hay voucher con error
      let voucherError = { isError: false };
      if (data.voucher) {
        voucherError = detectVoucherError(data.voucher);
      }

      // Crear error estructurado
      const apiError: APIError = new Error(
        createUserFriendlyMessage(data.errorCode, data.message || data.error)
      );
      
      apiError.code = data.errorCode || `HTTP_${response.status}`;
      apiError.details = data;
      apiError.canRetry = ['COMM_ERROR', 'TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE'].includes(data.errorCode);
      apiError.isVoucherError = voucherError.isError;
      apiError.voucher = data.voucher;

      throw apiError;
    }

    console.log(`✅ Success response from ${url}:`, data);
    return data;

  } catch (error: any) {
    console.error(`Error fetching ${url}:`, error);

    // Si es un error que ya procesamos, re-lanzarlo
    if (error.code && error.details) {
      throw error;
    }

    // Clasificar errores de red
    let errorCode = 'NETWORK_ERROR';
    let errorMessage = 'Error de conexión';

    if (error.name === 'AbortError') {
      errorCode = 'TIMEOUT';
      errorMessage = 'Tiempo de espera agotado';
    } else if (error.message?.includes('fetch')) {
      errorCode = 'NETWORK_ERROR';
      errorMessage = 'Error de red. Verifica tu conexión a internet';
    } else if (error.message?.includes('Failed to fetch')) {
      errorCode = 'CONNECTION_ERROR';
      errorMessage = 'No se pudo conectar al servidor';
    }

    const apiError: APIError = new Error(errorMessage);
    apiError.code = errorCode;
    apiError.canRetry = true;
    
    throw apiError;
  }
};

// Función mejorada para subir archivos
export const uploadPaymentProof = async (
  file: File, 
  options?: { token?: string; isEmbedded?: boolean }
): Promise<string | null> => {
  try {
    const formData = new FormData();
    formData.append('payment_proof', file);
    
    const headers: HeadersInit = {};
    
    // Manejar token de iframe
    if (options?.isEmbedded && options?.token) {
      headers['X-Iframe-Token'] = options.token;
    } else {
      const authToken = localStorage.getItem('token');
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
    }
    
    console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos para uploads

    const response = await fetch(`${API_BASE_URL}/api/upload/payment-proof`, {
      method: 'POST',
      body: formData,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data: UploadResponse = await response.json();
    console.log('Upload response:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Error al subir archivo');
    }
    
    if (data.success && data.url) {
      return data.url;
    }
    
    throw new Error(data.message || 'Error al procesar el archivo');
  } catch (error: any) {
    console.error('Error uploading file:', error);
    
    if (error.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado subiendo archivo');
    }
    
    throw error;
  }
};

// Función para eliminar archivo de pago
export const deletePaymentProof = async (
  filename: string,
  options?: { token?: string; isEmbedded?: boolean }
): Promise<boolean> => {
  try {
    const response = await fetchAPI(`/api/upload/payment-proof/${filename}`, {
      method: 'DELETE',
      ...options
    });
    
    return response.success || false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

// API calls específicas mejoradas
export const apiBanks = {
  getAll: async (options?: { token?: string; isEmbedded?: boolean }) => {
    try {
      return await fetchAPI('/api/payment-gateway/banks', options);
    } catch (error: any) {
      console.error('Error fetching banks:', error);
      // Retornar lista vacía en caso de error para no romper la UI
      return { success: false, banks: [], error: error.message };
    }
  }
};

export const apiExchangeRate = {
  getCurrent: async (options?: { token?: string; isEmbedded?: boolean }) => {
    try {
      return await fetchAPI('/api/exchange-rates/current', options);
    } catch (error: any) {
      console.error('Error fetching exchange rate:', error);
      // Retornar tasa por defecto en caso de error
      return { 
        success: false, 
        rateUSD: 40, 
        error: error.message,
        fallback: true 
      };
    }
  }
};

export const apiInventory = {
  getAll: async (options?: { token?: string; isEmbedded?: boolean }) => {
    try {
      // Si es iframe, usar endpoint específico
      const endpoint = options?.isEmbedded && options?.token 
        ? '/api/inventory/iframe' 
        : '/api/inventory';
      
      console.log(`📋 Fetching inventory from: ${endpoint}`);
      return await fetchAPI(endpoint, options);
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      return { success: false, inventory: [], error: error.message };
    }
  }
};

export const apiRunners = {
  registerGroup: async (data: any, options?: { token?: string; isEmbedded?: boolean }) => {
    return await fetchAPI('/api/runners/register-group', {
      method: 'POST',
      body: JSON.stringify(data),
      ...options
    });
  }
};

export const apiPayment = {
  initP2C: async (data: any, options?: { token?: string; isEmbedded?: boolean }) => {
    console.log('📤 Enviando datos P2C al backend:', {
      ...data,
      amountInfo: {
        amountUSD: data.amount,
        runnersCount: data.runnersCount,
        note: 'El backend calculará el monto en Bs usando la tasa BCV actual'
      },
      isEmbedded: options?.isEmbedded,
      hasToken: !!options?.token
    });
    
    // Si es iframe, usar endpoint específico
    const endpoint = options?.isEmbedded && options?.token
      ? '/api/payment-gateway/mobile-payment/p2c/public/init'
      : '/api/payment-gateway/mobile-payment/p2c/init';
    
    try {
      const result = await fetchAPI(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          token: options?.token // Incluir token en el body para iframe
        }),
        ...options
      });

      console.log('📥 Respuesta del backend P2C:', {
        success: result.success,
        hasVoucher: !!result.voucher,
        amountUSD: result.amountUSD,
        amountBs: result.amountBs,
        exchangeRate: result.exchangeRate,
        errorCode: result.errorCode,
        note: 'El gateway recibió el monto en Bs'
      });
      
      return result;

    } catch (error: any) {
      console.error('Error en initP2C:', error);
      
      // Para P2C necesitamos retornar información estructurada incluso en errores
      // porque puede contener voucher e información importante
      if (error.details) {
        return {
          success: false,
          ...error.details,
          userMessage: error.message,
          canRetry: error.canRetry,
          isVoucherError: error.isVoucherError
        };
      }
      
      // Re-lanzar el error si no tiene detalles estructurados
      throw error;
    }
  },

  getPaymentStatus: async (control: string, options?: { token?: string; isEmbedded?: boolean }) => {
    return await fetchAPI(`/api/payment-gateway/payment-status/${control}`, options);
  }
};

// Funciones helper para usar en componentes con iframe
export const createAPIHelpers = (token?: string, isEmbedded?: boolean) => {
  const options = { token, isEmbedded };
  
  return {
    fetchBanks: () => apiBanks.getAll(options),
    fetchExchangeRate: () => apiExchangeRate.getCurrent(options),
    fetchInventory: () => apiInventory.getAll(options),
    registerGroup: (data: any) => apiRunners.registerGroup(data, options),
    initP2CPayment: (data: any) => apiPayment.initP2C(data, options),
    getPaymentStatus: (control: string) => apiPayment.getPaymentStatus(control, options),
    uploadPaymentProof: (file: File) => uploadPaymentProof(file, options),
    deletePaymentProof: (filename: string) => deletePaymentProof(filename, options)
  };
};

// Función utility para verificar si un error es recuperable
export const isRetryableError = (error: any): boolean => {
  if (!error) return false;
  
  const retryableCodes = [
    'COMM_ERROR',
    'TIMEOUT',
    'TIMEOUT_ERROR', 
    'NETWORK_ERROR',
    'CONNECTION_ERROR',
    'SERVICE_UNAVAILABLE',
    'ERROR_DE_TRANSACCION'
  ];
  
  return retryableCodes.includes(error.code) || error.canRetry === true;
};

// Función utility para obtener mensaje user-friendly de un error
export const getErrorMessage = (error: any): string => {
  if (error?.message) return error.message;
  if (error?.details?.message) return error.details.message;
  if (error?.details?.error) return error.details.error;
  return 'Error desconocido';
};

// Exportar tipos para uso en otros archivos
export type { APIError, FetchAPIOptions, UploadResponse };

/* 
 * DOCUMENTACIÓN IMPORTANTE PARA EL FLUJO DE PAGO:
 * 
 * FLUJO DE CONVERSIÓN USD -> Bs:
 * 
 * 1. Frontend envía al backend:
 *    - runnersCount: cantidad de corredores
 *    - amount: monto TOTAL en USD (solo referencial)
 *    - token: si es iframe
 * 
 * 2. Backend calcula:
 *    - totalUSD = runnersCount * RACE_PRICE_USD
 *    - Obtiene tasa de cambio actual del BCV
 *    - totalBs = totalUSD * exchangeRate
 *    - Formatea totalBs con 2 decimales
 * 
 * 3. Backend envía al gateway:
 *    - amount: totalBs (EN BOLÍVARES, NO USD)
 * 
 * 4. Backend responde al frontend con:
 *    - amountUSD: monto original para mostrar
 *    - amountBs: monto convertido que se cobró
 *    - exchangeRate: tasa utilizada
 * 
 * MANEJO DE ERRORES:
 * 
 * - Los errores P2C pueden contener vouchers con información importante
 * - COMM_ERROR indica problemas de comunicación con el banco
 * - Los errores se estructuran con códigos específicos y mensajes user-friendly
 * - Algunos errores permiten reintentos automáticos
 * 
 * AUTENTICACIÓN:
 * - Para usuarios normales: Se usa el token de localStorage con header 'Authorization'
 * - Para iframes: Se usa el token pasado como parámetro con header 'X-Iframe-Token'
 */