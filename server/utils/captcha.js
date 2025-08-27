// server/utils/captcha.js
import axios from 'axios';

/**
 * Validates hCaptcha response
 * @param {string} captchaResponse - The captcha response from the client
 * @param {string} userIP - The user's IP address (optional)
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const validateCaptcha = async (captchaResponse, userIP = null) => {
  try {
    if (!captchaResponse) {
      return {
        success: false,
        message: 'Captcha response es requerido'
      };
    }

    const secret = process.env.HCAPTCHA_SECRET_KEY;
    
    if (!secret) {
      console.error('HCAPTCHA_SECRET_KEY no está configurado');
      // En desarrollo, podrías querer permitir bypass
      if (process.env.NODE_ENV === 'development') {
        console.warn('Captcha bypassed in development mode');
        return { success: true };
      }
      return {
        success: false,
        message: 'Captcha no está configurado correctamente'
      };
    }

    // Verificar con hCaptcha
    const verificationUrl = 'https://hcaptcha.com/siteverify';
    
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', captchaResponse);
    if (userIP) {
      params.append('remoteip', userIP);
    }

    const response = await axios.post(verificationUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.data.success) {
      return { success: true };
    } else {
      return {
        success: false,
        message: 'Captcha inválido',
        errors: response.data['error-codes']
      };
    }

  } catch (error) {
    console.error('Error validating captcha:', error);
    return {
      success: false,
      message: 'Error al validar captcha'
    };
  }
};

/**
 * Middleware para validar captcha en requests
 */
export const requireCaptcha = async (req, res, next) => {
  // Skip captcha in development or for authenticated users
  if (process.env.NODE_ENV === 'development' || (req.user && !req.user.isPublic)) {
    return next();
  }

  const captchaResponse = req.body.captcha || req.headers['x-captcha-response'];
  const userIP = req.ip || req.connection.remoteAddress;

  const validation = await validateCaptcha(captchaResponse, userIP);

  if (!validation.success) {
    return res.status(400).json({
      message: validation.message || 'Captcha inválido',
      errors: validation.errors
    });
  }

  next();
};