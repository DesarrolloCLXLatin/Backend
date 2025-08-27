// server/controllers/AuthController.js
import { BaseController } from './BaseController.js';
import { UserModel } from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

export class AuthController extends BaseController {
  constructor() {
    super();
  }

  /**
   * Registro de usuario
   */
  register = this.handleAsync(async (req, res) => {
    try {
      const { email, password, full_name, role = 'usuario' } = req.body;

      // Validar campos requeridos
      this.validateRequired(req.body, ['email', 'password', 'full_name']);

      if (password.length < 6) {
        return this.validationError(res, 
          { password: 'La contraseña debe tener al menos 6 caracteres' }
        );
      }

      const userModel = new UserModel(req.supabase);

      // Verificar si el usuario ya existe
      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        return this.error(res, 'Ya existe un usuario con este correo', 409);
      }

      // Verificar que el rol existe
      const { data: roleData, error: roleError } = await req.supabase
        .from('roles')
        .select('id')
        .eq('name', role)
        .single();

      if (roleError || !roleData) {
        return this.validationError(res, { role: 'Rol inválido' });
      }

      // Crear usuario
      const newUser = await userModel.createUser({
        email,
        password,
        full_name,
        role: role === 'admin' ? 'admin' : role === 'tienda' ? 'tienda' : 'usuario'
      });

      // Asignar rol en el sistema RBAC
      await userModel.assignRole(newUser.id, roleData.id, req.user?.id);

      // Obtener permisos del usuario
      const permissions = await userModel.getUserPermissions(newUser.id);

      // Generar token
      const token = generateToken(newUser, permissions.permissionsList);

      // Respuesta exitosa
      this.success(res, {
        user: {
          id: newUser.id,
          email: newUser.email,
          full_name: newUser.full_name,
          role: role,
          permissions: permissions.permissionsList,
          created_at: newUser.created_at
        },
        token
      }, 'Usuario creado exitosamente', 201);

    } catch (error) {
      console.error('Registration error:', error);
      this.error(res, error.message);
    }
  });

  /**
   * Inicio de sesión
   */
  login = this.handleAsync(async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validar campos requeridos
      this.validateRequired(req.body, ['email', 'password']);

      const userModel = new UserModel(req.supabase);

      // Buscar usuario
      const user = await userModel.findByEmail(email);
      if (!user) {
        return this.unauthorized(res, 'Credenciales inválidas');
      }

      // Verificar contraseña
      const isValidPassword = await userModel.verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        return this.unauthorized(res, 'Credenciales inválidas');
      }

      // Obtener permisos y módulos
      const [permissions, modules] = await Promise.all([
        userModel.getUserPermissions(user.id),
        userModel.getUserModules(user.id)
      ]);

      // Obtener roles detallados
      const userWithRoles = await userModel.findWithRolesAndPermissions(user.id);
      const roles = userWithRoles.user_roles?.map(ur => ur.roles).filter(Boolean) || [];

      // Generar token
      const token = generateToken(user);

      // Actualizar último login
      await userModel.updateLastLogin(user.id);

      // Construir respuesta
      const userData = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        roles,
        permissions: permissions.permissionsList,
        modules,
        created_at: user.created_at,
        updated_at: user.updated_at
      };

      this.success(res, {
        user: userData,
        token
      }, 'Inicio de sesión exitoso');

    } catch (error) {
      console.error('Login error:', error);
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Obtener perfil del usuario actual
   */
  getProfile = this.handleAsync(async (req, res) => {
    try {
      const userModel = new UserModel(req.supabase);
      
      const user = await userModel.findById(req.user.id, {
        select: 'id, email, full_name, role, created_at, updated_at'
      });

      if (!user) {
        return this.notFound(res, 'Usuario');
      }

      this.success(res, {
        ...user,
        permissions: req.user.permissions,
        modules: req.user.modules,
        roles: req.user.roleDetails
      });

    } catch (error) {
      console.error('Profile error:', error);
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Obtener información completa del usuario actual
   */
  getMe = this.handleAsync(async (req, res) => {
    try {
      const userModel = new UserModel(req.supabase);
      
      // Obtener usuario con roles completos
      const userWithRoles = await userModel.findWithRolesAndPermissions(req.user.id);
      
      if (!userWithRoles) {
        return this.notFound(res, 'Usuario');
      }

      // Obtener permisos y módulos
      const [permissions, modules] = await Promise.all([
        userModel.getUserPermissions(req.user.id),
        userModel.getUserModules(req.user.id)
      ]);

      // Formatear roles
      const roles = userWithRoles.user_roles?.map(ur => ({
        id: ur.roles.id,
        name: ur.roles.name,
        display_name: ur.roles.display_name,
        description: ur.roles.description,
        is_system: ur.roles.is_system
      })) || [];

      // Determinar capacidades
      const isAdmin = userWithRoles.role === 'admin' || 
                      roles.some(r => r.name === 'admin') ||
                      permissions.permissionsList.includes('system:manage_all');

      const canGenerateIframeTokens = permissions.permissionsList.some(p => 
        ['iframe_tokens:create', 'tickets:manage', 'tickets:sell', 'system:manage_all'].includes(p)
      ) || ['admin', 'tienda'].includes(userWithRoles.role);

      // Construir respuesta
      const userData = {
        id: userWithRoles.id,
        email: userWithRoles.email,
        full_name: userWithRoles.full_name,
        role: userWithRoles.role,
        roles,
        permissions: permissions.permissionsList,
        modules,
        modules_count: modules.length,
        canGenerateIframeTokens,
        isAdmin,
        created_at: userWithRoles.created_at,
        updated_at: userWithRoles.updated_at
      };

      this.success(res, { user: userData });

    } catch (error) {
      console.error('Error fetching user profile:', error);
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Verificar token
   */
  verifyToken = this.handleAsync(async (req, res) => {
    this.success(res, {
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

  /**
   * Listar usuarios (admin)
   */
  listUsers = this.handleAsync(async (req, res) => {
    try {
      const { page, limit, offset } = this.getPaginationParams(req);
      const { search } = req.query;

      const userModel = new UserModel(req.supabase);

      const { data: users, count } = await userModel.searchUsers(search, {}, {
        limit,
        offset,
        orderBy: 'created_at',
        ascending: false
      });

      // Obtener conteo de módulos para cada usuario
      const userIds = users.map(user => user.id);
      const { data: modulesCounts } = await req.supabase
        .from('user_modules')
        .select('user_id')
        .in('user_id', userIds)
        .eq('is_active', true);

      const modulesCountMap = {};
      modulesCounts?.forEach(um => {
        modulesCountMap[um.user_id] = (modulesCountMap[um.user_id] || 0) + 1;
      });

      // Formatear respuesta
      const transformedUsers = users.map(user => ({
        ...user,
        roles: user.user_roles?.map(ur => ur.roles).filter(Boolean) || [],
        modules_count: modulesCountMap[user.id] || 0,
        user_roles: undefined
      }));

      this.paginatedResponse(res, transformedUsers, count, page, limit);

    } catch (error) {
      console.error('Error listing users:', error);
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Obtener detalles de un usuario específico
   */
  getUserDetails = this.handleAsync(async (req, res) => {
    try {
      const { userId } = req.params;

      const userModel = new UserModel(req.supabase);
      const userWithRoles = await userModel.findWithRolesAndPermissions(userId);

      if (!userWithRoles) {
        return this.notFound(res, 'Usuario');
      }

      // Obtener módulos del usuario
      const modules = await userModel.getUserModules(userId);

      // Formatear respuesta
      const formattedUser = {
        ...userWithRoles,
        roles: userWithRoles.user_roles?.map(ur => ur.roles).filter(Boolean) || [],
        modules,
        modules_count: modules.length,
        user_roles: undefined
      };

      this.success(res, { user: formattedUser });

    } catch (error) {
      console.error('Error getting user details:', error);
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Actualizar usuario
   */
  updateUser = this.handleAsync(async (req, res) => {
    try {
      const { userId } = req.params;
      const { email, full_name, password } = req.body;

      // No permitir auto-edición sin permisos de admin
      if (req.user.id === userId && !req.user.permissions?.includes('system:manage_all')) {
        return this.forbidden(res, 'No puedes editar tu propio perfil desde aquí');
      }

      const userModel = new UserModel(req.supabase);

      // Verificar que el usuario existe
      const existingUser = await userModel.findById(userId);
      if (!existingUser) {
        return this.notFound(res, 'Usuario');
      }

      // Preparar datos de actualización
      const updateData = {};
      if (email !== undefined) updateData.email = email;
      if (full_name !== undefined) updateData.full_name = full_name;

      // Actualizar datos básicos
      if (Object.keys(updateData).length > 0) {
        await userModel.updateById(userId, updateData);
      }

      // Actualizar contraseña si se proporciona
      if (password) {
        await userModel.updatePassword(userId, password);
      }

      this.success(res, null, 'Usuario actualizado correctamente');

    } catch (error) {
      console.error('Error updating user:', error);
      this.error(res, 'Error interno del servidor');
    }
  });

  /**
   * Eliminar usuario
   */
  deleteUser = this.handleAsync(async (req, res) => {
    try {
      const { userId } = req.params;

      // No permitir auto-eliminación
      if (req.user.id === userId) {
        return this.forbidden(res, 'No puedes eliminar tu propia cuenta');
      }

      const userModel = new UserModel(req.supabase);

      // Verificar que el usuario existe
      const existingUser = await userModel.findWithRolesAndPermissions(userId);
      if (!existingUser) {
        return this.notFound(res, 'Usuario');
      }

      // No permitir eliminar el último admin
      const isAdmin = existingUser.user_roles?.some(ur => ur.roles?.name === 'admin');
      
      if (isAdmin) {
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
            return this.forbidden(res, 'No se puede eliminar el último administrador del sistema');
          }
        }
      }

      // Eliminar usuario (CASCADE eliminará relaciones)
      await userModel.deleteById(userId);

      this.success(res, null, 'Usuario eliminado correctamente');

    } catch (error) {
      console.error('Error deleting user:', error);
      this.error(res, 'Error interno del servidor');
    }
  });
}

export default AuthController;