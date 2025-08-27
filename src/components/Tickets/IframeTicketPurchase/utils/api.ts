// src/components/tickets/IframeTicketPurchase/utils/api.ts

import { API_ENDPOINTS, DEFAULT_PAYMENT_METHODS } from '../constants';
import { TokenInfo, Inventory, Bank } from '../types';

// Obtener información del token
export const fetchTokenInfo = async (token: string): Promise<TokenInfo | null> => {
  try {
    const response = await fetch(`${API_ENDPOINTS.tokenInfo}?token=${token}`);
    if (response.ok) {
      const data = await response.json();
      console.log('Token info fetched:', data);
      return data;
    }
    console.error('Token validation failed');
    return null;
  } catch (error) {
    console.error('Error fetching token info:', error);
    return null;
  }
};

// Validar token con el nuevo endpoint
export const validateToken = async (token: string, origin?: string): Promise<any> => {
  try {
    const response = await fetch(API_ENDPOINTS.validateToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Iframe-Token': token
      },
      body: JSON.stringify({ token, origin: origin || window.location.origin })
    });
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Error validating token:', error);
    return null;
  }
};

// Obtener disponibilidad de boxes y zonas
export const fetchBoxesAvailability = async (): Promise<any> => {
  try {
    const response = await fetch(API_ENDPOINTS.boxesAvailability);
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error fetching boxes availability:', error);
    return null;
  }
};

