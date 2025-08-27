// server/routes/rbac.js
import express from 'express';
import { 
  authenticateToken, 
  requirePermission,
  clearPermissionsCache,
  getUserPermissions,
  getUserModules
} from '../middleware/auth.js';

const router = express.Router();

// ========== GESTIÓN DE ROLES ==========

// Listar todos los roles
router.get('/roles', authenticateToken, requirePermission('users', 'read'), async (req, res) => {
  try {
    const { data: roles, error } = await req.supabase
      .from('roles')
      .select(`
        *,
        role_permissions(
          permission_id,
          permissions(
            id,
            resource,
            action,
            description
          )
        )
      `)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Formatear respuesta y contar usuarios por rol
    const formattedRoles = await Promise.all(roles.map(async (role) => {
      // Contar usuarios con este rol
      const { count } = await req.supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role_id', role.id);

      return {
        ...role,
        permissions: role.role_permissions.map(rp => rp.permissions).filter(Boolean),
        permissions_count: role.role_permissions.length,
        users_count: count || 0,
        role_permissions: undefined // Remover el campo intermedio
      };
    }));

    res.json({ 
      success: true, 
      roles: formattedRoles 
    });
  } catch (error) {
    console.error('Error listando roles:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener roles' 
    });
  }
});

router.get('/roles/:roleId', authenticateToken, requirePermission('users', 'read'), async (req, res) => {
  try {
    const { roleId } = req.params;

    const { data: role, error } = await req.supabase
      .from('roles')
      .select(`
        *,
        role_permissions(
          permission_id,
          permissions(
            id,
            resource,
            action,
            description
          )
        )
      `)
      .eq('id', roleId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false, 
          message: 'Rol no encontrado' 
        });
      }
      throw error;
    }

    // Formatear respuesta
    const formattedRole = {
      ...role,
      permissions: role.role_permissions.map(rp => rp.permissions).filter(Boolean)
    };

    // Contar usuarios con este rol
    const { count } = await req.supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', roleId);

    formattedRole.users_count = count || 0;

    res.json({ 
      success: true, 
      role: formattedRole 
    });
  } catch (error) {
    console.error('Error obteniendo detalles del rol:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener detalles del rol' 
    });
  }
});

// Crear nuevo rol
router.post('/roles', authenticateToken, requirePermission('users', 'manage_roles'), async (req, res) => {
  try {
    const { name, display_name, description, permissions = [] } = req.body;

    // Validación
    if (!name || !display_name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nombre y nombre para mostrar son requeridos' 
      });
    }

    // Verificar que no exista
    const { data: existing } = await req.supabase
      .from('roles')
      .select('id')
      .eq('name', name)
      .single();

    if (existing) {
      return res.status(409).json({ 
        success: false, 
        message: 'Ya existe un rol con ese nombre' 
      });
    }

    // Crear rol
    const { data: newRole, error: roleError } = await req.supabase
      .from('roles')
      .insert({ 
        name, 
        display_name, 
        description,
        is_system: false,
        is_active: true,
        is_assignable: true
      })
      .select()
      .single();

    if (roleError) throw roleError;

    // Asignar permisos si se proporcionaron
    if (permissions.length > 0) {
      const rolePermissions = permissions.map(permId => ({
        role_id: newRole.id,
        permission_id: permId
      }));

      const { error: permError } = await req.supabase
        .from('role_permissions')
        .insert(rolePermissions);

      if (permError) throw permError;
    }

    res.status(201).json({ 
      success: true, 
      role: newRole,
      message: 'Rol creado exitosamente' 
    });
  } catch (error) {
    console.error('Error creando rol:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear rol' 
    });
  }
});

// Actualizar rol
router.put('/roles/:roleId', authenticateToken, requirePermission('users', 'manage_roles'), async (req, res) => {
  try {
    const { roleId } = req.params;
    const { display_name, description, permissions, name } = req.body;

    // Verificar que no sea un rol del sistema
    const { data: role } = await req.supabase
      .from('roles')
      .select('is_system, name')
      .eq('id', roleId)
      .single();

    if (role?.is_system) {
      return res.status(403).json({ 
        success: false, 
        message: 'No se pueden modificar roles del sistema' 
      });
    }

    // Actualizar información del rol
    const updates = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (description !== undefined) updates.description = description;
    if (name !== undefined && name !== role.name) {
      // Verificar que el nuevo nombre no exista
      const { data: existing } = await req.supabase
        .from('roles')
        .select('id')
        .eq('name', name)
        .neq('id', roleId)
        .single();

      if (existing) {
        return res.status(409).json({ 
          success: false, 
          message: 'Ya existe un rol con ese nombre' 
        });
      }
      updates.name = name;
    }

    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length > 0) {
      const { error } = await req.supabase
        .from('roles')
        .update(updates)
        .eq('id', roleId);

      if (error) throw error;
    }

    // Actualizar permisos si se proporcionaron
    if (permissions !== undefined) {
      // Eliminar permisos actuales
      await req.supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId);

      // Insertar nuevos permisos
      if (permissions.length > 0) {
        const rolePermissions = permissions.map(permId => ({
          role_id: roleId,
          permission_id: permId
        }));

        const { error } = await req.supabase
          .from('role_permissions')
          .insert(rolePermissions);

        if (error) throw error;
      }

      // Limpiar cache de permisos para usuarios con este rol
      const { data: affectedUsers } = await req.supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', roleId);

      affectedUsers?.forEach(user => {
        clearPermissionsCache(user.user_id);
      });
    }

    res.json({ 
      success: true, 
      message: 'Rol actualizado exitosamente' 
    });
  } catch (error) {
    console.error('Error actualizando rol:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar rol' 
    });
  }
});

// Eliminar rol
router.delete('/roles/:roleId', authenticateToken, requirePermission('users', 'manage_roles'), async (req, res) => {
  try {
    const { roleId } = req.params;

    // Verificar que no sea un rol del sistema
    const { data: role } = await req.supabase
      .from('roles')
      .select('is_system, name')
      .eq('id', roleId)
      .single();

    if (role?.is_system) {
      return res.status(403).json({ 
        success: false, 
        message: 'No se pueden eliminar roles del sistema' 
      });
    }

    // Verificar que no haya usuarios con este rol
    const { count } = await req.supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', roleId);

    if (count > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `No se puede eliminar el rol porque hay ${count} usuarios asignados` 
      });
    }

    // Eliminar rol (las relaciones se eliminan por CASCADE)
    const { error } = await req.supabase
      .from('roles')
      .delete()
      .eq('id', roleId);

    if (error) throw error;

    res.json({ 
      success: true, 
      message: 'Rol eliminado exitosamente' 
    });
  } catch (error) {
    console.error('Error eliminando rol:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar rol' 
    });
  }
});



