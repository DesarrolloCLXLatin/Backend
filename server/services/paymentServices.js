// server/services/paymentGateway.js
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { createClient } from '@supabase/supabase-js';
import megasoftService from './megasoftService.js'; // IMPORTANTE: Importar el servicio real
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

class PaymentGatewayService {
  constructor() {
    // Configuración del gateway - USAR LAS MISMAS QUE MEGASOFT
    this.baseURL = process.env.PAYMENT_GATEWAY_URL || 'https://paytest.megasoft.com.ve';
    this.codAfiliacion = process.env.PAYMENT_COD_AFILIACION || '20250325';
    this.username = process.env.PAYMENT_USERNAME || 'multimax';
    this.password = process.env.PAYMENT_PASSWORD || 'Caracas123.1';
    
    // Crear autenticación Basic
    this.authHeader = `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
    
    // Configuración de la carrera
    this.racePriceUSD = parseFloat(process.env.RACE_PRICE_USD || '55.00');
    
    // Datos del comercio para P2C
    this.commercePhone = process.env.COMMERCE_PHONE || '04141234567';
    this.commerceBankCode = process.env.COMMERCE_BANK_CODE || '0138';
    
    // Inicializar Supabase solo si tenemos las credenciales
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    } else {
      console.warn('Supabase no configurado en PaymentGatewayService - algunas funciones pueden no estar disponibles');
      this.supabase = null;
    }
  }

  // Crear XML request body
  createXMLRequest(params) {
    const xmlLines = ['<request>'];
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        xmlLines.push(`    <${key}>${value}</${key}>`);
      }
    });
    
    xmlLines.push('</request>');
    return xmlLines.join('\n');
  }

  // Parsear respuesta XML a JSON
  async parseXMLResponse(xmlData) {
    try {
      const result = await parseStringPromise(xmlData, {
        explicitArray: false,
        ignoreAttrs: true,
        trim: true
      });
      
      return result.response || result;
    } catch (error) {
      console.error('Error parsing XML:', error);
      console.error('XML recibido:', xmlData);
      throw new Error('Error al procesar respuesta del gateway');
    }
  }

  // Procesar voucher desde la respuesta - MEJORADO
  processVoucher(voucherData) {
    if (!voucherData) {
      return {
        text: null,
        lines: [],
        isDuplicated: false
      };
    }

    let voucherLines = [];
    let isDuplicated = false;

    try {
      // Si es un array de líneas
      if (Array.isArray(voucherData)) {
        voucherLines = voucherData.map(line => {
          const lineText = typeof line === 'string' ? line : String(line);
          if (lineText.includes('DUPLICADO')) {
            isDuplicated = true;
          }
          return lineText;
        });
      }
      // Si es un string directo
      else if (typeof voucherData === 'string') {
        voucherLines = voucherData.split('\n').filter(line => line.trim());
        if (voucherData.includes('DUPLICADO')) {
          isDuplicated = true;
        }
      }
      // Si es un objeto con estructura de voucher
      else if (typeof voucherData === 'object') {
        if (voucherData.text) {
          // Ya procesado por megasoftService
          return {
            text: voucherData.text,
            lines: voucherData.text.split('\n').filter(line => line.trim()),
            isDuplicated: voucherData.text.includes('DUPLICADO')
          };
        } else if (Array.isArray(voucherData.linea)) {
          // Múltiples líneas
          voucherLines = voucherData.linea.map(line => {
            if (typeof line === 'object' && line.UT) {
              if (line.UT.includes('DUPLICADO')) {
                isDuplicated = true;
              }
              return line.UT;
            }
            return typeof line === 'string' ? line : JSON.stringify(line);
          });
        } else if (voucherData.linea) {
          // Una sola línea
          const line = voucherData.linea;
          if (typeof line === 'object' && line.UT) {
            if (line.UT.includes('DUPLICADO')) {
              isDuplicated = true;
            }
            voucherLines = [line.UT];
          } else {
            voucherLines = [typeof line === 'string' ? line : JSON.stringify(line)];
          }
        }
      }

      // Limpiar y procesar líneas
      const processedLines = voucherLines
        .filter(line => line && line.trim())
        .map(line => line.trim().replace(/_/g, ' '));

      return {
        text: processedLines.join('\n'),
        lines: processedLines,
        isDuplicated: isDuplicated
      };

    } catch (error) {
      console.error('Error procesando voucher:', error);
      return {
        text: typeof voucherData === 'string' ? voucherData : JSON.stringify(voucherData),
        lines: [],
        isDuplicated: false
      };
    }
  }

  // Obtener tasa de cambio actual desde Supabase
  async getCurrentExchangeRateWithSupabase(supabaseInstance) {
    try {
      if (!supabaseInstance) {
        throw new Error('No se proporcionó instancia de Supabase');
      }

      // Obtener la tasa más reciente
      const { data: rate, error } = await supabaseInstance
        .from('exchange_rates')
        .select('rate')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error obteniendo tasa de BD:', error);
        throw error;
      }

      if (!rate || !rate.rate) {
        throw new Error('No hay tasa de cambio disponible en la base de datos');
      }

      console.log('📊 Tasa obtenida de BD:', rate.rate);
      return parseFloat(rate.rate);

    } catch (error) {
      console.error('Error obteniendo tasa de cambio:', error);

      // Fallback de emergencia si está configurado
      if (process.env.FALLBACK_EXCHANGE_RATE) {
        console.warn('⚠️ Usando tasa de emergencia:', process.env.FALLBACK_EXCHANGE_RATE);
        return parseFloat(process.env.FALLBACK_EXCHANGE_RATE);
      }

      throw new Error('No se pudo obtener la tasa de cambio actual: ' + error.message);
    }
  }

  // Convertir USD a Bolívares - VERSIÓN MEJORADA
  async convertUSDtoBs(amountUSD, supabaseInstance = null) {
    try {
      // Usar la instancia proporcionada o intentar con la propia
      let exchangeRate;

      if (supabaseInstance) {
        exchangeRate = await this.getCurrentExchangeRateWithSupabase(supabaseInstance);
      } else if (this.supabase) {
        exchangeRate = await this.getCurrentExchangeRateWithSupabase(this.supabase);
      } else {
        // Fallback si no hay Supabase
        exchangeRate = parseFloat(process.env.FALLBACK_EXCHANGE_RATE || '40');
      }

      console.log('💱 Conversión USD a Bs:');
      console.log(`   Monto USD: $${amountUSD}`);
      console.log(`   Tasa BCV actual: ${exchangeRate}`);

      // Calcular el monto en Bolívares
      const amountBs = amountUSD * exchangeRate;

      console.log(`   Monto Bs calculado: ${amountBs}`);
      console.log(`   Monto Bs formateado: ${amountBs.toFixed(2)}`);

      return {
        amountBs: parseFloat(amountBs.toFixed(2)),
        exchangeRate: exchangeRate
      };
    } catch (error) {
      console.error('Error en conversión USD a Bs:', error);
      throw error;
    }
  }

  // Preregistro - USAR MEGASOFT SERVICE
  async preregister() {
    try {
      console.log('🔄 Delegando preregistro a MegasoftService...');
      
      // USAR MEGASOFT SERVICE REAL
      const result = await megasoftService.preRegistro();
      
      // Adaptar respuesta al formato esperado
      return {
        success: result.success,
        control: result.control,
        descripcion: result.descripcion
      };
      
    } catch (error) {
      console.error('Error en preregistro:', error.message);
      throw error;
    }
  }

  // Pago móvil P2C - INTEGRACIÓN CON MEGASOFT SERVICE
// Reemplazar el método processPaymentP2C en paymentServices.js con este código corregido

async processPaymentP2C(paymentData) {
  try {
    console.log('🔄 Delegando pago P2C a MegasoftService...');
    console.log('📋 Datos recibidos en processPaymentP2C:', paymentData);
    
    // CORRECCIÓN CRÍTICA: Normalizar nombres de campos
    // Aceptar tanto 'codigoBancoCliente' como 'codigobancoCliente'
    const codigoBancoCliente = paymentData.codigoBancoCliente || 
                               paymentData.codigobancoCliente || 
                               paymentData.clientBankCode;
    
    if (!codigoBancoCliente) {
      console.error('❌ Código de banco no encontrado en ninguna variante:', {
        codigoBancoCliente: paymentData.codigoBancoCliente,
        codigobancoCliente: paymentData.codigobancoCliente,
        clientBankCode: paymentData.clientBankCode
      });
      
      const error = new Error('Validación fallida: Banco del cliente es requerido, Código de banco cliente inválido: undefined');
      error.codigo = 'COMM_ERROR';
      error.voucher = this.generateErrorVoucher('Banco del cliente es requerido', paymentData);
      throw error;
    }
    
    // Validar datos críticos
    const requiredFields = {
      control: paymentData.control,
      factura: paymentData.factura,
      amount: paymentData.amount,
      cid: paymentData.cid,
      telefonoCliente: paymentData.telefonoCliente,
      codigoBancoCliente: codigoBancoCliente,
      referencia: paymentData.referencia
    };
    
    const missingFields = [];
    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      console.error('❌ Campos faltantes:', missingFields);
      const errorMessage = `Validación fallida: ${missingFields.map(f => {
        if (f === 'codigoBancoCliente') {
          return 'Banco del cliente es requerido';
        }
        return `${f} es requerido`;
      }).join(', ')}`;
      
      const error = new Error(errorMessage);
      error.codigo = 'COMM_ERROR';
      error.voucher = this.generateErrorVoucher(errorMessage, paymentData);
      throw error;
    }

    console.log('✅ Procesando pago P2C con MegasoftService:', {
      control: paymentData.control,
      factura: paymentData.factura,
      amount: paymentData.amount,
      telefonoCliente: paymentData.telefonoCliente,
      codigoBancoCliente: codigoBancoCliente,
      cid: paymentData.cid,
      referencia: paymentData.referencia
    });

    // Formatear teléfonos
    const telefonoCliente = this.formatPhoneNumber(paymentData.telefonoCliente);
    const telefonoComercio = this.formatPhoneNumber(
      paymentData.telefonoComercio || this.commercePhone
    );

    // Preparar datos para MegasoftService con el nombre correcto del campo
    const megasoftPaymentData = {
      control: paymentData.control,
      factura: paymentData.factura,
      amount: paymentData.amount,
      telefonoCliente: telefonoCliente,
      codigoBancoCliente: codigoBancoCliente, // Usar el valor normalizado
      referencia: paymentData.referencia || this.generateUniqueReference(),
      cid: paymentData.cid || paymentData.clientIdentification || 'V00000000'
    };

    console.log('📤 Enviando a MegasoftService con datos normalizados:', megasoftPaymentData);

    // LLAMAR AL SERVICIO REAL DE MEGASOFT
    const result = await megasoftService.procesarCompraP2C(megasoftPaymentData);

    console.log('✅ Resultado de MegasoftService:', {
      success: result.success,
      codigo: result.codigo,
      descripcion: result.descripcion,
      hasVoucher: !!result.voucherText || !!result.voucher,
      referencia: result.referencia
    });

    // Procesar voucher correctamente
    let voucherData = null;
    let isDuplicated = false;

    // Preferir voucherText si está disponible, sino usar voucher
    if (result.voucherText) {
      voucherData = result.voucherText;
      isDuplicated = result.voucherText.includes('DUPLICADO');
    } else if (result.voucher) {
      // Si voucher es un array, convertirlo a texto
      if (Array.isArray(result.voucher)) {
        voucherData = result.voucher.join('\n');
      } else if (typeof result.voucher === 'string') {
        voucherData = result.voucher;
      } else {
        // Si es otro tipo, intentar procesarlo
        const processedVoucher = this.processVoucher(result.voucher);
        voucherData = processedVoucher.text;
        isDuplicated = processedVoucher.isDuplicated;
      }
      
      // Verificar si es duplicado
      if (!isDuplicated && voucherData) {
        isDuplicated = voucherData.includes('DUPLICADO');
      }
    }

    console.log('📝 Voucher procesado:', {
      hasVoucher: !!voucherData,
      isDuplicated: isDuplicated,
      linesCount: voucherData ? voucherData.split('\n').length : 0
    });

    // Construir respuesta compatible con el formato esperado
    const paymentResult = {
      success: result.success,
      codigo: result.codigo,
      descripcion: result.descripcion,
      authid: result.authid || '',
      referencia: result.referencia || megasoftPaymentData.referencia,
      seqnum: result.seqnum || '',
      voucher: voucherData,
      isDuplicated: isDuplicated,
      vtid: result.vtid || '',
      terminal: result.terminal || '',
      lote: result.lote || '',
      afiliacion: result.afiliacion || megasoftService.codAfiliacion,
      authname: result.authname || '',
      rifbanco: result.rifbanco || '',
      // Incluir campos adicionales para debugging
      control: paymentData.control,
      factura: paymentData.factura,
      amount: paymentData.amount,
      // Datos del resultado original de Megasoft
      rawResponse: result.rawResponse
    };

    console.log('✅ Resultado final del pago P2C:', {
      codigo: paymentResult.codigo,
      descripcion: paymentResult.descripcion,
      referencia: paymentResult.referencia,
      isDuplicated: paymentResult.isDuplicated,
      hasVoucher: !!paymentResult.voucher,
      success: paymentResult.success
    });

    return paymentResult;

  } catch (error) {
    console.error('❌ Error en pago P2C:', error.message);
    console.error('Stack:', error.stack);
    
    // Si el error viene de MegasoftService con voucher
    if (error.voucher || error.voucherText) {
      const enhancedError = new Error(error.message);
      enhancedError.voucher = error.voucherText || error.voucher;
      enhancedError.codigo = error.codigo || 'GATEWAY_ERROR';
      throw enhancedError;
    }

    // Error genérico - generar voucher de error
    const errorVoucher = this.generateErrorVoucher(error.message, paymentData);
    const enhancedError = new Error(error.message);
    enhancedError.voucher = errorVoucher;
    enhancedError.codigo = 'COMM_ERROR';
    throw enhancedError;
  }
}

  // Generar voucher de error
  generateErrorVoucher(errorMessage, paymentData) {
    const fecha = new Date().toLocaleString('es-VE');
    const lines = [
      '_',
      '_____________ERROR_DE_TRANSACCION_',
      'PAYMENT_GATEWAY_',
      'CHAGUARAMOS_',
      `FECHA:${fecha}_`,
      'TRANSACCION_FALLIDA:_',
      `${errorMessage.replace(/ /g, '_').toUpperCase()}_`,
      `CONTROL:${paymentData?.control || 'N/A'}_`,
      `FACTURA:${paymentData?.factura || 'N/A'}_`,
      '_'
    ];
    return lines.join('\n');
  }

  // Consultar estado de transacción - USAR MEGASOFT SERVICE
  async queryStatus(control, version = '3', tipotrx = 'P2C') {
    try {
      console.log('🔄 Consultando estado con MegasoftService...');
      
      // USAR MEGASOFT SERVICE REAL
      const result = await megasoftService.queryStatus(control, tipotrx);
      
      // Adaptar respuesta al formato esperado
      return {
        success: result.success,
        estado: result.estado || (result.success ? 'A' : 'R'), // A=Aprobada, R=Rechazada, P=Pendiente
        codigo: result.codigo,
        descripcion: result.descripcion,
        monto: result.monto,
        referencia: result.referencia || result.reference,
        factura: result.factura,
        authid: result.authid || result.authId,
        terminal: result.terminal,
        vtid: result.vtid,
        control: result.control,
        voucher: result.voucher || result.voucherText
      };
      
    } catch (error) {
      console.error('Error consultando estado:', error.message);
      throw error;
    }
  }

  // Proceso completo de pago P2C - VERSIÓN ACTUALIZADA
  async executeP2CPaymentFlow(runnerId, paymentData, supabaseInstance = null) {
    const startTime = Date.now();
    let transaction = null;
    
    // Usar la instancia de Supabase proporcionada o la del servicio
    const supabase = supabaseInstance || this.supabase;
    
    if (!supabase) {
      throw new Error('No hay conexión a Supabase disponible');
    }
    
    try {
      console.log('=== Iniciando flujo de pago P2C ===');
      
      // 1. Obtener runner
      const { data: runner, error: runnerError } = await supabase
        .from('runners')
        .select('*')
        .eq('id', runnerId)
        .single();
    
      if (runnerError || !runner) {
        throw new Error('Corredor no encontrado');
      }
    
      // 2. Convertir precio a bolívares
      const { amountBs, exchangeRate } = await this.convertUSDtoBs(this.racePriceUSD, supabase);
      console.log(`Conversión: $${this.racePriceUSD} USD = Bs. ${amountBs} (Tasa: ${exchangeRate})`);
    
      // 3. Generar número de factura única
      const factura = `RUN${Date.now()}`;
    
      // 4. Preregistrar transacción (usando MegasoftService)
      const preregResult = await this.preregister();
      if (!preregResult.success) {
        throw new Error('Error en preregistro: ' + (preregResult.descripcion || 'Error desconocido'));
      }
    
      // 5. Crear registro de transacción en BD
      const { data: newTransaction, error: transError } = await supabase
        .from('payment_transactions')
        .insert({
          runner_id: runnerId,
          control: preregResult.control,
          invoice: factura,
          amount_usd: this.racePriceUSD,
          amount_bs: amountBs,
          exchange_rate: exchangeRate,
          payment_method: 'pago_movil_p2c',
          status: 'pending',
          client_phone: paymentData.telefonoCliente,
          client_bank_code: paymentData.codigobancoCliente,
          client_identification: paymentData.cid || runner.identification || 'V00000000',
          commerce_phone: this.commercePhone,
          commerce_bank_code: this.commerceBankCode,
          reference: null,
          metadata: {
            runner_name: runner.full_name,
            runner_identification: runner.identification
          }
        })
        .select()
        .single();
      
      if (transError) {
        throw new Error('Error creando transacción: ' + transError.message);
      }
    
      transaction = newTransaction;
      console.log('Transacción creada:', transaction.id);
    
      // 6. Actualizar estado del runner
      await supabase
        .from('runners')
        .update({ payment_status: 'procesando' })
        .eq('id', runnerId);
    
      // 7. Ejecutar pago P2C (usando MegasoftService)
      const paymentResult = await this.processPaymentP2C({
        control: preregResult.control,
        factura: factura,
        amount: amountBs,
        telefonoCliente: paymentData.telefonoCliente,
        codigobancoCliente: paymentData.codigobancoCliente,
        telefonoComercio: this.commercePhone,
        codigobancoComercio: this.commerceBankCode,
        cid: paymentData.cid || runner.identification,
        referencia: this.generateUniqueReference()
      });
    
      // 8. Actualizar transacción con resultado - INCLUYENDO VOUCHER SIEMPRE
      const updateData = {
        status: paymentResult.success ? 'approved' : 'failed',
        gateway_response: paymentResult,
        auth_id: paymentResult.authid,
        reference: paymentResult.referencia || null,
        terminal: paymentResult.terminal,
        lote: paymentResult.lote,
        seqnum: paymentResult.seqnum,
        voucher: paymentResult.voucher ? { 
          text: paymentResult.voucher,
          isDuplicated: paymentResult.isDuplicated 
        } : null,
        gateway_code: paymentResult.codigo,
        gateway_description: paymentResult.descripcion,
        processed_at: new Date().toISOString()
      };
    
      await supabase
        .from('payment_transactions')
        .update(updateData)
        .eq('id', transaction.id);
    
      // 9. Si el pago fue exitoso, confirmar corredor
      if (paymentResult.success) {
        // Llamar función de confirmación
        const { data: confirmResult, error: confirmError } = await supabase
          .rpc('confirm_p2c_payment', {
            p_transaction_id: transaction.id,
            p_auth_id: paymentResult.authid,
            p_reference: paymentResult.referencia || null,
            p_voucher: paymentResult.voucher
          });
        
        if (confirmError) {
          console.error('Error confirmando pago:', confirmError);
        }
      
        console.log('✅ Pago confirmado exitosamente');
        
      } else {
        // Actualizar estado del runner a rechazado
        await supabase
          .from('runners')
          .update({ 
            payment_status: 'rechazado',
            rejection_reason: paymentResult.descripcion 
          })
          .eq('id', runnerId);
      
        // Liberar inventario si estaba reservado
        await supabase
          .rpc('release_inventory', {
            size: runner.shirt_size,
            quantity: 1
          });
          
        console.log('❌ Pago rechazado:', paymentResult.descripcion);
      }
    
      const duration = Date.now() - startTime;
      console.log(`=== Flujo completado en ${duration}ms ===`);
    
      return {
        success: paymentResult.success,
        transactionId: transaction.id,
        control: preregResult.control,
        invoice: factura,
        amountUSD: this.racePriceUSD,
        amountBs: amountBs,
        exchangeRate: exchangeRate,
        voucher: paymentResult.voucher,
        isDuplicated: paymentResult.isDuplicated,
        reference: paymentResult.referencia || null,
        authId: paymentResult.authid,
        message: paymentResult.descripcion,
        codigo: paymentResult.codigo,
        // Datos adicionales para el frontend
        paymentResult: paymentResult
      };
    
    } catch (error) {
      console.error('❌ Error en flujo de pago:', error);
      
      // Preparar información del error incluyendo voucher si está disponible
      const errorInfo = {
        success: false,
        message: error.message,
        codigo: error.codigo || 'UNKNOWN_ERROR',
        voucher: error.voucher || null,
        transactionId: transaction?.id || null,
        control: transaction?.control || null
      };
      
      // Registrar error
      if (transaction && supabase) {
        try {
          await supabase
            .from('payment_errors')
            .insert({
              runner_id: runnerId,
              transaction_id: transaction.id,
              error_code: error.codigo || 'UNKNOWN',
              error_message: error.message,
              error_details: {
                stack: error.stack,
                response: error.response?.data,
                voucher: error.voucher
              }
            });
          
          // Actualizar transacción como fallida
          await supabase
            .from('payment_transactions')
            .update({
              status: 'failed',
              gateway_response: { 
                error: error.message, 
                codigo: error.codigo,
                voucher: error.voucher 
              },
              voucher: error.voucher ? { text: error.voucher } : null,
              gateway_code: error.codigo || 'ERROR',
              gateway_description: error.message,
              failed_at: new Date().toISOString()
            })
            .eq('id', transaction.id);
        } catch (dbError) {
          console.error('Error actualizando BD:', dbError);
        }
      }
    
      // Actualizar estado del runner
      if (supabase && runnerId) {
        try {
          await supabase
            .from('runners')
            .update({ 
              payment_status: 'rechazado',
              rejection_reason: error.message 
            })
            .eq('id', runnerId);
        } catch (dbError) {
          console.error('Error actualizando runner:', dbError);
        }
      }
    
      // Lanzar error enriquecido con información del voucher
      const enhancedError = new Error(error.message);
      Object.assign(enhancedError, errorInfo);
      throw enhancedError;
    }
  }

  // Formatear número de teléfono
  formatPhoneNumber(phone) {
    // Remover todos los caracteres no numéricos
    let cleaned = phone.replace(/[^0-9]/g, '');
    
    // Si no empieza con 0, agregarlo
    if (!cleaned.startsWith('0')) {
      cleaned = '0' + cleaned;
    }
    
    // Validar formato venezolano (04XX XXX XXXX)
    if (!/^04[0-9]{9}$/.test(cleaned)) {
      throw new Error(`Formato de teléfono inválido: ${phone}. Debe ser 04XXXXXXXXX`);
    }
    
    return cleaned;
  }

  // Formatear cédula de identidad
  formatCID(cid) {
    if (!cid) {
      return 'V00000000';
    }

    // Remover espacios y guiones
    let cleaned = cid.replace(/[\s-]/g, '').toUpperCase();
    
    // Si es solo números, agregar V al inicio
    if (/^\d+$/.test(cleaned)) {
      cleaned = 'V' + cleaned;
    }
    
    // Validar formato: Letra seguida de números
    if (!/^[VEJGP]\d{6,9}$/.test(cleaned)) {
      console.warn(`Formato de cédula inválido: ${cid}. Usando valor por defecto.`);
      return 'V00000000';
    }
    
    return cleaned;
  }

  // Generar referencia única
  generateUniqueReference() {
    // Generar referencia de 8 dígitos basada en timestamp
    const timestamp = Date.now().toString();
    return timestamp.slice(-8);
  }

  // Validar datos P2C
  validateP2CData(paymentData) {
    const errors = [];
    
    if (!paymentData.control) errors.push('Control es requerido');
    if (!paymentData.telefonoCliente) errors.push('Teléfono del cliente es requerido');
    if (!paymentData.codigobancoCliente) errors.push('Banco del cliente es requerido');
    if (!paymentData.amount || paymentData.amount <= 0) errors.push('Monto debe ser mayor a 0');
    if (!paymentData.factura) errors.push('Número de factura es requerido');
    
    // Validar códigos de banco
    const validBankCodes = ['0102', '0104', '0105', '0108', '0114', '0115', '0116', '0128', 
                            '0134', '0137', '0138', '0146', '0151', '0156', '0157', '0163', 
                            '0166', '0168', '0169', '0171', '0172', '0173', '0174', '0175', 
                            '0176', '0177', '0191'];
    
    if (!validBankCodes.includes(paymentData.codigobancoCliente)) {
      errors.push(`Código de banco cliente inválido: ${paymentData.codigobancoCliente}`);
    }
    
    if (errors.length > 0) {
      throw new Error(`Validación fallida: ${errors.join(', ')}`);
    }
    
    return true;
  }

  // Obtener lista de bancos
  async getBankList() {
    try {
      // Usar el método de MegasoftService para obtener bancos
      const bankName = megasoftService.getBankName('0134'); // Test
      
      // Si el método existe, usar la lista del servicio
      const banks = [
        { code: '0102', name: 'Banco de Venezuela', short_name: 'VENEZUELA', is_active: true },
        { code: '0134', name: 'Banesco', short_name: 'BANESCO', is_active: true },
        { code: '0105', name: 'Banco Mercantil', short_name: 'MERCANTIL', is_active: true },
        { code: '0108', name: 'Banco Provincial', short_name: 'PROVINCIAL', is_active: true },
        { code: '0116', name: 'Banco Occidental de Descuento', short_name: 'BOD', is_active: true },
        { code: '0114', name: 'Bancaribe', short_name: 'BANCARIBE', is_active: true },
        { code: '0115', name: 'Banco Exterior', short_name: 'EXTERIOR', is_active: true },
        { code: '0175', name: 'Banco Bicentenario', short_name: 'BICENTENARIO', is_active: true },
        { code: '0163', name: 'Banco del Tesoro', short_name: 'TESORO', is_active: true },
        { code: '0191', name: 'Banco Nacional de Crédito', short_name: 'BNC', is_active: true },
        { code: '0138', name: 'Banco Plaza', short_name: 'PLAZA', is_active: true },
        { code: '0174', name: 'Banplus', short_name: 'BANPLUS', is_active: true },
        { code: '0172', name: 'Bancamiga', short_name: 'BANCAMIGA', is_active: true },
        { code: '0169', name: 'Mi Banco', short_name: 'MIBANCO', is_active: true },
        { code: '0171', name: 'Banco Activo', short_name: 'ACTIVO', is_active: true },
        { code: '0168', name: 'Bancrecer', short_name: 'BANCRECER', is_active: true },
        { code: '0137', name: 'Sofitasa', short_name: 'SOFITASA', is_active: true },
        { code: '0177', name: 'Banco de la Fuerza Armada Nacional Bolivariana', short_name: 'BANFANB', is_active: true },
        { code: '0104', name: 'Banco Venezolano de Crédito', short_name: 'BVC', is_active: true },
        { code: '0173', name: 'Banco Internacional de Desarrollo', short_name: 'BID', is_active: true },
        { code: '0128', name: 'Banco Caroní', short_name: 'CARONI', is_active: true },
        { code: '0146', name: 'Banco de la Gente Emprendedora', short_name: 'BANGENTE', is_active: true },
        { code: '0151', name: 'BFC Banco Fondo Común', short_name: 'BFC', is_active: true },
        { code: '0156', name: '100% Banco', short_name: '100%BANCO', is_active: true },
        { code: '0157', name: 'DelSur', short_name: 'DELSUR', is_active: true },
        { code: '0166', name: 'Banco Agrícola de Venezuela', short_name: 'BAV', is_active: true },
        { code: '0176', name: 'Banco Espirito Santo', short_name: 'BES', is_active: true }
      ].sort((a, b) => a.name.localeCompare(b.name));
      
      return banks;
      
    } catch (error) {
      console.error('Error obteniendo lista de bancos:', error);
      throw error;
    }
  }

  // Método para testing - USAR MEGASOFT SERVICE
  async testConnection() {
    try {
      console.log('🔄 Probando conexión con MegasoftService...');
      
      // Usar el método de test de MegasoftService
      const result = await megasoftService.testConnection();
      
      return result;
      
    } catch (error) {
      console.error('Error en test de conexión:', error.message);
      return {
        success: false,
        message: error.message,
        details: error.response?.data
      };
    }
  }

  // Test de pago P2C completo - USAR MEGASOFT SERVICE
  async testP2CPayment() {
    try {
      console.log('=== Iniciando test de pago P2C con MegasoftService ===');
      
      // 1. Preregistro
      const preregResult = await this.preregister();
      console.log('1. Preregistro:', preregResult);
      
      if (!preregResult.success) {
        throw new Error('Preregistro falló');
      }
      
      // 2. Datos de prueba
      const testData = {
        control: preregResult.control,
        factura: `TEST${Date.now()}`,
        amount: 1000.00, // Bs. 1000 para prueba
        telefonoCliente: '04125555444', // Teléfono de prueba
        codigobancoCliente: '0102', // Banco de Venezuela
        telefonoComercio: this.commercePhone,
        codigobancoComercio: this.commerceBankCode,
        cid: 'V12345678',
        referencia: this.generateUniqueReference()
      };
      
      console.log('2. Ejecutando pago con datos:', testData);
      
      // 3. Procesar pago
      const paymentResult = await this.processPaymentP2C(testData);
      console.log('3. Resultado del pago:', paymentResult);
      
      // 4. Consultar estado
      const statusResult = await this.queryStatus(preregResult.control);
      console.log('4. Estado de la transacción:', statusResult);
      
      return {
        success: paymentResult.success,
        preregistro: preregResult,
        pago: paymentResult,
        estado: statusResult
      };
      
    } catch (error) {
      console.error('Error en test P2C:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }
}

// Exportar instancia única
const paymentGateway = new PaymentGatewayService();
export default paymentGateway;