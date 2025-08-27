// server/middleware/auth.js
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Verificar que las variables existan antes de crear el cliente
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables de entorno de Supabase no configuradas');
  console.error('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  throw new Error('Configuración de Supabase incompleta');
}

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Get JWT secret from environment or use a default (change in production!)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Cache de permisos para mejorar performance
const permissionsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Generate JWT token con más información
export const generateToken = (user, permissions = []) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role, // Mantener para compatibilidad
    roles: user.roles || [], // Array de roles
    permissions: permissions // Permisos del usuario
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

// Verify JWT token middleware mejorado
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'Token requerido' 
    });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ 
        success: false,
        message: 'Token inválido' 
      });
    }
    
    try {
      // Obtener información actualizada del usuario
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', decoded.id)
        .single();

      if (userError || !userData) {
        return res.status(401).json({ 
          success: false,
          message: 'Usuario no encontrado' 
        });
      }

      // Obtener roles actuales del usuario
      const { data: userRoles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select(`
          *,
          roles!inner(*)
        `)
        .eq('user_id', decoded.id);

      if (!rolesError && userRoles) {
        userData.roles = userRoles.map(ur => ur.roles);
      } else {
        userData.roles = [];
      }

      // Obtener permisos actualizados
      const permissions = await getUserPermissions(decoded.id);
      userData.permissions = permissions.permissions;
      userData.permissionsList = permissions.permissionsList;

      req.user = userData;
      req.supabase = supabaseAdmin;
      
      next();
    } catch (error) {
      console.error('Error en autenticación:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error al autenticar usuario' 
      });
    }
  });
};

// Obtener permisos del usuario desde la base de datos - MEJORADO
export const getUserPermissions = async (userId) => {
  const cacheKey = `perms_${userId}`;
  const cached = permissionsCache.get(cacheKey);
  
  if (cached && cached.timestamp > Date.now() - CACHE_TTL) {
    console.log(`[CACHE HIT] Permisos para usuario ${userId}`);
    return cached.data;
  }

  console.log(`[CACHE MISS] Consultando permisos para usuario ${userId}`);

  try {
    // Primero intentar con RPC si existe
    const { data: rpcData, error: rpcError } = await supabaseAdmin
      .rpc('get_user_permissions', { p_user_id: userId });

    if (!rpcError && rpcData && rpcData.length > 0) {
      // Organizar permisos en formato estructurado
      const permissions = {};
      const permissionsList = [];

      rpcData.forEach(perm => {
        if (!permissions[perm.resource]) {
          permissions[perm.resource] = [];
        }
        permissions[perm.resource].push(perm.action);
        permissionsList.push(`${perm.resource}:${perm.action}`);
      });
      
      const result = {
        permissions,
        permissionsList,
        raw: rpcData
      };

      // Guardar en caché
      permissionsCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      console.log(`[PERMISOS RPC] Usuario ${userId}: ${permissionsList.length} permisos`);
      return result;
    }

    // Si RPC falla, usar consulta directa
    console.log('[PERMISOS] RPC falló o sin datos, usando consulta directa');
    
    // Obtener roles del usuario
    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select(`
        role_id,
        roles!inner(
          id,
          name,
          is_system
        )
      `)
      .eq('user_id', userId);

    if (rolesError || !userRoles || userRoles.length === 0) {
      console.log(`[PERMISOS] Usuario ${userId} sin roles asignados`);
      return { permissions: {}, permissionsList: [], raw: [] };
    }

    const roleIds = userRoles.map(ur => ur.role_id);
    const roleNames = userRoles.map(ur => ur.roles.name);

    // Si el usuario tiene rol admin, darle TODOS los permisos disponibles
    if (roleNames.includes('admin')) {
      console.log(`[PERMISOS] Usuario ${userId} es admin - otorgando acceso total`);
      
      // Obtener TODOS los permisos del sistema
      const { data: allPermissions, error: permError } = await supabaseAdmin
        .from('permissions')
        .select('*')
        .order('resource')
        .order('action');
      
      if (!permError && allPermissions) {
        const permissions = {};
        const permissionsList = [];
        
        allPermissions.forEach(perm => {
          if (!permissions[perm.resource]) {
            permissions[perm.resource] = [];
          }
          permissions[perm.resource].push(perm.action);
          permissionsList.push(`${perm.resource}:${perm.action}`);
        });
        
        // Asegurar que system:manage_all esté incluido
        if (!permissionsList.includes('system:manage_all')) {
          permissions.system = permissions.system || [];
          permissions.system.push('manage_all');
          permissionsList.push('system:manage_all');
        }
        
        const result = {
          permissions,
          permissionsList,
          raw: allPermissions
        };
        
        // Guardar en caché
        permissionsCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
        
        console.log(`[PERMISOS ADMIN] Usuario ${userId}: ${permissionsList.length} permisos totales`);
        return result;
      }
    }

    // Para usuarios no-admin, obtener permisos de sus roles
    const { data: rolePermissions, error: permsError } = await supabaseAdmin
      .from('role_permissions')
      .select(`
        permission_id,
        permissions!inner(
          id,
          resource,
          action,
          scope,
          description
        )
      `)
      .in('role_id', roleIds);

    if (permsError) {
      console.error('[ERROR] Obteniendo permisos de roles:', permsError);
      return { permissions: {}, permissionsList: [], raw: [] };
    }

    // Organizar permisos
    const permissions = {};
    const permissionsList = [];
    const raw = [];
    const addedPerms = new Set();

    rolePermissions?.forEach(rp => {
      const perm = rp.permissions;
      const permKey = `${perm.resource}:${perm.action}`;
      
      if (!addedPerms.has(permKey)) {
        if (!permissions[perm.resource]) {
          permissions[perm.resource] = [];
        }
        permissions[perm.resource].push(perm.action);
        permissionsList.push(permKey);
        raw.push(perm);
        addedPerms.add(permKey);
      }
    });

    const result = {
      permissions,
      permissionsList,
      raw
    };

    // Guardar en caché
    permissionsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    console.log(`[PERMISOS QUERY] Usuario ${userId}: ${permissionsList.length} permisos encontrados`);
    console.log(`[PERMISOS DETALLE]`, permissionsList);
    
    return result;
  } catch (error) {
    console.error('[ERROR] Obteniendo permisos:', error);
    return { permissions: {}, permissionsList: [], raw: [] };
  }
};