// ========== GESTIÓN DE PERMISOS ==========

// Listar todos los permisos
router.get('/permissions', authenticateToken, requirePermission('users', 'manage_roles'), async (req, res) => {
  try {
    const { resource } = req.query;

    let query = req.supabase
      .from('permissions')
      .select('*')
      .order('resource')
      .order('action');

    if (resource) {
      query = query.eq('resource', resource);
    }

    const { data: permissions, error } = await query;

    if (error) throw error;

    // Agrupar por recurso
    const groupedPermissions = permissions.reduce((acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = [];
      }
      acc[perm.resource].push(perm);
      return acc;
    }, {});

    res.json({ 
      success: true, 
      permissions: groupedPermissions,
      total: permissions.length
    });
  } catch (error) {
    console.error('Error listando permisos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener permisos' 
    });
  }
});

// Crear nuevo permiso
router.post('/permissions', authenticateToken, requirePermission('system', 'manage_all'), async (req, res) => {
  try {
    const { resource, action, description, scope = 'global' } = req.body;

    // Validación
    if (!resource || !action) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recurso y acción son requeridos' 
      });
    }

    // Verificar que no exista
    const { data: existing } = await req.supabase
      .from('permissions')
      .select('id')
      .eq('resource', resource)
      .eq('action', action)
      .single();

    if (existing) {
      return res.status(409).json({ 
        success: false, 
        message: 'Ya existe un permiso con ese recurso y acción' 
      });
    }

    // Crear permiso
    const { data: newPermission, error } = await req.supabase
      .from('permissions')
      .insert({ 
        resource, 
        action, 
        description,
        scope,
        is_system: false
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ 
      success: true, 
      permission: newPermission,
      message: 'Permiso creado exitosamente' 
    });
  } catch (error) {
    console.error('Error creando permiso:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear permiso' 
    });
  }
});

// ========== GESTIÓN DE USUARIOS Y ROLES ==========

// Asignar rol a usuario
router.post('/users/:userId/roles', authenticateToken, requirePermission('users', 'manage_roles'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleId, autoAssignModules = true } = req.body;

    if (!roleId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID del rol es requerido' 
      });
    }

    // Verificar que el usuario exista
    const { data: user } = await req.supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    // Verificar que el rol exista y sea asignable
    const { data: role } = await req.supabase
      .from('roles')
      .select('id, name, is_assignable')
      .eq('id', roleId)
      .single();

    if (!role) {
      return res.status(404).json({ 
        success: false, 
        message: 'Rol no encontrado' 
      });
    }

    if (role.is_assignable === false) {
      return res.status(403).json({ 
        success: false, 
        message: 'Este rol no puede ser asignado manualmente' 
      });
    }

    // Verificar que no tenga ya el rol
    const { data: existing } = await req.supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .single();

    if (existing) {
      return res.status(409).json({ 
        success: false, 
        message: 'El usuario ya tiene este rol' 
      });
    }

    // Asignar rol
    const { error } = await req.supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: roleId,
        assigned_by: req.user.id
      });

    if (error) throw error;

    // Auto-asignar módulos basados en los permisos del rol
    if (autoAssignModules) {
      await autoAssignModulesForUser(req.supabase, userId, roleId);
    }

    // Registrar en auditoría
    await req.supabase
      .from('permission_audit_log')
      .insert({
        user_id: req.user.id,
        action: 'grant',
        target_user_id: userId,
        target_role_id: roleId,
        reason: `Rol asignado por ${req.user.email}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

    // Limpiar cache de permisos
    clearPermissionsCache(userId);

    res.status(201).json({ 
      success: true, 
      message: 'Rol asignado exitosamente' 
    });
  } catch (error) {
    console.error('Error asignando rol:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al asignar rol' 
    });
  }
});

// Función helper para auto-asignar módulos basados en permisos
async function autoAssignModulesForUser(supabase, userId, roleId) {
  try {
    // Obtener permisos del rol
    const { data: rolePermissions } = await supabase
      .from('role_permissions')
      .select('permissions(resource, action)')
      .eq('role_id', roleId);

    if (!rolePermissions || rolePermissions.length === 0) return;

    // Mapear recursos a módulos
    const moduleMapping = {
      'runners': 'runners_management',
      'payments': 'payment_management',
      'inventory': 'inventory_management',
      'tickets': 'ticket_management',
      'dashboard': ['boss_dashboard', 'admin_dashboard', 'user_dashboard'],
      'system': 'rbac_management',
      'users': 'rbac_management'
    };

    const modulesToAssign = new Set();

    // Determinar qué módulos asignar basado en los permisos
    rolePermissions.forEach(rp => {
      const resource = rp.permissions?.resource;
      if (resource && moduleMapping[resource]) {
        if (Array.isArray(moduleMapping[resource])) {
          moduleMapping[resource].forEach(mod => modulesToAssign.add(mod));
        } else {
          modulesToAssign.add(moduleMapping[resource]);
        }
      }
    });

    // Agregar módulos especiales basados en acciones específicas
    const hasReports = rolePermissions.some(rp => 
      rp.permissions?.action === 'view_reports' || 
      rp.permissions?.resource === 'dashboard' && rp.permissions?.action === 'view_reports'
    );
    if (hasReports) {
      modulesToAssign.add('reports');
    }

    // Obtener módulos existentes del sistema
    const { data: systemModules } = await supabase
      .from('system_modules') // NO 'modules'
      .select('name as key') // Mapear 'name' a 'key'
      .in('name', Array.from(modulesToAssign));

    if (!systemModules || systemModules.length === 0) return;

    // Preparar datos para insertar
    const userModules = systemModules.map(mod => ({
      user_id: userId,
      module_key: mod.key, // Usar 'key' mapeado
      is_active: true,
      granted_at: new Date().toISOString(),
      granted_by: userId
    }));

    // Insertar módulos (ignorar si ya existen)
    await supabase
      .from('user_modules')
      .upsert(userModules, { 
        onConflict: 'user_id,module_key',
        ignoreDuplicates: true 
      });

  } catch (error) {
    console.error('Error auto-asignando módulos:', error);
  }
}

// Remover rol de usuario
router.delete('/users/:userId/roles/:roleId', authenticateToken, requirePermission('users', 'manage_roles'), async (req, res) => {
  try {
    const { userId, roleId } = req.params;

    // No permitir que un admin se quite su propio rol de admin
    if (userId === req.user.id) {
      const { data: role } = await req.supabase
        .from('roles')
        .select('name')
        .eq('id', roleId)
        .single();

      if (role?.name === 'admin') {
        return res.status(403).json({ 
          success: false, 
          message: 'No puedes quitar tu propio rol de administrador' 
        });
      }
    }

    // Verificar que el usuario tenga al menos un rol después de eliminar este
    const { data: userRoles } = await req.supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId);

    if (userRoles?.length <= 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'El usuario debe tener al menos un rol' 
      });
    }

    // Eliminar asignación de rol
    const { error } = await req.supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId);

    if (error) throw error;

    // Registrar en auditoría
    await req.supabase
      .from('permission_audit_log')
      .insert({
        user_id: req.user.id,
        action: 'revoke',
        target_user_id: userId,
        target_role_id: roleId,
        reason: `Rol removido por ${req.user.email}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

    // Limpiar cache de permisos
    clearPermissionsCache(userId);

    res.json({ 
      success: true, 
      message: 'Rol removido exitosamente' 
    });
  } catch (error) {
    console.error('Error removiendo rol:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al remover rol' 
    });
  }
});

