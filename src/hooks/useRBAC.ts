// hooks/useRBAC.ts
import { useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useRBAC = () => {
  const { user } = useAuth();

  const permissions = useMemo(() => {
    if (!user?.permissions) return [];
    return user.permissions;
  }, [user]);

  const roles = useMemo(() => {
    if (!user?.roles) return [];
    return user.roles.map(r => r.name);
  }, [user]);

  const hasPermission = useCallback((resource: string, action: string) => {
    // Check direct permission
    if (permissions.includes(`${resource}:${action}`)) return true;
    
    // Check manage permission
    if (permissions.includes(`${resource}:manage`)) return true;
    
    // Check wildcard
    if (permissions.includes(`${resource}:*`)) return true;
    
    // Check system admin
    if (permissions.includes('system:manage_all')) return true;
    
    return false;
  }, [permissions]);

  const hasRole = useCallback((roleName: string) => {
    return roles.includes(roleName);
  }, [roles]);

  const hasAnyRole = useCallback((...roleNames: string[]) => {
    return roleNames.some(role => roles.includes(role));
  }, [roles]);

  const hasAllRoles = useCallback((...roleNames: string[]) => {
    return roleNames.every(role => roles.includes(role));
  }, [roles]);

  const hasAnyPermission = useCallback((...perms: Array<[string, string]>) => {
    return perms.some(([resource, action]) => hasPermission(resource, action));
  }, [hasPermission]);

  const hasAllPermissions = useCallback((...perms: Array<[string, string]>) => {
    return perms.every(([resource, action]) => hasPermission(resource, action));
  }, [hasPermission]);

  const canAccessRoute = useCallback((path: string) => {
    // Define route permissions mapping
    const routePermissions: Record<string, [string, string][]> = {
      '/rbac': [['system', 'manage_all'], ['users', 'manage']],
      '/users': [['users', 'read']],
      '/tickets': [['tickets', 'read']],
      '/runners': [['runners', 'read']],
      '/payments': [['payments', 'read']],
      '/reports': [['dashboard', 'view_reports']]
    };

    const requiredPerms = routePermissions[path];
    if (!requiredPerms) return true; // No permissions required
    
    return hasAnyPermission(...requiredPerms);
  }, [hasAnyPermission]);

  return {
    permissions,
    roles,
    hasPermission,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    hasAnyPermission,
    hasAllPermissions,
    canAccessRoute,
    isAdmin: hasRole('admin') || hasPermission('system', 'manage_all'),
    isAuthenticated: !!user
  };
};