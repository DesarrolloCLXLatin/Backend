// server/models/User.js
import { BaseModel } from './BaseModel.js';
import bcrypt from 'bcryptjs';

export class UserModel extends BaseModel {
  constructor(supabase) {
    super(supabase, 'users');
  }

  /**
   * Buscar usuario por email
   */
  async findByEmail(email) {
    return this.findOne({ email: email.toLowerCase() });
  }

  /**
   * Crear usuario con hash de contraseña
   */
  async createUser(userData) {
    try {
      // Validar campos requeridos
      this.validateRequired(userData, ['email', 'password', 'full_name']);

      // Hash de la contraseña
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(userData.password, saltRounds);

      // Preparar datos del usuario
      const userToCreate = {
        email: userData.email.toLowerCase(),
        password_hash: passwordHash,
        full_name: userData.full_name,
        role: userData.role || 'usuario',
        created_at: new Date().toISOString()
      };

      return this.create(userToCreate);
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Verificar contraseña
   */
  async verifyPassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }

  /**
   * Actualizar contraseña
   */
  async updatePassword(userId, newPassword) {
    try {
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      return this.updateById(userId, { password_hash: passwordHash });
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  }

  /**
   * Obtener usuario con roles y permisos
   */
  async findWithRolesAndPermissions(userId) {
    try {
      const { data, error } = await this.supabase
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
              is_system
            )
          )
        `)
        .eq('id', userId)
        .single();

      if (error) {
        throw this.handleSupabaseError(error);
      }

      return data;
    } catch (error) {
      console.error('Error finding user with roles:', error);
      throw error;
    }
  }

  /**
   * Obtener permisos del usuario
   */
  async getUserPermissions(userId) {
    try {
      // Intentar usar RPC primero
      const { data: rpcData, error: rpcError } = await this.supabase
        .rpc('get_user_permissions', { p_user_id: userId });

      if (!rpcError && rpcData) {
        return this.formatPermissions(rpcData);
      }

      // Fallback a query directa
      const { data: userRoles } = await this.supabase
        .from('user_roles')
        .select(`
          role_id,
          roles!inner(name)
        `)
        .eq('user_id', userId);

      if (!userRoles || userRoles.length === 0) {
        return { permissions: {}, permissionsList: [] };
      }

      const roleIds = userRoles.map(ur => ur.role_id);

      const { data: rolePermissions } = await this.supabase
        .from('role_permissions')
        .select(`
          permissions!inner(resource, action)
        `)
        .in('role_id', roleIds);

      return this.formatPermissions(rolePermissions?.map(rp => rp.permissions) || []);
    } catch (error) {
      console.error('Error getting user permissions:', error);
      throw error;
    }
  }

  /**
   * Formatear permisos en estructura útil
   */
  formatPermissions(permissionsData) {
    const permissions = {};
    const permissionsList = [];

    permissionsData.forEach(perm => {
      if (!permissions[perm.resource]) {
        permissions[perm.resource] = [];
      }
      permissions[perm.resource].push(perm.action);
      permissionsList.push(`${perm.resource}:${perm.action}`);
    });

    return { permissions, permissionsList };
  }

  /**
   * Obtener módulos del usuario
   */
  async getUserModules(userId) {
    try {
      const { data, error } = await this.supabase
        .from('user_modules')
        .select(`
          *,
          system_modules!inner(*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        throw this.handleSupabaseError(error);
      }

      return data?.map(um => ({
        ...um.system_modules,
        granted_at: um.granted_at,
        granted_by: um.granted_by
      })) || [];
    } catch (error) {
      console.error('Error getting user modules:', error);
      throw error;
    }
  }

  /**
   * Asignar rol a usuario
   */
  async assignRole(userId, roleId, assignedBy = null) {
    try {
      const { data, error } = await this.supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: roleId,
          assigned_by: assignedBy,
          assigned_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw this.handleSupabaseError(error);
      }

      return data;
    } catch (error) {
      console.error('Error assigning role:', error);
      throw error;
    }
  }

  /**
   * Remover rol de usuario
   */
  async removeRole(userId, roleId) {
    try {
      const { data, error } = await this.supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', roleId)
        .select()
        .single();

      if (error) {
        throw this.handleSupabaseError(error);
      }

      return data;
    } catch (error) {
      console.error('Error removing role:', error);
      throw error;
    }
  }

  /**
   * Buscar usuarios con filtros avanzados
   */
  async searchUsers(searchTerm, filters = {}, options = {}) {
    try {
      let query = this.supabase
        .from('users')
        .select(`
          *,
          user_roles!user_roles_user_id_fkey (
            roles (name, display_name)
          )
        `, { count: 'exact' });

      // Búsqueda por texto
      if (searchTerm) {
        query = query.or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`);
      }

      // Filtros adicionales
      if (filters.role) {
        query = query.eq('role', filters.role);
      }

      if (filters.created_after) {
        query = query.gte('created_at', filters.created_after);
      }

      // Ordenamiento
      query = query.order(options.orderBy || 'created_at', { 
        ascending: options.ascending || false 
      });

      // Paginación
      if (options.limit && options.offset !== undefined) {
        query = query.range(options.offset, options.offset + options.limit - 1);
      }

      const { data, count, error } = await query;

      if (error) {
        throw this.handleSupabaseError(error);
      }

      return { data: data || [], count };
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  /**
   * Actualizar último login
   */
  async updateLastLogin(userId) {
    try {
      return this.updateById(userId, { 
        last_login: new Date().toISOString() 
      });
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  }

  /**
   * Verificar si el usuario es admin
   */
  async isAdmin(userId) {
    try {
      const user = await this.findById(userId);
      if (!user) return false;

      // Verificar rol legacy
      if (user.role === 'admin') return true;

      // Verificar roles RBAC
      const { data: adminRole } = await this.supabase
        .from('user_roles')
        .select('roles!inner(name)')
        .eq('user_id', userId)
        .eq('roles.name', 'admin')
        .single();

      return !!adminRole;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }
}

export default UserModel;