// Obtener roles de un usuario
router.get('/users/:userId/roles', authenticateToken, requirePermission('users', 'read'), async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: userRoles, error } = await req.supabase
      .from('user_roles')
      .select(`
        *,
        roles!inner(*),
        assigned_by_user:users!user_roles_assigned_by_fkey(email, full_name)
      `)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ 
      success: true, 
      roles: userRoles 
    });
  } catch (error) {
    console.error('Error obteniendo roles del usuario:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener roles' 
    });
  }
});

// Obtener permisos de un usuario
router.get('/users/:userId/permissions', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Solo admin o el mismo usuario pueden ver sus permisos
    if (req.user.id !== userId && !req.user.roles?.some(r => r.name === 'admin')) {
      return res.status(403).json({ 
        success: false, 
        message: 'No autorizado' 
      });
    }

    const permissions = await getUserPermissions(userId);

    res.json({ 
      success: true, 
      permissions 
    });
  } catch (error) {
    console.error('Error obteniendo permisos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener permisos' 
    });
  }
});


// ========== GESTIÓN DE MÓDULOS - ENDPOINTS COMPLETOS ==========

router.get('/users/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Obtener información del usuario
    const { data: user, error: userError } = await req.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Obtener roles del usuario
    const { data: userRoles } = await req.supabase
      .from('user_roles')
      .select(`
        roles(id, name, display_name)
      `)
      .eq('user_id', userId);

    // ✅ CORRECCIÓN PRINCIPAL: Obtener módulos activos correctamente
    const { data: userModules } = await req.supabase
      .from('user_modules')
      .select(`
        *,
        system_modules(name, display_name, description, is_active)
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    // Formatear módulos
    const activeModules = userModules?.filter(um => 
      um.system_modules && um.system_modules.is_active
    ).map(um => ({
      key: um.module_key,
      name: um.system_modules.display_name || um.system_modules.name,
      description: um.system_modules.description,
      granted_at: um.granted_at
    })) || [];

    // Obtener también módulos inactivos para el conteo total
    const { data: allUserModules } = await req.supabase
      .from('user_modules')
      .select('module_key, is_active')
      .eq('user_id', userId);

    const totalModules = allUserModules?.length || 0;
    const inactiveModules = allUserModules?.filter(um => !um.is_active) || [];

    // Respuesta formateada
    const response = {
      success: true,
      user: {
        ...user,
        roles: userRoles?.map(ur => ur.roles).filter(Boolean) || [],
        active_modules: activeModules,
        inactive_modules: inactiveModules,
        total_modules: totalModules,
        modules_count: activeModules.length // ✅ Este es el campo clave
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información del usuario'
    });
  }
});

router.get('/user-info/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // ✅ USAR LA MISMA LÓGICA QUE EN EL ENDPOINT QUE FUNCIONA
    const { data: userData, error } = await req.supabase
      .rpc('get_user_with_modules_count', { p_user_id: userId });

    if (error) {
      // Fallback a consulta manual
      const { data: user } = await req.supabase
        .from('users')
        .select(`
          *,
          user_modules!inner(
            module_key,
            is_active,
            system_modules(name, display_name, is_active)
          )
        `)
        .eq('id', userId)
        .single();

      if (user) {
        const activeModules = user.user_modules?.filter(um => 
          um.is_active && um.system_modules?.is_active
        ) || [];

        res.json({
          user_id: user.id,
          email: user.email,
          full_name: user.full_name,
          roles: [], // Obtener roles por separado si es necesario
          active_modules: activeModules.map(um => ({
            key: um.module_key,
            name: um.system_modules.display_name
          })),
          inactive_modules: [],
          total_modules: activeModules.length
        });
      } else {
        throw new Error('Usuario no encontrado');
      }
    } else {
      res.json(userData);
    }

  } catch (error) {
    console.error('Error en user-info:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Listar todos los módulos del sistema
router.get('/modules', authenticateToken, requirePermission('users', 'read'), async (req, res) => {
  try {
    // ✅ CAMBIAR DE 'system_modules' si está usando 'modules'
    const { data: modules, error } = await req.supabase
      .from('system_modules') // Asegurar que sea la tabla correcta
      .select('*')
      .eq('is_active', true)
      .order('display_name');

    if (error) throw error;

    // Transformar la respuesta para que coincida con lo que espera el frontend
    const formattedModules = modules.map(module => ({
      key: module.name,
      name: module.display_name,
      description: module.description || 'Sin descripción',
      is_active: module.is_active,
      required_permissions: module.required_permissions || [],
      module_type: module.module_type,
      path: module.path,
      icon: module.icon
    }));

    res.json({ 
      success: true, 
      modules: formattedModules
    });
  } catch (error) {
    console.error('Error listando módulos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener módulos',
      debug: error.message
    });
  }
});

// Obtener módulos de un usuario específico
router.get('/users/:userId/modules', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Solo admin o el mismo usuario pueden ver sus módulos
    if (req.user.id !== userId && !req.user.roles?.some(r => r.name === 'admin')) {
      return res.status(403).json({ 
        success: false, 
        message: 'No autorizado' 
      });
    }

    // Verificar que el usuario existe
    const { data: user } = await req.supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', userId)
      .single();

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    // MÉTODO 1: Intentar con JOIN automático
    let userModules = null;
    let moduleData = [];
    
    try {
      const { data, error } = await req.supabase
        .from('user_modules')
        .select(`
          *,
          module:system_modules!user_modules_module_key_fkey(*)
        `)
        .eq('user_id', userId)
        .order('granted_at', { ascending: false });

      if (!error && data) {
        userModules = data;
        console.log('✅ JOIN automático funcionó');
      } else {
        console.log('⚠️ JOIN automático falló:', error?.message);
        throw new Error('JOIN failed');
      }
    } catch (joinError) {
      console.log('🔄 Usando método alternativo de consulta manual...');
      
      // MÉTODO 2: Consulta manual separada (más confiable)
      const { data: userModulesRaw, error: userModulesError } = await req.supabase
        .from('user_modules')
        .select('*')
        .eq('user_id', userId)
        .order('granted_at', { ascending: false });

      if (userModulesError) throw userModulesError;

      if (userModulesRaw && userModulesRaw.length > 0) {
        // Obtener información de módulos por separado
        const moduleKeys = userModulesRaw.map(um => um.module_key);
        
        const { data: systemModules, error: modulesError } = await req.supabase
          .from('system_modules')
          .select('*')
          .in('name', moduleKeys);

        if (modulesError) throw modulesError;

        // Combinar datos manualmente
        userModules = userModulesRaw.map(um => {
          const module = systemModules?.find(sm => sm.name === um.module_key);
          return {
            ...um,
            module: module || null
          };
        });

        console.log(`✅ Método manual exitoso: ${userModules.length} módulos encontrados`);
      } else {
        userModules = [];
      }
    }

    // Formatear respuesta
    const formattedModules = userModules.map(um => ({
      user_id: um.user_id,
      module_key: um.module_key,
      is_active: um.is_active,
      granted_at: um.granted_at,
      granted_by: um.granted_by,
      module: um.module ? {
        key: um.module.name,
        name: um.module.display_name || um.module.name,
        description: um.module.description || 'Sin descripción',
        is_active: um.module.is_active,
        required_permissions: um.module.required_permissions || [],
        path: um.module.path,
        icon: um.module.icon,
        module_type: um.module.module_type
      } : {
        key: um.module_key,
        name: um.module_key,
        description: 'Módulo no encontrado en system_modules',
        is_active: false,
        error: 'MODULE_NOT_FOUND'
      }
    }));

    // Separar módulos activos e inactivos
    const activeModules = formattedModules.filter(um => um.is_active && um.module && !um.module.error);
    const inactiveModules = formattedModules.filter(um => !um.is_active || um.module?.error);

    const response = {
      success: true,
      modules: formattedModules,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name
      },
      summary: {
        total: formattedModules.length,
        active: activeModules.length,
        inactive: inactiveModules.length,
        active_modules: activeModules,
        inactive_modules: inactiveModules
      },
      debug: {
        query_method: userModules ? 'manual_join' : 'auto_join',
        timestamp: new Date().toISOString()
      }
    };

    console.log(`📊 Módulos para ${user.email}:`, {
      total: formattedModules.length,
      active: activeModules.length,
      inactive: inactiveModules.length
    });

    res.json(response);

  } catch (error) {
    console.error('❌ Error obteniendo módulos del usuario:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener módulos del usuario',
      debug: {
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
});

// TAMBIÉN AGREGAR ENDPOINT DE VERIFICACIÓN RÁPIDA
router.get('/users/:userId/modules/quick-check', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Consulta directa como la que funcionó en SQL
    const { data, error } = await req.supabase
      .rpc('get_user_modules_with_details', { p_user_id: userId });
      
    if (error) {
      // Si no existe la función, usar consulta manual
      const { data: rawData } = await req.supabase
        .from('user_modules')
        .select(`
          *,
          system_modules!inner(name, display_name, is_active)
        `)
        .eq('user_id', userId)
        .eq('is_active', true);
      
      res.json({
        success: true,
        modules_count: rawData?.length || 0,
        modules: rawData || [],
        method: 'manual_query'
      });
    } else {
      res.json({
        success: true,
        modules_count: data?.length || 0,
        modules: data || [],
        method: 'rpc_function'
      });
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Asignar módulos a un usuario
router.post('/users/:userId/modules', authenticateToken, requirePermission('users', 'manage'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { modules } = req.body;

    if (!Array.isArray(modules) || modules.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Los módulos deben ser un array no vacío' 
      });
    }

    // Verificar que el usuario exista
    const { data: user } = await req.supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    // Verificar que todos los módulos existan
    const { data: existingModules } = await req.supabase
      .from('system_modules')
      .select('name')
      .in('name', modules)
      .eq('is_active', true);

    if (!existingModules || existingModules.length !== modules.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Uno o más módulos no existen o están inactivos' 
      });
    }

    // Preparar datos para insertar
    const userModules = modules.map(moduleKey => ({
      user_id: userId,
      module_key: moduleKey,
      is_active: true,
      granted_at: new Date().toISOString(),
      granted_by: req.user.id
    }));

    // Insertar módulos usando upsert para evitar duplicados
    const { error } = await req.supabase
      .from('user_modules')
      .upsert(userModules, { 
        onConflict: 'user_id,module_key',
        ignoreDuplicates: false
      });

    if (error) throw error;

    // Registrar en auditoría
    await req.supabase
      .from('permission_audit_log')
      .insert({
        user_id: req.user.id,
        action: 'grant',
        target_user_id: userId,
        new_value: { modules },
        reason: `Módulos asignados por ${req.user.email}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

    res.json({ 
      success: true, 
      message: `${modules.length} módulos asignados exitosamente` 
    });
  } catch (error) {
    console.error('Error asignando módulos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al asignar módulos' 
    });
  }
});

