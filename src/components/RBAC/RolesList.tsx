import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit, Trash2, Lock, RefreshCw, AlertCircle, Settings, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface Role {
  id: string;
  name: string;
  description: string;
  display_name?: string;
  is_system: boolean;
  permissions_count?: number;
  users_count?: number;
}

interface RolesListProps {
  onSelectRole: (roleId: string) => void;
}

const RolesList: React.FC<RolesListProps> = ({ onSelectRole }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rbac/roles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar roles');
      }

      const data = await response.json();
      setRoles(data.roles || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar los roles');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('¿Estás seguro de eliminar este rol? Esta acción no se puede deshacer.')) return;

    try {
      const response = await fetch(`/api/rbac/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar rol');
      }

      toast.success('Rol eliminado correctamente');
      fetchRoles();
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar el rol');
    }
  };

  const getRoleIcon = (roleName: string) => {
    const iconColors: Record<string, string> = {
      'admin': 'text-red-600',
      'boss': 'text-purple-600',
      'administracion': 'text-blue-600',
      'tienda': 'text-green-600',
      'usuario': 'text-gray-600'
    };
    
    return <Shield className={`w-5 h-5 ${iconColors[roleName] || 'text-gray-600'}`} />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Roles del Sistema ({roles.length})
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchRoles}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Recargar"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear Rol
          </button>
        </div>
      </div>

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Información sobre roles:</p>
            <ul className="mt-1 list-disc list-inside">
              <li>Los roles del sistema (con candado) no pueden ser eliminados</li>
              <li>Haz clic en "Gestionar Permisos" para ver y modificar los permisos de un rol</li>
              <li>Los cambios en permisos afectan inmediatamente a todos los usuarios con ese rol</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => (
          <div
            key={role.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center">
                {getRoleIcon(role.name)}
                <h3 className="ml-2 text-lg font-medium text-gray-900">
                  {role.display_name || role.name}
                </h3>
                {role.is_system && (
                  <span title="Rol del sistema">
                    <Lock className="w-4 h-4 text-gray-400 ml-2" />
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1">
                {!role.is_system && (
                  <>
                    <button
                      onClick={() => setEditingRole(role)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Editar rol"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRole(role.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Eliminar rol"
                      disabled={role.users_count > 0}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">
              {role.description || 'Sin descripción'}
            </p>
            
            <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
              <span>{role.permissions_count || 0} permisos</span>
              <span>{role.users_count || 0} usuarios</span>
            </div>

            <button
              onClick={() => onSelectRole(role.id)}
              className="w-full inline-flex items-center justify-center px-3 py-2 border border-orange-500 text-orange-600 rounded-md hover:bg-orange-50 text-sm font-medium transition-colors"
            >
              <Settings className="w-4 h-4 mr-2" />
              Gestionar Permisos
            </button>
          </div>
        ))}
      </div>

      {/* Create/Edit Role Modal */}
      {(showCreateModal || editingRole) && (
        <RoleFormModal
          role={editingRole}
          onClose={() => {
            setShowCreateModal(false);
            setEditingRole(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingRole(null);
            fetchRoles();
          }}
        />
      )}
    </div>
  );
};

// Modal Component
const RoleFormModal: React.FC<{
  role?: Role | null;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ role, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: role?.name || '',
    display_name: role?.display_name || '',
    description: role?.description || ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre del rol es requerido';
    } else if (!/^[a-z_]+$/.test(formData.name)) {
      newErrors.name = 'Solo se permiten letras minúsculas y guiones bajos';
    }

    if (!formData.display_name.trim()) {
      newErrors.display_name = 'El nombre para mostrar es requerido';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'La descripción no puede exceder 500 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault?.();

    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const url = role 
        ? `/api/rbac/roles/${role.id}`
        : '/api/rbac/roles';
      
      const response = await fetch(url, {
        method: role ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al guardar rol');
      }

      toast.success(role ? 'Rol actualizado correctamente' : 'Rol creado correctamente');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar el rol');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {role ? 'Editar Rol' : 'Crear Nuevo Rol'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Rol (Interno)
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value.toLowerCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="ejemplo_rol"
              disabled={role?.is_system}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.name}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Usado internamente. Solo letras minúsculas y guiones bajos.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre para Mostrar
            </label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => handleInputChange('display_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Ejemplo de Rol"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            {errors.display_name && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.display_name}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Este nombre será visible para los usuarios.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              rows={3}
              placeholder="Describe las responsabilidades de este rol..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.description}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {formData.description.length}/500 caracteres
            </p>
          </div>

          {!role && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Nota:</strong> Después de crear el rol, podrás asignarle permisos específicos desde la pestaña de permisos.
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolesList;