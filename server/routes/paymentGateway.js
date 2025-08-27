import express from 'express';
import crypto from 'crypto';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import paymentGateway from '../services/paymentServices.js';
import { assignRunnerNumbers } from '../utils/runnerNumberAssignment.js';
import { queueConfirmationEmail } from '../utils/emailQueue.js';

const router = express.Router();

// Función para generar referencia única
function generateUniqueReference() {
  // Generar referencia de 6-12 dígitos como en el Postman
  const timestamp = Date.now().toString();
  return timestamp.slice(-8);
}

// Función para formatear teléfono
function formatPhone(phone) {
  if (!phone) return null;
  const cleaned = phone.replace(/[^0-9]/g, '');
  // Asegurar que empiece con 0
  return cleaned.startsWith('0') ? cleaned : '0' + cleaned;
}

// Función para formatear monto
function formatAmount(amount) {
  // Asegurar que el monto tenga 2 decimales
  return parseFloat(amount).toFixed(2);
}

// Función para extraer cédula del email o usar default
function extractCID(email, registrantIdentification) {
  if (registrantIdentification) {
    return registrantIdentification;
  }
  // Si no hay cédula, generar una por defecto
  return 'V00000000';
}

async function validateBankCode(bankCode, supabase) {
  try {
    // Validación adicional del formato del código
    if (!bankCode || typeof bankCode !== 'string' || bankCode.trim() === '') {
      console.error('❌ Código de banco inválido o vacío:', bankCode);
      return false;
    }

    const { data: bank, error } = await supabase
      .from('banks')
      .select('code')
      .eq('code', bankCode)
      .eq('is_active', true)
      .single();

    return !error && bank !== null;
  } catch (error) {
    console.error('Error validando banco:', error);
    return false;
  }
}

// ==========================================
// FUNCIONES AUXILIARES COMPARTIDAS
// ==========================================

/**
 * Valida los datos básicos del pago P2C
 */
function validateP2CData(data) {
    const errors = [];
    
    // Validar identificación
    if (!data.clientIdentification) {
        errors.push('clientIdentification es requerido');
    } else {
        const cidClean = String(data.clientIdentification).trim();
        if (!/^[VEJGvejg]?\d{7,9}$/.test(cidClean)) {
            errors.push(`Formato de cédula inválido: ${cidClean}`);
        }
    }
    
    // Validar teléfono
    if (!data.clientPhone) {
        errors.push('clientPhone es requerido');
    } else if (!/^04\d{9}$/.test(data.clientPhone)) {
        errors.push(`Formato de teléfono inválido: ${data.clientPhone}`);
    }
    
    // Validar banco
    if (!data.clientBankCode) {
        errors.push('clientBankCode es requerido');
    } else if (!/^\d{4}$/.test(data.clientBankCode)) {
        errors.push(`Código de banco inválido: ${data.clientBankCode}`);
    }
    
    // Validar monto
    if (!data.amount || data.amount <= 0) {
        errors.push('amount debe ser mayor a 0');
    }
    
    return errors;
}

/**
 * Valida y formatea el teléfono
 */
function validateAndFormatPhone(clientPhone) {
  const formattedPhone = formatPhone(clientPhone);
  const phoneRegex = /^04[0-9]{9}$/;
  
  if (!phoneRegex.test(formattedPhone)) {
    throw new Error('Formato de teléfono inválido. Debe ser 04XXXXXXXXX');
  }
  
  return formattedPhone;
}

/**
 * Valida y formatea la cédula de identidad
 */
function validateAndFormatCID(clientIdentification, registrantIdentification, fallback = null) {
  let cid = clientIdentification || registrantIdentification || fallback;

  if (!cid) {
    console.error('⚠️ CID no proporcionado, usando valor por defecto');
    cid = 'V00000000';
  } else {
    // Limpiar y formatear CID
    cid = cid.toString().replace(/[^0-9VEJG]/g, '');
    
    // Si no tiene prefijo, agregar V
    if (!cid.match(/^[VEJG]/)) {
      cid = 'V' + cid;
    }
    
    // Validar formato final
    const cidRegex = /^[VEJG]\d{7,9}$/;
    if (!cidRegex.test(cid)) {
      console.error(`⚠️ CID inválido: ${cid}. Formato esperado: V12345678`);
      // Pero continuamos con lo que tenemos
    }
  }
  
  console.log('🔍 CID formateado:', cid);
  return cid;
}

/**
 * Verifica disponibilidad de inventario para runners
 */
async function checkInventoryAvailability(runners, supabase, isIframe = false) {
  if (!runners || runners.length === 0) return { success: true };

  console.log(`📦 Verificando disponibilidad de inventario${isIframe ? ' para iframe' : ''}...`);
  
  // Agrupar por talla y género
  const inventoryCheck = {};
  runners.forEach(runner => {
    const gender = runner.gender || 'M';
    const key = `${runner.shirt_size}-${gender}`;
    inventoryCheck[key] = (inventoryCheck[key] || 0) + 1;
  });

  console.log('Inventario solicitado:', inventoryCheck);

  // Verificar disponibilidad para cada combinación
  for (const [key, quantity] of Object.entries(inventoryCheck)) {
    const [shirt_size, gender] = key.split('-');
    
    const { data: inventory, error: invError } = await supabase
      .from('inventory')
      .select('stock, reserved, assigned')
      .eq('shirt_size', shirt_size)
      .eq('gender', gender)
      .single();

    if (invError || !inventory) {
      console.error(`❌ Talla ${shirt_size}/${gender} no encontrada`);
      return {
        success: false,
        error: `Talla ${shirt_size} (${gender === 'M' ? 'Masculino' : 'Femenino'}) no disponible`,
        errorCode: 'INVENTORY_NOT_FOUND'
      };
    }

    const available = inventory.stock - inventory.reserved - (inventory.assigned || 0);
    
    if (available < quantity) {
      console.error(`❌ Stock insuficiente para ${shirt_size}/${gender}: ${available} < ${quantity}`);
      return {
        success: false,
        error: `Solo quedan ${available} unidades de talla ${shirt_size} (${gender === 'M' ? 'Masculino' : 'Femenino'})`,
        errorCode: 'INSUFFICIENT_INVENTORY',
        details: {
          shirt_size,
          gender,
          requested: quantity,
          available
        }
      };
    }
    
    console.log(`✅ Disponible ${shirt_size}/${gender}: ${available} >= ${quantity}`);
  }

  console.log('✅ Inventario verificado, suficiente stock disponible');
  return { success: true };
}

/**
 * Procesa un grupo existente para pago P2C
 */
async function processExistingGroup(groupId, amount, userEmail, userRole, supabase) {
  // Verificar que el grupo existe
  const { data: groupData, error: groupError } = await supabase
    .from('registration_groups')
    .select(`
      *,
      runners(*)
    `)
    .eq('id', groupId)
    .single();

  if (groupError || !groupData) {
    throw new Error('Grupo no encontrado');
  }

  // Verificar permisos
  const canProcessPayment = 
    groupData.registrant_email === userEmail ||
    userRole === 'admin' || 
    userRole === 'tienda';

  if (!canProcessPayment) {
    throw new Error('No tienes permisos para procesar este pago');
  }

  // Verificar que no tenga un pago exitoso previo
  if (groupData.payment_status === 'confirmado') {
    throw new Error('Este grupo ya tiene un pago confirmado');
  }

  // Verificar que el método de pago sea P2C
  if (groupData.payment_method !== 'pago_movil_p2c') {
    throw new Error('Este grupo no está configurado para pago móvil P2C');
  }

  // Calcular monto
  const pricePerRunner = parseFloat(process.env.RACE_PRICE_USD || '55.00');
  const totalUSD = amount || (pricePerRunner * groupData.runners.length);

  console.log('💰 Cálculo de montos:');
  console.log(`   Precio por corredor: $${pricePerRunner}`);
  console.log(`   Número de corredores: ${groupData.runners.length}`);
  console.log(`   Total USD calculado: $${totalUSD}`);

  // Verificar que el cálculo sea correcto
  if (totalUSD > 1000 && groupData.runners.length <= 10) {
    console.error('⚠️ ALERTA: Monto USD parece excesivo para la cantidad de corredores');
    console.error(`   Verificar cálculo: ${groupData.runners.length} x $${pricePerRunner} = $${totalUSD}`);
  }

  return { group: groupData, totalUSD };
}