// Actualizar módulos de un usuario (reemplaza todos)
router.put('/users/:userId/modules', authenticateToken, requirePermission('users', 'manage'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { modules } = req.body;

    if (!Array.isArray(modules)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Los módulos deben ser un array' 
      });
    }

    // Verificar que el usuario exista
    const { data: user } = await req.supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    // Obtener módulos actuales para auditoría
    const { data: currentModules } = await req.supabase
      .from('user_modules')
      .select('module_key')
      .eq('user_id', userId)
      .eq('is_active', true);

    // Eliminar módulos actuales
    await req.supabase
      .from('user_modules')
      .delete()
      .eq('user_id', userId);

    // Si hay módulos nuevos, insertarlos
    if (modules.length > 0) {
      // Verificar que todos los módulos existan
      const { data: existingModules } = await req.supabase
        .from('system_modules')
        .select('name')
        .in('name', modules)
        .eq('is_active', true);

      if (!existingModules || existingModules.length !== modules.length) {
        return res.status(400).json({ 
          success: false, 
          message: 'Uno o más módulos no existen o están inactivos' 
        });
      }

      const userModules = modules.map(moduleKey => ({
        user_id: userId,
        module_key: moduleKey,
        is_active: true,
        granted_at: new Date().toISOString(),
        granted_by: req.user.id
      }));

      const { error } = await req.supabase
        .from('user_modules')
        .insert(userModules);

      if (error) throw error;
    }

    // Registrar en auditoría
    await req.supabase
      .from('permission_audit_log')
      .insert({
        user_id: req.user.id,
        action: 'modify',
        target_user_id: userId,
        old_value: { modules: currentModules?.map(m => m.module_key) || [] },
        new_value: { modules },
        reason: `Módulos actualizados por ${req.user.email}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

    res.json({ 
      success: true, 
      message: 'Módulos actualizados exitosamente' 
    });
  } catch (error) {
    console.error('Error actualizando módulos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar módulos' 
    });
  }
});

// Remover módulo específico de un usuario
router.delete('/users/:userId/modules/:moduleKey', authenticateToken, requirePermission('users', 'manage'), async (req, res) => {
  try {
    const { userId, moduleKey } = req.params;

    // Verificar que el usuario tenga el módulo asignado
    const { data: userModule } = await req.supabase
      .from('user_modules')
      .select('*')
      .eq('user_id', userId)
      .eq('module_key', moduleKey)
      .single();

    if (!userModule) {
      return res.status(404).json({ 
        success: false, 
        message: 'El usuario no tiene este módulo asignado' 
      });
    }

    // Eliminar el módulo
    const { error } = await req.supabase
      .from('user_modules')
      .delete()
      .eq('user_id', userId)
      .eq('module_key', moduleKey);

    if (error) throw error;

    // Registrar en auditoría
    await req.supabase
      .from('permission_audit_log')
      .insert({
        user_id: req.user.id,
        action: 'revoke',
        target_user_id: userId,
        old_value: { module: moduleKey },
        reason: `Módulo removido por ${req.user.email}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

    res.json({ 
      success: true, 
      message: 'Módulo removido exitosamente' 
    });
  } catch (error) {
    console.error('Error removiendo módulo:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al remover módulo' 
    });
  }
});

