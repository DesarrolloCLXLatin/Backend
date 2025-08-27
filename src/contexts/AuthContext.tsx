import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthContextType } from '../types';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (storedToken && storedUser) {
          // Validar que el storedUser sea un JSON válido
          try {
            const parsedUser = JSON.parse(storedUser);
            
            // Verificar que el objeto parseado tenga las propiedades mínimas esperadas
            if (parsedUser && parsedUser.id && parsedUser.email) {
              setToken(storedToken);
              setUser(parsedUser);
              
              // Log para debug
              console.log('Usuario cargado del localStorage:', {
                id: parsedUser.id,
                email: parsedUser.email,
                role: parsedUser.role,
                roles: parsedUser.roles,
                permissions: parsedUser.permissions,
                modules: parsedUser.modules
              });
              
              // Verificar que el token siga siendo válido
              await verifyToken(storedToken);
            } else {
              // Si el usuario no es válido, limpiar localStorage
              console.error('Usuario almacenado no es válido');
              localStorage.removeItem('token');
              localStorage.removeItem('user');
            }
          } catch (parseError) {
            // Si falla el parse, limpiar localStorage
            console.error('Error parseando usuario del localStorage:', parseError);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      } catch (error) {
        console.error('Error inicializando autenticación:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Agrega este log en el AuthContext en la función verifyToken

  const verifyToken = async (token: string) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    
      if (!response.ok) {
        logout();
        return;
      }
    
      const data = await response.json();
      if (data.user) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // 🔍 LOGS DE DEBUG DETALLADOS - SIN MODIFICAR EL OBJETO ORIGINAL
        console.log('✅ Usuario actualizado desde el servidor:', data.user);
        console.log('📊 Análisis de permisos:', {
          tipo: typeof data.user.permissions,
          esArray: Array.isArray(data.user.permissions),
          cantidad: data.user.permissions?.length || 0,
          primeros5: data.user.permissions?.slice(0, 5),
          tieneRunnersRead: data.user.permissions?.includes('runners:read'),
          tieneSystemManageAll: data.user.permissions?.includes('system:manage_all')
        });
        console.log('📦 Análisis de módulos:', {
          cantidad: data.user.modules?.length || 0,
          moduleKeys: data.user.modules?.map(m => m.module_key || m.key).slice(0, 5)
        });
      }
    } catch (error) {
      console.error('Error verificando token:', error);
      logout();
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al iniciar sesión');
      }

      const data = await response.json();
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Log para debug
      console.log('Usuario logueado:', {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        roles: data.user.roles,
        permissions: data.user.permissions,
        modules: data.user.modules
      });
      
      toast.success('Sesión iniciada correctamente');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al iniciar sesión');
      throw error;
    }
  };

  const register = async (email: string, password: string, role: string, full_name?: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, role, full_name }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al registrarse');
      }

      const data = await response.json();
      toast.success('Usuario registrado correctamente');
      return data;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al registrarse');
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Sesión cerrada');
  };

  // Función helper para verificar permisos
  const hasPermission = useCallback((resource: string, action: string): boolean => {
    if (!user) {
      console.log('hasPermission: No hay usuario');
      return false;
    }
    
    if (!user.permissions || !Array.isArray(user.permissions)) {
      console.log('hasPermission: Usuario sin permisos definidos');
      return false;
    }
    
    // Admin siempre tiene todos los permisos
    if (user.permissions.includes('system:manage_all')) {
      console.log(`hasPermission: Usuario es admin, acceso concedido a ${resource}:${action}`);
      return true;
    }
    
    // Verificar permiso específico
    const permission = `${resource}:${action}`;
    const hasIt = user.permissions.includes(permission);
    
    console.log(`hasPermission: Verificando ${permission}`, {
      userPermissions: user.permissions,
      hasPermission: hasIt
    });
    
    return hasIt;
  }, [user]);

  // Función helper para verificar múltiples permisos (OR)
  const hasAnyPermission = useCallback((...permissions: Array<{resource: string, action: string}>): boolean => {
    if (!user) {
      console.log('hasAnyPermission: No hay usuario');
      return false;
    }
    
    if (!user.permissions || !Array.isArray(user.permissions)) {
      console.log('hasAnyPermission: Usuario sin permisos definidos');
      return false;
    }
    
    // Admin siempre tiene todos los permisos
    if (user.permissions.includes('system:manage_all')) {
      console.log('hasAnyPermission: Usuario es admin, acceso concedido');
      return true;
    }
    
    // Verificar si tiene alguno de los permisos
    const requiredPermissions = permissions.map(({resource, action}) => `${resource}:${action}`);
    const hasAny = permissions.some(({resource, action}) => {
      const permission = `${resource}:${action}`;
      return user.permissions.includes(permission);
    });
    
    console.log('hasAnyPermission: Verificando permisos', {
      requiredPermissions,
      userPermissions: user.permissions,
      hasAnyPermission: hasAny
    });
    
    return hasAny;
  }, [user]);

  // Función helper para verificar múltiples permisos (AND)
  const hasAllPermissions = useCallback((...permissions: Array<{resource: string, action: string}>): boolean => {
    if (!user) {
      console.log('hasAllPermissions: No hay usuario');
      return false;
    }
    
    if (!user.permissions || !Array.isArray(user.permissions)) {
      console.log('hasAllPermissions: Usuario sin permisos definidos');
      return false;
    }
    
    // Admin siempre tiene todos los permisos
    if (user.permissions.includes('system:manage_all')) {
      console.log('hasAllPermissions: Usuario es admin, acceso concedido');
      return true;
    }
    
    // Verificar si tiene todos los permisos
    const requiredPermissions = permissions.map(({resource, action}) => `${resource}:${action}`);
    const hasAll = permissions.every(({resource, action}) => {
      const permission = `${resource}:${action}`;
      return user.permissions.includes(permission);
    });
    
    console.log('hasAllPermissions: Verificando permisos', {
      requiredPermissions,
      userPermissions: user.permissions,
      hasAllPermissions: hasAll
    });
    
    return hasAll;
  }, [user]);

  // Función helper para verificar si puede acceder a un módulo
  const canAccessModule = useCallback((moduleKey: string): boolean => {
    if (!user) {
      console.log('canAccessModule: No hay usuario');
      return false;
    }
    
    // Admin siempre puede acceder a todos los módulos
    if (user.permissions?.includes('system:manage_all')) {
      console.log(`canAccessModule: Usuario es admin, acceso concedido a módulo ${moduleKey}`);
      return true;
    }
    
    if (!user.modules || !Array.isArray(user.modules)) {
      console.log(`canAccessModule: Usuario sin módulos definidos para ${moduleKey}`);
      return false;
    }
    
    // Verificar acceso al módulo - soporte para diferentes estructuras de datos
    const hasAccess = user.modules.some(module => {
      // Estructura nueva: {module_key: string, is_active: boolean, module?: {key: string}}
      if (module.module_key) {
        return module.module_key === moduleKey && module.is_active;
      }
      // Estructura alternativa: {key: string, is_active: boolean}
      if (module.key) {
        return module.key === moduleKey && module.is_active;
      }
      // Estructura del objeto módulo anidado
      if (module.module && module.module.key) {
        return module.module.key === moduleKey && module.is_active;
      }
      return false;
    });
    
    console.log(`canAccessModule: Verificando módulo ${moduleKey}`, {
      userModules: user.modules,
      hasAccess
    });
    
    return hasAccess;
  }, [user]);

  // Función helper para obtener los roles del usuario
  const getUserRoles = useCallback((): string[] => {
    if (!user?.roles) {
      // Fallback para compatibilidad con el campo role legacy
      if (user?.role) {
        return [user.role];
      }
      return [];
    }
    return user.roles.map(role => role.name);
  }, [user]);

  // Función para actualizar permisos del usuario (después de cambios de rol)
  const refreshUserPermissions = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
          
          console.log('Permisos y módulos actualizados:', {
            permissions: data.user.permissions,
            modules: data.user.modules,
            roles: data.user.roles
          });
          
          toast.success('Permisos actualizados');
        }
      }
    } catch (error) {
      console.error('Error actualizando permisos:', error);
    }
  }, [token]);

  // Función para obtener lista de módulos del usuario
  const getUserModules = useCallback((): string[] => {
    if (!user?.modules || !Array.isArray(user.modules)) {
      return [];
    }
    
    return user.modules
      .filter(module => module.is_active)
      .map(module => {
        // Soportar diferentes estructuras
        if (module.module_key) return module.module_key;
        if (module.key) return module.key;
        if (module.module?.key) return module.module.key;
        return null;
      })
      .filter(Boolean) as string[];
  }, [user]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      register, 
      logout, 
      loading,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      canAccessModule,
      getUserRoles,
      getUserModules,
      refreshUserPermissions
    }}>
      {children}
    </AuthContext.Provider>
  );
};