/**
 * Verifica pagos pendientes para un grupo
 */
async function checkPendingPayments(groupId, supabase) {
  if (!groupId) return;

  const { data: pendingPayment } = await supabase
    .from('payment_transactions')
    .select('id, control, created_at')
    .eq('group_id', groupId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingPayment) {
    const paymentAge = Date.now() - new Date(pendingPayment.created_at).getTime();
    const thirtyMinutes = 30 * 60 * 1000;
    
    if (paymentAge < thirtyMinutes) {
      throw new Error(`Ya existe un pago pendiente para este grupo. Control: ${pendingPayment.control}. Tiempo de espera: ${Math.ceil((thirtyMinutes - paymentAge) / 1000 / 60)} min`);
    } else {
      await supabase
        .from('payment_transactions')
        .update({ 
          status: 'expired',
          expired_at: new Date().toISOString()
        })
        .eq('id', pendingPayment.id);
    }
  }
}

/**
 * Prepara datos de runners para pre-registro
 */
function prepareRunnersData(runners, runnersCount) {
  return runners || Array(runnersCount).fill({}).map((_, i) => ({ 
    full_name: `Corredor ${i + 1}`,
    identification_type: 'V',
    identification: `PENDING-${Date.now()}-${i}`,
    birth_date: null,
    gender: 'M',
    email: null,
    phone: null,
    shirt_size: 'M'
  }));
}

/**
 * Lógica principal de procesamiento P2C
 */
async function processP2CPayment({
  groupId,
  clientPhone,
  clientBankCode,
  clientIdentification,
  amount,
  runnersCount,
  registrantEmail,
  registrantPhone,
  registrantIdentification,
  runners,
  userEmail,
  userRole,
  userId,
  isIframe = false,
  iframeTokenId = null,
  supabase
}) {
  // 1. Validaciones básicas
  const validationErrors = validateP2CData({
    clientPhone,
    clientBankCode
  });
  
  if (validationErrors.length > 0) {
    throw new Error('Validación fallida: ' + validationErrors.join(', '));
  }

  // 2. Validar y formatear datos
  const formattedPhone = validateAndFormatPhone(clientPhone);
  let cid = validateAndFormatCID(  // ← Cambiar const por let
    clientIdentification, 
    registrantIdentification,
    isIframe ? `V${Date.now().toString().slice(-8)}` : null
  );

  // 3. Validar banco
  const isValidBank = await validateBankCode(clientBankCode, supabase);
  if (!isValidBank) {
    throw new Error('Código de banco inválido o banco no disponible: ' + clientBankCode);
  }

  let group = null;
  let totalUSD = 0;
  let isPreRegistration = false;
  let runnersData = null;

  // 4. Procesar según si existe groupId
  if (groupId) {
    // Flujo con grupo existente
    const result = await processExistingGroup(groupId, amount, userEmail, userRole, supabase);
    group = result.group;
    totalUSD = result.totalUSD;
    
    // Usar cédula del registrante si existe
    if (group.registrant_identification) {
      cid = group.registrant_identification;
    }
    
    // Verificar pagos pendientes
    await checkPendingPayments(groupId, supabase);
    
  } else {
    // Flujo sin groupId (pago antes del registro)
    if (!amount || !runnersCount) {
      throw new Error('Para pago sin grupo registrado, amount y runnersCount son requeridos');
    }

    // Validar permisos para email
    if (registrantEmail && registrantEmail !== userEmail && 
        userRole !== 'admin' && userRole !== 'tienda' && !isIframe) {
      throw new Error('No puedes procesar pagos para otro email');
    }

    totalUSD = amount;
    isPreRegistration = true;

    // Preparar datos de runners
    runnersData = prepareRunnersData(runners, runnersCount);

    // Verificar inventario si tenemos datos de runners
    if (runners && runners.length > 0) {
      const inventoryCheck = await checkInventoryAvailability(runners, supabase, isIframe);
      if (!inventoryCheck.success) {
        const error = new Error(inventoryCheck.error);
        error.errorCode = inventoryCheck.errorCode;
        error.details = inventoryCheck.details;
        throw error;
      }
    }

    // Crear objeto group TEMPORAL
    group = {
      id: null,
      group_code: isIframe ? `IFRAME-${Date.now()}` : null,
      runners: runnersData,
      registrant_email: registrantEmail || userEmail,
      registrant_phone: registrantPhone || clientPhone,
      registrant_identification: cid,
      is_temporary: true,
      created_by: userId,
      ...(isIframe && {
        iframe_token_id: iframeTokenId,
        created_by_token: 'iframe'
      })
    };

    console.log(`📝 Pre-registro preparado con ${runnersData.length} corredores`);
  }

  // 5. Ejecutar el flujo de pago P2C
  console.log('🚀 Ejecutando flujo P2C:', {
    isPreRegistration,
    hasGroupId: !!groupId,
    telefonoCliente: formattedPhone,
    codigoBancoCliente: clientBankCode,
    cid: cid,
    isIframe
  });

  const result = await executeGroupP2CPayment(
    group, 
    {
      telefonoCliente: formattedPhone,
      codigoBancoCliente: clientBankCode,
      cid: cid
    },
    supabase,
    isPreRegistration,
    totalUSD,
    runnersData,
    userId
  );

  return {
    ...result,
    isPreRegistration,
    isIframe
  };
}

// ==========================================
// RUTAS REFACTORIZADAS
// ==========================================

// Iniciar proceso de pago móvil P2C para un grupo (APP)
router.post('/mobile-payment/p2c/init', authenticateToken, async (req, res) => {
  try {
    const { 
      groupId, 
      clientPhone,
      clientBankCode,
      clientIdentification,
      amount,
      runnersCount,
      registrantEmail,
      registrantPhone,
      registrantIdentification,
      runners 
    } = req.body;

    console.log('📥 Datos recibidos en P2C init (APP):', {
      groupId,
      clientPhone,
      clientBankCode,
      clientIdentification,
      amount,
      runnersCount,
      hasRunnersData: !!runners
    });

    const result = await processP2CPayment({
      groupId,
      clientPhone,
      clientBankCode,
      clientIdentification,
      amount,
      runnersCount,
      registrantEmail,
      registrantPhone,
      registrantIdentification,
      runners,
      userEmail: req.user.email,
      userRole: req.user.role,
      userId: req.user.id,
      isIframe: false,
      supabase: req.supabase
    });

    res.json({
      success: result.success,
      transactionId: result.transactionId,
      groupId: result.groupId || groupId || null,
      groupCode: result.groupCode || null,
      control: result.control,
      invoice: result.invoice,
      amountUSD: result.amountUSD,
      amountBs: result.amountBs,
      exchangeRate: result.exchangeRate,
      message: result.message,
      voucher: result.voucher,
      reference: result.reference,
      authId: result.authId,
      status: result.success ? 'approved' : 'failed',
      isPreRegistration: result.isPreRegistration,
      groupCreated: result.groupCreated || false,
      runnersCreated: result.runnersCreated || 0,
      emailQueued: result.emailQueued || false,
      confirmationMessage: result.confirmationMessage,
      // Si es error, incluir campos adicionales
      ...(result.error ? {
        error: result.error,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        paymentDetails: result.paymentDetails,
        note: result.note
      } : {})
    });

  } catch (error) {
    console.error('Mobile payment P2C error (APP):', error);
    handleP2CError(error, res);
  }
});