// Middleware para verificar permisos específicos - MEJORADO
export const requirePermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: 'Autenticación requerida' 
        });
      }

      // Obtener permisos actualizados
      const userPerms = await getUserPermissions(req.user.id);
      const requiredPermission = `${resource}:${action}`;

      // IMPORTANTE: Actualizar req.user con los permisos obtenidos
      if (!req.user.permissions || !Array.isArray(req.user.permissions)) {
        req.user.permissions = userPerms.permissionsList || [];
        req.user.permissionsList = userPerms.permissionsList || [];
        req.user.permissionsObject = userPerms.permissions || {};
      }

      console.log(`[REQUIRE PERMISSION] Usuario ${req.user.email} requiere ${requiredPermission}`);
      console.log(`[REQUIRE PERMISSION] Permisos del usuario:`, userPerms.permissionsList);

      // Verificar permisos
      const hasPermission = 
        userPerms.permissionsList.includes(requiredPermission) ||
        userPerms.permissionsList.includes(`${resource}:manage`) ||
        userPerms.permissionsList.includes(`${resource}:*`) ||
        userPerms.permissionsList.includes('system:manage_all') ||
        req.user.role === 'admin'; // Compatibilidad legacy

      if (hasPermission) {
        console.log(`[REQUIRE PERMISSION] ✅ Acceso concedido`);
        next();
      } else {
        console.log(`[REQUIRE PERMISSION] ❌ Acceso denegado`);
        res.status(403).json({ 
          success: false,
          message: 'No tienes permisos para realizar esta acción',
          required: requiredPermission,
          userPermissions: userPerms.permissionsList
        });
      }
    } catch (error) {
      console.error('[REQUIRE PERMISSION ERROR]:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error al verificar permisos' 
      });
    }
  };
};

