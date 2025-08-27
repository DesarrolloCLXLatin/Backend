// src/components/tickets/IframeTicketPurchase/hooks/useTicketPurchase.ts

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  FormData,
  P2CData,
  PaymentData,
  FormErrors,
  Inventory,
  TokenInfo,
  TicketZone,
  Seat,
  Bank,
  PaymentMethod
} from '../types';
import { 
  VIP_SEAT_CONFIG, 
  FORM_STEPS,
  MESSAGES,
  API_ENDPOINTS,
  CAPTCHA_CONFIG
} from '../constants';
import { validateStep } from '../utils/validators';
import { calculateTotalPrice } from '../utils/calculations';

// Tipo para el ticket que se pasa al onSuccess
interface ConcertTicket {
  id: string;
  ticket_number: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string;
  buyer_identification?: string;
  payment_method: string;
  payment_status: 'pendiente' | 'confirmado' | 'rechazado';
  ticket_status: 'vendido' | 'canjeado' | 'cancelado';
  zone_name?: string;
  ticket_price?: number;
  price?: number;
  quantity?: number;
  total_price?: number;
  created_at: string;
  redeemed_at?: string;
  email_sent?: boolean;
  email_sent_at?: string;
  receipt_sent?: boolean;
  is_box_purchase?: boolean;
  box_full_purchase?: boolean;
  box_code?: string;
  voucher_data?: any;
}

