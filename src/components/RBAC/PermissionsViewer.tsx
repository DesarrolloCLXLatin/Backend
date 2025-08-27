import React, { useState, useEffect } from 'react';
import { Shield, Lock, Check, X, Key, FileText, Package, Users, DollarSign, BarChart } from 'lucide-react';
import toast from 'react-hot-toast';

interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
  permissions?: Permission[];
}

interface PermissionsViewerProps {
  selectedRoleId: string | null;
  onRoleChange: (roleId: string) => void;
}

const PermissionsViewer: React.FC<PermissionsViewerProps> = ({ selectedRoleId, onRoleChange }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoles();
    fetchAllPermissions();
  }, []);

  useEffect(() => {
    if (selectedRoleId && roles.length > 0) {
      fetchRoleDetails(selectedRoleId);
    }
  }, [selectedRoleId, roles]);

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/rbac/roles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Error al cargar roles');

      const data = await response.json();
      setRoles(data.roles || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar roles');
    }
  };

  const fetchAllPermissions = async () => {
    try {
      const response = await fetch('/api/rbac/permissions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Error al cargar permisos');

      const data = await response.json();
      setAllPermissions(data.permissions || []);
    } catch (error) {
      console.error('Error:', error);
      // Los permisos podrían no estar disponibles como endpoint separado
      // Construimos una lista basada en los permisos conocidos
      setAllPermissions(getDefaultPermissions());
    } finally {
      setLoading(false);
    }
  };

  const fetchRoleDetails = async (roleId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/rbac/roles/${roleId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Error al cargar detalles del rol');

      const data = await response.json();
      // Asegurarse de que permissions sea un array
      const role = {
        ...data.role,
        permissions: Array.isArray(data.role?.permissions) ? data.role.permissions : []
      };
      setSelectedRole(role);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar detalles del rol');
    } finally {
      setLoading(false);
    }
  };

  // En PermissionsViewer.tsx, actualiza getDefaultPermissions
  const getDefaultPermissions = (): Permission[] => {
    const permissionsList = [
      // Runners
      { resource: 'runners', action: 'create', description: 'Crear corredores' },
      { resource: 'runners', action: 'read', description: 'Ver corredores' },
      { resource: 'runners', action: 'update', description: 'Actualizar corredores' },
      { resource: 'runners', action: 'delete', description: 'Eliminar corredores' },
      { resource: 'runners', action: 'register_group', description: 'Registrar grupo de corredores' },
      { resource: 'runners', action: 'view_own', description: 'Ver propios corredores' },
      
      // Payments
      { resource: 'payments', action: 'read', description: 'Ver pagos' },
      { resource: 'payments', action: 'confirm', description: 'Confirmar pagos' },
      { resource: 'payments', action: 'reject', description: 'Rechazar pagos' },
      { resource: 'payments', action: 'manage', description: 'Gestionar pagos' },
      
      // Tickets
      { resource: 'tickets', action: 'create', description: 'Crear tickets' },
      { resource: 'tickets', action: 'read', description: 'Ver tickets' },
      { resource: 'tickets', action: 'manage', description: 'Gestionar tickets' },
      { resource: 'tickets', action: 'sell', description: 'Vender tickets' },
      
      // Inventory
      { resource: 'inventory', action: 'read', description: 'Ver inventario' },
      { resource: 'inventory', action: 'update', description: 'Actualizar inventario' },
      { resource: 'inventory', action: 'manage', description: 'Gestionar inventario' },
      
      // Dashboard
      { resource: 'dashboard', action: 'view_admin', description: 'Ver dashboard admin' },
      { resource: 'dashboard', action: 'view_boss', description: 'Ver dashboard gerente' },
      { resource: 'dashboard', action: 'view_reports', description: 'Ver reportes' },
      { resource: 'dashboard', action: 'view_store', description: 'Ver dashboard tienda' },
      { resource: 'dashboard', action: 'view_user', description: 'Ver dashboard usuario' },
      
      // System
      { resource: 'system', action: 'manage_all', description: 'Gestionar todo el sistema' },
      
      // Users
      { resource: 'users', action: 'create', description: 'Crear usuarios' },
      { resource: 'users', action: 'read', description: 'Ver usuarios' },
      { resource: 'users', action: 'update', description: 'Actualizar usuarios' },
      { resource: 'users', action: 'manage', description: 'Gestionar usuarios' },
      { resource: 'users', action: 'manage_roles', description: 'Gestionar roles' }
    ];
  
    return permissionsList.map((perm, index) => ({
      id: `${perm.resource}:${perm.action}`,
      ...perm
    }));
  };

  const groupPermissionsByResource = (permissions: Permission[] = []) => {
    const grouped: Record<string, Permission[]> = {};
    
    // Asegurarse de que permissions sea un array
    const permissionsArray = Array.isArray(permissions) ? permissions : [];
    
    permissionsArray.forEach(permission => {
      if (!grouped[permission.resource]) {
        grouped[permission.resource] = [];
      }
      grouped[permission.resource].push(permission);
    });

    return grouped;
  };

  const getResourceIcon = (resource: string) => {
    const icons: Record<string, JSX.Element> = {
      runners: <Users className="w-5 h-5" />,
      payments: <DollarSign className="w-5 h-5" />,
      tickets: <FileText className="w-5 h-5" />,
      inventory: <Package className="w-5 h-5" />,
      dashboard: <BarChart className="w-5 h-5" />,
      system: <Shield className="w-5 h-5" />,
      users: <Key className="w-5 h-5" />
    };
    return icons[resource] || <Shield className="w-5 h-5" />;
  };

  const getResourceName = (resource: string) => {
    const names: Record<string, string> = {
      runners: 'Corredores',
      payments: 'Pagos',
      tickets: 'Tickets',
      inventory: 'Inventario',
      dashboard: 'Dashboard',
      system: 'Sistema',
      users: 'Usuarios'
    };
    return names[resource] || resource;
  };

  const getActionName = (action: string) => {
    const names: Record<string, string> = {
      create: 'Crear',
      read: 'Leer',
      update: 'Actualizar',
      delete: 'Eliminar',
      manage: 'Gestionar',
      confirm: 'Confirmar',
      reject: 'Rechazar',
      sell: 'Vender',
      register_group: 'Registrar Grupo',
      view_own: 'Ver Propios',
      view_admin: 'Ver Admin',
      view_boss: 'Ver Boss',
      view_reports: 'Ver Reportes',
      view_store: 'Ver Tienda',
      view_user: 'Ver Usuario',
      manage_all: 'Gestionar Todo'
    };
    return names[action] || action;
  };

  const roleHasPermission = (permission: Permission): boolean => {
    if (!selectedRole || !Array.isArray(selectedRole.permissions)) return false;
    return selectedRole.permissions.some(
      p => p.resource === permission.resource && p.action === permission.action
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  // Usar los permisos del rol seleccionado si existen, o los permisos por defecto
  const permissionsToShow = selectedRole?.permissions && selectedRole.permissions.length > 0
    ? selectedRole.permissions
    : allPermissions;

  const groupedPermissions = groupPermissionsByResource(permissionsToShow);

  return (
    <div className="space-y-6">
      {/* Role Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Seleccionar Rol
        </label>
        <select
          value={selectedRoleId || ''}
          onChange={(e) => onRoleChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">-- Seleccionar rol --</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name} {role.is_system && '(Sistema)'}
            </option>
          ))}
        </select>
      </div>

      {selectedRole && (
        <>
          {/* Role Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Shield className="w-8 h-8 text-orange-600 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedRole.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedRole.description || 'Sin descripción'}
                  </p>
                </div>
              </div>
              {selectedRole.is_system && (
                <div className="flex items-center text-gray-500">
                  <Lock className="w-4 h-4 mr-1" />
                  <span className="text-sm">Rol del Sistema</span>
                </div>
              )}
            </div>
          </div>

          {/* System Warning */}
          {selectedRole.is_system && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Los permisos de los roles del sistema no pueden ser modificados.
              </p>
            </div>
          )}

          {/* Permissions by Resource */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-900">
              Permisos del Rol ({selectedRole.permissions?.length || 0})
            </h3>
            
            {Object.keys(groupedPermissions).length > 0 ? (
              Object.entries(groupedPermissions).map(([resource, permissions]) => (
                <div key={resource} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    {getResourceIcon(resource)}
                    <h4 className="ml-2 font-medium text-gray-900">
                      {getResourceName(resource)}
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {permissions.map((permission) => (
                      <div
                        key={`${permission.resource}-${permission.action}`}
                        className={`
                          flex items-center px-3 py-2 rounded-md text-sm
                          ${roleHasPermission(permission)
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-500'
                          }
                        `}
                      >
                        {roleHasPermission(permission) ? (
                          <Check className="w-4 h-4 mr-2" />
                        ) : (
                          <X className="w-4 h-4 mr-2" />
                        )}
                        {getActionName(permission.action)}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No hay permisos configurados para este rol</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PermissionsViewer;