// Middleware para verificar múltiples permisos (OR) - MEJORADO
export const requireAnyPermission = (...permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: 'Autenticación requerida' 
        });
      }

      // Obtener permisos del usuario
      const userPerms = await getUserPermissions(req.user.id);
      const userPermissions = userPerms.permissionsList || [];
      
      // IMPORTANTE: Actualizar req.user con los permisos obtenidos
      // Esto asegura que los permisos estén disponibles para el resto de la aplicación
      if (!req.user.permissions || !Array.isArray(req.user.permissions)) {
        req.user.permissions = userPermissions;
        req.user.permissionsList = userPermissions;
        req.user.permissionsObject = userPerms.permissions || {};
      }
      
      console.log('[REQUIRE ANY] Verificando permisos para usuario:', req.user.email);
      console.log('[REQUIRE ANY] Permisos del usuario:', userPermissions);
      console.log('[REQUIRE ANY] Permisos requeridos:', permissions);

      // Admin siempre tiene acceso
      if (userPermissions.includes('system:manage_all') || req.user.role === 'admin') {
        console.log('[REQUIRE ANY] Usuario es admin global');
        return next();
      }

      // Verificar permisos
      const hasPermission = permissions.some(perm => {
        if (typeof perm === 'string') {
          // Si es string, comparar directamente
          const hasIt = userPermissions.includes(perm);
          if (hasIt) console.log(`[REQUIRE ANY] ✅ Tiene permiso: ${perm}`);
          return hasIt;
        } else if (perm && typeof perm === 'object' && perm.resource && perm.action) {
          // Si es objeto, construir el string y comparar
          const permString = `${perm.resource}:${perm.action}`;
          const manageString = `${perm.resource}:manage`;
          const wildcardString = `${perm.resource}:*`;
          
          // Verificar permiso específico o permiso manage
          const hasIt = userPermissions.includes(permString) || 
                       userPermissions.includes(manageString) ||
                       userPermissions.includes(wildcardString);
          
          if (hasIt) console.log(`[REQUIRE ANY] ✅ Tiene permiso: ${permString}`);
          return hasIt;
        }
        return false;
      });

      console.log('[REQUIRE ANY] Resultado:', hasPermission ? 'PERMITIDO' : 'DENEGADO');

      if (hasPermission) {
        next();
      } else {
        res.status(403).json({ 
          success: false,
          message: 'No tienes permisos para realizar esta acción',
          required: permissions,
          userPermissions: userPermissions
        });
      }
    } catch (error) {
      console.error('[REQUIRE ANY ERROR]:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error al verificar permisos' 
      });
    }
  };
};

// Middleware para verificar acceso al dashboard - MEJORADO
export const requireDashboardAccess = () => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: 'Autenticación requerida' 
        });
      }

      const userPerms = await getUserPermissions(req.user.id);
      const permArray = userPerms.permissionsList;

      console.log('[DASHBOARD ACCESS] Verificando acceso para:', req.user.email);
      console.log('[DASHBOARD ACCESS] Permisos:', permArray);

      // Cualquier permiso de dashboard es válido
      const dashboardPerms = permArray.filter(p => p.startsWith('dashboard:view_'));
      const hasDashboardAccess = dashboardPerms.length > 0 || 
                                permArray.includes('system:manage_all') ||
                                req.user.role === 'admin';

      if (hasDashboardAccess) {
        // Agregar información sobre qué tipo de dashboard puede ver
        req.dashboardType = dashboardPerms[0]?.split(':')[1]?.replace('view_', '') || 'admin';
        console.log('[DASHBOARD ACCESS] ✅ Acceso concedido - Tipo:', req.dashboardType);
        next();
      } else {
        console.log('[DASHBOARD ACCESS] ❌ Acceso denegado');
        res.status(403).json({ 
          success: false,
          message: 'No tienes acceso al dashboard'
        });
      }
    } catch (error) {
      console.error('[DASHBOARD ACCESS ERROR]:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error al verificar permisos' 
      });
    }
  };
};

// Middleware para verificar roles (compatibilidad con código existente)
export const authorizeRoles = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Autenticación requerida' 
      });
    }

    try {
      // Obtener roles del usuario desde la base de datos
      const { data: userRoles, error } = await supabaseAdmin
        .from('user_roles')
        .select('roles!inner(name)')
        .eq('user_id', req.user.id);

      if (error) {
        console.error('Error obteniendo roles:', error);
        return res.status(500).json({ 
          success: false,
          message: 'Error al verificar roles' 
        });
      }

      const roleNames = userRoles?.map(ur => ur.roles.name) || [];
      
      // Incluir rol legacy si existe
      if (req.user.role && !roleNames.includes(req.user.role)) {
        roleNames.push(req.user.role);
      }

      console.log('[AUTHORIZE ROLES] Usuario:', req.user.email);
      console.log('[AUTHORIZE ROLES] Roles del usuario:', roleNames);
      console.log('[AUTHORIZE ROLES] Roles permitidos:', allowedRoles);
      
      // Verificar si tiene alguno de los roles permitidos
      if (roleNames.some(role => allowedRoles.includes(role))) {
        // Actualizar req.user con los roles actuales
        req.user.roles = roleNames;
        console.log('[AUTHORIZE ROLES] ✅ Acceso concedido');
        next();
      } else {
        console.log('[AUTHORIZE ROLES] ❌ Acceso denegado');
        res.status(403).json({ 
          success: false,
          message: 'No tienes permisos para acceder a este recurso',
          required: allowedRoles,
          current: roleNames
        });
      }
    } catch (error) {
      console.error('[AUTHORIZE ROLES ERROR]:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error al verificar roles' 
      });
    }
  };
};

