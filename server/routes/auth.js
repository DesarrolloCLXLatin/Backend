import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { 
  generateToken, 
  authenticateToken, 
  getUserPermissions,
  getUserModules,
  enrichUserData,
  requirePermission
} from '../middleware/auth.js';

// Cargar variables de entorno
dotenv.config();

// Crear cliente de Supabase para las rutas que no tienen authenticateToken
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// Función helper para obtener Supabase
// Usa req.supabase si está disponible (rutas autenticadas)
// De lo contrario usa supabaseAdmin (login, register, refresh)
const getSupabase = (req) => {
  return req.supabase || supabaseAdmin;
};

async function getUserModulesFromDatabase(supabase, userId) {
  try {
    // Obtener módulos del usuario desde user_modules
    const { data: userModulesRaw } = await supabase
      .from('user_modules')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('granted_at', { ascending: false });

    if (!userModulesRaw || userModulesRaw.length === 0) {
      return { modules: [], modules_count: 0 };
    }

    // Obtener información completa de los módulos desde system_modules
    const moduleKeys = userModulesRaw.map(um => um.module_key);
    
    const { data: systemModules } = await supabase
      .from('system_modules')
      .select('*')
      .in('name', moduleKeys)
      .eq('is_active', true);

    // Combinar datos de user_modules con system_modules
    const modules = userModulesRaw.map(um => {
      const systemModule = systemModules?.find(sm => sm.name === um.module_key);
      
      return {
        user_id: um.user_id,
        module_key: um.module_key,
        is_active: um.is_active,
        granted_at: um.granted_at,
        granted_by: um.granted_by,
        module: systemModule ? {
          key: systemModule.name,
          name: systemModule.display_name || systemModule.name,
          display_name: systemModule.display_name,
          description: systemModule.description || 'Sin descripción',
          is_active: systemModule.is_active,
          required_permissions: systemModule.required_permissions || [],
          path: systemModule.path,
          icon: systemModule.icon,
          module_type: systemModule.module_type,
          parent_id: systemModule.parent_id,
          order_index: systemModule.order_index
        } : {
          key: um.module_key,
          name: um.module_key,
          description: 'Módulo no encontrado',
          error: 'MODULE_NOT_FOUND'
        }
      };
    });

    // Contar módulos activos y válidos
    const modules_count = modules.filter(m => 
      m.is_active && 
      m.module && 
      !m.module.error && 
      m.module.is_active
    ).length;

    console.log(`📊 getUserModulesFromDatabase para ${userId}: ${modules_count} módulos activos`);

    return { modules, modules_count };

  } catch (error) {
    console.error('❌ Error obteniendo módulos:', error);
    return { modules: [], modules_count: 0 };
  }
}