// Activar/Desactivar módulo de un usuario
router.patch('/users/:userId/modules/:moduleKey', authenticateToken, requirePermission('users', 'manage'), async (req, res) => {
  try {
    const { userId, moduleKey } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ 
        success: false, 
        message: 'is_active debe ser un booleano' 
      });
    }

    // Verificar que el usuario tenga el módulo asignado
    const { data: userModule } = await req.supabase
      .from('user_modules')
      .select('*')
      .eq('user_id', userId)
      .eq('module_key', moduleKey)
      .single();

    if (!userModule) {
      return res.status(404).json({ 
        success: false, 
        message: 'El usuario no tiene este módulo asignado' 
      });
    }

    // Actualizar el estado del módulo
    const { error } = await req.supabase
      .from('user_modules')
      .update({ 
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('module_key', moduleKey);

    if (error) throw error;

    // Registrar en auditoría
    await req.supabase
      .from('permission_audit_log')
      .insert({
        user_id: req.user.id,
        action: 'modify',
        target_user_id: userId,
        old_value: { module: moduleKey, was_active: userModule.is_active },
        new_value: { module: moduleKey, is_active },
        reason: `Módulo ${is_active ? 'activado' : 'desactivado'} por ${req.user.email}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

    res.json({ 
      success: true, 
      message: `Módulo ${is_active ? 'activado' : 'desactivado'} exitosamente` 
    });
  } catch (error) {
    console.error('Error actualizando estado del módulo:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar estado del módulo' 
    });
  }
});

// Obtener estadísticas de módulos por usuario
router.get('/modules/statistics', authenticateToken, requirePermission('system', 'manage_all'), async (req, res) => {
  try {
    // Módulos totales
    const { count: totalModules } = await req.supabase
      .from('system_modules')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Usuarios con módulos asignados
    const { data: usersWithModules } = await req.supabase
      .from('user_modules')
      .select('user_id')
      .eq('is_active', true);

    const uniqueUsersWithModules = new Set(usersWithModules?.map(um => um.user_id)).size;

    // Usuarios sin módulos
    const { count: totalUsers } = await req.supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Módulos más asignados
    const { data: moduleUsage } = await req.supabase
      .from('user_modules')
      .select(`
        module_key,
        system_modules!user_modules_module_key_fkey(display_name)
      `)
      .eq('is_active', true);

    const moduleStats = {};
    moduleUsage?.forEach(um => {
      const moduleName = um.system_modules?.display_name || um.module_key;
      moduleStats[moduleName] = (moduleStats[moduleName] || 0) + 1;
    });

    const topModules = Object.entries(moduleStats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      success: true,
      statistics: {
        total_modules: totalModules || 0,
        users_with_modules: uniqueUsersWithModules,
        users_without_modules: (totalUsers || 0) - uniqueUsersWithModules,
        total_assignments: moduleUsage?.length || 0,
        top_modules: topModules
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de módulos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener estadísticas' 
    });
  }
});

// Asignar módulos masivamente por rol
router.post('/roles/:roleId/assign-modules', authenticateToken, requirePermission('users', 'manage_roles'), async (req, res) => {
  try {
    const { roleId } = req.params;
    const { modules } = req.body;

    if (!Array.isArray(modules) || modules.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Los módulos deben ser un array no vacío' 
      });
    }

    // Obtener usuarios con este rol
    const { data: usersWithRole } = await req.supabase
      .from('user_roles')
      .select('user_id')
      .eq('role_id', roleId);

    if (!usersWithRole || usersWithRole.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No hay usuarios con este rol' 
      });
    }

    // Preparar asignaciones masivas
    const assignments = [];
    usersWithRole.forEach(userRole => {
      modules.forEach(moduleKey => {
        assignments.push({
          user_id: userRole.user_id,
          module_key: moduleKey,
          is_active: true,
          granted_at: new Date().toISOString(),
          granted_by: req.user.id
        });
      });
    });

    // Insertar asignaciones
    const { error } = await req.supabase
      .from('user_modules')
      .upsert(assignments, { 
        onConflict: 'user_id,module_key',
        ignoreDuplicates: true 
      });

    if (error) throw error;

    // Registrar en auditoría
    await req.supabase
      .from('permission_audit_log')
      .insert({
        user_id: req.user.id,
        action: 'grant',
        target_role_id: roleId,
        new_value: { 
          modules, 
          affected_users: usersWithRole.length 
        },
        reason: `Módulos asignados masivamente por rol por ${req.user.email}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

    res.json({ 
      success: true, 
      message: `Módulos asignados a ${usersWithRole.length} usuarios con este rol` 
    });
  } catch (error) {
    console.error('Error en asignación masiva:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error en la asignación masiva de módulos' 
    });
  }
});