// Middleware para obtener módulos del usuario
export const getUserModules = async (userId) => {
  try {
    // Primero intentar con RPC
    const { data: rpcData, error: rpcError } = await supabaseAdmin
      .rpc('get_user_modules', { p_user_id: userId });

    if (!rpcError && rpcData) {
      return organizeModules(rpcData);
    }

    // Si falla, usar consulta directa
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role_id')
      .eq('user_id', userId);

    if (!userRoles || userRoles.length === 0) {
      return [];
    }

    const roleIds = userRoles.map(ur => ur.role_id);

    const { data: roleModules } = await supabaseAdmin
      .from('role_modules')
      .select(`
        module_id,
        system_modules!inner(*)
      `)
      .in('role_id', roleIds)
      .eq('can_access', true);

    if (!roleModules) {
      return [];
    }

    // Eliminar duplicados
    const uniqueModules = new Map();
    roleModules.forEach(rm => {
      if (rm.system_modules && !uniqueModules.has(rm.system_modules.id)) {
        uniqueModules.set(rm.system_modules.id, rm.system_modules);
      }
    });

    return organizeModules(Array.from(uniqueModules.values()));
  } catch (error) {
    console.error('Error obteniendo módulos:', error);
    return [];
  }
};

// Función auxiliar para organizar módulos en jerarquía
const organizeModules = (modules) => {
  const moduleMap = new Map();
  const rootModules = [];

  // Crear mapa de todos los módulos
  modules.forEach(mod => {
    moduleMap.set(mod.id, { ...mod, children: [] });
  });

  // Organizar jerarquía
  modules.forEach(mod => {
    if (mod.parent_id) {
      const parent = moduleMap.get(mod.parent_id);
      if (parent) {
        parent.children.push(moduleMap.get(mod.id));
      }
    } else {
      rootModules.push(moduleMap.get(mod.id));
    }
  });

  return rootModules;
};

// Middleware para adjuntar información completa del usuario
export const enrichUserData = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    console.log('[ENRICH USER - INICIO] Usuario:', req.user.email);
    console.log('[ENRICH USER - INICIO] Permisos actuales:', Array.isArray(req.user.permissions) ? `Array(${req.user.permissions.length})` : typeof req.user.permissions);

    // Obtener información adicional del usuario
    const [permissions, modules] = await Promise.all([
      getUserPermissions(req.user.id),
      getUserModules(req.user.id)
    ]);

    // Obtener roles actuales
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('roles!inner(id, name, display_name, description)')
      .eq('user_id', req.user.id);

    // IMPORTANTE: Asignar correctamente los permisos como array
    req.user.permissions = permissions.permissionsList || []; // ✅ Array de strings
    req.user.permissionsList = permissions.permissionsList || []; // ✅ Mantener por compatibilidad
    req.user.permissionsObject = permissions.permissions || {}; // ✅ Objeto agrupado si se necesita
    req.user.modules = modules;
    req.user.roleDetails = userRoles?.map(ur => ur.roles) || [];

    // 🔍 LOGS DE DEBUG
    console.log('[ENRICH USER - FIN] Usuario:', req.user.email);
    console.log('[ENRICH USER - FIN] Roles:', req.user.roleDetails.map(r => r.name));
    console.log('[ENRICH USER - FIN] Permisos:', req.user.permissions.length);
    console.log('[ENRICH USER - FIN] Tipo de permissions:', typeof req.user.permissions);
    console.log('[ENRICH USER - FIN] Es array:', Array.isArray(req.user.permissions));
    console.log('[ENRICH USER - FIN] Primeros 5:', req.user.permissions.slice(0, 5));
    console.log('[ENRICH USER - FIN] Tiene runners:read:', req.user.permissions.includes('runners:read'));
    console.log('[ENRICH USER - FIN] Tiene system:manage_all:', req.user.permissions.includes('system:manage_all'));

    next();
  } catch (error) {
    console.error('[ENRICH USER - ERROR]:', error);
    // En caso de error, continuar pero loguear
    next();
  }
};

// Helpers para verificaciones específicas
export const isAdmin = authorizeRoles('admin');
export const isAdminOrStore = authorizeRoles('admin', 'tienda');
export const isAdminOrBoss = authorizeRoles('admin', 'boss');
export const isAdminOrAdministracion = authorizeRoles('admin', 'administracion');

// Función para limpiar cache (llamar cuando se actualicen permisos)
export const clearPermissionsCache = (userId = null) => {
  if (userId) {
    const cacheKey = `perms_${userId}`;
    permissionsCache.delete(cacheKey);
    console.log(`[CACHE] Limpiado para usuario ${userId}`);
  } else {
    permissionsCache.clear();
    console.log('[CACHE] Limpiado completamente');
  }
};

