import React, { useState, useEffect } from 'react';
import { Package, ToggleLeft, ToggleRight, Search, AlertCircle, CheckCircle, XCircle, Plus, Minus } from 'lucide-react';

interface Module {
  key: string;
  name: string;
  description: string;
  is_active: boolean;
  required_permissions?: string[];
}

interface UserModule {
  user_id: string;
  module_key: string;
  is_active: boolean;
  granted_at: string;
  granted_by: string;
  module?: Module;
}

interface ModulesManagerProps {
  selectedUserId: string | null;
  onUserChange?: (userId: string) => void;
  onModulesUpdated?: () => void;
}

const ModulesManager: React.FC<ModulesManagerProps> = ({ selectedUserId, onUserChange, onModulesUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [availableModules, setAvailableModules] = useState<Module[]>([]);
  const [userModules, setUserModules] = useState<UserModule[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [recommendedModules, setRecommendedModules] = useState<Module[]>([]);
  const [showRecommended, setShowRecommended] = useState(false);

  // Module display names
  const moduleDisplayNames: Record<string, string> = {
    'runners_management': 'Gestión de Corredores',
    'payment_management': 'Gestión de Pagos',
    'inventory_management': 'Gestión de Inventario',
    'ticket_management': 'Gestión de Tickets',
    'boss_dashboard': 'Dashboard Jefe',
    'admin_dashboard': 'Dashboard Admin',
    'user_dashboard': 'Dashboard Usuario',
    'reports': 'Reportes',
    'rbac_management': 'Gestión RBAC',
    'iframe_management': 'Gestión iFrame',
    'iframe_analytics': 'Analíticas iFrame',
    'exchange_rates': 'Tasas de Cambio'
  };

  const moduleIcons: Record<string, React.ReactNode> = {
    'runners_management': '🏃',
    'payment_management': '💳',
    'inventory_management': '📦',
    'ticket_management': '🎫',
    'boss_dashboard': '👔',
    'admin_dashboard': '👨‍💼',
    'user_dashboard': '👤',
    'reports': '📊',
    'rbac_management': '🔐',
    'iframe_management': '🖼️',
    'iframe_analytics': '📈',
    'exchange_rates': '💱'
  };

  useEffect(() => {
    fetchAvailableModules();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetchUserModules();
      fetchRecommendedModules();
    } else {
      setUserModules([]);
      setSelectedUser(null);
      setRecommendedModules([]);
    }
  }, [selectedUserId]);

  const fetchAvailableModules = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No se encontró token de autenticación');
      }

      const response = await fetch('/api/rbac/modules', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Error al cargar módulos');
      }

      setAvailableModules(data.modules || []);
    } catch (error) {
      console.error('Error fetching modules:', error);
      setError(`Error al cargar módulos: ${error.message}`);
      setAvailableModules([]);
    }
  };

  const fetchUserModules = async () => {
    if (!selectedUserId) return;

    setLoading(true);
    try {
      setError(null);
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error('No se encontró token de autenticación');
      }

      console.log(`🔍 Cargando módulos para usuario: ${selectedUserId}`);

      const response = await fetch(`/api/rbac/users/${selectedUserId}/modules`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Error al cargar módulos del usuario');
      }

      console.log('📊 Respuesta de módulos:', data);

      // Manejar tanto el formato antiguo como el nuevo
      let modulesToSet = [];

      if (data.modules) {
        modulesToSet = data.modules;
      } else if (data.summary?.active_modules) {
        modulesToSet = data.summary.active_modules;
      }

      // Filtrar solo módulos válidos
      const validModules = modulesToSet.filter(um => 
        um.module && 
        !um.module.error && 
        um.module.key
      );

      console.log(`✅ Módulos válidos encontrados: ${validModules.length}`);
      console.log('📋 Detalle de módulos:', validModules.map(um => ({
        key: um.module.key,
        name: um.module.name,
        active: um.is_active
      })));

      setUserModules(validModules);
      setSelectedUser(data.user || null);

      if (modulesToSet.length > 0 && validModules.length === 0) {
        console.warn('⚠️ Se encontraron módulos pero ninguno es válido:', modulesToSet);
        setError('Se encontraron módulos asignados pero hay problemas de configuración. Contacta al administrador.');
      }

    } catch (error) {
      console.error('❌ Error fetching user modules:', error);
      setError(`Error al cargar módulos del usuario: ${error.message}`);
      setUserModules([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendedModules = async () => {
    if (!selectedUserId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/rbac/users/${selectedUserId}/modules/recommended`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRecommendedModules(data.recommended_modules || []);
        }
      }
    } catch (error) {
      console.log('Error fetching recommended modules:', error);
    }
  };

  const handleToggleModule = async (moduleKey: string, currentlyActive: boolean) => {
    if (!selectedUserId) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No se encontró token de autenticación');
      }

      const method = currentlyActive ? 'DELETE' : 'POST';
      const url = currentlyActive 
        ? `/api/rbac/users/${selectedUserId}/modules/${moduleKey}`
        : `/api/rbac/users/${selectedUserId}/modules`;

      const body = currentlyActive ? undefined : JSON.stringify({ modules: [moduleKey] });

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al actualizar módulo');
      }

      console.log('🔄 Notificando actualización de módulos...');
      console.log(currentlyActive ? 'Módulo desactivado' : 'Módulo activado');
      
      await fetchUserModules();
      await fetchRecommendedModules();
      
      if (onModulesUpdated) {
        console.log('✅ Ejecutando callback onModulesUpdated');
        onModulesUpdated();
      } else {
        console.log('❌ No hay callback onModulesUpdated disponible');
      }
    } catch (error) {
      console.error('Error toggling module:', error);
      setError(`Error al actualizar el módulo: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignAllModules = async () => {
    if (!selectedUserId || availableModules.length === 0) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No se encontró token de autenticación');
      }

      // Obtener todas las claves de módulos disponibles
      const allModuleKeys = availableModules.map(module => module.key);

      const response = await fetch(`/api/rbac/users/${selectedUserId}/modules`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ modules: allModuleKeys })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al asignar todos los módulos');
      }

      console.log('✅ Todos los módulos asignados exitosamente');
      
      await fetchUserModules();
      await fetchRecommendedModules();
      
      if (onModulesUpdated) {
        onModulesUpdated();
      }
    } catch (error) {
      console.error('Error assigning all modules:', error);
      setError(`Error al asignar todos los módulos: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAllModules = async () => {
    if (!selectedUserId) return;

    // Confirmar acción
    if (!window.confirm('¿Estás seguro de que quieres remover todos los módulos de este usuario?')) {
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No se encontró token de autenticación');
      }

      // Usar PUT con array vacío para remover todos
      const response = await fetch(`/api/rbac/users/${selectedUserId}/modules`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ modules: [] })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al remover todos los módulos');
      }

      console.log('✅ Todos los módulos removidos exitosamente');
      
      await fetchUserModules();
      await fetchRecommendedModules();
      
      if (onModulesUpdated) {
        onModulesUpdated();
      }
    } catch (error) {
      console.error('Error removing all modules:', error);
      setError(`Error al remover todos los módulos: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAssignRecommended = async () => {
    if (!selectedUserId || recommendedModules.length === 0) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const moduleKeys = recommendedModules.map(m => m.key);

      const response = await fetch(`/api/rbac/users/${selectedUserId}/modules`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ modules: moduleKeys })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al asignar módulos recomendados');
      }

      console.log('Módulos recomendados asignados exitosamente');
      await fetchUserModules();
      await fetchRecommendedModules();
      
      if (onModulesUpdated) {
        onModulesUpdated();
      }
    } catch (error) {
      console.error('Error assigning recommended modules:', error);
      setError(`Error al asignar módulos recomendados: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAllModules = async () => {
    if (!selectedUserId) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No se encontró token de autenticación');
      }

      const activeModuleKeys = userModules
        .filter(um => um.is_active)
        .map(um => um.module_key);

      const response = await fetch(`/api/rbac/users/${selectedUserId}/modules`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ modules: activeModuleKeys })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al actualizar módulos');
      }

      console.log('Módulos actualizados exitosamente');
      await fetchUserModules();
      
      if (onModulesUpdated) {
        onModulesUpdated();
      }
    } catch (error) {
      console.error('Error updating modules:', error);
      setError(`Error al actualizar los módulos: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const isModuleAssigned = (moduleKey) => {
    const assigned = userModules.some(um => 
      um.module_key === moduleKey && 
      um.is_active && 
      um.module && 
      !um.module.error
    );
    
    console.log(`🔍 Verificando módulo ${moduleKey}:`, {
      assigned,
      userModulesCount: userModules.length,
      availableKeys: userModules.map(um => um.module_key)
    });
    
    return assigned;
  };

  const filteredModules = availableModules.filter(module =>
    module.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    module.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    moduleDisplayNames[module.key]?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular estadísticas para los botones de acción masiva
  const assignedModulesCount = userModules.filter(um => um.is_active).length;
  const totalModulesCount = availableModules.length;
  const allModulesAssigned = assignedModulesCount === totalModulesCount && totalModulesCount > 0;

  if (!selectedUserId) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Selecciona un usuario para gestionar sus módulos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-900">Error</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchAvailableModules();
                if (selectedUserId) fetchUserModules();
              }}
              className="mt-2 text-sm text-red-600 underline hover:text-red-800"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Package className="w-6 h-6 mr-2 text-orange-600" />
            Gestión de Módulos
          </h2>
          {selectedUser && (
            <p className="text-sm text-gray-600 mt-1">
              Usuario: <span className="font-medium">{selectedUser.full_name || selectedUser.email}</span>
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            {assignedModulesCount} de {totalModulesCount} módulos activos
          </span>
          {recommendedModules.length > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {recommendedModules.length} recomendados
            </span>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Acciones Masivas</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAssignAllModules}
            disabled={saving || allModulesAssigned || totalModulesCount === 0}
            className="inline-flex items-center px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4 mr-1" />
            Asignar Todos ({totalModulesCount})
          </button>
          
          <button
            onClick={handleRemoveAllModules}
            disabled={saving || assignedModulesCount === 0}
            className="inline-flex items-center px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Minus className="w-4 h-4 mr-1" />
            Remover Todos ({assignedModulesCount})
          </button>

          {recommendedModules.length > 0 && (
            <button
              onClick={handleBulkAssignRecommended}
              disabled={saving}
              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Package className="w-4 h-4 mr-1" />
              Asignar Recomendados ({recommendedModules.length})
            </button>
          )}
        </div>
        
        {allModulesAssigned && (
          <p className="text-xs text-green-600 mt-2 flex items-center">
            <CheckCircle className="w-3 h-3 mr-1" />
            Todos los módulos están asignados a este usuario
          </p>
        )}
      </div>

      {/* Recommended Modules Section */}
      {recommendedModules.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Package className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="font-medium text-blue-900">
                Módulos Recomendados ({recommendedModules.length})
              </h3>
            </div>
            <button
              onClick={() => setShowRecommended(!showRecommended)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showRecommended ? 'Ocultar' : 'Ver'} recomendados
            </button>
          </div>
          
          {showRecommended && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {recommendedModules.map((module) => (
                <div key={module.key} className="bg-white rounded-md p-3 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{module.name}</h4>
                      <p className="text-xs text-gray-600">{module.description}</p>
                    </div>
                    <button
                      onClick={() => handleToggleModule(module.key, false)}
                      disabled={saving}
                      className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200 disabled:opacity-50"
                    >
                      Asignar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar módulos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      {/* Modules Grid */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {availableModules.length === 0 
              ? 'No se encontraron módulos disponibles'
              : 'No se encontraron módulos que coincidan con la búsqueda'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModules.map((module) => {
            const isAssigned = isModuleAssigned(module.key);
            const displayName = moduleDisplayNames[module.key] || module.name;
            const icon = moduleIcons[module.key] || '📁';

            return (
              <div
                key={module.key}
                className={`border rounded-lg p-4 transition-all ${
                  isAssigned 
                    ? 'bg-orange-50 border-orange-300' 
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <h3 className="font-medium text-gray-900">{displayName}</h3>
                      <p className="text-xs text-gray-500">{module.key}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleModule(module.key, isAssigned)}
                    disabled={saving}
                    className={`p-1 rounded transition-colors ${
                      isAssigned 
                        ? 'text-orange-600 hover:bg-orange-100' 
                        : 'text-gray-400 hover:bg-gray-100'
                    } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isAssigned ? (
                      <ToggleRight className="w-6 h-6" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                </div>

                <p className="text-sm text-gray-600 mb-3">{module.description}</p>

                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      isAssigned
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {isAssigned ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Activo
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Inactivo
                      </>
                    )}
                  </span>

                  {isAssigned && userModules.find(um => um.module_key === module.key)?.granted_at && (
                    <span className="text-xs text-gray-500">
                      Asignado {new Date(userModules.find(um => um.module_key === module.key)!.granted_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Required Permissions Info */}
                {module.required_permissions && module.required_permissions.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500 mb-1">Permisos requeridos:</p>
                    <div className="flex flex-wrap gap-1">
                      {module.required_permissions.map((perm, idx) => (
                        <span key={idx} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Warning for users without modules */}
      {!loading && !error && userModules.length === 0 && availableModules.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-900">Sin módulos asignados</h4>
            <p className="text-sm text-yellow-700 mt-1">
              Este usuario no tiene ningún módulo asignado. Usa el botón "Asignar Todos" o selecciona módulos individuales para permitir el acceso a las diferentes secciones del sistema.
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          onClick={() => {
            setUserModules([]);
            setSearchTerm('');
            setError(null);
          }}
          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          disabled={saving}
        >
          Limpiar Selección
        </button>
        <button
          onClick={handleUpdateAllModules}
          disabled={saving || availableModules.length === 0}
          className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </div>
  );
};

export default ModulesManager;