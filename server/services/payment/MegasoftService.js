// server/services/payment/MegasoftService.js
// Servicio reorganizado - copia del original para nueva estructura

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
    
    console.log(`[MegasoftService] Iniciando en modo: ${this.isProduction ? 'PRODUCCIÓN' : 'PRUEBAS'}`);
    console.log(`[MegasoftService] URL: ${this.baseURL}`);
    console.log(`[MegasoftService] Afiliación: ${this.codAfiliacion}`);
    
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
      timeout: this.isProduction ? 60000 : 30000,
    });

    // Request/Response interceptors for logging
    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[MegasoftService ${this.isProduction ? 'PROD' : 'TEST'}] ${config.method.toUpperCase()} ${config.url}`);
        if (process.env.DEBUG_GATEWAY === 'true') {
          console.log('[MegasoftService Request Body]', config.data);
        }
        return config;
      },
      (error) => {
        console.error('[MegasoftService Request Error]', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[MegasoftService Response] Status: ${response.status}`);
        if (process.env.DEBUG_GATEWAY === 'true') {
          console.log('[MegasoftService Response Body]', response.data);
        }
        return response;
      },
      (error) => {
        console.error('[MegasoftService Response Error]', error.response?.data || error.message);
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
        console.error(`[MegasoftService] Attempt ${attempt} failed:`, error.message);
        
        if (attempt < retries) {
          const baseDelay = this.isProduction ? 2000 : 1000;
          const delay = Math.pow(2, attempt - 1) * baseDelay;
          console.log(`[MegasoftService] Retrying in ${delay}ms...`);
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
      console.error('[MegasoftService preRegistro Error]', error);
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
    
    // Validar datos requeridos
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

      const requestBody = {
        request: {
          cod_afiliacion: this.codAfiliacion,
          control: control,
          telefonoCliente: formattedPhone,
          codigobancoCliente: codigoBancoCliente,
          telefonoComercio: this.commercePhone,
          codigobancoComercio: this.commerceBankCode,
          amount: formattedAmount,
          factura: factura,
          referencia: paymentReference,
          cid: formattedCID
        }
      };

      const xml = this.jsonToXml(requestBody);
      
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

      // Procesar voucher
      let voucherLines = [];
      let voucherText = null;
      
      if (result.voucher) {
        if (result.voucher.linea) {
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
            const lineValue = typeof result.voucher.linea === 'object' 
              ? (result.voucher.linea._ || result.voucher.linea.UT || JSON.stringify(result.voucher.linea))
              : String(result.voucher.linea);
            voucherLines = [lineValue];
          }
        } else if (typeof result.voucher === 'string') {
          voucherLines = result.voucher.split('\n');
        }
        
        voucherText = this.formatVoucher(voucherLines);
      }

      const isSuccess = result.codigo === '00';

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
      console.error('[MegasoftService procesarCompraP2C Error]', error);
      
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
      console.error('[MegasoftService queryStatus Error]', error);
      throw error;
    }
  }

  /**
   * Format amount to Megasoft format
   */
  formatAmount(amount) {
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount)) {
      throw new Error(`Monto inválido: ${amount}`);
    }
    
    if (numAmount <= 0) {
      throw new Error(`El monto debe ser mayor a 0. Recibido: ${amount}`);
    }
    
    return numAmount.toFixed(2);
  }

  /**
   * Format voucher lines into readable text
   */
  formatVoucher(lines) {
    if (!lines || lines.length === 0) return '';
    
    return lines
      .map(line => {
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
    
    const cleaned = phone.replace(/[^0-9]/g, '');
    const formatted = cleaned.startsWith('0') ? cleaned : '0' + cleaned;
    
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
}

// Export singleton instance
export default new MegasoftService();