// server/utils/rateLimiter.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Almacén en memoria para rate limiting (en producción usar Redis)
const rateLimitStore = new Map();

/**
 * Limpia entradas expiradas del store
 */
const cleanupExpiredEntries = () => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (data.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
};

// Limpiar cada 5 minutos
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

/**
 * Rate limiter genérico
 * @param {string} key - Clave única para el rate limit
 * @param {number} limit - Número máximo de requests
 * @param {number} windowMs - Ventana de tiempo en milisegundos
 * @returns {Object} - { allowed: boolean, remaining: number, resetAt: Date }
 */
export const checkRateLimit = (key, limit = 10, windowMs = 3600000) => {
  const now = Date.now();
  const resetAt = now + windowMs;

  let data = rateLimitStore.get(key);

  if (!data || data.resetAt < now) {
    // Nueva ventana de tiempo
    data = {
      count: 1,
      resetAt: resetAt
    };
    rateLimitStore.set(key, data);
    
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: new Date(resetAt)
    };
  }

  // Incrementar contador
  data.count++;
  
  if (data.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(data.resetAt)
    };
  }

  return {
    allowed: true,
    remaining: limit - data.count,
    resetAt: new Date(data.resetAt)
  };
};

/**
 * Rate limiter específico para compras públicas
 */
export const publicPurchaseRateLimiter = async (req, res, next) => {
  // No aplicar a usuarios autenticados (no públicos)
  if (req.user && !req.user.isPublic) {
    return next();
  }

  const ip = req.ip || req.connection.remoteAddress;
  const token = req.iframeToken?.token;
  
  // Rate limit por IP
  const ipKey = `purchase:ip:${ip}`;
  const ipLimit = checkRateLimit(ipKey, 10, 3600000); // 10 compras por hora
  
  if (!ipLimit.allowed) {
    return res.status(429).json({
      message: 'Demasiadas solicitudes. Por favor intente más tarde.',
      retryAfter: ipLimit.resetAt
    });
  }

  // Rate limit por token
  if (token) {
    const tokenKey = `purchase:token:${token}`;
    const tokenLimit = checkRateLimit(tokenKey, 50, 86400000); // 50 compras por día por token
    
    if (!tokenLimit.allowed) {
      return res.status(429).json({
        message: 'Límite de transacciones alcanzado para este enlace.',
        retryAfter: tokenLimit.resetAt
      });
    }
  }

  // Agregar headers informativos
  res.set({
    'X-RateLimit-Limit': '10',
    'X-RateLimit-Remaining': ipLimit.remaining.toString(),
    'X-RateLimit-Reset': ipLimit.resetAt.toISOString()
  });

  next();
};

/**
 * Registra intento de compra en la base de datos
 */
export const logPurchaseAttempt = async (req, status = 'success') => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const origin = req.headers.origin || req.headers.referer;

    await supabaseAdmin
      .from('purchase_rate_limit_logs')
      .insert({
        ip_address: ip,
        token_id: req.iframeToken?.id,
        user_agent: userAgent,
        origin: origin,
        status: status,
        metadata: {
          tokenType: req.iframeToken?.token_type,
          isPublic: req.user?.isPublic
        }
      });
  } catch (error) {
    console.error('Error logging purchase attempt:', error);
    // No fallar la request por error de logging
  }
};

/**
 * Middleware para validar límites de transacciones del token
 */
export const checkTokenTransactionLimit = async (req, res, next) => {
  if (!req.iframeToken || req.iframeToken.token_type !== 'public_token') {
    return next();
  }

  const { max_transactions, transactions_count } = req.iframeToken;

  if (max_transactions && transactions_count >= max_transactions) {
    await logPurchaseAttempt(req, 'token_limit_exceeded');
    
    return res.status(403).json({
      message: 'Este enlace ha alcanzado su límite de transacciones.',
      limit: max_transactions,
      used: transactions_count
    });
  }

  next();
};