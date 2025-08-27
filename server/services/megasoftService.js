import axios from 'axios';
import xml2js from 'xml2js';
import { promisify } from 'util';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// XML parser and builder configuration
const xmlParser = new xml2js.Parser({ 
  explicitArray: false, 
  ignoreAttrs: true 
});

const xmlBuilder = new xml2js.Builder({ 
  headless: true, 
  renderOpts: { pretty: false } 
});

const parseXML = promisify(xmlParser.parseString);

class MegasoftService {
  constructor() {
    // Determinar si estamos en producción o desarrollo
    this.isProduction = process.env.NODE_ENV === 'production' || process.env.USE_PRODUCTION_GATEWAY === 'true';
    
    // URLs según el ambiente
    this.baseURL = this.isProduction 
      ? (process.env.MEGASOFT_PROD_URL || 'https://pay.megasoft.com.ve')
      : (process.env.MEGASOFT_TEST_URL || 'https://paytest.megasoft.com.ve');
    
    // Credenciales según el ambiente
    this.username = this.isProduction
      ? process.env.MEGASOFT_PROD_USERNAME
      : process.env.MEGASOFT_TEST_USERNAME;
    
    this.password = this.isProduction
      ? process.env.MEGASOFT_PROD_PASSWORD
      : process.env.MEGASOFT_TEST_PASSWORD;
    
    this.codAfiliacion = this.isProduction
      ? process.env.MEGASOFT_PROD_COD_AFILIACION
      : process.env.MEGASOFT_TEST_COD_AFILIACION;
    
    // Datos del comercio (igual para ambos ambientes)
    this.commercePhone = process.env.MEGASOFT_COMMERCE_PHONE;
    this.commerceBankCode = process.env.MEGASOFT_COMMERCE_BANK_CODE;
    
    console.log(`[Megasoft] Iniciando en modo: ${this.isProduction ? 'PRODUCCIÓN' : 'PRUEBAS'}`);
    console.log(`[Megasoft] URL: ${this.baseURL}`);
    console.log(`[Megasoft] Afiliación: ${this.codAfiliacion}`);
    
    // Validar configuración requerida
    if (!this.username || !this.password || !this.codAfiliacion) {
      throw new Error('Configuración de Megasoft incompleta. Revise las variables de entorno.');
    }
    
    // Axios instance with basic configuration
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'text/xml',
        'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`
      },
      timeout: this.isProduction ? 60000 : 30000, // Mayor timeout en producción
    });

    // Request/Response interceptors for logging
    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[Megasoft ${this.isProduction ? 'PROD' : 'TEST'}] ${config.method.toUpperCase()} ${config.url}`);
        if (process.env.DEBUG_GATEWAY === 'true') {
          console.log('[Megasoft Request Body]', config.data);
        }
        return config;
      },
      (error) => {
        console.error('[Megasoft Request Error]', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[Megasoft Response] Status: ${response.status}`);
        if (process.env.DEBUG_GATEWAY === 'true') {
          console.log('[Megasoft Response Body]', response.data);
        }
        return response;
      },
      (error) => {
        console.error('[Megasoft Response Error]', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Convert JSON object to XML string
   */
  jsonToXml(obj) {
    return xmlBuilder.buildObject(obj);
  }

  /**
   * Parse XML string to JSON object
   */
  async xmlToJson(xml) {
    try {
      const result = await parseXML(xml);
      return result;
    } catch (error) {
      console.error('Error parsing XML:', error);
      throw new Error('Invalid XML response from payment gateway');
    }
  }

  /**
   * Execute request with retry logic
   */
  async executeWithRetry(requestFn, maxRetries = null) {
    const retries = maxRetries || (this.isProduction ? 3 : 2);
    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await requestFn();
        return result;
      } catch (error) {
        lastError = error;
        console.error(`[Megasoft] Attempt ${attempt} failed:`, error.message);
        
        if (attempt < retries) {
          const baseDelay = this.isProduction ? 2000 : 1000;
          const delay = Math.pow(2, attempt - 1) * baseDelay;
          console.log(`[Megasoft] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Generate unique reference number
   */
  generateUniqueReference() {
    // Generar referencia de 6-12 dígitos como en el Postman
    const timestamp = Date.now().toString();
    return timestamp.slice(-8);
  }

  /**
   * Step 1: Pre-registro - Get control number
   */
  async preRegistro() {
    const requestBody = {
      request: {
        cod_afiliacion: this.codAfiliacion
      }
    };

    const xml = this.jsonToXml(requestBody);

    try {
      const response = await this.executeWithRetry(async () => {
        const endpoint = '/action/v2-preregistro';
        return await this.client.post(endpoint, xml);
      });

      const jsonResponse = await this.xmlToJson(response.data);
      const result = jsonResponse.response;

      if (!result || !result.control) {
        throw new Error('Respuesta inválida del gateway: no se recibió número de control');
      }

      if (result.codigo !== '00') {
        throw new Error(`Pre-registro failed: ${result.descripcion || 'Error desconocido'}`);
      }

      return {
        success: true,
        control: result.control,
        codigo: result.codigo,
        descripcion: result.descripcion
      };
    } catch (error) {
      console.error('[Megasoft preRegistro Error]', error);
      throw error;
    }
  }

  /**
   * Format and validate CID (Cédula de Identidad)
   */
  formatCID(cid) {
        console.log(`🔍 [formatCID] Input recibido: "${cid}"`);
        
        if (!cid) {
            throw new Error('CID no puede estar vacío');
        }
        
        // Convertir a string y limpiar espacios
        const cidStr = String(cid).trim();
        console.log(`🔍 [formatCID] CID limpio: "${cidStr}"`);
        
        // Si ya tiene prefijo válido, devolverlo tal como está
        if (/^[VEJGvejg]\d{7,9}$/.test(cidStr)) {
            const formatted = cidStr.toUpperCase();
            console.log(`✅ [formatCID] Ya tiene formato válido: "${formatted}"`);
            return formatted;
        }
        
        // Si son solo números, agregar prefijo V
        if (/^\d{7,9}$/.test(cidStr)) {
            const formatted = `V${cidStr}`;
            console.log(`✅ [formatCID] Formato aplicado: "${formatted}"`);
            return formatted;
        }
        
        // Si tiene formato incorrecto, intentar extraer números
        const numbersOnly = cidStr.replace(/[^\d]/g, '');
        if (numbersOnly.length >= 7 && numbersOnly.length <= 9) {
            const formatted = `V${numbersOnly}`;
            console.log(`⚠️ [formatCID] Formato extraído: "${formatted}"`);
            return formatted;
        }
        
        console.log(`❌ [formatCID] Formato inválido para: "${cidStr}"`);
        throw new Error(`Formato de cédula inválido: ${cidStr}. Debe ser V12345678`);
  }

  /**
   * Verify if we're in the correct environment for the account
   */
  verifyEnvironment() {
    console.log('🔍 Verificando ambiente del gateway:');
    console.log(`- Modo: ${this.isProduction ? 'PRODUCCIÓN' : 'PRUEBAS'}`);
    console.log(`- URL: ${this.baseURL}`);
    console.log(`- Afiliación: ${this.codAfiliacion}`);
    
    if (!this.isProduction) {
      console.log('⚠️ ATENCIÓN: Estás en modo PRUEBAS. Asegúrate de que:');
      console.log('  1. La cuenta del cliente existe en el ambiente de pruebas');
      console.log('  2. El teléfono y banco están registrados en pruebas');
      console.log('  3. Estás usando datos de prueba válidos');
    }
  }

  /**
   * Step 2: Process P2C payment
   */
  async procesarCompraP2C(data) {
    const {
      control,
      telefonoCliente,
      codigoBancoCliente,
      amount,
      factura,
      referencia,
      cid
    } = data;

    console.log('📄 Procesando pago P2C con MegasoftService...');
    
    // Verificar ambiente antes de procesar
    this.verifyEnvironment();
    
    // Validar datos requeridos con mensajes específicos
    const missingFields = [];
    if (!control) missingFields.push('control');
    if (!telefonoCliente) missingFields.push('telefonoCliente');
    if (!codigoBancoCliente) missingFields.push('codigoBancoCliente');
    if (!amount) missingFields.push('amount');
    if (!factura) missingFields.push('factura');
    if (!cid) missingFields.push('cid');
    
    if (missingFields.length > 0) {
      throw new Error(`Datos incompletos para procesar pago P2C. Faltan: ${missingFields.join(', ')}`);
    }

    try {
      // Validar y formatear teléfono
      const formattedPhone = this.formatPhoneNumber(telefonoCliente);
      
      // Validar código de banco
      if (!this.validateBankCode(codigoBancoCliente)) {
        const bankName = this.getBankName(codigoBancoCliente);
        throw new Error(`Código de banco inválido: ${codigoBancoCliente} (${bankName}). Verifica que el banco esté soportado.`);
      }

      // Formatear CID correctamente
      const formattedCID = this.formatCID(cid);

      // Formatear monto - SIEMPRE con 2 decimales
      const formattedAmount = this.formatAmount(amount);

      // Generar referencia única si no existe
      const paymentReference = referencia || this.generateUniqueReference();

      console.log('📋 Datos validados para envío:', {
        control,
        factura,
        amount: formattedAmount,
        telefonoCliente: formattedPhone,
        codigoBancoCliente,
        banco: this.getBankName(codigoBancoCliente),
        cid: formattedCID,
        referencia: paymentReference,
        ambiente: this.isProduction ? 'PRODUCCIÓN' : 'PRUEBAS'
      });

      // IMPORTANTE: Usar nombres de campos con mayúsculas correctas según la documentación
      // Alrededor de la línea 650-670
      const requestBody = {
        request: {
          cod_afiliacion: this.codAfiliacion,
          control: control,
          telefonoCliente: formattedPhone,           // Sin mayúscula en medio
          codigobancoCliente: codigoBancoCliente,    // TODO MINÚSCULAS después de 'codigo'
          telefonoComercio: this.commercePhone,      // Sin mayúscula en medio
          codigobancoComercio: this.commerceBankCode, // TODO MINÚSCULAS después de 'codigo'
          amount: formattedAmount,
          factura: factura,
          referencia: paymentReference,
          cid: formattedCID
        }
      };

      const xml = this.jsonToXml(requestBody);
      
      // Log del XML para debug
      if (process.env.DEBUG_GATEWAY === 'true') {
        console.log('📤 XML enviado al gateway:');
        console.log(xml);
      }

      const response = await this.executeWithRetry(async () => {
        const endpoint = '/action/v2-procesar-compra-p2c';
        return await this.client.post(endpoint, xml);
      });

      const jsonResponse = await this.xmlToJson(response.data);
      const result = jsonResponse.response;

      if (!result) {
        throw new Error('Respuesta vacía del gateway');
      }

      console.log('📥 Respuesta del gateway:', {
        codigo: result.codigo,
        descripcion: result.descripcion,
        hasVoucher: !!result.voucher
      });

      // Manejar códigos de error específicos
      if (result.codigo === 'AG') {
        console.error('❌ Error AG: Cuenta bancaria no registrada');
        console.error('Verifica que:');
        console.error(`1. El teléfono ${formattedPhone} esté registrado en ${this.getBankName(codigoBancoCliente)}`);
        console.error(`2. La cédula ${formattedCID} corresponda al titular de la cuenta`);
        console.error(`3. Estés usando el ambiente correcto (${this.isProduction ? 'PRODUCCIÓN' : 'PRUEBAS'})`);
        
        throw new Error(`Error AG: La combinación teléfono (${formattedPhone}) + banco (${this.getBankName(codigoBancoCliente)}) + cédula (${formattedCID}) no está registrada en el sistema bancario. ${this.isProduction ? '' : 'Verifica que uses datos de prueba válidos.'}`);
      }

      // Procesar voucher de manera simplificada
      let voucherLines = [];
      let voucherText = null;
      
      if (result.voucher) {
        if (result.voucher.linea) {
          // Si linea es un array, usarlo directamente
          if (Array.isArray(result.voucher.linea)) {
            voucherLines = result.voucher.linea.map(line => {
              if (typeof line === 'object' && line._) {
                return line._;
              } else if (typeof line === 'object' && line.UT) {
                return line.UT;
              }
              return String(line);
            });
          } else {
            // Si es un solo elemento
            const lineValue = typeof result.voucher.linea === 'object' 
              ? (result.voucher.linea._ || result.voucher.linea.UT || JSON.stringify(result.voucher.linea))
              : String(result.voucher.linea);
            voucherLines = [lineValue];
          }
        } else if (typeof result.voucher === 'string') {
          // Si el voucher es directamente un string
          voucherLines = result.voucher.split('\n');
        }
        
        // Formatear el texto del voucher
        voucherText = this.formatVoucher(voucherLines);
      }

      console.log('📄 Voucher procesado:', {
        lines: voucherLines.length,
        hasText: !!voucherText
      });

      // Determinar si fue exitoso
      const isSuccess = result.codigo === '00';

      if (!isSuccess) {
        console.error(`❌ Pago rechazado: ${result.codigo} - ${result.descripcion}`);
      } else {
        console.log('✅ Pago procesado exitosamente');
      }

      return {
        success: isSuccess,
        control: result.control || control,
        codigo: result.codigo,
        descripcion: result.descripcion,
        monto: result.monto,
        factura: result.factura || factura,
        seqnum: result.seqnum,
        authid: result.authid || (isSuccess ? `APPROVED-${control.substring(-8)}` : ''),
        authname: result.authname || 'P-BancoPlazaP2C',
        referencia: result.referencia || paymentReference,
        terminal: result.terminal,
        lote: result.lote,
        rifbanco: result.rifbanco || '',
        afiliacion: result.afiliacion,
        voucher: voucherLines,
        voucherText: voucherText,
        rawResponse: result
      };
    } catch (error) {
      console.error('[Megasoft procesarCompraP2C Error]', error);
      
      // Enriquecer el error con información útil
      const enrichedError = new Error(error.message);
      enrichedError.codigo = error.response?.data?.codigo || 'ERROR';
      enrichedError.descripcion = error.response?.data?.descripcion || error.message;
      enrichedError.voucher = error.response?.data?.voucher;
      enrichedError.ambiente = this.isProduction ? 'PRODUCCIÓN' : 'PRUEBAS';
      
      throw enrichedError;
    }
  }

  /**
   * Step 3: Query transaction status
   */
  async queryStatus(control, tipotrx = 'P2C') {
    if (!control) {
      throw new Error('Control number is required for status query');
    }

    const requestBody = {
      request: {
        cod_afiliacion: this.codAfiliacion,
        control: control,
        version: '3',
        tipotrx: tipotrx
      }
    };

    const xml = this.jsonToXml(requestBody);

    try {
      const response = await this.executeWithRetry(async () => {
        const endpoint = '/action/v2-querystatus';
        return await this.client.post(endpoint, xml);
      });

      const jsonResponse = await this.xmlToJson(response.data);
      const result = jsonResponse.response;

      if (!result) {
        throw new Error('Respuesta vacía del gateway');
      }

      // Parse voucher if present
      let voucherLines = [];
      let voucherText = '';
      
      if (result.voucher) {
        if (result.voucher.linea) {
          voucherLines = Array.isArray(result.voucher.linea) 
            ? result.voucher.linea 
            : [result.voucher.linea];
        } else if (typeof result.voucher === 'string') {
          voucherLines = result.voucher.split('\n');
        }
        
        voucherText = this.formatVoucher(voucherLines);
      }

      return {
        success: result.codigo === '00',
        control: result.control,
        codigo: result.codigo,
        descripcion: result.descripcion,
        estado: result.estado,
        monto: result.monto,
        factura: result.factura,
        seqnum: result.seqnum,
        authid: result.authid,
        authname: result.authname,
        referencia: result.referencia,
        terminal: result.terminal,
        lote: result.lote,
        rifbanco: result.rifbanco,
        afiliacion: result.afiliacion,
        voucher: voucherLines,
        voucherText: voucherText,
        rawResponse: result
      };
    } catch (error) {
      console.error('[Megasoft queryStatus Error]', error);
      throw error;
    }
  }

  /**
   * Format amount to Megasoft format
   * CORRECCIÓN: Siempre usar formato con 2 decimales
   */
  formatAmount(amount) {
    // Convertir a número y formatear con 2 decimales
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount)) {
      throw new Error(`Monto inválido: ${amount}`);
    }
    
    // Validar que el monto sea positivo
    if (numAmount <= 0) {
      throw new Error(`El monto debe ser mayor a 0. Recibido: ${amount}`);
    }
    
    // Siempre retornar con 2 decimales como string
    return numAmount.toFixed(2);
  }

  /**
   * Format voucher lines into readable text
   */
  formatVoucher(lines) {
    if (!lines || lines.length === 0) return '';
    
    return lines
      .map(line => {
        // Manejar líneas que pueden ser objetos o strings
        if (typeof line === 'object') {
          if (line._ !== undefined) {
            return line._;
          } else if (line.UT !== undefined) {
            return line.UT;
          }
          return JSON.stringify(line);
        }
        return String(line);
      })
      .join('\n')
      .replace(/_/g, ' ')
      .trim();
  }

  /**
   * Generate unique invoice number
   */
  generateInvoiceNumber() {
    // Format: YYYYMMDDHHMMSSRANDOM
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${date}${time}${random}`;
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phone) {
    // Venezuelan phone format: 04XX-XXXXXXX
    const phoneRegex = /^(0412|0414|0424|0416|0426)\d{7}$/;
    const cleanPhone = phone.replace(/[-\s]/g, '');
    return phoneRegex.test(cleanPhone);
  }

  /**
   * Format phone number
   */
  formatPhoneNumber(phone) {
    if (!phone) {
      throw new Error('Número de teléfono es requerido');
    }
    
    // Limpiar el número
    const cleaned = phone.replace(/[^0-9]/g, '');
    
    // Asegurar que empiece con 0
    const formatted = cleaned.startsWith('0') ? cleaned : '0' + cleaned;
    
    // Validar formato
    if (!this.validatePhoneNumber(formatted)) {
      throw new Error(`Formato de teléfono inválido: ${phone}. Debe ser 04XXXXXXXXX (ej: 04121234567)`);
    }
    
    return formatted;
  }

  /**
   * Get bank name by code
   */
  getBankName(code) {
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
      '0177': 'Banco de la Fuerza Armada Nacional Bolivariana',
      '0191': 'Banco Nacional de Crédito'
    };
    
    return banks[code] || 'Banco Desconocido';
  }

  /**
   * Validate bank code
   */
  validateBankCode(code) {
    const validCodes = [
      '0102', '0104', '0105', '0108', '0114', '0115', '0116', '0128',
      '0134', '0137', '0138', '0151', '0156', '0157', '0163', '0166',
      '0168', '0169', '0171', '0172', '0173', '0174', '0175', '0177', '0191'
    ];
    
    return validCodes.includes(code);
  }

  /**
   * Get list of supported banks
   */
  getSupportedBanks() {
    return [
      { code: '0102', name: 'Banco de Venezuela' },
      { code: '0104', name: 'Banco Venezolano de Crédito' },
      { code: '0105', name: 'Banco Mercantil' },
      { code: '0108', name: 'Banco Provincial' },
      { code: '0114', name: 'Bancaribe' },
      { code: '0115', name: 'Banco Exterior' },
      { code: '0116', name: 'Banco Occidental de Descuento' },
      { code: '0128', name: 'Banco Caroní' },
      { code: '0134', name: 'Banesco' },
      { code: '0137', name: 'Banco Sofitasa' },
      { code: '0138', name: 'Banco Plaza' },
      { code: '0151', name: 'BFC Banco Fondo Común' },
      { code: '0156', name: '100% Banco' },
      { code: '0157', name: 'DelSur' },
      { code: '0163', name: 'Banco del Tesoro' },
      { code: '0166', name: 'Banco Agrícola de Venezuela' },
      { code: '0168', name: 'Bancrecer' },
      { code: '0169', name: 'Mi Banco' },
      { code: '0171', name: 'Banco Activo' },
      { code: '0172', name: 'Bancamiga' },
      { code: '0173', name: 'Banco Internacional de Desarrollo' },
      { code: '0174', name: 'Banplus' },
      { code: '0175', name: 'Banco Bicentenario' },
      { code: '0177', name: 'Banco de la Fuerza Armada Nacional Bolivariana' },
      { code: '0191', name: 'Banco Nacional de Crédito' }
    ];
  }

  /**
   * Test connection to gateway
   */
  async testConnection() {
    try {
      console.log('=================================');
      console.log('Probando conexión al gateway...');
      console.log(`Ambiente: ${this.isProduction ? 'PRODUCCIÓN' : 'PRUEBAS'}`);
      console.log('URL:', this.baseURL);
      console.log('Afiliación:', this.codAfiliacion);
      console.log('Username:', this.username ? '✓ Configurado' : '✗ No configurado');
      console.log('Password:', this.password ? '✓ Configurado' : '✗ No configurado');
      console.log('=================================');
      
      // Intentar un preregistro de prueba
      const result = await this.preRegistro();
      
      console.log('✅ Conexión exitosa:', result);
      return {
        success: true,
        environment: this.isProduction ? 'production' : 'test',
        message: 'Conexión al gateway exitosa',
        control: result.control,
        baseURL: this.baseURL,
        afiliacion: this.codAfiliacion
      };
    } catch (error) {
      console.error('❌ Error en test de conexión:', error.message);
      return {
        success: false,
        environment: this.isProduction ? 'production' : 'test',
        message: error.message,
        details: error.response?.data,
        baseURL: this.baseURL,
        afiliacion: this.codAfiliacion
      };
    }
  }

  /**
   * Test P2C payment (only for development)
   */
  async testP2CPayment() {
    if (this.isProduction) {
      throw new Error('Test no disponible en producción');
    }

    try {
      console.log('=== Iniciando test de pago P2C ===');
      console.log('Ambiente:', this.isProduction ? 'PRODUCCIÓN' : 'PRUEBAS');
      console.log('URL:', this.baseURL);
      
      // 1. Preregistro
      const preregResult = await this.preRegistro();
      console.log('1. Preregistro exitoso:', preregResult.control);
      
      // 2. Procesar pago de prueba
      const testData = {
        control: preregResult.control,
        telefonoCliente: '04121234567',  // Número de prueba
        codigoBancoCliente: '0138',      // Banco Plaza (banco de prueba)
        amount: '11.99',                  // Monto de prueba
        factura: this.generateInvoiceNumber(),
        referencia: this.generateUniqueReference(),
        cid: 'V12345678'                  // Cédula de prueba
      };
      
      console.log('2. Intentando procesar pago con datos de prueba:', testData);
      
      const paymentResult = await this.procesarCompraP2C(testData);
      console.log('2. Pago procesado:', {
        success: paymentResult.success,
        codigo: paymentResult.codigo,
        descripcion: paymentResult.descripcion
      });
      
      // 3. Consultar estado
      const statusResult = await this.queryStatus(preregResult.control);
      console.log('3. Estado consultado:', {
        estado: statusResult.estado,
        codigo: statusResult.codigo
      });
      
      console.log('=== Test completado ===');
      
      return {
        success: true,
        preregistro: preregResult,
        payment: paymentResult,
        status: statusResult
      };
      
    } catch (error) {
      console.error('Error en test P2C:', error.message);
      console.error('Detalles:', {
        codigo: error.codigo,
        descripcion: error.descripcion,
        ambiente: error.ambiente
      });
      throw error;
    }
  }

  /**
   * Debug method to show current configuration
   */
  debugConfiguration() {
    console.log('=== Configuración actual de Megasoft ===');
    console.log('Ambiente:', this.isProduction ? 'PRODUCCIÓN' : 'PRUEBAS');
    console.log('URL Base:', this.baseURL);
    console.log('Afiliación:', this.codAfiliacion);
    console.log('Teléfono Comercio:', this.commercePhone);
    console.log('Banco Comercio:', this.commerceBankCode);
    console.log('Usuario configurado:', this.username ? 'Sí' : 'No');
    console.log('Contraseña configurada:', this.password ? 'Sí' : 'No');
    console.log('========================================');
  }
}

// Export singleton instance
export default new MegasoftService();