// Obtener módulos recomendados para un usuario basado en sus roles
router.get('/users/:userId/modules/recommended', authenticateToken, requirePermission('users', 'read'), async (req, res) => {
  try {
    const { userId } = req.params;

    // Obtener roles del usuario
    const { data: userRoles } = await req.supabase
      .from('user_roles')
      .select(`
        roles(name)
      `)
      .eq('user_id', userId);

    if (!userRoles || userRoles.length === 0) {
      return res.json({ 
        success: true, 
        recommended_modules: [],
        message: 'Usuario sin roles asignados' 
      });
    }

    // Mapear roles a módulos recomendados
    const roleModuleMapping = {
      'admin': ['rbac_management', 'user_management', 'system_config', 'audit_logs', 'reports'],
      'boss': ['boss_dashboard', 'reports', 'financial_reports', 'runner_reports'],
      'administracion': ['payment_management', 'registration_management', 'exchange_rates'],
      'tienda': ['store_dashboard', 'ticket_sales', 'payment_management'],
      'usuario': ['user_dashboard']
    };

    const recommendedModuleKeys = new Set();
    userRoles.forEach(ur => {
      const roleName = ur.roles?.name;
      if (roleName && roleModuleMapping[roleName]) {
        roleModuleMapping[roleName].forEach(moduleKey => {
          recommendedModuleKeys.add(moduleKey);
        });
      }
    });

    // Obtener información completa de los módulos recomendados
    const { data: recommendedModules } = await req.supabase
      .from('system_modules')
      .select('*')
      .in('name', Array.from(recommendedModuleKeys))
      .eq('is_active', true);

    // Obtener módulos ya asignados al usuario
    const { data: assignedModules } = await req.supabase
      .from('user_modules')
      .select('module_key')
      .eq('user_id', userId)
      .eq('is_active', true);

    const assignedKeys = new Set(assignedModules?.map(am => am.module_key) || []);

    // Filtrar módulos no asignados
    const notAssignedModules = recommendedModules?.filter(module => 
      !assignedKeys.has(module.name)
    ) || [];

    res.json({ 
      success: true, 
      recommended_modules: notAssignedModules.map(module => ({
        key: module.name,
        name: module.display_name,
        description: module.description,
        reason: `Recomendado para roles: ${userRoles.map(ur => ur.roles?.name).join(', ')}`
      }))
    });
  } catch (error) {
    console.error('Error obteniendo módulos recomendados:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener módulos recomendados' 
    });
  }
});

router.post('/debug/sync-user-modules/:userId', authenticateToken, requirePermission('system', 'manage_all'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { forceResync = false } = req.body;

    console.log(`🔄 Iniciando sincronización para usuario: ${userId}`);

    // 1. Verificar que el usuario existe
    const { data: user, error: userError } = await req.supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        debug: userError
      });
    }

    // 2. Verificar qué tabla de módulos existe
    let moduleTable = 'system_modules';
    let moduleTableExists = true;

    try {
      const { data: testModules } = await req.supabase
        .from('system_modules')
        .select('name')
        .limit(1);
      
      if (!testModules) {
        moduleTable = 'modules';
        const { data: testModules2 } = await req.supabase
          .from('modules')
          .select('name')
          .limit(1);
        
        if (!testModules2) {
          moduleTableExists = false;
        }
      }
    } catch (error) {
      moduleTable = 'modules';
      try {
        await req.supabase.from('modules').select('name').limit(1);
      } catch (error2) {
        moduleTableExists = false;
      }
    }

    if (!moduleTableExists) {
      return res.status(500).json({
        success: false,
        message: 'No se encontró tabla de módulos (ni system_modules ni modules)',
        debug: { attempted_tables: ['system_modules', 'modules'] }
      });
    }

    console.log(`📋 Usando tabla de módulos: ${moduleTable}`);

    // 3. Obtener módulos del usuario con la tabla correcta
    const { data: userModules, error: userModulesError } = await req.supabase
      .from('user_modules')
      .select(`
        *,
        module:${moduleTable}!user_modules_module_key_fkey(*)
      `)
      .eq('user_id', userId);

    if (userModulesError) {
      console.error('Error obteniendo user_modules:', userModulesError);
      return res.status(500).json({
        success: false,
        message: 'Error obteniendo módulos del usuario',
        debug: userModulesError
      });
    }

    // 4. Separar módulos activos e inactivos
    const activeModules = userModules.filter(um => um.is_active && um.module);
    const inactiveModules = userModules.filter(um => !um.is_active || !um.module);
    const orphanedModules = userModules.filter(um => !um.module);

    // 5. Si hay módulos huérfanos y forceResync está activado, limpiarlos
    if (forceResync && orphanedModules.length > 0) {
      console.log(`🧹 Limpiando ${orphanedModules.length} módulos huérfanos`);
      
      const orphanedIds = orphanedModules.map(om => om.id);
      await req.supabase
        .from('user_modules')
        .delete()
        .in('id', orphanedIds);
    }

    // 6. Obtener roles del usuario para auto-asignación
    const { data: userRoles } = await req.supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', userId);

    // 7. Limpiar caché de permisos
    clearPermissionsCache(userId);

    // 8. Preparar respuesta completa
    const response = {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name
      },
      modules: {
        active: activeModules.map(um => ({
          ...um,
          module: um.module ? {
            key: um.module.name,
            name: um.module.display_name || um.module.name,
            description: um.module.description
          } : null
        })),
        inactive: inactiveModules.filter(um => um.module).map(um => ({
          ...um,
          module: {
            key: um.module.name,
            name: um.module.display_name || um.module.name,
            description: um.module.description
          }
        })),
        orphaned: orphanedModules.map(um => ({
          module_key: um.module_key,
          granted_at: um.granted_at,
          status: 'module_not_found'
        }))
      },
      debug: {
        module_table_used: moduleTable,
        total_user_modules: userModules.length,
        active_count: activeModules.length,
        inactive_count: inactiveModules.length,
        orphaned_count: orphanedModules.length,
        user_roles: userRoles?.map(ur => ur.roles?.name).filter(Boolean) || [],
        cache_cleared: true,
        force_resync: forceResync
      }
    };

    console.log(`✅ Sincronización completada para ${user.email}`);
    
    res.json(response);

  } catch (error) {
    console.error('Error en sincronización:', error);
    res.status(500).json({
      success: false,
      message: 'Error durante la sincronización',
      debug: error.message
    });
  }
});