// Obtener detalles de un usuario específico
router.get('/users/:userId', authenticateToken, enrichUserData, requirePermission('users', 'read'), async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: user, error } = await req.supabase
      .from('users')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey (
          id,
          role_id,
          roles (
            id,
            name,
            description,
            is_system
          )
        )
      `)
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }

    // ⭐ NUEVO: Obtener módulos del usuario
    const { modules, modules_count } = await getUserModulesFromDatabase(req.supabase, userId);

    // Formatear respuesta
    const formattedUser = {
      ...user,
      roles: user.user_roles?.map(ur => ur.roles).filter(Boolean) || [],
      modules, // ⭐ AGREGAR MÓDULOS
      modules_count, // ⭐ AGREGAR CONTEO DE MÓDULOS
      user_roles: undefined
    };

    console.log(`✅ /users/${userId}: ${modules_count} módulos incluidos`);

    res.json({
      success: true,
      user: formattedUser
    });

  } catch (error) {
    console.error('Error getting user details:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Get current user profile con permisos y módulos
router.get('/profile', authenticateToken, enrichUserData, async (req, res) => {
  try {
    const { data: user, error } = await req.supabase
      .from('users')
      .select('id, email, full_name, role, created_at, updated_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }

    res.json({ 
      success: true,
      user: {
        ...user,
        permissions: req.user.permissions,
        modules: req.user.modules,
        roles: req.user.roleDetails
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Verify token endpoint mejorado
router.get('/verify', authenticateToken, enrichUserData, (req, res) => {
  res.json({ 
    success: true,
    valid: true, 
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      permissions: req.user.permissions,
      modules: req.user.modules,
      roles: req.user.roleDetails
    }
  });
});

// GET /api/auth/me - Obtener perfil completo con permisos
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Obtener usuario con roles
    const { data: user, error: userError } = await req.supabase
      .from('users')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey (
          role_id,
          roles (
            id,
            name,
            display_name,
            description,
            is_system,
            role_permissions (
              permissions (
                resource,
                action
              )
            )
          )
        )
      `)
      .eq('id', req.user.id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }

    // Extraer permisos únicos
    const permissions = new Set();
    const roles = [];

    user.user_roles?.forEach(ur => {
      if (ur.roles) {
        roles.push({
          id: ur.roles.id,
          name: ur.roles.name,
          display_name: ur.roles.display_name,
          description: ur.roles.description,
          is_system: ur.roles.is_system
        });

        ur.roles.role_permissions?.forEach(rp => {
          if (rp.permissions) {
            permissions.add(`${rp.permissions.resource}:${rp.permissions.action}`);
          }
        });
      }
    });

    // Si el usuario es admin, agregar el permiso especial
    if (user.role === 'admin' || roles.some(r => r.name === 'admin')) {
      permissions.add('system:manage_all');
    }

    // Obtener módulos
    const { modules: userModules, modules_count } = await getUserModulesFromDatabase(req.supabase, req.user.id);

    // TAMBIÉN obtener módulos desde role_modules para compatibilidad
    const { data: roleModules } = await req.supabase
      .from('role_modules')
      .select(`
        system_modules (
          id,
          name,
          display_name,
          path,
          icon,
          parent_id,
          order_index,
          is_active
        )
      `)
      .in('role_id', roles.map(r => r.id))
      .eq('can_access', true)
      .eq('system_modules.is_active', true)
      .order('system_modules.order_index');

    const roleBasedModules = roleModules?.reduce((acc, rm) => {
      if (rm.system_modules && !acc.find(m => m.id === rm.system_modules.id)) {
        acc.push(rm.system_modules);
      }
      return acc;
    }, []) || [];

    // Priorizar user_modules sobre role_modules
    let finalModules = userModules;
    
    if (userModules.length === 0 && roleBasedModules.length > 0) {
      console.log(`⚠️ Usuario ${user.email}: Usando role_modules como fallback (${roleBasedModules.length} módulos)`);
      finalModules = roleBasedModules.map(rm => ({
        module_key: rm.name,
        is_active: true,
        module: {
          key: rm.name,
          name: rm.display_name || rm.name,
          display_name: rm.display_name,
          path: rm.path,
          icon: rm.icon,
          is_active: rm.is_active,
          module_type: 'menu'
        }
      }));
    }

    // IMPORTANTE: Convertir permisos a array
    const permissionsArray = Array.from(permissions);

    // Determinar capacidades especiales
    const canGenerateIframeTokens = permissionsArray.some(p => 
      p === 'iframe_tokens:create' || 
      p === 'tickets:manage' || 
      p === 'tickets:sell' ||
      p === 'system:manage_all'
    ) || user.role === 'admin' || user.role === 'tienda';

    const isAdmin = user.role === 'admin' || 
                    roles.some(r => r.name === 'admin') ||
                    permissionsArray.includes('system:manage_all');

    // Construir respuesta
    const userData = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      roles,
      permissions: permissionsArray,
      modules: finalModules,
      modules_count: finalModules.length,
      canGenerateIframeTokens,
      isAdmin,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    console.log(`✅ /me para ${user.email}:`);
    console.log(`   - Permisos: ${permissionsArray.length}`);
    console.log(`   - Módulos: ${finalModules.length}`);
    console.log(`   - Es admin: ${isAdmin}`);

    res.json({
      success: true,
      user: userData
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// List users con información de roles
router.get('/users', authenticateToken, enrichUserData, requirePermission('users', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    
    let query = req.supabase
      .from('users')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey (
          id,
          role_id,
          assigned_by,
          roles (
            id,
            name,
            description,
            is_system
          )
        )
      `, { count: 'exact' });

    // Aplicar búsqueda si existe
    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }

    // Paginación
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data: users, count, error } = await query;

    if (error) {
      console.error('Users list error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error al obtener usuarios' 
      });
    }

    // **NUEVO: Obtener conteo de módulos para cada usuario**
    let modulesCountMap = {};
    if (users && users.length > 0) {
      const userIds = users.map(user => user.id);
      
      const { data: modulesCounts, error: modulesError } = await req.supabase
        .from('user_modules')
        .select('user_id')
        .in('user_id', userIds)
        .eq('is_active', true);

      if (!modulesError && modulesCounts) {
        // Crear mapa de conteos de módulos
        modulesCounts.forEach(um => {
          modulesCountMap[um.user_id] = (modulesCountMap[um.user_id] || 0) + 1;
        });
      }
    }

    // Transformar la respuesta para aplanar los roles y agregar conteo de módulos
    const transformedUsers = users?.map(user => ({
      ...user,
      roles: user.user_roles?.map(ur => ur.roles).filter(Boolean) || [],
      modules_count: modulesCountMap[user.id] || 0, // **NUEVO: Agregar conteo de módulos**
      user_roles: undefined // Remover el campo intermedio
    })) || [];

    res.json({
      success: true,
      users: transformedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Register new user con sistema RBAC
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, role = 'usuario' } = req.body;

    // Validation
    if (!email || !password || !full_name) {
      return res.status(400).json({ 
        success: false,
        message: 'Email, contraseña y nombre completo son requeridos' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }

    // Verificar que el rol exista en el nuevo sistema RBAC - Usar supabaseAdmin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', role)
      .single();

    if (roleError || !roleData) {
      return res.status(400).json({ 
        success: false,
        message: 'Rol inválido' 
      });
    }

    // Check if user already exists - Usar supabaseAdmin
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({ 
        success: false,
        message: 'Ya existe un usuario con este correo' 
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // IMPORTANTE: Mapear el rol al valor permitido en la BD
    let dbRole = 'usuario'; // Valor por defecto
    
    if (role === 'admin') {
      dbRole = 'admin';
    } else if (role === 'tienda') {
      dbRole = 'tienda';
    }

    // Create user con el rol mapeado - Usar supabaseAdmin
    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert([{
        email,
        password_hash: passwordHash,
        full_name,
        role: dbRole // Usar el rol mapeado
      }])
      .select('id, email, full_name, role, created_at')
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error creando usuario' 
      });
    }

    // Asignar el rol real en el sistema RBAC - Usar supabaseAdmin
    const { error: roleAssignError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUser.id,
        role_id: roleData.id,
        assigned_by: req.user?.id || null
      });

    if (roleAssignError) {
      console.error('Error asignando rol:', roleAssignError);
      // Opcional: hacer rollback del usuario si falla la asignación del rol
      await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', newUser.id);
      
      return res.status(500).json({ 
        success: false,
        message: 'Error asignando rol al usuario' 
      });
    }

    // Obtener permisos del usuario
    const permissions = await getUserPermissions(newUser.id);

    // Generate token con permisos
    const token = generateToken(newUser, permissions);

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: {
        id: newUser.id,
        email: newUser.email,
        full_name: newUser.full_name,
        role: role, // Devolver el rol original solicitado
        permissions,
        created_at: newUser.created_at
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Login user con sistema RBAC
// server/routes/auth.js - Actualizar el endpoint de login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email y contraseña son requeridos' 
      });
    }

    // Find user - Usar supabaseAdmin directamente
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, password_hash, role, full_name, created_at, updated_at')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ 
        success: false,
        message: 'Credenciales inválidas' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false,
        message: 'Credenciales inválidas' 
      });
    }

    // Obtener permisos del usuario
    console.log('[LOGIN] Obteniendo permisos para usuario:', user.id);
    const permissions = await getUserPermissions(user.id);
    console.log('[LOGIN] Permisos obtenidos:', permissions);

    // Asegurarse de que permissions sea un array
    let permissionsArray = [];
    if (Array.isArray(permissions)) {
      permissionsArray = permissions;
    } else if (permissions && permissions.list) {
      permissionsArray = permissions.list;
    } else if (permissions && permissions.permissionsList) {
      permissionsArray = permissions.permissionsList;
    }

    console.log('[LOGIN] Permisos formateados:', permissionsArray);

    // Obtener módulos del usuario
    const modules = await getUserModules(user.id);

    // Obtener roles del usuario con más detalle - Usar supabaseAdmin
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select(`
        role_id,
        roles (
          id,
          name,
          display_name,
          description
        )
      `)
      .eq('user_id', user.id);

    const roles = userRoles?.map(ur => ur.roles).filter(Boolean) || [];

    // Generate token
    const token = generateToken(user);

    // Update last login - Usar supabaseAdmin
    await supabaseAdmin
      .from('users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', user.id);

    // Construir objeto de usuario completo
    const userResponse = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role, // Para compatibilidad
      roles, // Array de roles completos
      permissions: permissionsArray, // IMPORTANTE: Este es el array que necesita el frontend
      modules,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    console.log('[LOGIN] Usuario final:', {
      ...userResponse,
      permissions: `${userResponse.permissions.length} permisos`
    });

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      user: userResponse,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Refresh token con permisos actualizados
router.post('/refresh', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'Token requerido para refrescar' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    
    // Verificar edad del token
    const tokenAge = Date.now() / 1000 - decoded.iat;
    const maxAge = 30 * 24 * 60 * 60; // 30 días

    if (tokenAge > maxAge) {
      return res.status(403).json({ 
        success: false,
        message: 'Token demasiado antiguo. Por favor inicia sesión nuevamente.' 
      });
    }

    // Obtener información actualizada del usuario - Usar supabaseAdmin
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', decoded.id)
      .single();

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }

    // Obtener permisos actualizados
    const permissions = await getUserPermissions(user.id);

    // Generar nuevo token
    const newToken = generateToken(user, permissions);

    res.json({ 
      success: true,
      token: newToken,
      message: 'Token refrescado exitosamente'
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(403).json({ 
      success: false,
      message: 'Token inválido' 
    });
  }
});

// Update user profile
router.get('/profile', authenticateToken, enrichUserData, async (req, res) => {
  try {
    const { data: user, error } = await req.supabase
      .from('users')
      .select('id, email, full_name, role, created_at, updated_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }

    res.json({ 
      success: true,
      user: {
        ...user,
        permissions: req.user.permissions,
        modules: req.user.modules,
        roles: req.user.roleDetails
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Actualizar usuario
router.put('/users/:userId', authenticateToken, enrichUserData, requirePermission('users', 'update'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, full_name, password } = req.body;

    // No permitir que un usuario se edite a sí mismo si no es admin
    if (req.user.id === userId && !req.user.permissions?.includes('system:manage_all')) {
      return res.status(403).json({ 
        success: false,
        message: 'No puedes editar tu propio perfil desde aquí' 
      });
    }

    // Verificar que el usuario existe
    const { data: existingUser, error: userError } = await req.supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !existingUser) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }

    // Preparar datos para actualizar
    const updateData = {};
    if (email !== undefined) updateData.email = email;
    if (full_name !== undefined) updateData.full_name = full_name;
    updateData.updated_at = new Date().toISOString();

    // Actualizar datos básicos
    const { error: updateError } = await req.supabase
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
      console.error('Error actualizando usuario:', updateError);
      return res.status(500).json({ 
        success: false,
        message: 'Error al actualizar usuario' 
      });
    }

    // Si se proporciona nueva contraseña, actualizarla
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);

      const { error: passwordError } = await req.supabase
        .from('users')
        .update({ password_hash: hashedPassword })
        .eq('id', userId);

      if (passwordError) {
        console.error('Error actualizando contraseña:', passwordError);
        return res.status(500).json({ 
          success: false,
          message: 'Error al actualizar la contraseña' 
        });
      }
    }

    res.json({ 
      success: true,
      message: 'Usuario actualizado correctamente' 
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Eliminar usuario
router.delete('/users/:userId', authenticateToken, enrichUserData, requirePermission('users', 'delete'), async (req, res) => {
  try {
    const { userId } = req.params;

    // No permitir que un usuario se elimine a sí mismo
    if (req.user.id === userId) {
      return res.status(403).json({ 
        success: false,
        message: 'No puedes eliminar tu propia cuenta' 
      });
    }

    // Verificar que el usuario existe
    const { data: existingUser, error: userError } = await req.supabase
      .from('users')
      .select(`
        id,
        email,
        user_roles!user_roles_user_id_fkey (
          role_id,
          roles (
            id,
            name
          )
        )
      `)
      .eq('id', userId)
      .single();

    if (userError || !existingUser) {
      console.error('Error buscando usuario:', userError);
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }

    // No permitir eliminar el último admin
    const isAdmin = existingUser.user_roles?.some(ur => ur.roles?.name === 'admin');
    
    if (isAdmin) {
      // Contar cuántos admins hay
      const { data: adminRole } = await req.supabase
        .from('roles')
        .select('id')
        .eq('name', 'admin')
        .single();

      if (adminRole) {
        const { count } = await req.supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('role_id', adminRole.id)
          .neq('user_id', userId);

        if (count === 0 || count === null) {
          return res.status(403).json({ 
            success: false,
            message: 'No se puede eliminar el último administrador del sistema' 
          });
        }
      }
    }

    // Eliminar usuario (las relaciones se eliminan por CASCADE)
    const { error: deleteError } = await req.supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('Error eliminando usuario:', deleteError);
      return res.status(500).json({ 
        success: false,
        message: 'Error al eliminar usuario' 
      });
    }

    res.json({ 
      success: true,
      message: 'Usuario eliminado correctamente' 
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});
export default router;