// Obtener inventario de tickets
export const fetchInventory = async (): Promise<Inventory | null> => {
  try {
    const response = await fetch(API_ENDPOINTS.inventory);
    if (response.ok) {
      const data = await response.json();
      
      // Si el backend devuelve el formato antiguo, adaptarlo
      if (data.total_tickets !== undefined) {
        return {
          total_capacity: data.total_tickets || 5270,
          sold_count: data.sold_tickets || 0,
          reserved_count: data.reserved_tickets || 0,
          available_count: data.available_tickets || 5270
        };
      }
      
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return null;
  }
};

// Obtener estadísticas del venue
export const fetchVenueStats = async (): Promise<any> => {
  try {
    const response = await fetch(API_ENDPOINTS.venueStats, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Error fetching venue stats:', error);
    return null;
  }
};

// Obtener lista de bancos
export const fetchBanks = async (): Promise<Bank[]> => {
  try {
    const response = await fetch(API_ENDPOINTS.banks);
    if (response.ok) {
      const data = await response.json();
      
      // Si es un objeto con propiedad banks
      if (data.banks && Array.isArray(data.banks)) {
        return data.banks;
      }
      
      // Si es directamente un array
      if (Array.isArray(data)) {
        return data;
      }
      
      console.warn('Unexpected banks response format:', data);
      return [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching banks:', error);
    return [];
  }
};

// Obtener métodos de pago disponibles
export const fetchPaymentMethods = async (tokenType?: string): Promise<any[]> => {
  try {
    const url = tokenType 
      ? `${API_ENDPOINTS.paymentMethods}?tokenType=${tokenType}`
      : API_ENDPOINTS.paymentMethods;
      
    const response = await fetch(url);
    if (response.ok) {
      return await response.json();
    }
    return DEFAULT_PAYMENT_METHODS;
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return DEFAULT_PAYMENT_METHODS;
  }
};

// Obtener tasa de cambio actual
export const fetchExchangeRate = async (): Promise<number | null> => {
  try {
    const response = await fetch(API_ENDPOINTS.exchangeRate);
    if (response.ok) {
      const data = await response.json();
      
      // Manejar diferentes formatos de respuesta
      if (data.rate) return data.rate;
      if (data.exchangeRate) return data.exchangeRate;
      if (data.exchange_rate) return data.exchange_rate;
      if (typeof data === 'number') return data;
      
      console.warn('Unexpected exchange rate format:', data);
      return 40; // Valor por defecto
    }
    return 40; // Valor por defecto si falla
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return 40; // Valor por defecto
  }
};

// Iniciar pago móvil P2C para tickets generales
export const initiateP2CPayment = async (
  token: string,
  paymentData: any
): Promise<{ success: boolean; transactionId?: string; paymentDetails?: any; error?: string }> => {
  try {
    const response = await fetch(API_ENDPOINTS.initiateP2C, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Iframe-Token': token
      },
      body: JSON.stringify(paymentData)
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      return { 
        success: true, 
        transactionId: data.transactionId,
        paymentDetails: data.paymentDetails
      };
    } else {
      return { 
        success: false, 
        error: data.message || 'Error al iniciar pago' 
      };
    }
  } catch (error) {
    console.error('Error initiating P2C payment:', error);
    return { 
      success: false, 
      error: 'Error de conexión al procesar su solicitud' 
    };
  }
};

// Confirmar pago móvil P2C
export const confirmP2CPayment = async (
  token: string,
  transactionId: string,
  reference: string,
  cedula?: string
): Promise<{ success: boolean; voucher?: any; tickets?: any[]; error?: string }> => {
  try {
    const response = await fetch(API_ENDPOINTS.confirmP2C, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Iframe-Token': token
      },
      body: JSON.stringify({
        transactionId,
        reference,
        cedula
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      return { 
        success: true, 
        voucher: data.voucher,
        tickets: data.tickets 
      };
    } else {
      return { 
        success: false, 
        error: data.message || 'Error al confirmar pago' 
      };
    }
  } catch (error) {
    console.error('Error confirming P2C payment:', error);
    return { 
      success: false, 
      error: 'Error al confirmar pago' 
    };
  }
};

// Enviar mensaje al padre (para iframes)
export const sendMessageToParent = (type: string, data?: any): void => {
  if (window.parent !== window) {
    window.parent.postMessage({ 
      type, 
      source: 'ticket-purchase-iframe',
      timestamp: Date.now(),
      ...data 
    }, '*');
  }
};

// Iniciar compra de box
export const initiateBoxPurchase = async (
  token: string,
  boxData: any
): Promise<{ success: boolean; transactionId?: string; boxInfo?: any; error?: string }> => {
  try {
    const response = await fetch(API_ENDPOINTS.initiateBox, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Iframe-Token': token
      },
      body: JSON.stringify(boxData)
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      return { 
        success: true, 
        transactionId: data.transactionId,
        boxInfo: data.boxInfo
      };
    } else {
      return { 
        success: false, 
        error: data.message || 'Error al reservar box' 
      };
    }
  } catch (error) {
    console.error('Error initiating box purchase:', error);
    return { 
      success: false, 
      error: 'Error al procesar reserva de box' 
    };
  }
};

// Obtener detalles de un box específico
export const fetchBoxDetails = async (boxCode: string): Promise<any> => {
  try {
    const response = await fetch(`${API_ENDPOINTS.boxDetails}/${boxCode}`);
    if (response.ok) {
      const data = await response.json();
      return data.success ? data.box : null;
    }
    return null;
  } catch (error) {
    console.error('Error fetching box details:', error);
    return null;
  }
};

// Verificar estado de transacción
export const checkTransactionStatus = async (
  transactionId: string,
  token?: string
): Promise<any> => {
  try {
    const url = `${API_ENDPOINTS.transactionStatus}/${transactionId}${token ? `?token=${token}` : ''}`;
    const response = await fetch(url);
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Error checking transaction status:', error);
    return null;
  }
};

// Crear tickets con pago manual (transferencia, Zelle, etc.)
export const createManualPaymentTickets = async (
  ticketData: any,
  proofFile?: File
): Promise<{ success: boolean; message?: string; transactionId?: string; error?: string }> => {
  try {
    const formData = new FormData();
    
    // Agregar datos del formulario
    Object.keys(ticketData).forEach(key => {
      if (key === 'tickets' || key === 'activities') {
        formData.append(key, JSON.stringify(ticketData[key]));
      } else {
        formData.append(key, ticketData[key]);
      }
    });
    
    // Agregar archivo si existe
    if (proofFile) {
      formData.append('proof', proofFile);
    }
    
    const response = await fetch(API_ENDPOINTS.manualPayment, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      return {
        success: true,
        message: data.message || MESSAGES.info.verificationEmail,
        transactionId: data.transaction?.id
      };
    } else {
      return {
        success: false,
        error: data.message || 'Error al procesar pago manual'
      };
    }
  } catch (error) {
    console.error('Error creating manual payment:', error);
    return {
      success: false,
      error: 'Error al procesar su solicitud'
    };
  }
};

// Función helper para formatear la respuesta de disponibilidad
export const formatAvailabilityData = (data: any): { zones: TicketZone[], boxes: any[] } => {
  const zones: TicketZone[] = [];
  
  // Agregar zona general si existe
  if (data.general) {
    zones.push({
      id: 'general',
      zone_code: 'GENERAL',
      zone_name: 'Entrada General',
      zone_type: 'general',
      price_usd: data.general.price_usd || 35.00,
      total_capacity: data.general.capacity || 4970,
      available: data.general.available || 0,
      is_numbered: false,
      zone_color: '#667eea',
      description: 'Acceso general al concierto'
    });
  }
  
  // Agregar boxes como zona si hay disponibles
  if (data.boxes && data.boxes.summary) {
    const availableBoxes = data.boxes.detail?.filter(b => b.status === 'available') || [];
    if (availableBoxes.length > 0) {
      zones.push({
        id: 'boxes',
        zone_code: 'BOX',
        zone_name: 'Boxes Premium',
        zone_type: 'vip',
        price_usd: availableBoxes[0]?.price_usd || 750.00,
        total_capacity: data.boxes.summary.total_boxes * 10,
        available: data.boxes.summary.available_boxes,
        is_numbered: true,
        zone_color: '#764ba2',
        description: 'Box privado con capacidad para 10 personas, servicio VIP incluido'
      });
    }
  }
  
  // Agregar otras zonas si existen
  if (data.zones && Array.isArray(data.zones)) {
    data.zones.forEach(zone => {
      if (zone.code !== 'GENERAL' && zone.code !== 'BOX') {
        zones.push({
          id: zone.id,
          zone_code: zone.code,
          zone_name: zone.name,
          zone_type: zone.type as 'general' | 'vip',
          price_usd: zone.price_usd,
          total_capacity: zone.capacity,
          available: zone.capacity - (zone.sold || 0),
          is_numbered: zone.type === 'vip',
          zone_color: zone.color || '#667eea',
          description: zone.description
        });
      }
    });
  }
  
  return {
    zones,
    boxes: data.boxes?.detail || []
  };
};