export const useTicketPurchase = (token: string | null, onSuccess?: (ticketData?: ConcertTicket) => void) => {
  // Estados principales
  const [inventory, setInventory] = useState<Inventory>({
    total_tickets: 5000,
    sold_tickets: 0,
    reserved_tickets: 0,
    available_tickets: 5000
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(FORM_STEPS.PERSONAL_DATA);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [showP2CForm, setShowP2CForm] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [captchaSiteKey, setCaptchaSiteKey] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [showManualPaymentConfirmation, setShowManualPaymentConfirmation] = useState(false);
  const [transactionData, setTransactionData] = useState<any>(null);
  
  // NUEVO: Estados para resumen de compra y voucher
  const [ticketDetails, setTicketDetails] = useState<any>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [voucherData, setVoucherData] = useState<any>(null);
  
  // Estados de zonas y asientos
  const [zones, setZones] = useState<TicketZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<TicketZone | null>(null);
  const [vipSeats, setVipSeats] = useState<Seat[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [generalQuantity, setGeneralQuantity] = useState(1);
  
  // Inicializar zonas por defecto con IDs válidos
  useEffect(() => {
    const defaultZones: TicketZone[] = [
      {
        id: 'zone-general-001',
        zone_code: 'GENERAL',
        zone_name: 'Zona General',
        zone_type: 'general',
        price_usd: 35,
        total_capacity: 4970,
        available: 4970,
        is_numbered: false,
        zone_color: '#FD8D6A',
        description: 'Entrada general - Área de pie con acceso directo al escenario'
      }
    ];
    
    // Agregar boxes como zonas
    for (let i = 1; i <= 30; i++) {
      defaultZones.push({
        id: `box-${String(i).padStart(2, '0')}`,
        zone_code: `B${i}`,
        zone_name: `Box ${i}`,
        zone_type: 'vip',
        price_usd: 120,
        total_capacity: 8,
        available: 8,
        is_numbered: false,
        zone_color: '#FD8D6A',
        description: `Box privado ${i} - Capacidad para 8 personas`
      });
    }
    
    setZones(defaultZones);
  }, []);
  
  // Datos de pago móvil P2C
  const [p2cData, setP2CData] = useState<P2CData>({
    client_phone: '',
    client_bank_code: ''
  });
  
  // Datos de otros métodos de pago
  const [paymentData, setPaymentData] = useState<PaymentData>({
    bank_code: '',
    reference: '',
    email_from: '',
    proof_file: null,
    paypal_email: ''
  });
  
  // Datos del formulario principal
  const [formData, setFormData] = useState<FormData>({
    buyer_name: '',
    buyer_identification: '',
    buyer_email: '',
    buyer_phone: '',
    payment_method: '',
    quantity: 1,
    ticket_type: 'general',
    zone_id: '',
    seat_ids: []
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // 🔧 FUNCIÓN AUXILIAR: Manejar respuestas de API con validación
  const handleApiResponse = async (response: Response): Promise<any> => {
    try {
      // Verificar si la respuesta tiene contenido
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('La respuesta del servidor no es JSON válido');
      }

      const text = await response.text();
      if (!text.trim()) {
        throw new Error('Respuesta vacía del servidor');
      }

      const data = JSON.parse(text);
      
      if (!response.ok) {
        throw new Error(data.message || `Error del servidor: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Error al procesar respuesta de API:', error);
      throw error;
    }
  };

  // 🔧 FUNCIÓN AUXILIAR: Validar endpoints
  const validateEndpoint = (endpoint: string, name: string): string => {
    if (!endpoint || endpoint === 'undefined') {
      console.error(`❌ Endpoint ${name} no está definido:`, endpoint);
      throw new Error(`Configuración de API incompleta: ${name}`);
    }
    return endpoint;
  };

  // Funciones de API CORREGIDAS
  const fetchTokenInfo = useCallback(async () => {
    if (!token) return;
    
    try {
      const endpoint = validateEndpoint(API_ENDPOINTS.tokenInfo, 'tokenInfo');
      const response = await fetch(`${endpoint}?token=${token}`);
      const data = await handleApiResponse(response);
      
      setTokenInfo(data);
      setCaptchaSiteKey(data.captcha_site_key || '');
      
      if (!data.valid) {
        toast.error(MESSAGES.errors.tokenInvalid);
        sendMessageToParent('TOKEN_INVALID');
      }
    } catch (error) {
      console.error('Error fetching token info:', error);
      toast.error(`Error al validar token: ${error.message}`);
      sendMessageToParent('TOKEN_ERROR');
    }
  }, [token]);

  const fetchInventory = useCallback(async () => {
    try {
      const endpoint = validateEndpoint(API_ENDPOINTS.inventory, 'inventory');
      const response = await fetch(endpoint);
      const data = await handleApiResponse(response);
      setInventory(data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      // No mostrar toast para errores de inventario, usar datos por defecto
    }
  }, []);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const availableMethods = [
        { value: 'pago_movil', label: 'Pago Móvil P2C', available: true },
        { value: 'transferencia_nacional', label: 'Transferencia Nacional', available: true },
        { value: 'zelle', label: 'Zelle', available: true },
        { value: 'paypal', label: 'PayPal', available: true }
      ];
      
      setPaymentMethods(availableMethods);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    }
  }, []);

  const fetchBanks = useCallback(async () => {
    try {
      const endpoint = validateEndpoint(API_ENDPOINTS.banks, 'banks');
      const response = await fetch(endpoint);
      const data = await handleApiResponse(response);
      
      if (data.success && Array.isArray(data.banks)) {
        const formattedBanks = data.banks
          .filter((bank: any) => bank.is_active !== false)
          .map((bank: any) => ({
            code: bank.code,
            name: bank.name
          }));
        
        setBanks(formattedBanks);
      } else if (Array.isArray(data)) {
        setBanks(data);
      } else {
        setBanks([]);
      }
    } catch (error) {
      console.error('Error fetching banks:', error);
      // Bancos por defecto en caso de error
      setBanks([
        { code: '0102', name: 'Banco de Venezuela' },
        { code: '0108', name: 'Banco Provincial' },
        { code: '0114', name: 'Bancaribe' },
        { code: '0128', name: 'Banco Caroní' }
      ]);
    }
  }, []);

  const fetchExchangeRate = useCallback(async () => {
    try {
      const endpoint = validateEndpoint(API_ENDPOINTS.exchangeRate, 'exchangeRate');
      const response = await fetch(endpoint);
      const data = await handleApiResponse(response);
      
      if (data.rate !== undefined && data.rate !== null) {
        setExchangeRate(Number(data.rate));
      } else if (data.exchangeRate !== undefined && data.exchangeRate !== null) {
        setExchangeRate(Number(data.exchangeRate));
      } else {
        setExchangeRate(36.50);
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      setExchangeRate(36.50);
    }
  }, []);

  // Funciones de manejo
  const sendMessageToParent = (type: string, data?: any) => {
    if (window.parent !== window) {
      window.parent.postMessage({ type, ...data }, '*');
    }
  };

  const handleInputChange = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  }, [errors]);

  const handleP2CInputChange = useCallback((field: string, value: string) => {
    setP2CData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  }, [errors]);

  const handlePaymentDataChange = useCallback((field: string, value: any) => {
    setPaymentData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  }, [errors]);

  const handleSeatSelection = useCallback((seat: Seat) => {
    if (seat.status !== 'available') return;
    
    const isSelected = selectedSeats.find(s => s.id === seat.id);
    if (isSelected) {
      setSelectedSeats(selectedSeats.filter(s => s.id !== seat.id));
    } else {
      if (selectedSeats.length < 5) {
        setSelectedSeats([...selectedSeats, seat]);
      } else {
        toast.error('Máximo 5 asientos por compra');
      }
    }
  }, [selectedSeats]);

  const handleZoneSelection = useCallback((zone: TicketZone) => {
    setSelectedZone(zone);
    setSelectedSeats([]);
    setGeneralQuantity(1);
    
    // Actualizar formData con la información de la zona
    setFormData(prev => ({
      ...prev,
      zone_id: zone.id,
      ticket_type: zone.zone_type === 'vip' ? 'vip' : 'general'
    }));
  }, []);

  const handleCaptchaVerify = useCallback((token: string) => {
    setCaptchaToken(token);
    if (errors.captcha) {
      setErrors(prev => ({ ...prev, captcha: null }));
    }
  }, [errors]);

  // Navegación
  const handleNextStep = useCallback(() => {
    const validation = validateStep(
      currentStep,
      formData,
      selectedZone,
      selectedSeats,
      generalQuantity,
      p2cData,
      paymentData,
      captchaToken,
      tokenInfo?.requires_captcha || false
    );

    if (validation.isValid) {
      if (currentStep === FORM_STEPS.ZONE_SELECTION) {
        const quantity = selectedZone?.is_numbered ? selectedSeats.length : generalQuantity;
        const seat_ids = selectedSeats.map(s => s.id);
        
        setFormData(prev => ({
          ...prev,
          quantity,
          ticket_type: selectedZone?.zone_type || 'general',
          zone_id: selectedZone?.id || '',
          seat_ids
        }));
      }
      setCurrentStep(prev => Math.min(prev + 1, FORM_STEPS.PAYMENT));
    } else {
      setErrors(validation.errors);
    }
  }, [currentStep, formData, selectedZone, selectedSeats, generalQuantity, p2cData, paymentData, captchaToken, tokenInfo]);

  const handlePrevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, FORM_STEPS.PERSONAL_DATA));
  }, []);

  // 🔧 FUNCIÓN ACTUALIZADA: Envío del formulario con validaciones mejoradas
  const handleSubmit = useCallback(async () => {
    const validation = validateStep(
      FORM_STEPS.PAYMENT,
      formData,
      selectedZone,
      selectedSeats,
      generalQuantity,
      p2cData,
      paymentData,
      captchaToken,
      tokenInfo?.requires_captcha || false
    );

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    if (!token) {
      toast.error(MESSAGES.errors.tokenRequired);
      return;
    }

    setIsSubmitting(true);
    const totalPrice = calculateTotalPrice(selectedZone, selectedSeats, generalQuantity);

    try {
      // Detectar si es compra de box y sus características
      const isBoxPurchase = selectedZone?.zone_type === 'vip' && selectedZone?.zone_code?.startsWith('B');
      const isFullBoxPurchase = (selectedZone as any)?.box_full_purchase === true;
      const boxQuantity = (selectedZone as any)?.box_quantity || generalQuantity;

      // Estructura base para todos los métodos de pago
      const baseTicketData = {
        buyer_name: formData.buyer_name,
        buyer_email: formData.buyer_email,
        buyer_phone: formData.buyer_phone,
        buyer_identification: formData.buyer_identification,
        quantity: isBoxPurchase ? boxQuantity : (formData.quantity || 1),
        zone_id: selectedZone?.id || 'zone-general-001',
        zone_type: selectedZone?.zone_type || 'general',
        zone_name: selectedZone?.zone_name || 'Zona General',
        price_usd: selectedZone?.price_usd || 35,
        total_price: totalPrice,
        seat_ids: formData.seat_ids || [],
        is_numbered: selectedZone?.is_numbered || false,
        // Nuevos campos para boxes
        is_box_purchase: isBoxPurchase,
        box_full_purchase: isFullBoxPurchase,
        box_code: isBoxPurchase ? selectedZone?.zone_code : null,
        box_seats_quantity: isBoxPurchase ? boxQuantity : null
      };

      if (formData.payment_method === 'pago_movil') {
        // 🔧 VALIDAR ENDPOINT ANTES DE USAR
        const endpoint = validateEndpoint(API_ENDPOINTS.initiateP2C, 'initiateP2C');
        
        // Estructura específica para Pago Móvil P2C
        const paymentPayload = {
          ...baseTicketData,
          payment_method: 'pago_movil',
          client_phone: p2cData.client_phone,
          client_bank_code: p2cData.client_bank_code,
          captcha: captchaToken || '',
          send_email: true,
          tickets: [{
            ...baseTicketData,
            ticket_type: selectedZone?.zone_type || 'general',
            purchase_type: isBoxPurchase ? (isFullBoxPurchase ? 'full_box' : 'box_seats') : 'regular'
          }]
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Iframe-Token': token
          },
          body: JSON.stringify(paymentPayload)
        });

        const data = await handleApiResponse(response);

        if (data.success) {
          // Guardar los detalles para el resumen de compra y voucher
          setTicketDetails({
            zone_name: selectedZone?.zone_name || 'Zona General',
            quantity: isBoxPurchase ? boxQuantity : (selectedZone?.is_numbered ? selectedSeats.length : generalQuantity),
            price_per_ticket: isBoxPurchase && isFullBoxPurchase ? totalPrice : (selectedZone?.price_usd || 35),
            seat_numbers: selectedSeats.map(s => s.seat_number),
            ticket_type: selectedZone?.zone_type || 'general',
            is_box_purchase: isBoxPurchase,
            box_full_purchase: isFullBoxPurchase,
            box_code: isBoxPurchase ? selectedZone?.zone_code : null,
            purchase_description: isBoxPurchase 
              ? (isFullBoxPurchase ? 'Box Completo' : `${boxQuantity} ${boxQuantity === 1 ? 'puesto' : 'puestos'} en box`)
              : null
          });

          // Guardar detalles del pago
          setPaymentDetails({
            commerce_phone: data.paymentDetails?.commerce_phone,
            commerce_bank_code: data.paymentDetails?.commerce_bank_code,
            commerce_bank_name: data.paymentDetails?.commerce_bank_name,
            commerce_rif: data.paymentDetails?.commerce_rif,
            invoiceNumber: data.invoiceNumber,
            controlNumber: data.controlNumber,
            amount: data.paymentDetails?.amount
          });

          setTransactionId(data.transactionId);
          setShowP2CForm(true);
          toast.success(MESSAGES.success.paymentInitiated);
          sendMessageToParent('PAYMENT_INITIATED', { 
            transactionId: data.transactionId,
            isBoxPurchase,
            boxFullPurchase: isFullBoxPurchase,
            boxCode: isBoxPurchase ? selectedZone?.zone_code : null
          });
        } else {
          toast.error(data.message || MESSAGES.errors.processingError);
        }
      } else if (formData.payment_method === 'transferencia_nacional' || 
                  formData.payment_method === 'zelle' || 
                  formData.payment_method === 'paypal') {
        
        // 🔧 VALIDAR ENDPOINT ANTES DE USAR
        const endpoint = validateEndpoint(API_ENDPOINTS.manualPayment, 'manualPayment');
        
        // Estructura para pagos manuales
        const manualPaymentPayload = {
          ...baseTicketData,
          payment_method: formData.payment_method,
          payment_reference: paymentData.reference || null,
          bank_code: paymentData.bank_code || null,
          email_from: paymentData.email_from || formData.buyer_email,
          paypal_email: paymentData.paypal_email || null,
          send_email: true,
          tickets: [{
            ...baseTicketData,
            ticket_type: selectedZone?.zone_type || 'general',
            purchase_type: isBoxPurchase ? (isFullBoxPurchase ? 'full_box' : 'box_seats') : 'regular'
          }]
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Iframe-Token': token
          },
          body: JSON.stringify(manualPaymentPayload)
        });

        const data = await handleApiResponse(response);

        if (data.success) {
          const successMessage = isBoxPurchase 
            ? (isFullBoxPurchase 
              ? `🎉 Box completo reservado. ${data.message || 'Recibirá un email de confirmación.'}` 
              : `🎉 ${boxQuantity} ${boxQuantity === 1 ? 'puesto' : 'puestos'} reservado(s). ${data.message || 'Recibirá un email de confirmación.'}`)
            : data.message || 'Pago registrado. Recibirá un email de confirmación una vez verificado.';
            
          toast.success(successMessage);
          
          // Crear objeto del ticket para pasar al onSuccess
          const newTicketData: ConcertTicket = {
            id: data.ticketId || data.transactionId || `temp-${Date.now()}`,
            ticket_number: data.ticketNumber || `TK-${Date.now()}`,
            buyer_name: formData.buyer_name,
            buyer_email: formData.buyer_email,
            buyer_phone: formData.buyer_phone,
            buyer_identification: formData.buyer_identification,
            payment_method: formData.payment_method,
            payment_status: 'pendiente',
            ticket_status: 'vendido',
            zone_name: selectedZone?.zone_name || 'Zona General',
            ticket_price: selectedZone?.price_usd || 35,
            price: selectedZone?.price_usd || 35,
            quantity: isBoxPurchase ? boxQuantity : (formData.quantity || 1),
            total_price: totalPrice,
            created_at: new Date().toISOString(),
            email_sent: data.emailSent !== false,
            email_sent_at: new Date().toISOString(),
            receipt_sent: false,
            is_box_purchase: isBoxPurchase,
            box_full_purchase: isFullBoxPurchase,
            box_code: isBoxPurchase ? selectedZone?.zone_code : null
          };
          
          sendMessageToParent('PAYMENT_SUBMITTED', { 
            transactionId: data.transactionId,
            payment_method: formData.payment_method,
            isBoxPurchase,
            boxFullPurchase: isFullBoxPurchase,
            boxCode: isBoxPurchase ? selectedZone?.zone_code : null,
            ticketData: newTicketData
          });
          
          onSuccess?.(newTicketData);

          // Resetear el formulario
          setTimeout(() => {
            setCurrentStep(FORM_STEPS.PERSONAL_DATA);
            setFormData({
              buyer_name: '',
              buyer_identification: '',
              buyer_email: '',
              buyer_phone: '',
              payment_method: '',
              quantity: 1,
              ticket_type: 'general',
              zone_id: '',
              seat_ids: []
            });
            setSelectedZone(null);
            setSelectedSeats([]);
            setGeneralQuantity(1);
            setTicketDetails(null);
            setPaymentDetails(null);
            setVoucherData(null);
          }, 3000);
        } else {
          toast.error(data.message || MESSAGES.errors.processingError);
        }
      }
    } catch (error) {
      console.error('Error en handleSubmit:', error);
      toast.error(`Error al procesar pago: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, selectedZone, selectedSeats, generalQuantity, p2cData, paymentData, captchaToken, token, tokenInfo, onSuccess]);

  // 🔧 FUNCIÓN ACTUALIZADA: Confirmación de pago P2C con validaciones mejoradas
  const confirmP2CPayment = useCallback(async (reference: string) => {
    if (!reference) {
      toast.error('Ingrese la referencia de la transferencia');
      return;
    }
  
    setIsSubmitting(true);
    
    try {
      const endpoint = validateEndpoint(API_ENDPOINTS.confirmP2C, 'confirmP2C');
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Iframe-Token': token || ''
        },
        body: JSON.stringify({
          transactionId,
          reference,
          send_email: true,
          cedula: formData.buyer_identification
        })
      });
    
      const data = await handleApiResponse(response);
    
      if (data.success) {
        // Guardar datos del voucher si vienen en la respuesta
        if (data.voucher || data.authId || data.control || data.terminal) {
          setVoucherData({
            authId: data.authId,
            terminal: data.terminal,
            lote: data.lote,
            seqnum: data.seqnum,
            voucher: data.voucher,
            control: data.control,
            reference: data.reference || reference
          });
        }
      
        toast.success(data.message || MESSAGES.success.paymentConfirmed);
        
        // Crear objeto del ticket confirmado inmediatamente
        const confirmedTicketData: ConcertTicket = {
          id: data.ticketId || data.tickets?.[0]?.id || transactionId || `confirmed-${Date.now()}`,
          ticket_number: data.ticketNumber || data.tickets?.[0]?.ticket_number || `TK-${Date.now()}`,
          buyer_name: formData.buyer_name,
          buyer_email: formData.buyer_email,
          buyer_phone: formData.buyer_phone,
          buyer_identification: formData.buyer_identification,
          payment_method: 'pago_movil',
          payment_status: 'confirmado',
          ticket_status: 'vendido',
          zone_name: selectedZone?.zone_name || 'Zona General',
          ticket_price: selectedZone?.price_usd || 35,
          price: selectedZone?.price_usd || 35,
          quantity: selectedZone?.is_numbered ? selectedSeats.length : generalQuantity,
          total_price: calculateTotalPrice(selectedZone, selectedSeats, generalQuantity),
          created_at: new Date().toISOString(),
          email_sent: true,
          email_sent_at: new Date().toISOString(),
          receipt_sent: true,
          voucher_data: data.voucher || voucherData,
          is_box_purchase: selectedZone?.zone_type === 'vip' && selectedZone?.zone_code?.startsWith('B'),
          box_full_purchase: (selectedZone as any)?.box_full_purchase === true,
          box_code: selectedZone?.zone_code?.startsWith('B') ? selectedZone?.zone_code : null
        };
        
        console.log('✅ P2C Confirmado - Ticket data:', confirmedTicketData);
        
        sendMessageToParent('PAYMENT_COMPLETED', { 
          transactionId, 
          tickets: data.tickets,
          voucher: data.voucher,
          ticketData: confirmedTicketData
        });
        
        onSuccess?.(confirmedTicketData);
        
        // Resetear formulario después de delay
        setTimeout(() => {
          setShowP2CForm(false);
          setTransactionId(null);
          setCurrentStep(FORM_STEPS.PERSONAL_DATA);
          setFormData({
            buyer_name: '',
            buyer_identification: '',
            buyer_email: '',
            buyer_phone: '',
            payment_method: '',
            quantity: 1,
            ticket_type: 'general',
            zone_id: '',
            seat_ids: []
          });
          setSelectedZone(null);
          setSelectedSeats([]);
          setGeneralQuantity(1);
          setTicketDetails(null);
          setPaymentDetails(null);
          setVoucherData(null);
        }, 3000);
      } else {
        toast.error(data.message || 'Error al confirmar pago');
        sendMessageToParent('PAYMENT_ERROR', { message: data.message });
      }
    } catch (error) {
      console.error('Error en confirmP2CPayment:', error);
      toast.error(`Error al confirmar pago: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [token, transactionId, formData, selectedZone, selectedSeats, generalQuantity, voucherData, onSuccess]);

  // Efectos
  useEffect(() => {
    if (selectedZone && selectedZone.is_numbered && selectedZone.zone_type === 'vip') {
      const seats: Seat[] = [];
      const { rows, seatsPerRow, soldSeats } = VIP_SEAT_CONFIG;
      
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        for (let col = 1; col <= seatsPerRow; col++) {
          const seatNumber = `V${rows[rowIndex]}${String(col).padStart(2, '0')}`;
          seats.push({
            id: `${selectedZone.id}_${rowIndex}_${col}`,
            seat_number: seatNumber,
            row: rows[rowIndex],
            column: col,
            status: soldSeats.includes(seatNumber) ? 'sold' : 'available',
            seat_type: 'standard',
            price: selectedZone.price_usd,
            zone_type: selectedZone.zone_type
          });
        }
      }
      setVipSeats(seats);
    } else {
      setVipSeats([]);
    }
    
    setSelectedSeats([]);
  }, [selectedZone]);

  useEffect(() => {
    if (token) {
      fetchTokenInfo();
    }
    fetchInventory();
    fetchBanks();
    fetchExchangeRate();
  }, [token, fetchTokenInfo, fetchInventory, fetchBanks, fetchExchangeRate]);

  useEffect(() => {
    if (tokenInfo) {
      fetchPaymentMethods();
    }
  }, [tokenInfo, fetchPaymentMethods]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Cargar script de captcha
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).hcaptcha) {
      const script = document.createElement('script');
      script.src = CAPTCHA_CONFIG.scriptUrl;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const handleCaptchaEvent = (event: CustomEvent) => {
      handleCaptchaVerify(event.detail);
    };
  
    window.addEventListener('captchaVerified', handleCaptchaEvent as any);
    
    return () => {
      window.removeEventListener('captchaVerified', handleCaptchaEvent as any);
    };
  }, [handleCaptchaVerify]);

  return {
    // Estados
    inventory,
    isSubmitting,
    currentStep,
    paymentMethods,
    banks,
    exchangeRate,
    showP2CForm,
    transactionId,
    tokenInfo,
    captchaSiteKey,
    captchaToken,
    showManualPaymentConfirmation,
    transactionData,
    zones,
    selectedZone,
    vipSeats,
    selectedSeats,
    generalQuantity,
    p2cData,
    paymentData,
    formData,
    errors,
    mousePosition,
    ticketDetails,
    paymentDetails,
    voucherData,
    
    // Funciones
    handleInputChange,
    handleP2CInputChange,
    handlePaymentDataChange,
    handleSeatSelection,
    handleZoneSelection,
    handleCaptchaVerify,
    handleNextStep,
    handlePrevStep,
    handleSubmit,
    confirmP2CPayment,
    setGeneralQuantity,
    setShowP2CForm,
    setTransactionId,
    setVoucherData
  };
};