// Iniciar proceso de pago móvil P2C público (IFRAME)
router.post('/mobile-payment/p2c/public/init', async (req, res) => {
  try {
    const { 
      token,
      clientPhone,
      clientBankCode,
      amount,
      runnersCount,
      registrantEmail,
      registrantPhone,
      registrantIdentification,
      registrantIdentificationType,
      runners
    } = req.body;

    console.log('📥 Datos recibidos en P2C init (IFRAME):', {
      token: token ? 'presente' : 'ausente',
      clientPhone,
      clientBankCode,
      amount,
      runnersCount,
      hasRunnersData: !!runners
    });

    // Validar token del iframe
    if (!token) {
      return res.status(400).json({ 
        success: false,
        message: 'Token de iframe requerido',
        error: 'Token requerido',
        errorCode: 'MISSING_TOKEN'
      });
    }

    // Verificar token válido y activo
    const { data: iframeToken, error: tokenError } = await req.supabase
      .from('iframe_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (tokenError || !iframeToken) {
      return res.status(401).json({ 
        success: false,
        message: 'Token inválido o expirado',
        error: 'Token inválido',
        errorCode: 'INVALID_TOKEN'
      });
    }

    // Verificar que no haya expirado
    if (new Date(iframeToken.expires_at) < new Date()) {
      return res.status(401).json({ 
        success: false,
        message: 'Token expirado',
        error: 'Token expirado',
        errorCode: 'EXPIRED_TOKEN'
      });
    }

    // Registrar uso del token
    await req.supabase
      .from('iframe_token_usage')
      .insert({
        token_id: iframeToken.id,
        action: 'payment_p2c_init',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        metadata: {
          amount,
          runnersCount,
          registrantEmail
        }
      });

    // Procesar pago usando la función unificada
    const result = await processP2CPayment({
      groupId: null, // Los iframes no tienen groupId
      clientPhone,
      clientBankCode,
      clientIdentification: registrantIdentification,
      amount,
      runnersCount,
      registrantEmail,
      registrantPhone,
      registrantIdentification,
      runners,
      userEmail: registrantEmail, // Para iframes, el email del registrante es el "usuario"
      userRole: 'public', // Rol público para iframes
      userId: null, // No hay userId para iframes
      isIframe: true,
      iframeTokenId: iframeToken.id,
      supabase: req.supabase
    });

    // Si el pago fue exitoso, incrementar contador de transacciones del token
    if (result.success) {
      await req.supabase
        .from('iframe_tokens')
        .update({ 
          transactions_count: iframeToken.transactions_count + 1 
        })
        .eq('id', iframeToken.id);

      // Registrar evento de inventario pendiente para iframe
      if (runners && runners.length > 0) {
        console.log('📝 Pago exitoso, inventario será actualizado al completar registro');
        
        await req.supabase
          .from('payment_events')
          .insert({
            transaction_id: result.transactionId,
            event_type: 'iframe_inventory_pending',
            event_data: {
              runners: runners.map(r => ({
                shirt_size: r.shirt_size,
                gender: r.gender || 'M'
              })),
              token_id: iframeToken.id
            }
          });
      }
    }

    res.json({
      success: result.success,
      transactionId: result.transactionId,
      control: result.control,
      invoice: result.invoice,
      amountUSD: result.amountUSD,
      amountBs: result.amountBs,
      exchangeRate: result.exchangeRate,
      message: result.message,
      voucher: result.voucher,
      reference: result.reference,
      authId: result.authId,
      status: result.success ? 'approved' : 'failed',
      isIframePayment: true,
      needsRegistration: true,
      inventoryVerified: runners && runners.length > 0,
      emailQueued: result.emailQueued || false,
      confirmationMessage: result.confirmationMessage
    });

  } catch (error) {
    console.error('Iframe payment P2C error:', error);
    
    // Registrar error si hay token
    if (req.body.token) {
      try {
        const { data: token } = await req.supabase
          .from('iframe_tokens')
          .select('id')
          .eq('token', req.body.token)
          .single();
        
        if (token) {
          await req.supabase
            .from('iframe_token_usage')
            .insert({
              token_id: token.id,
              action: 'payment_p2c_error',
              metadata: { error: error.message }
            });
        }
      } catch (logError) {
        console.error('Error logging iframe error:', logError);
      }
    }
    
    handleP2CError(error, res);
  }
});

function detectVoucherError(voucher) {
  if (!voucher) return null;
  
  const voucherText = Array.isArray(voucher) ? voucher.join('\n') : voucher.toString();
  const errorPatterns = [
    'ERROR_DE_TRANSACCION',
    'COMMUNICATION_ERROR',
    'TIMEOUT_ERROR',
    'INVALID_REQUEST',
    'SERVICE_UNAVAILABLE'
  ];
  
  for (const pattern of errorPatterns) {
    if (voucherText.includes(pattern)) {
      return {
        isError: true,
        errorType: pattern,
        rawVoucher: voucher
      };
    }
  }
  
  return { isError: false, rawVoucher: voucher };
}

// Función auxiliar para manejo de errores
function handleP2CError(error, res) {
  console.error('Error en P2C:', error);
  
  let statusCode = 500;
  let errorMessage = 'Error al procesar pago móvil';
  let errorCode = 'INTERNAL_ERROR';
  let voucher = null;
  let additionalData = {};

  // Si el error viene con voucher (error estructurado del gateway)
  if (error.voucher) {
    const voucherAnalysis = detectVoucherError(error.voucher);
    
    if (voucherAnalysis.isError) {
      // Es un error del gateway con voucher de error
      statusCode = 400;
      errorCode = 'GATEWAY_ERROR';
      voucher = error.voucher;
      
      // Mapear tipos de error específicos
      switch (voucherAnalysis.errorType) {
        case 'ERROR_DE_TRANSACCION':
          errorMessage = 'Error en la transacción. Verifica los datos e intenta nuevamente.';
          errorCode = 'TRANSACTION_ERROR';
          break;
        case 'COMMUNICATION_ERROR':
          errorMessage = 'Error de comunicación con el banco. Intenta nuevamente en unos minutos.';
          errorCode = 'COMM_ERROR';
          break;
        default:
          errorMessage = 'Error procesando el pago. Verifica los datos bancarios.';
      }
      
      // Incluir datos adicionales del error si existen
      additionalData = {
        control: error.control,
        reference: error.reference,
        invoice: error.invoice,
        amountUSD: error.amountUSD,
        amountBs: error.amountBs,
        exchangeRate: error.exchangeRate
      };
    }
  }
  // Error con código específico pero sin voucher
  else if (error.errorCode) {
    statusCode = 400;
    errorCode = error.errorCode;
    errorMessage = error.message || error.errorMessage || errorMessage;
  }
  // Errores de validación
  else if (error.message) {
    if (error.message.includes('Validación fallida')) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
      errorMessage = error.message;
    } else if (error.message.includes('Formato de teléfono inválido')) {
      statusCode = 400;
      errorCode = 'INVALID_PHONE';
      errorMessage = error.message;
    } else if (error.message.includes('banco') && error.message.includes('inválido')) {
      statusCode = 400;
      errorCode = 'INVALID_BANK';
      errorMessage = error.message;
    } else if (error.message.includes('Grupo no encontrado')) {
      statusCode = 404;
      errorCode = 'GROUP_NOT_FOUND';
      errorMessage = error.message;
    } else if (error.message.includes('permisos')) {
      statusCode = 403;
      errorCode = 'FORBIDDEN';
      errorMessage = error.message;
    } else if (error.message.includes('timeout')) {
      statusCode = 504;
      errorCode = 'TIMEOUT';
      errorMessage = 'Tiempo de espera agotado al procesar el pago';
    }
  }

  const response = {
    success: false,
    message: errorMessage,
    error: errorMessage,
    errorCode: errorCode,
    errorMessage: errorMessage,
    ...(voucher && { voucher }),
    ...additionalData,
    ...(error.details && { details: error.details }),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      originalError: error.message 
    })
  };

  res.status(statusCode).json(response);
}