// Optional: Refresh token functionality mejorado
export const refreshToken = async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'Token requerido para refrescar' 
    });
  }

  jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }, async (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false,
        message: 'Token inválido' 
      });
    }

    // Check if token is not too old (e.g., within 30 days)
    const tokenData = jwt.decode(token);
    const tokenAge = Date.now() / 1000 - tokenData.iat;
    const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds

    if (tokenAge > maxAge) {
      return res.status(403).json({ 
        success: false,
        message: 'Token demasiado antiguo. Por favor inicia sesión nuevamente.' 
      });
    }

    // Obtener permisos actualizados
    const permissions = await getUserPermissions(user.id);

    // Generate new token
    const newToken = generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    }, permissions.permissionsList);

    res.json({ 
      success: true,
      token: newToken,
      message: 'Token refrescado exitosamente'
    });
  });
};

// NUEVO: Middleware mejorado para autenticación de iframe
export const authenticateIframe = async (req, res, next) => {
  try {
    const token = req.headers['x-iframe-token'] || req.query.token;
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Token de iframe requerido' 
      });
    }

    // Verificar token en la base de datos
    const { data: iframeToken, error } = await supabaseAdmin
      .from('iframe_tokens')
      .select(`
        *,
        users:user_id(id, email, full_name, role)
      `)
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (error || !iframeToken) {
      return res.status(401).json({ 
        success: false,
        message: 'Token inválido o expirado' 
      });
    }

    // Verificar expiración
    if (new Date(iframeToken.expires_at) < new Date()) {
      await supabaseAdmin
        .from('iframe_tokens')
        .update({ is_active: false })
        .eq('token', token);
      
      return res.status(401).json({ 
        success: false,
        message: 'Token expirado' 
      });
    }

    // Verificar origen
    const origin = req.headers.origin || req.headers.referer;
    
    // Si el token tiene dominios permitidos, verificar
    if (iframeToken.allowed_domains && iframeToken.allowed_domains.length > 0) {
      const isAllowedDomain = iframeToken.allowed_domains.some(domain => {
        return origin && origin.includes(domain);
      });
      
      if (!isAllowedDomain) {
        return res.status(403).json({ 
          success: false,
          message: 'Dominio no autorizado',
          origin: origin,
          allowed: iframeToken.allowed_domains 
        });
      }
    }

    // Verificar límite de transacciones para tokens públicos
    if (iframeToken.token_type === 'public_token' && iframeToken.max_transactions) {
      if (iframeToken.transactions_count >= iframeToken.max_transactions) {
        return res.status(403).json({ 
          success: false,
          message: 'Límite de transacciones alcanzado para este token' 
        });
      }
    }

    // Adjuntar información al request
    req.iframeToken = iframeToken;
    
    // Si es un token de vendedor, adjuntar usuario con permisos
    if (iframeToken.token_type === 'seller_token' && iframeToken.users) {
      req.user = iframeToken.users;
      // Obtener permisos del usuario
      const perms = await getUserPermissions(req.user.id);
      req.user.permissions = perms.permissions;
      req.user.permissionsList = perms.permissionsList;
    } else {
      // Para tokens públicos, crear un usuario "virtual"
      req.user = {
        id: null,
        email: 'public@iframe.temp',
        role: 'public',
        isPublic: true,
        permissions: { tickets: ['sell'] },
        permissionsList: ['tickets:sell']
      };
    }
    
    // Registrar información adicional
    req.tokenInfo = {
      type: iframeToken.token_type,
      origin: origin,
      transactionsCount: iframeToken.transactions_count,
      maxTransactions: iframeToken.max_transactions
    };
    
    next();
  } catch (error) {
    console.error('Iframe auth error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error de autenticación' 
    });
  }
};

// Función de debug mejorada
export const debugPermissionsCache = (userId) => {
  const cacheKey = `perms_${userId}`;
  const cached = permissionsCache.get(cacheKey);
  
  console.log('=== DEBUG CACHE ===');
  console.log('Usuario:', userId);
  console.log('Cache existe:', !!cached);
  if (cached) {
    console.log('Timestamp:', new Date(cached.timestamp));
    console.log('Edad (ms):', Date.now() - cached.timestamp);
    console.log('TTL restante (ms):', CACHE_TTL - (Date.now() - cached.timestamp));
    console.log('Permisos:', cached.data.permissionsList);
    console.log('Estructura completa:', JSON.stringify(cached.data, null, 2));
  }
  console.log('==================');
};