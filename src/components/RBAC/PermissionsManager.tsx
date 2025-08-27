import React, { useState, useEffect } from 'react';
import { Shield, Check, X, Save, AlertCircle, Plus, Trash2, Lock, Info } from 'lucide-react';
import toast from 'react-hot-toast';

interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string;
  is_system?: boolean;
}

interface PermissionsManagerProps {
  roleId: string;
  roleName: string;
  isSystemRole: boolean;
}

const PermissionsManager: React.FC<PermissionsManagerProps> = ({ 
  roleId, 
  roleName, 
  isSystemRole 
}) => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [changes, setChanges] = useState<{added: string[], removed: string[]}>({
    added: [],
    removed: []
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreatePermission, setShowCreatePermission] = useState(false);
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPermissions();
    fetchRolePermissions();
  }, [roleId]);

  const fetchPermissions = async () => {
    try {
      const response = await fetch('/api/rbac/permissions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Convertir el objeto agrupado en array plano
      let permissionsArray: Permission[] = [];
      
      if (data.permissions && typeof data.permissions === 'object') {
        for (const [resource, actions] of Object.entries(data.permissions)) {
          if (Array.isArray(actions)) {
            actions.forEach((perm: any) => {
              permissionsArray.push({
                id: perm.id,
                resource: perm.resource,
                action: perm.action,
                description: perm.description || '',
                is_system: perm.is_system
              });
            });
          }
        }
      }
      
      setPermissions(permissionsArray);
    } catch (error) {
      console.error('Error al cargar permisos:', error);
      toast.error('Error al cargar permisos');
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRolePermissions = async () => {
    try {
      const response = await fetch(`/api/rbac/roles/${roleId}/permissions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const rolePermissionIds = (data.permissions || []).map((p: any) => p.id);
      
      setRolePermissions(rolePermissionIds);
    } catch (error) {
      console.error('Error al cargar permisos del rol:', error);
      toast.error('Error al cargar permisos del rol');
      setRolePermissions([]);
    }
  };

  const togglePermission = (permissionId: string) => {
    if (isSystemRole) return;

    const isCurrentlySelected = rolePermissions.includes(permissionId);
    const newChanges = { ...changes };

    if (isCurrentlySelected) {
      setRolePermissions(prev => prev.filter(id => id !== permissionId));
      if (changes.added.includes(permissionId)) {
        newChanges.added = changes.added.filter(id => id !== permissionId);
      } else {
        newChanges.removed = [...changes.removed, permissionId];
      }
    } else {
      setRolePermissions(prev => [...prev, permissionId]);
      if (changes.removed.includes(permissionId)) {
        newChanges.removed = changes.removed.filter(id => id !== permissionId);
      } else {
        newChanges.added = [...changes.added, permissionId];
      }
    }

    setChanges(newChanges);
  };

  const toggleResourceExpansion = (resource: string) => {
    const newExpanded = new Set(expandedResources);
    if (newExpanded.has(resource)) {
      newExpanded.delete(resource);
    } else {
      newExpanded.add(resource);
    }
    setExpandedResources(newExpanded);
  };

  const toggleAllInResource = (resource: string, perms: Permission[]) => {
    if (isSystemRole) return;

    const resourcePermIds = perms.map(p => p.id);
    const allSelected = resourcePermIds.every(id => rolePermissions.includes(id));

    if (allSelected) {
      // Deseleccionar todos
      setRolePermissions(prev => prev.filter(id => !resourcePermIds.includes(id)));
    } else {
      // Seleccionar todos
      const newPermissions = [...new Set([...rolePermissions, ...resourcePermIds])];
      setRolePermissions(newPermissions);
    }

    // Actualizar cambios
    const newChanges = { ...changes };
    resourcePermIds.forEach(id => {
      if (allSelected) {
        if (newChanges.added.includes(id)) {
          newChanges.added = newChanges.added.filter(pid => pid !== id);
        } else {
          newChanges.removed.push(id);
        }
      } else {
        if (newChanges.removed.includes(id)) {
          newChanges.removed = newChanges.removed.filter(pid => pid !== id);
        } else {
          newChanges.added.push(id);
        }
      }
    });

    setChanges(newChanges);
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/rbac/roles/${roleId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ permissions: rolePermissions })
      });

      if (!response.ok) throw new Error('Error al guardar permisos');

      toast.success('Permisos actualizados correctamente');
      setChanges({ added: [], removed: [] });
    } catch (error) {
      toast.error('Error al guardar los permisos');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = changes.added.length > 0 || changes.removed.length > 0;

  // Agrupar permisos por recurso
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) acc[perm.resource] = [];
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const getResourceDisplayName = (resource: string) => {
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

  const getActionDisplayName = (action: string) => {
    const names: Record<string, string> = {
      create: 'Crear',
      read: 'Ver',
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
      manage_all: 'Gestionar Todo',
      manage_roles: 'Gestionar Roles',
      manage_settings: 'Gestionar Config.'
    };
    return names[action] || action;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Gestionar Permisos - {roleName}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {rolePermissions.length} permisos asignados
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {hasChanges && (
            <button
              onClick={saveChanges}
              disabled={saving || isSystemRole}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          )}
        </div>
      </div>

      {/* System Role Warning */}
      {isSystemRole && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <Lock className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" />
            <p className="text-sm text-yellow-800">
              Este es un rol del sistema y sus permisos no pueden ser modificados.
            </p>
          </div>
        </div>
      )}

      {/* Changes Summary */}
      {hasChanges && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Cambios pendientes:
          </h4>
          <div className="space-y-1 text-sm">
            {changes.added.length > 0 && (
              <p className="text-green-700">
                <span className="inline-flex items-center">
                  <Plus className="w-3 h-3 mr-1" />
                  {changes.added.length} permisos agregados
                </span>
              </p>
            )}
            {changes.removed.length > 0 && (
              <p className="text-red-700">
                <span className="inline-flex items-center">
                  <Trash2 className="w-3 h-3 mr-1" />
                  {changes.removed.length} permisos removidos
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Haz clic en un recurso para expandir/contraer sus permisos
          </p>
          <button
            onClick={() => {
              const allResources = Object.keys(groupedPermissions);
              if (expandedResources.size === allResources.length) {
                setExpandedResources(new Set());
              } else {
                setExpandedResources(new Set(allResources));
              }
            }}
            className="text-sm text-orange-600 hover:text-orange-700"
          >
            {expandedResources.size === Object.keys(groupedPermissions).length 
              ? 'Contraer todo' 
              : 'Expandir todo'}
          </button>
        </div>
      </div>

      {/* Permissions Grid */}
      <div className="space-y-3">
        {Object.entries(groupedPermissions).map(([resource, perms]) => {
          const allSelected = perms.every(p => rolePermissions.includes(p.id));
          const someSelected = perms.some(p => rolePermissions.includes(p.id));
          const isExpanded = expandedResources.has(resource);

          return (
            <div key={resource} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div
                className="px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleResourceExpansion(resource)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="mr-3">
                      {isExpanded ? (
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                    <h4 className="font-medium text-gray-900 capitalize">
                      {getResourceDisplayName(resource)}
                    </h4>
                    <span className="ml-3 text-sm text-gray-500">
                      ({perms.filter(p => rolePermissions.includes(p.id)).length}/{perms.length} permisos)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!isSystemRole && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllInResource(resource, perms);
                        }}
                        className={`
                          px-3 py-1 text-xs font-medium rounded-md transition-colors
                          ${allSelected
                            ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }
                        `}
                      >
                        {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      </button>
                    )}
                    <div className={`
                      w-5 h-5 rounded border-2 flex items-center justify-center
                      ${allSelected
                        ? 'bg-orange-600 border-orange-600'
                        : someSelected
                        ? 'bg-orange-300 border-orange-300'
                        : 'bg-white border-gray-300'
                      }
                    `}>
                      {allSelected && <Check className="w-3 h-3 text-white" />}
                      {someSelected && !allSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                    </div>
                  </div>
                </div>
              </div>
              
              {isExpanded && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {perms.map((permission) => (
                    <label
                      key={permission.id}
                      className={`
                        flex items-start p-3 rounded-lg border cursor-pointer transition-all
                        ${rolePermissions.includes(permission.id)
                          ? 'bg-orange-50 border-orange-300 shadow-sm'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                        }
                        ${isSystemRole ? 'cursor-not-allowed opacity-60' : ''}
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={rolePermissions.includes(permission.id)}
                        onChange={() => togglePermission(permission.id)}
                        disabled={isSystemRole}
                        className="sr-only"
                      />
                      <div className="flex items-start w-full">
                        <div className={`
                          w-5 h-5 rounded border-2 mr-3 flex-shrink-0 mt-0.5 flex items-center justify-center
                          ${rolePermissions.includes(permission.id)
                            ? 'bg-orange-600 border-orange-600'
                            : 'bg-white border-gray-300'
                          }
                        `}>
                          {rolePermissions.includes(permission.id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-gray-900">
                              {getActionDisplayName(permission.action)}
                            </p>
                            {permission.is_system && (
                              <Lock className="w-3 h-3 text-gray-400 ml-1" title="Permiso del sistema" />
                            )}
                          </div>
                          {permission.description && (
                            <p className="text-xs text-gray-500 mt-1">
                              {permission.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {permissions.length === 0 && (
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No se encontraron permisos disponibles</p>
        </div>
      )}
    </div>
  );
};

export default PermissionsManager;