// Función auxiliar para obtener nombre del banco
function getBankName(code) {
  const banks = {
    '0102': 'Banco de Venezuela',
    '0104': 'Banco Venezolano de Crédito',
    '0105': 'Banco Mercantil',
    '0108': 'Banco Provincial',
    '0114': 'Bancaribe',
    '0115': 'Banco Exterior',
    '0116': 'Banco Occidental de Descuento',
    '0128': 'Banco Caroní',
    '0134': 'Banesco',
    '0137': 'Banco Sofitasa',
    '0138': 'Banco Plaza',
    '0151': 'BFC Banco Fondo Común',
    '0156': '100% Banco',
    '0157': 'DelSur',
    '0163': 'Banco del Tesoro',
    '0166': 'Banco Agrícola de Venezuela',
    '0168': 'Bancrecer',
    '0169': 'Mi Banco',
    '0171': 'Banco Activo',
    '0172': 'Bancamiga',
    '0173': 'Banco Internacional de Desarrollo',
    '0174': 'Banplus',
    '0175': 'Banco Bicentenario',
    '0177': 'BANFANB',
    '0191': 'Banco Nacional de Crédito'
  };
  return banks[code] || 'Banco';
}

// Agregar esta función después de la línea 370 aproximadamente
async function transitionInventoryForPayment(groupId, supabase) {
  try {
    console.log('📦 Procesando transición de inventario para grupo:', groupId);
    
    // Obtener runners confirmados con sus tallas
    const { data: runners, error } = await supabase
      .from('runners')
      .select('id, shirt_size, gender')
      .eq('group_id', groupId)
      .eq('payment_status', 'confirmado');

    if (error || !runners?.length) {
      console.log('No se encontraron runners confirmados');
      return { success: false };
    }

    // Agrupar por talla y género
    const inventory = {};
    runners.forEach(runner => {
      const key = `${runner.shirt_size}-${runner.gender}`;
      inventory[key] = (inventory[key] || 0) + 1;
    });

    // Ejecutar transición para cada combinación
    const results = [];
    for (const [key, quantity] of Object.entries(inventory)) {
      const [shirt_size, gender] = key.split('-');
      
      const { data, error } = await supabase.rpc('transition_inventory_state', {
        p_shirt_size: shirt_size,
        p_gender: gender,
        p_quantity: quantity,
        p_from_state: 'reserved',
        p_to_state: 'assigned'
      });

      results.push({
        shirt_size,
        gender,
        quantity,
        success: !error,
        data,
        error
      });
    }

    return { 
      success: results.every(r => r.success),
      results 
    };
  } catch (error) {
    console.error('Error en transición:', error);
    return { success: false, error: error.message };
  }
}

