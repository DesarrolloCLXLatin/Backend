// server/middleware/cors.js
import supabase from './supabase.js'; // Importar desde el middleware de supabase

let cachedAllowedOrigins = new Set();
let lastCacheUpdate = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Función para actualizar orígenes permitidos desde la BD
async function updateAllowedOrigins() {
  try {
    // IMPORTANTE: Siempre incluir localhost y orígenes de desarrollo
    const developmentOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'https://localhost:5173',
      'https://localhost:5174'
    ];
    
    // Limpiar y agregar orígenes de desarrollo primero
    cachedAllowedOrigins.clear();
    developmentOrigins.forEach(origin => cachedAllowedOrigins.add(origin));
    
    // Obtener de gateway_config
    const { data: configData } = await supabase
      .from('gateway_config')
      .select('config_value')
      .eq('config_key', 'iframe_allowed_origins')
      .single();
    
    // Agregar orígenes de la configuración
    if (configData?.config_value) {
      try {
        const origins = JSON.parse(configData.config_value);
        origins.forEach(origin => {
          if (origin) {
            cachedAllowedOrigins.add(origin);
            // También agregar versiones con/sin trailing slash
            if (origin.endsWith('/')) {
              cachedAllowedOrigins.add(origin.slice(0, -1));
            } else {
              cachedAllowedOrigins.add(origin + '/');
            }
          }
        });
      } catch (e) {
        console.error('Error parsing CORS origins:', e);
      }
    }

    // Agregar orígenes de los tokens activos
    const { data: tokens } = await supabase
      .from('iframe_tokens')
      .select('allowed_domains, origin')
      .eq('is_active', true);

    tokens?.forEach(token => {
      if (token.allowed_domains && Array.isArray(token.allowed_domains)) {
        token.allowed_domains.forEach(domain => {
          if (domain) cachedAllowedOrigins.add(domain);
        });
      }
      if (token.origin) {
        cachedAllowedOrigins.add(token.origin);
      }
    });

    // Agregar orígenes del .env
    const envOrigins = process.env.IFRAME_ALLOWED_ORIGINS?.split(',') || [];
    envOrigins.forEach(origin => {
      const trimmedOrigin = origin.trim();
      if (trimmedOrigin && trimmedOrigin !== '*') {
        cachedAllowedOrigins.add(trimmedOrigin);
      }
    });

    // Agregar frontend URL si existe
    if (process.env.FRONTEND_URL) {
      cachedAllowedOrigins.add(process.env.FRONTEND_URL);
    }

    console.log('✅ Dominios permitidos actualizados:', Array.from(cachedAllowedOrigins));
    lastCacheUpdate = Date.now();
  } catch (error) {
    console.error('Error updating allowed origins:', error);
    // En caso de error, al menos mantener localhost
    ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'].forEach(origin => {
      cachedAllowedOrigins.add(origin);
    });
  }
}

// Función para obtener orígenes con cache
async function getCachedAllowedOrigins() {
  const now = Date.now();
  if (now - lastCacheUpdate > CACHE_DURATION || cachedAllowedOrigins.size === 0) {
    await updateAllowedOrigins();
  }
  return cachedAllowedOrigins;
}

// Middleware CORS mejorado
export const dynamicCorsMiddleware = async (req, res, next) => {
  const origin = req.headers.origin;
  const requestPath = req.path;
  
  // Solo mostrar log en desarrollo o para rutas críticas
  if (process.env.NODE_ENV === 'development' || requestPath.includes('/iframe/')) {
    console.log(`CORS: ${req.method} ${requestPath} from ${origin || 'no-origin'}`);
  }

  // Para OPTIONS, siempre responder positivamente
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Iframe-Token, X-Captcha-Response');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    return res.sendStatus(200);
  }

  // Obtener orígenes permitidos
  const allowedOrigins = await getCachedAllowedOrigins();

  // Verificar si es una ruta de iframe/embed
  const isIframeRoute = requestPath.includes('/iframe/') || 
                       requestPath.includes('/embed') || 
                       requestPath.includes('/public/');

  // Para desarrollo o localhost, siempre permitir
  const isLocalhost = origin && (
    origin.includes('localhost') || 
    origin.includes('127.0.0.1')
  );

  // Lógica de CORS
  let shouldAllowOrigin = false;

  if (!origin) {
    // Permitir requests sin origin (ej: Postman, server-side, mismo origen)
    shouldAllowOrigin = true;
  } else if (isLocalhost) {
    // Siempre permitir localhost
    shouldAllowOrigin = true;
  } else if (allowedOrigins.has(origin)) {
    // Origen está en la lista permitida
    shouldAllowOrigin = true;
  } else if (process.env.IFRAME_ALLOWED_ORIGINS === '*') {
    // Wildcard configurado (solo para desarrollo)
    shouldAllowOrigin = true;
  } else if (process.env.NODE_ENV === 'development') {
    // En modo desarrollo, ser más permisivo
    shouldAllowOrigin = true;
  }

  // Si es una ruta de iframe y el origen no está permitido, rechazar
  if (isIframeRoute && !shouldAllowOrigin && origin) {
    console.log(`⚠️ CORS: Rechazando ${origin} para ruta iframe`);
    return res.status(403).json({
      success: false,
      message: 'Origen no permitido para iframe',
      origin: origin,
      help: 'Configure este dominio en la sección de CORS del administrador'
    });
  }

  // Configurar headers CORS
  if (!origin) {
    // Para requests sin origin, usar wildcard
    res.header('Access-Control-Allow-Origin', '*');
  } else if (shouldAllowOrigin) {
    // Para requests con origin permitido
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  // Siempre establecer estos headers
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Iframe-Token, X-Captcha-Response');

  next();
};

// Middleware específico para rutas públicas (más permisivo)
export const publicCorsMiddleware = (req, res, next) => {
  const origin = req.headers.origin || '*';
  
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Iframe-Token, X-Captcha-Response');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
};

// Función helper para actualizar inmediatamente
export function updateCorsMiddleware() {
  updateAllowedOrigins();
}

// Exportar la función updateAllowedOrigins para uso externo
export { updateAllowedOrigins };

// Cargar inicialmente
updateAllowedOrigins().catch(console.error);