// Endpoint para verificar la estructura de las tablas
router.get('/debug/table-structure', authenticateToken, requirePermission('system', 'manage_all'), async (req, res) => {
  try {
    const checks = {
      tables: {},
      foreign_keys: {},
      sample_data: {}
    };

    // Verificar tablas existentes
    const tableNames = ['users', 'user_modules', 'system_modules', 'modules', 'roles', 'user_roles'];
    
    for (const tableName of tableNames) {
      try {
        const { data, error } = await req.supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        checks.tables[tableName] = {
          exists: !error,
          error: error?.message,
          has_data: data && data.length > 0
        };
      } catch (err) {
        checks.tables[tableName] = {
          exists: false,
          error: err.message
        };
      }
    }

    // Obtener muestra de user_modules
    try {
      const { data: userModulesSample } = await req.supabase
        .from('user_modules')
        .select('*')
        .limit(3);
      
      checks.sample_data.user_modules = userModulesSample;
    } catch (err) {
      checks.sample_data.user_modules = { error: err.message };
    }

    // Obtener muestra de módulos disponibles
    for (const moduleTable of ['system_modules', 'modules']) {
      try {
        const { data: modulesSample } = await req.supabase
          .from(moduleTable)
          .select('*')
          .limit(3);
        
        checks.sample_data[moduleTable] = modulesSample;
      } catch (err) {
        checks.sample_data[moduleTable] = { error: err.message };
      }
    }

    res.json({
      success: true,
      checks,
      recommendations: [
        checks.tables.system_modules?.exists ? 
          'Usar system_modules como tabla principal' : 
          'Verificar si debe crearse la tabla system_modules',
        checks.tables.user_modules?.exists ?
          'Tabla user_modules disponible' :
          'CRÍTICO: Tabla user_modules no encontrada',
        'Verificar foreign keys entre user_modules y la tabla de módulos'
      ]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verificando estructura',
      debug: error.message
    });
  }
});

// ========== REPORTES Y AUDITORÍA ==========

router.get('/views/:viewName/config', authenticateToken, async (req, res) => {
  const { viewName } = req.params;
  const userId = req.user.id;

  try {
    // Obtener configuración de vista para el usuario
    const { data, error } = await req.supabase
      .rpc('get_view_config_for_user', {
        p_user_id: userId,
        p_view_name: viewName
      });

    if (error) throw error;

    // Agregar información adicional
    const config = {
      ...data,
      userPermissions: await getUserPermissions(userId),
      viewName
    };

    res.json({ 
      success: true, 
      config 
    });
  } catch (error) {
    console.error('Error loading view config:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al cargar configuración' 
    });
  }
});

// Obtener resumen de permisos por rol
router.get('/reports/permissions-by-role', authenticateToken, requirePermission('users', 'manage_roles'), async (req, res) => {
  try {
    const { data: roles, error } = await req.supabase
      .from('roles')
      .select(`
        *,
        user_roles(count),
        role_permissions(
          permissions(*)
        )
      `);

    if (error) throw error;

    const report = roles.map(role => ({
      role: {
        id: role.id,
        name: role.name,
        display_name: role.display_name,
        is_system: role.is_system
      },
      users_count: role.user_roles[0]?.count || 0,
      permissions_count: role.role_permissions.length,
      permissions: role.role_permissions.map(rp => rp.permissions)
    }));

    res.json({ 
      success: true, 
      report 
    });
  } catch (error) {
    console.error('Error generando reporte:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al generar reporte' 
    });
  }
});

// Obtener estadísticas RBAC (incluyendo módulos)
router.get('/statistics', authenticateToken, requirePermission('system', 'manage_all'), async (req, res) => {
  try {
    // Contar usuarios totales
    const { count: totalUsers } = await req.supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Contar roles totales
    const { count: totalRoles } = await req.supabase
      .from('roles')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Contar permisos totales
    const { count: totalPermissions } = await req.supabase
      .from('permissions')
      .select('*', { count: 'exact', head: true });

    // Contar módulos totales
    const { count: totalModules } = await req.supabase
      .from('modules')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Cambios recientes (últimas 24 horas)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { count: recentChanges } = await req.supabase
      .from('permission_audit_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString());

    // Usuarios sin roles
    const { data: usersWithoutRoles } = await req.supabase
      .from('users')
      .select('id')
      .not('id', 'in', req.supabase
        .from('user_roles')
        .select('user_id')
      );

    // Usuarios sin módulos
    const { data: usersWithoutModules } = await req.supabase
      .from('users')
      .select('id')
      .not('id', 'in', req.supabase
        .from('user_modules')
        .select('user_id')
      );

    // Permisos no usados
    const { data: unusedPermissions } = await req.supabase
      .from('permissions')
      .select('id')
      .not('id', 'in', req.supabase
        .from('role_permissions')
        .select('permission_id')
      );

    const stats = {
      total_users: totalUsers || 0,
      total_roles: totalRoles || 0,
      total_permissions: totalPermissions || 0,
      total_modules: totalModules || 0,
      active_sessions: 0, // Implementar si tienes sistema de sesiones
      recent_changes: recentChanges || 0,
      unused_permissions: unusedPermissions?.length || 0,
      users_without_roles: usersWithoutRoles?.length || 0,
      users_without_modules: usersWithoutModules?.length || 0,
      system_health: (usersWithoutRoles?.length > 0 || usersWithoutModules?.length > 0 || unusedPermissions?.length > 5) ? 'warning' : 'good'
    };

    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener estadísticas' 
    });
  }
});

