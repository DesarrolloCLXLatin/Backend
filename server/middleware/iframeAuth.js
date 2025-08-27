// server/middleware/iframeAuth.js
import { createClient } from '@supabase/supabase-js';

export const authenticateIframeToken = async (req, res, next) => {
  try {
    // Primero intentar con el token de usuario normal
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Si hay un token Bearer normal, dejar que el middleware normal lo maneje
      return next();
    }

    // Si no hay token Bearer, verificar el token del iframe
    const iframeToken = req.headers['x-iframe-token'];
    
    if (!iframeToken) {
      return res.status(401).json({ message: 'Token requerido' });
    }

    // Crear cliente de Supabase para validar el token
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Validar el token del iframe
    const { data: tokenData, error } = await supabase
      .from('iframe_tokens')
      .select('*')
      .eq('token', iframeToken)
      .single();

    if (error || !tokenData) {
      return res.status(401).json({ message: 'Token inválido' });
    }

    // Verificar si el token ha expirado
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(401).json({ message: 'Token expirado' });
    }

    // Verificar el dominio si es necesario
    if (tokenData.allowed_domains && tokenData.allowed_domains.length > 0) {
      const origin = req.headers.origin || req.headers.referer;
      if (origin) {
        const originUrl = new URL(origin);
        const domain = originUrl.hostname;
        
        if (!tokenData.allowed_domains.includes(domain)) {
          return res.status(403).json({ message: 'Dominio no autorizado' });
        }
      }
    }

    // Agregar información del iframe al request
    req.iframeToken = tokenData;
    req.isIframe = true;
    
    // Para el inventario, crear un usuario virtual con permisos completos
    // Los permisos dependen del tipo de token
    const permissions = [];
    
    // Si es un token público o de vendedor, necesita acceso al inventario
    if (tokenData.token_type === 'public_token' || tokenData.token_type === 'seller_token') {
      permissions.push('inventory:read');
      permissions.push('inventory:reserve'); // Permiso para reservar inventario
      permissions.push('inventory:update'); // Permiso para actualizar inventario después de compra
    }
    
    req.user = {
      id: `iframe-${tokenData.id}`,
      email: `iframe-${tokenData.token_type}@system`,
      permissions: permissions,
      isIframe: true,
      tokenType: tokenData.token_type,
      tokenId: tokenData.id
    };
    
    // Agregar el cliente Supabase al request
    req.supabase = supabase;
    
    next();
  } catch (error) {
    console.error('Error en autenticación de iframe:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Middleware que permite tanto autenticación normal como iframe
export const authenticateTokenOrIframe = async (req, res, next) => {
  // Si hay un token Bearer, usar autenticación normal
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return require('./auth').authenticateToken(req, res, next);
  }
  
  // Si no, intentar con iframe
  return authenticateIframeToken(req, res, next);
};