// Función auxiliar para procesar pago de grupo (con validaciones mejoradas y manejo de error)
async function executeGroupP2CPayment(
  group, 
  paymentData, 
  supabase, 
  isPreRegistration = false, 
  totalUSDOverride = null,
  runnersData = null,
  userId = null
) {
  const startTime = Date.now();
  let transaction = null;
  let createdGroup = null;
  let createdRunners = [];
  
  try {
    console.log('=== Iniciando flujo de pago P2C ===');
    console.log('Pre-registro:', isPreRegistration);
    console.log('Grupo existente:', !!group.id);

    // Validación de datos críticos
    if (!paymentData.codigoBancoCliente) {
      throw new Error('Código de banco del cliente es requerido');
    }
    
    if (!paymentData.telefonoCliente) {
      throw new Error('Teléfono del cliente es requerido');
    }
    
    // Validar formato del teléfono
    const phoneRegex = /^04[0-9]{9}$/;
    if (!phoneRegex.test(paymentData.telefonoCliente)) {
      throw new Error('Formato de teléfono inválido. Debe ser 04XXXXXXXXX');
    }
    
    // 1. Calcular montos
    const pricePerRunner = parseFloat(process.env.RACE_PRICE_USD || '55.00');
    const totalUSD = totalUSDOverride || (pricePerRunner * group.runners.length);
    
    // Validar monto razonable
    if (totalUSD <= 0 || totalUSD > 10000) {
      throw new Error(`Monto inválido: $${totalUSD}. Verifique la configuración.`);
    }
    
    // 2. Obtener tasa de cambio
    const { amountBs, exchangeRate } = await paymentGateway.convertUSDtoBs(totalUSD, supabase);
    
    console.log('📊 CONVERSIÓN DE MONEDA:');
    console.log(`   USD: $${totalUSD}`);
    console.log(`   Tasa BCV: ${exchangeRate}`);
    console.log(`   Bs calculados: ${amountBs}`);
    
    const formattedAmountBs = formatAmount(amountBs);

    // 3. Generar factura y referencia
    const factura = `GRP${Date.now()}`;
    const referencia = generateUniqueReference();

    // 4. Preregistro con validación mejorada
    console.log('🔄 Iniciando preregistro...');
    const preregResult = await paymentGateway.preregister();
    
    if (!preregResult || !preregResult.success) {
      console.error('Error en preregistro:', preregResult);
      throw new Error('Error en preregistro: ' + (preregResult?.descripcion || 'Servicio no disponible'));
    }

    console.log('✅ Preregistro exitoso:', preregResult.control);

    // 5. Crear transacción
    const transactionData = {
      group_id: group.id || null,
      control: preregResult.control,
      invoice: factura,
      amount_usd: totalUSD,
      amount_bs: parseFloat(formattedAmountBs),
      exchange_rate: exchangeRate,
      payment_method: 'pago_movil_p2c',
      status: 'pending',
      client_phone: paymentData.telefonoCliente,
      client_bank_code: paymentData.codigoBancoCliente,
      client_identification: paymentData.cid,
      commerce_phone: formatPhone(process.env.COMMERCE_PHONE || '04141234567'),
      commerce_bank_code: process.env.COMMERCE_BANK_CODE || '0138',
      reference: referencia,
      is_pre_registration: isPreRegistration,
      terminal: null,
      lote: null,
      seqnum: null,
      auth_id: null,
      voucher: null,
      processed_at: null,
      metadata: {
        runners_count: runnersData?.length || group.runners.length,
        group_code: group.group_code || 'PENDING',
        price_per_runner: pricePerRunner,
        total_usd_calculated: totalUSD,
        exchange_rate_used: exchangeRate,
        calculation_timestamp: new Date().toISOString(),
        ...(isPreRegistration && {
          pre_registration_data: {
            registrant_email: group.registrant_email,
            registrant_phone: group.registrant_phone,
            registrant_identification: group.registrant_identification,
            runners_to_create: runnersData?.length || 0,
            created_by: userId
          }
        })
      }
    };

    const { data: newTransaction, error: transError } = await supabase
      .from('payment_transactions')
      .insert(transactionData)
      .select()
      .single();

    if (transError) {
      throw new Error('Error creando transacción: ' + transError.message);
    }

    transaction = newTransaction;
    console.log('📝 Transacción creada:', transaction.id);

    // 6. Actualizar grupo existente
    if (group.id) {
      await supabase
        .from('registration_groups')
        .update({ 
          payment_status: 'procesando',
          last_payment_attempt: new Date().toISOString()
        })
        .eq('id', group.id);
    }

    // 7. Procesar pago P2C con timeout y validación mejorada
    console.log('💳 Procesando pago P2C...');
    
    let paymentResult;
    try {
      // Agregar timeout a la llamada del gateway
      const paymentPromise = paymentGateway.processPaymentP2C({
        control: preregResult.control,
        factura: factura,
        amount: formattedAmountBs,
        cid: paymentData.cid,
        telefonoCliente: paymentData.telefonoCliente,
        codigoBancoCliente: paymentData.codigoBancoCliente,
        telefonoComercio: formatPhone(process.env.COMMERCE_PHONE || '04141234567'),
        codigoBancoComercio: process.env.COMMERCE_BANK_CODE || '0138',
        referencia: referencia
      });

      // Timeout de 30 segundos para el pago
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout procesando pago')), 30000)
      );

      paymentResult = await Promise.race([paymentPromise, timeoutPromise]);
      
    } catch (paymentError) {
      console.error('Error en gateway de pagos:', paymentError);
      
      // Si es timeout, crear un error estructurado
      if (paymentError.message.includes('Timeout')) {
        paymentResult = {
          success: false,
          codigo: 'TIMEOUT',
          descripcion: 'Tiempo de espera agotado',
          voucher: '_\n_____________ERROR_DE_TRANSACCION_\nTIMEOUT_ERROR\nTiempo de espera agotado al procesar el pago\n_'
        };
      } else {
        // Para otros errores, mantener la estructura original
        paymentResult = {
          success: false,
          codigo: 'COMM_ERROR',
          descripcion: paymentError.message || 'Error de comunicación',
          voucher: `_\n_____________ERROR_DE_TRANSACCION_\nCOMM_ERROR\n${paymentError.message || 'Error de comunicación con el servicio'}\n_`
        };
      }
    }

    // VERIFICACIÓN CRÍTICA CON DETECCIÓN DE ERRORES EN VOUCHER
    console.log('Analizando resultado del pago:', paymentResult);
    
    // Verificar si el voucher contiene un error
    const voucherAnalysis = detectVoucherError(paymentResult.voucher);
    const isApproved = paymentResult.success && 
                      paymentResult.codigo === '00' && 
                      !voucherAnalysis.isError;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`RESULTADO: ${isApproved ? '✅ APROBADO' : '❌ RECHAZADO'}`);
    console.log(`Código: ${paymentResult.codigo}`);
    console.log(`Descripción: ${paymentResult.descripcion}`);
    if (voucherAnalysis.isError) {
      console.log(`Error en voucher: ${voucherAnalysis.errorType}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 8. Actualizar transacción
    await supabase
      .from('payment_transactions')
      .update({
        status: isApproved ? 'approved' : 'failed',
        gateway_response: paymentResult,
        auth_id: paymentResult.authid || null,
        reference: paymentResult.referencia || referencia,
        voucher: paymentResult.voucher ? { text: paymentResult.voucher } : null,
        gateway_code: paymentResult.codigo,
        gateway_description: paymentResult.descripcion,
        processed_at: new Date().toISOString(),
        ...(voucherAnalysis.isError && {
          error_details: {
            voucher_error: voucherAnalysis.errorType,
            voucher_content: voucherAnalysis.rawVoucher
          }
        })
      })
      .eq('id', transaction.id);

    // LÓGICA CONDICIONAL
    if (isApproved) {
      console.log('✅ PAGO APROBADO - Procediendo con creación de registros...');
      
      // 1. Crear/actualizar grupo y runners
      const finalGroupId = await processApprovedPayment(
        group, 
        runnersData, 
        paymentResult, 
        transaction, 
        userId, 
        supabase,
        isPreRegistration,
        createdGroup,
        createdRunners
      );
      
      // 2. Encolar email para envío asíncrono
      try {
        await queueConfirmationEmail(finalGroupId, {
          priority: 'high',
          delay: 2000, // 2 segundos de delay
          retries: 3,
          metadata: {
            payment_method: paymentData.payment_method || 'pago_movil_p2c',
            transaction_id: transaction.id,
            amount_usd: totalUSD,
            amount_bs: parseFloat(formattedAmountBs),
            reference: paymentResult.referencia || referencia,
            runners_count: runnersData?.length || group.runners.length
          }
        });
        
        console.log('📧 Email de confirmación encolado exitosamente');
      } catch (emailQueueError) {
        console.error('⚠️ Error encolando email de confirmación:', emailQueueError);
        // No fallar el pago por error de email
      }

      // Actualizar inventario en el background
      const finalGroupIdForInventory = finalGroupId || createdGroup?.id || group.id;
      
      if (finalGroupIdForInventory) {
        // Dar tiempo para que se creen los runners
        setTimeout(async () => {
          const result = await transitionInventoryForPayment(finalGroupIdForInventory, supabase);

          if (result.success) {
            console.log('✅ Inventario actualizado');

            // Registrar evento
            await supabase.from('payment_events').insert({
              group_id: finalGroupIdForInventory,
              transaction_id: transaction.id,
              event_type: 'inventory_updated',
              event_data: result
            });
          } else {
            console.error('⚠️ Fallo actualización inventario:', result.error);

            // Registrar fallo sin revertir pago
            await supabase.from('payment_events').insert({
              group_id: finalGroupIdForInventory,
              transaction_id: transaction.id,
              event_type: 'inventory_update_failed',
              event_data: result
            });
          }
        }, 2000);
      }

      // Registrar evento de confirmación
      await supabase
        .from('payment_events')
        .insert({
          group_id: finalGroupId,
          transaction_id: transaction.id,
          event_type: 'payment_confirmed',
          event_data: {
            amount_usd: totalUSD,
            amount_bs: parseFloat(formattedAmountBs),
            reference: paymentResult.referencia || referencia,
            auth_id: paymentResult.authid,
            group_created: !!createdGroup,
            runners_created: createdRunners.length,
            email_queued: true
          }
        });

      // 3. Responder inmediatamente sin esperar el email
      return {
        success: true,
        transactionId: transaction.id,
        control: preregResult.control,
        invoice: factura,
        amountUSD: totalUSD,
        amountBs: parseFloat(formattedAmountBs),
        exchangeRate: exchangeRate,
        voucher: paymentResult.voucher,
        reference: paymentResult.referencia || referencia,
        authId: paymentResult.authid,
        message: paymentResult.descripcion,
        gatewayCode: paymentResult.codigo,
        groupId: finalGroupId,
        groupCode: createdGroup?.group_code || group.group_code,
        groupCreated: !!createdGroup,
        runnersCreated: createdRunners.length,
        emailQueued: true,
        confirmationMessage: 'Pago confirmado. Email de confirmación en proceso.'
      };
      
    } else {
      // PAGO RECHAZADO
      console.log('❌ PAGO RECHAZADO - No se crearán registros');
      
      if (group.id) {
        await supabase
          .from('registration_groups')
          .update({ 
            payment_status: 'rechazado',
            rejection_reason: `${paymentResult.codigo}: ${paymentResult.descripcion}`
          })
          .eq('id', group.id);
      }
      
      await supabase
        .from('payment_events')
        .insert({
          group_id: group.id || null,
          transaction_id: transaction.id,
          event_type: 'payment_rejected',
          event_data: {
            gateway_code: paymentResult.codigo,
            reason: paymentResult.descripcion,
            voucher_error: voucherAnalysis.isError,
            error_type: voucherAnalysis.errorType
          }
        });

      // Crear error estructurado para el frontend
      const errorResponse = {
        success: false,
        transactionId: transaction.id,
        control: preregResult.control,
        invoice: factura,
        amountUSD: totalUSD,
        amountBs: parseFloat(formattedAmountBs),
        exchangeRate: exchangeRate,
        voucher: paymentResult.voucher,
        reference: paymentResult.referencia || referencia,
        authId: paymentResult.authid,
        message: paymentResult.descripcion,
        gatewayCode: paymentResult.codigo,
        error: paymentResult.descripcion,
        errorCode: voucherAnalysis.isError ? voucherAnalysis.errorType : paymentResult.codigo,
        emailQueued: false,
        note: isPreRegistration ? 
          'Pago rechazado. No se creó grupo ni corredores.' : 
          'Pago rechazado. No se crearon corredores.',
        isVoucherError: voucherAnalysis.isError,
        canRetry: ['COMM_ERROR', 'TIMEOUT', 'ERROR_DE_TRANSACCION'].includes(paymentResult.codigo)
      };

      // Si es un error de comunicación, lanzar excepción estructurada
      if (voucherAnalysis.isError) {
        const structuredError = new Error(paymentResult.descripcion || 'Error en la transacción');
        Object.assign(structuredError, errorResponse);
        throw structuredError;
      }

      return errorResponse;
    }

  } catch (error) {
    console.error('❌ Error crítico en flujo P2C:', error);
    
    if (transaction && supabase) {
      await supabase
        .from('payment_transactions')
        .update({
          status: 'failed',
          gateway_response: { 
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
          },
          failed_at: new Date().toISOString()
        })
        .eq('id', transaction.id);
    }
    
    throw error;
  }
}

// Función auxiliar para procesar el pago aprobado
async function processApprovedPayment(
  group, 
  runnersData, 
  paymentResult, 
  transaction, 
  userId, 
  supabase,
  isPreRegistration,
  createdGroup,
  createdRunners
) {
  // CASO 1: Pre-registro aprobado
  if (isPreRegistration && !group.id) {
    console.log('📝 Creando grupo nuevo post-aprobación...');
    
    const groupCode = `G${Date.now().toString(36).toUpperCase()}`;
    
    const { data: newGroup, error: groupError } = await supabase
      .from('registration_groups')
      .insert({
        group_code: groupCode,
        registrant_email: group.registrant_email,
        registrant_phone: group.registrant_phone,
        registrant_identification: group.registrant_identification,
        total_runners: runnersData?.length || group.runners.length,
        payment_method: 'pago_movil_p2c',
        payment_reference: paymentResult.referencia || transaction.reference,
        payment_status: 'confirmado',
        payment_confirmed_at: new Date().toISOString(),
        payment_date: new Date().toISOString(),
        payment_transaction_id: transaction.id,
        created_by: userId,
        reserved_until: null
      })
      .select()
      .single();

    if (groupError) {
      throw new Error('Pago aprobado pero error creando grupo: ' + groupError.message);
    }

    createdGroup = newGroup;
    console.log(`✅ Grupo ${groupCode} creado`);

    // Actualizar transacción
    await supabase
      .from('payment_transactions')
      .update({ 
        group_id: newGroup.id,
        metadata: {
          ...transaction.metadata,
          group_created: true,
          group_id: newGroup.id,
          group_code: groupCode
        }
      })
      .eq('id', transaction.id);

    // Crear corredores
    if (runnersData && runnersData.length > 0) {
      const runnersToInsert = runnersData.map((runner, index) => ({
        full_name: runner.full_name || `Corredor ${index + 1}`,
        identification_type: runner.identification_type || 'V',
        identification: runner.identification || `TEMP-${Date.now()}-${index}`,
        birth_date: runner.birth_date,
        gender: runner.gender || 'M',
        email: runner.email,
        phone: runner.phone,
        shirt_size: runner.shirt_size || 'M',
        group_id: newGroup.id,
        payment_status: 'confirmado',
        payment_confirmed_at: new Date().toISOString(),
        payment_reference: paymentResult.referencia || transaction.reference,
        registered_by: userId
      }));

      const { data: insertedRunners } = await supabase
        .from('runners')
        .insert(runnersToInsert)
        .select();

      if (insertedRunners) {
        createdRunners = insertedRunners;
        console.log(`✅ ${insertedRunners.length} corredores creados`);
        
        // Asignar números
        try {
          if (typeof assignRunnerNumbers === 'function') {
            const numberAssignment = await assignRunnerNumbers(newGroup.id, supabase);
            if (numberAssignment.success) {
              console.log(`✅ Dorsales asignados: ${numberAssignment.assigned}`);
            }
          }
        } catch (error) {
          console.error('Error asignando dorsales:', error);
        }
      }
    }

    return newGroup.id;
    
  // CASO 2: Grupo existente
  } else if (group.id) {
    console.log('📝 Procesando grupo existente...');
    
    // Verificar si hay corredores
    const { data: existingRunners } = await supabase
      .from('runners')
      .select('id, shirt_size, gender')
      .eq('group_id', group.id);
    
    if (!existingRunners || existingRunners.length === 0) {
      // Buscar runners pendientes en payment_events
      const { data: pendingEvent } = await supabase
        .from('payment_events')
        .select('event_data')
        .eq('group_id', group.id)
        .eq('event_type', 'pending_runners_p2c')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (pendingEvent?.event_data?.runners) {
        const pendingRunners = pendingEvent.event_data.runners;
        console.log(`📝 Creando ${pendingRunners.length} corredores desde eventos...`);
        
        const runnersToInsert = pendingRunners.map(runner => ({
          ...runner,
          group_id: group.id,
          payment_status: 'confirmado',
          payment_confirmed_at: new Date().toISOString(),
          payment_reference: paymentResult.referencia || transaction.reference,
          registered_by: userId
        }));
        
        const { data: insertedRunners } = await supabase
          .from('runners')
          .insert(runnersToInsert)
          .select();
        
        if (insertedRunners) {
          createdRunners = insertedRunners;
          console.log(`✅ ${insertedRunners.length} corredores creados`);
        }
      }
    } else {
      // Actualizar corredores existentes
      await supabase
        .from('runners')
        .update({ 
          payment_status: 'confirmado',
          payment_confirmed_at: new Date().toISOString(),
          payment_reference: paymentResult.referencia || transaction.reference
        })
        .eq('group_id', group.id);
    }
    
    // Actualizar grupo
    await supabase
      .from('registration_groups')
      .update({ 
        payment_status: 'confirmado',
        payment_date: new Date().toISOString(),
        payment_reference: paymentResult.referencia || transaction.reference,
        payment_transaction_id: transaction.id
      })
      .eq('id', group.id);

    // Asignar números
    try {
      if (typeof assignRunnerNumbers === 'function') {
        const numberAssignment = await assignRunnerNumbers(group.id, supabase);
        if (numberAssignment.success) {
          console.log(`✅ Dorsales asignados: ${numberAssignment.assigned}`);
        }
      }
    } catch (error) {
      console.error('Error asignando dorsales:', error);
    }

    return group.id;
  }

  return null;
}

// 2. Endpoint para completar registro después del pago iframe
router.post('/iframe/complete-registration', async (req, res) => {
  try {
    const {
      token,
      transactionId,
      registrant_email,
      registrant_phone,
      registrant_identification_type,
      registrant_identification,
      runners
    } = req.body;

    // Validar token
    const { data: iframeToken, error: tokenError } = await req.supabase
      .from('iframe_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (tokenError || !iframeToken) {
      return res.status(401).json({ 
        message: 'Token inválido' 
      });
    }

    // Verificar que la transacción existe y está aprobada
    const { data: transaction, error: transError } = await req.supabase
      .from('payment_transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('status', 'approved')
      .single();

    if (transError || !transaction) {
      return res.status(404).json({ 
        message: 'Transacción no encontrada o no aprobada' 
      });
    }

    // Verificar que la transacción es de este iframe
    if (transaction.metadata?.iframe_token_id !== iframeToken.id) {
      return res.status(403).json({ 
        message: 'Transacción no autorizada' 
      });
    }

    // Crear el grupo de registro
    const groupCode = `GRP${Date.now().toString(36).toUpperCase()}`;
    
    const { data: group, error: groupError } = await req.supabase
      .from('registration_groups')
      .insert({
        group_code: groupCode,
        registrant_email,
        registrant_phone,
        registrant_identification_type,
        registrant_identification,
        total_runners: runners.length,
        payment_method: 'pago_movil_p2c',
        payment_reference: transaction.reference,
        payment_status: 'confirmado', 
        payment_confirmed_at: transaction.processed_at,
        payment_transaction_id: transaction.id,
        payment_date: transaction.processed_at,
        reserved_until: null,
        metadata: {
          iframe_token: token,
          iframe_token_id: iframeToken.id
        }
      })
      .select()
      .single();

    if (groupError) {
      console.error('Error creating group:', groupError);
      return res.status(500).json({ 
        message: 'Error al crear grupo de registro' 
      });
    }

    // Insertar corredores
    const runnersToInsert = runners.map(runner => ({
      ...runner,
      gender: runner.gender || 'M', // CRÍTICO: Asegurar género
      group_id: group.id,
      payment_status: 'confirmado',
      payment_confirmed_at: transaction.processed_at,
      payment_reference: transaction.reference,
      registered_by: iframeToken.user_id
    }));

    const { data: insertedRunners, error: runnersError } = await req.supabase
      .from('runners')
      .insert(runnersToInsert)
      .select();

    if (runnersError) {
      await req.supabase
        .from('registration_groups')
        .delete()
        .eq('id', group.id);

      return res.status(500).json({ 
        message: 'Error al registrar corredores' 
      });
    }

    try {
      const inventoryResult = await transitionInventoryForPayment(group.id, req.supabase);
      
      if (!inventoryResult.success) {
        console.error('⚠️ Error actualizando inventario:', inventoryResult.error);
        // NO revertir, solo registrar el error
        await req.supabase
          .from('payment_events')
          .insert({
            group_id: group.id,
            transaction_id: transaction.id,
            event_type: 'iframe_inventory_failed',
            event_data: inventoryResult
          });
      }
    } catch (error) {
      console.error('Error en transición de inventario iframe:', error);
    }

    // Actualizar la transacción con el group_id
    await req.supabase
      .from('payment_transactions')
      .update({ 
        group_id: group.id,
        metadata: {
          ...transaction.metadata,
          registration_completed: true,
          registration_date: new Date().toISOString()
        }
      })
      .eq('id', transaction.id);

    // Asignar números de corredor
    try {
      const { assignRunnerNumbers } = await import('../utils/runnerNumberAssignment.js');
      await assignRunnerNumbers(group.id, req.supabase);
    } catch (error) {
      console.error('Error asignando números:', error);
    }

    res.json({
      success: true,
      message: 'Registro completado exitosamente',
      group: {
        ...group,
        runners: insertedRunners
      }
    });

  } catch (error) {
    console.error('Complete registration error:', error);
    res.status(500).json({ 
      message: 'Error al completar registro' 
    });
  }
});

// Consultar estado de pago
router.get('/payment-status/:control', authenticateToken, async (req, res) => {
  try {
    const { control } = req.params;

    // Buscar transacción por control
    const { data: transaction, error: transError } = await req.supabase
      .from('payment_transactions')
      .select(`
        *,
        group:registration_groups!group_id(
          id,
          group_code,
          registrant_email,
          total_runners,
          payment_status,
          runners(
            id,
            full_name,
            email,
            identification,
            identification_type,
            shirt_size
          )
        )
      `)
      .eq('control', control)
      .single();

    if (transError || !transaction) {
      return res.status(404).json({ message: 'Transacción no encontrada' });
    }

    // Verificar permisos
    const canAccess = 
      (transaction.group && transaction.group.registrant_email === req.user.email) || 
      req.user.role === 'admin' || 
      req.user.role === 'tienda';

    if (!canAccess) {
      return res.status(403).json({ 
        message: 'No tienes permisos para consultar este pago' 
      });
    }

    // Si el pago está pendiente, consultar estado en el gateway
    if (transaction.status === 'pending' || transaction.status === 'processing') {
      try {
        console.log('Consultando estado en gateway para control:', control);
        const statusResult = await paymentGateway.queryStatus(control, 'P2C');
        
        console.log('Resultado de consulta:', statusResult);

        // Actualizar estado si cambió
        if (statusResult.estado === 'A' && transaction.status !== 'approved') {
          // Pago aprobado
          await req.supabase
            .from('payment_transactions')
            .update({
              status: 'approved',
              gateway_response: statusResult,
              reference: statusResult.referencia || transaction.reference,
              auth_id: statusResult.authid || transaction.auth_id,
              terminal: statusResult.terminal || transaction.terminal,
              lote: statusResult.lote || transaction.lote,
              seqnum: statusResult.seqnum || transaction.seqnum,
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.id);

          if (transaction.group_id) {
            // Confirmar el pago del grupo
            await req.supabase
              .from('registration_groups')
              .update({ 
                payment_status: 'confirmado',
                payment_date: new Date().toISOString(),
                payment_reference: statusResult.referencia
              })
              .eq('id', transaction.group_id);

            // Actualizar corredores
            await req.supabase
              .from('runners')
              .update({ 
                payment_status: 'confirmado',
                payment_confirmed_at: new Date().toISOString()
              })
              .eq('group_id', transaction.group_id);
          }

          transaction.status = 'approved';
          transaction.reference = statusResult.referencia;
          transaction.auth_id = statusResult.authid;

        } else if (statusResult.estado === 'R' && transaction.status !== 'failed') {
          // Pago rechazado
          await req.supabase
            .from('payment_transactions')
            .update({
              status: 'failed',
              gateway_response: statusResult,
              failed_at: new Date().toISOString()
            })
            .eq('id', transaction.id);

          if (transaction.group_id) {
            // Actualizar estado del grupo
            await req.supabase
              .from('registration_groups')
              .update({ 
                payment_status: 'rechazado',
                rejection_reason: statusResult.descripcion
              })
              .eq('id', transaction.group_id);
          }

          transaction.status = 'failed';
        }

        res.json({
          transactionId: transaction.id,
          groupId: transaction.group_id,
          groupCode: transaction.group?.group_code,
          status: statusResult.estado === 'A' ? 'approved' : statusResult.estado === 'R' ? 'failed' : 'pending',
          gatewayStatus: statusResult.estado,
          gatewayCode: statusResult.codigo,
          description: statusResult.descripcion,
          amountUSD: transaction.amount_usd,
          amountBs: transaction.amount_bs,
          exchangeRate: transaction.exchange_rate,
          reference: statusResult.referencia || transaction.reference,
          authId: statusResult.authid || transaction.auth_id,
          totalRunners: transaction.group?.total_runners,
          runners: transaction.group?.runners,
          lastChecked: new Date().toISOString()
        });

      } catch (gatewayError) {
        console.error('Gateway query error:', gatewayError);
        // Devolver estado de la BD si falla la consulta
        res.json({
          transactionId: transaction.id,
          groupId: transaction.group_id,
          groupCode: transaction.group?.group_code,
          status: transaction.status,
          amountUSD: transaction.amount_usd,
          amountBs: transaction.amount_bs,
          exchangeRate: transaction.exchange_rate,
          reference: transaction.reference,
          authId: transaction.auth_id,
          totalRunners: transaction.group?.total_runners,
          runners: transaction.group?.runners,
          voucher: transaction.voucher,
          error: 'No se pudo consultar el estado actual en el gateway',
          lastKnownUpdate: transaction.updated_at
        });
      }
    } else {
      // Devolver estado almacenado
      res.json({
        transactionId: transaction.id,
        groupId: transaction.group_id,
        groupCode: transaction.group?.group_code,
        status: transaction.status,
        amountUSD: transaction.amount_usd,
        amountBs: transaction.amount_bs,
        exchangeRate: transaction.exchange_rate,
        reference: transaction.reference,
        authId: transaction.auth_id,
        totalRunners: transaction.group?.total_runners,
        runners: transaction.group?.runners,
        voucher: transaction.voucher,
        processedAt: transaction.processed_at
      });
    }

  } catch (error) {
    console.error('Status query error:', error);
    res.status(500).json({ 
      message: 'Error al consultar estado',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

// Obtener bancos disponibles
router.get('/banks', async (req, res) => {
  try {
    // Obtener lista de bancos desde la base de datos
    const { data: banks, error } = await req.supabase
      .from('banks')
      .select('code, name, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({ 
      success: true,
      banks: banks || [],
      total: banks?.length || 0 
    });
  } catch (error) {
    console.error('Error obteniendo bancos:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error obteniendo lista de bancos',
      banks: []
    });
  }
});

// Obtener tasa de cambio actual
router.get('/exchange-rate', async (req, res) => {
  try {
    // Obtener tasa actual pasando la instancia de supabase
    const { amountBs, exchangeRate } = await paymentGateway.convertUSDtoBs(1, req.supabase);
    
    // Obtener precio por corredor
    const pricePerRunner = parseFloat(process.env.RACE_PRICE_USD || '55.00');
    
    // Calcular precio en bolívares
    const { amountBs: priceBs } = await paymentGateway.convertUSDtoBs(pricePerRunner, req.supabase);
    
    res.json({
      success: true,
      rateUSD: exchangeRate,
      priceUSD: pricePerRunner,
      priceBs: formatAmount(priceBs),
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    console.error('Exchange rate error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error obteniendo tasa de cambio',
      error: error.message
    });
  }
});

// Obtener transacciones de un grupo
router.get('/group/:groupId/transactions', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;

    // Verificar que el grupo existe
    const { data: group, error: groupError } = await req.supabase
      .from('registration_groups')
      .select('registrant_email')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Verificar permisos
    const canAccess = 
      group.registrant_email === req.user.email || 
      req.user.role === 'admin' || 
      req.user.role === 'tienda';

    if (!canAccess) {
      return res.status(403).json({ 
        message: 'No tienes permisos para ver estas transacciones' 
      });
    }

    // Obtener transacciones
    const { data: transactions, error } = await req.supabase
      .from('payment_transactions')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ 
      success: true,
      transactions: transactions || [],
      total: transactions?.length || 0
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error obteniendo transacciones' 
    });
  }
});

// Test de conexión al gateway (solo para admin)
router.get('/test-connection', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const result = await paymentGateway.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message,
      details: error.response?.data
    });
  }
});

// Test completo de P2C (solo para admin en desarrollo)
router.post('/test-p2c', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ 
      message: 'Test no disponible en producción' 
    });
  }

  try {
    const result = await paymentGateway.testP2CPayment();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message,
      details: error.response?.data
    });
  }
});

// Webhook para notificaciones del gateway
router.post('/webhook', async (req, res) => {
  try {
    // Log del webhook recibido
    console.log('Webhook recibido:', {
      headers: req.headers,
      body: req.body,
      ip: req.ip
    });

    // Verificar IP de origen si está configurado
    const allowedIPs = process.env.GATEWAY_WEBHOOK_IPS?.split(',').filter(ip => ip.trim());
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (allowedIPs && allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      console.warn(`Webhook rechazado desde IP no autorizada: ${clientIP}`);
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Verificar firma si existe
    const signature = req.headers['x-gateway-signature'];
    if (signature && process.env.GATEWAY_WEBHOOK_SECRET) {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.GATEWAY_WEBHOOK_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.warn('Firma de webhook inválida');
        return res.status(401).json({ message: 'Invalid signature' });
      }
    }

    const { control, estado, codigo, referencia, authid } = req.body;

    if (!control || !estado) {
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    // Buscar transacción
    const { data: transaction, error } = await req.supabase
      .from('payment_transactions')
      .select('*')
      .eq('control', control)
      .single();

    if (error || !transaction) {
      console.error('Transacción no encontrada:', control);
      return res.status(404).json({ message: 'Transacción no encontrada' });
    }

    // Mapear estado
    let newStatus = transaction.status;
    if (estado === 'A') {
      newStatus = 'approved';
    } else if (estado === 'R') {
      newStatus = 'failed';
    }

    console.log('Actualizando transacción:', {
      id: transaction.id,
      oldStatus: transaction.status,
      newStatus: newStatus
    });

    // Actualizar transacción
    await req.supabase
      .from('payment_transactions')
      .update({
        status: newStatus,
        gateway_response: req.body,
        reference: referencia || transaction.reference,
        auth_id: authid || transaction.auth_id,
        processed_at: new Date().toISOString(),
        webhook_received_at: new Date().toISOString()
      })
      .eq('id', transaction.id);

    // Si fue aprobado, confirmar el pago del grupo
    if (newStatus === 'approved' && transaction.status !== 'approved' && transaction.group_id) {
      await req.supabase
        .from('registration_groups')
        .update({ 
          payment_status: 'confirmado',
          payment_date: new Date().toISOString(),
          payment_reference: referencia
        })
        .eq('id', transaction.group_id);

      // Actualizar corredores
      await req.supabase
        .from('runners')
        .update({ 
          payment_status: 'confirmado',
          payment_confirmed_at: new Date().toISOString()
        })
        .eq('group_id', transaction.group_id);

      // Registrar evento
      await req.supabase
        .from('payment_events')
        .insert({
          group_id: transaction.group_id,
          transaction_id: transaction.id,
          event_type: 'webhook_payment_confirmed',
          event_data: req.body
        });

    } else if (newStatus === 'failed' && transaction.group_id) {
      await req.supabase
        .from('registration_groups')
        .update({ 
          payment_status: 'rechazado',
          rejection_reason: `Código: ${codigo} - ${estado}`
        })
        .eq('id', transaction.group_id);

      // Registrar evento
      await req.supabase
        .from('payment_events')
        .insert({
          group_id: transaction.group_id,
          transaction_id: transaction.id,
          event_type: 'webhook_payment_rejected',
          event_data: req.body
        });
    }

    res.json({ 
      received: true,
      status: newStatus,
      transactionId: transaction.id 
    });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: 'Error procesando webhook' });
  }
});

// Obtener errores de pago (admin only)
router.get('/payment-errors', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const { data: errors, count } = await req.supabase
      .from('payment_errors')
      .select(`
        *,
        group:registration_groups!group_id(
          group_code,
          registrant_email
        ),
        transaction:payment_transactions!transaction_id(
          control,
          invoice
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    res.json({
      success: true,
      errors: errors || [],
      total: count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Get payment errors:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error obteniendo errores de pago' 
    });
  }
});