// Registro de auditoría
router.get('/audit', authenticateToken, requirePermission('system', 'manage_all'), async (req, res) => {
  try {
    const { action, userId, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    
    let query = req.supabase
      .from('permission_audit_log')
      .select(`
        *,
        users!permission_audit_log_user_id_fkey(email),
        target_users:users!permission_audit_log_target_user_id_fkey(email),
        roles!permission_audit_log_target_role_id_fkey(name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (action) query = query.eq('action', action);
    if (userId) query = query.eq('user_id', userId);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    // Paginación
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;
    
    if (error) throw error;

    const entries = data.map(entry => ({
      ...entry,
      user_email: entry.users?.email,
      target_user_email: entry.target_users?.email,
      target_role_name: entry.roles?.name
    }));

    res.json({ 
      entries,
      totalPages: Math.ceil((count || 0) / parseInt(limit)),
      currentPage: parseInt(page),
      totalEntries: count || 0
    });
  } catch (error) {
    console.error('Error obteniendo auditoría:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener registro de auditoría' 
    });
  }
});

// Gestión de permisos por rol
router.get('/roles/:roleId/permissions', authenticateToken, requirePermission('users', 'manage_roles'), async (req, res) => {
  const { roleId } = req.params;
  
  try {
    const { data, error } = await req.supabase
      .from('role_permissions')
      .select(`
        permissions(*)
      `)
      .eq('role_id', roleId);
      
    if (error) throw error;
    
    res.json({ 
      success: true,
      permissions: data.map(rp => rp.permissions).filter(Boolean)
    });
  } catch (error) {
    console.error('Error obteniendo permisos del rol:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener permisos del rol' 
    });
  }
});

router.put('/roles/:roleId/permissions', authenticateToken, requirePermission('users', 'manage_roles'), async (req, res) => {
  const { roleId } = req.params;
  const { permissions } = req.body;
  
  try {
    // Verificar que no sea un rol del sistema
    const { data: role } = await req.supabase
      .from('roles')
      .select('is_system')
      .eq('id', roleId)
      .single();

    if (role?.is_system) {
      return res.status(403).json({ 
        success: false, 
        message: 'No se pueden modificar permisos de roles del sistema' 
      });
    }

    // Eliminar permisos existentes
    await req.supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);
    
    // Insertar nuevos permisos
    if (permissions && permissions.length > 0) {
      const rolePermissions = permissions.map(permId => ({
        role_id: roleId,
        permission_id: permId
      }));
      
      const { error } = await req.supabase
        .from('role_permissions')
        .insert(rolePermissions);

      if (error) throw error;
    }
    
    // Limpiar cache de permisos para usuarios con este rol
    const { data: affectedUsers } = await req.supabase
      .from('user_roles')
      .select('user_id')
      .eq('role_id', roleId);

    affectedUsers?.forEach(user => {
      clearPermissionsCache(user.user_id);
    });

    // Registrar en auditoría
    await req.supabase
      .from('permission_audit_log')
      .insert({
        user_id: req.user.id,
        action: 'modify',
        target_role_id: roleId,
        new_value: { permissions },
        reason: `Permisos actualizados por ${req.user.email}`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
    
    res.json({ 
      success: true,
      message: 'Permisos actualizados exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando permisos del rol:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al actualizar permisos del rol' 
    });
  }
});

// Agregar endpoint para exportar auditoría
router.get('/audit/export', authenticateToken, requirePermission('system', 'manage_all'), async (req, res) => {
  try {
    const { action, userId, dateFrom, dateTo } = req.query;
    
    let query = req.supabase
      .from('permission_audit_log')
      .select(`
        *,
        users!permission_audit_log_user_id_fkey(email),
        target_users:users!permission_audit_log_target_user_id_fkey(email),
        roles!permission_audit_log_target_role_id_fkey(name)
      `)
      .order('created_at', { ascending: false });

    if (action) query = query.eq('action', action);
    if (userId) query = query.eq('user_id', userId);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data, error } = await query;
    
    if (error) throw error;

    // Convertir a CSV
    const csv = [
      ['Fecha', 'Usuario', 'Acción', 'Usuario Objetivo', 'Rol Objetivo', 'Razón', 'IP'].join(','),
      ...data.map(entry => [
        new Date(entry.created_at).toISOString(),
        entry.users?.email || '',
        entry.action,
        entry.target_users?.email || '',
        entry.roles?.name || '',
        entry.reason || '',
        entry.ip_address || ''
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-log-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exportando auditoría:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al exportar auditoría' 
    });
  }
});

// Debug endpoints (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  router.get('/debug/permissions/:userId', authenticateToken, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Solo admin o el mismo usuario
      if (req.user.id !== userId && !req.user.roles?.some(r => r.name === 'admin')) {
        return res.status(403).json({ 
          success: false, 
          message: 'No autorizado' 
        });
      }

      // Forzar recarga sin caché
      clearPermissionsCache(userId);
      
      // Obtener toda la información
      const permissions = await getUserPermissions(userId);
      const modules = await getUserModules(userId);
      
      // Consulta directa a la DB para comparar
      const { data: dbRoles } = await req.supabase
        .from('user_roles')
        .select(`
          *,
          roles(*)
        `)
        .eq('user_id', userId);

      const { data: dbPerms } = await req.supabase
        .rpc('get_user_permissions', { p_user_id: userId });

      const { data: dbModules } = await req.supabase
        .from('user_modules')
        .select(`
          *,
          module:system_modules!user_modules_module_key_fkey(*)
        `)
        .eq('user_id', userId);

      res.json({
        success: true,
        debug: {
          userId,
          cache: {
            permissions: permissions.permissions,
            permissionsList: permissions.permissionsList,
            roles: permissions.roles
          },
          database: {
            roles: dbRoles,
            permissions: dbPerms,
            modules: dbModules
          },
          modules,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error en debug:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener información de debug',
        error: error.message 
      });
    }
  });

  // Endpoint para forzar limpieza de caché
  router.post('/cache/clear/:userId', authenticateToken, requirePermission('system', 'manage_settings'), (req, res) => {
    const { userId } = req.params;
    clearPermissionsCache(userId);
    
    res.json({ 
      success: true, 
      message: `Caché limpiado para usuario ${userId}` 
    });
  });

  // Ruta para limpiar todo el caché
  router.post('/cache/clear', authenticateToken, requirePermission('system', 'manage_settings'), (req, res) => {
    clearPermissionsCache();
    
    res.json({ 
      success: true, 
      message: 'Caché limpiado completamente' 
    });
  });

  router.get('/debug/my-permissions', authenticateToken, async (req, res) => {
    const perms = await getUserPermissions(req.user.id);
    debugPermissionsCache(req.user.id);
    
    res.json({
      user: req.user.email,
      roles: req.user.roles,
      permissions: perms
    });
  });
}

export default router;