// Endpoint para regenerar voucher
router.get('/voucher/:transactionId', authenticateToken, async (req, res) => {
  try {
    const { transactionId } = req.params;

    // Obtener transacción
    const { data: transaction, error } = await req.supabase
      .from('payment_transactions')
      .select(`
        *,
        group:registration_groups!group_id(
          id,
          group_code,
          registrant_email,
          total_runners
        )
      `)
      .eq('id', transactionId)
      .single();

    if (error || !transaction) {
      return res.status(404).json({ message: 'Transacción no encontrada' });
    }

    // Verificar permisos
    const canAccess = 
      (transaction.group && transaction.group.registrant_email === req.user.email) || 
      req.user.role === 'admin' || 
      req.user.role === 'tienda';

    if (!canAccess) {
      return res.status(403).json({ 
        message: 'No tienes permisos para ver este voucher' 
      });
    }

    // Solo mostrar voucher si el pago fue aprobado
    if (transaction.status !== 'approved') {
      return res.status(400).json({ 
        message: 'Solo se puede generar voucher para pagos aprobados' 
      });
    }

    res.json({
      success: true,
      voucher: transaction.voucher,
      transaction: {
        id: transaction.id,
        invoice: transaction.invoice,
        control: transaction.control,
        amountUSD: transaction.amount_usd,
        amountBs: transaction.amount_bs,
        exchangeRate: transaction.exchange_rate,
        reference: transaction.reference,
        authId: transaction.auth_id,
        processedAt: transaction.processed_at
      },
      group: transaction.group ? {
        code: transaction.group.group_code,
        totalRunners: transaction.group.total_runners
      } : null
    });

  } catch (error) {
    console.error('Get voucher error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error obteniendo voucher' 
    });
  }
});

export default router;