import React from 'react';
import { X, User, Mail, Calendar, Shield, Clock, Package, CheckCircle, XCircle } from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  roles: Array<{
    id: string;
    name: string;
    description?: string;
    display_name?: string;
  }>;
  modules?: Array<{
    module_key: string;
    is_active: boolean;
    granted_at: string;
    granted_by: string;
    module?: {
      key: string;
      name: string;
      description: string;
      icon?: string;
    };
  }>;
  modules_count?: number;
  created_at: string;
  updated_at: string;
}

interface UserDetailsModalProps {
  user: UserData | null;
  onClose: () => void;
}

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({ user, onClose }) => {
  // IMPORTANTE: Verificar si user existe antes de renderizar
  if (!user) {
    return null;
  }

  // Mapeo de nombres de módulos para mostrar en español
  const moduleDisplayNames: Record<string, string> = {
    'runners_management': 'Gestión de Corredores',
    'payment_management': 'Gestión de Pagos',
    'inventory_management': 'Gestión de Inventario',
    'ticket_management': 'Gestión de Tickets',
    'boss_dashboard': 'Dashboard Jefe',
    'admin_dashboard': 'Dashboard Admin',
    'user_dashboard': 'Dashboard Usuario',
    'store_dashboard': 'Dashboard Tienda',
    'reports': 'Reportes',
    'rbac_management': 'Gestión RBAC',
    'iframe_management': 'Gestión iFrame',
    'iframe_analytics': 'Analíticas iFrame',
    'exchange_rates': 'Tasas de Cambio',
    'registration_management': 'Gestión de Registros',
    'financial_reports': 'Reportes Financieros',
    'runner_reports': 'Reportes de Corredores',
    'user_management': 'Gestión de Usuarios',
    'system_config': 'Configuración del Sistema',
    'payment_config': 'Configuración de Pagos',
    'ticket_sales': 'Venta de Tickets',
    'audit_logs': 'Logs de Auditoría',
    'email_logs': 'Logs de Email',
    'webhook_logs': 'Logs de Webhooks',
    'qr_generator': 'Generador QR',
    'backup_restore': 'Backup y Restauración'
  };

  const moduleIcons: Record<string, string> = {
    'runners_management': '🏃',
    'payment_management': '💳',
    'inventory_management': '📦',
    'ticket_management': '🎫',
    'boss_dashboard': '👔',
    'admin_dashboard': '👨‍💼',
    'user_dashboard': '👤',
    'store_dashboard': '🏪',
    'reports': '📊',
    'rbac_management': '🔐',
    'iframe_management': '🖼️',
    'iframe_analytics': '📈',
    'exchange_rates': '💱',
    'registration_management': '📝',
    'financial_reports': '💰',
    'runner_reports': '🏃‍♂️',
    'user_management': '👥',
    'system_config': '⚙️',
    'payment_config': '💳',
    'ticket_sales': '🎟️',
    'audit_logs': '📋',
    'email_logs': '📧',
    'webhook_logs': '🔗',
    'qr_generator': '📱',
    'backup_restore': '💾'
  };

  // Separar módulos activos e inactivos
  const activeModules = user.modules?.filter(module => module.is_active) || [];
  const inactiveModules = user.modules?.filter(module => !module.is_active) || [];

  // Función para obtener el nombre mostrado del módulo
  const getModuleDisplayName = (moduleKey: string, moduleData?: any) => {
    if (moduleData?.name) return moduleData.name;
    return moduleDisplayNames[moduleKey] || moduleKey;
  };

  // Función para obtener el ícono del módulo
  const getModuleIcon = (moduleKey: string, moduleData?: any) => {
    if (moduleData?.icon) return moduleData.icon;
    return moduleIcons[moduleKey] || '📁';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            Detalles del Usuario
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* User Avatar and Name */}
          <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-medium text-gray-900">
                {user?.full_name || 'Sin nombre'}
              </h4>
              <p className="text-sm text-gray-500">{user?.email || ''}</p>
              <div className="flex items-center mt-2 space-x-4">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <Package className="w-3 h-3 mr-1" />
                  {user.modules_count || 0} módulos
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <Shield className="w-3 h-3 mr-1" />
                  {user.roles?.length || 0} roles
                </span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center text-gray-600 mb-2">
                <Mail className="w-5 h-5 mr-2" />
                <span className="font-medium">Correo Electrónico</span>
              </div>
              <p className="text-gray-900">{user?.email || ''}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center text-gray-600 mb-2">
                <User className="w-5 h-5 mr-2" />
                <span className="font-medium">Nombre Completo</span>
              </div>
              <p className="text-gray-900">{user?.full_name || 'No especificado'}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center text-gray-600 mb-2">
                <Calendar className="w-5 h-5 mr-2" />
                <span className="font-medium">Fecha de Registro</span>
              </div>
              <p className="text-gray-900">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'No disponible'}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center text-gray-600 mb-2">
                <Clock className="w-5 h-5 mr-2" />
                <span className="font-medium">Última Actualización</span>
              </div>
              <p className="text-gray-900">
                {user?.updated_at ? new Date(user.updated_at).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'No disponible'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Roles */}
            <div>
              <div className="flex items-center text-gray-600 mb-3">
                <Shield className="w-5 h-5 mr-2" />
                <span className="font-medium">Roles Asignados</span>
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {user.roles?.length || 0}
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {user?.roles && user.roles.length > 0 ? (
                  user.roles.map((role) => (
                    <div key={role.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {role.display_name || role.name}
                          </p>
                          {role.description && (
                            <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                          )}
                        </div>
                        <Shield className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <Shield className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No tiene roles asignados</p>
                  </div>
                )}
              </div>
            </div>

            {/* Módulos Activos */}
            <div>
              <div className="flex items-center text-gray-600 mb-3">
                <Package className="w-5 h-5 mr-2" />
                <span className="font-medium">Módulos Activos</span>
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {activeModules.length}
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activeModules.length > 0 ? (
                  activeModules.map((userModule) => (
                    <div key={userModule.module_key} className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">
                            {getModuleIcon(userModule.module_key, userModule.module)}
                          </span>
                          <div>
                            <p className="font-medium text-gray-900">
                              {getModuleDisplayName(userModule.module_key, userModule.module)}
                            </p>
                            <p className="text-xs text-gray-600">
                              Asignado {new Date(userModule.granted_at).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                        </div>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Sin módulos activos</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Módulos Inactivos (si los hay) */}
          {inactiveModules.length > 0 && (
            <div>
              <div className="flex items-center text-gray-600 mb-3">
                <XCircle className="w-5 h-5 mr-2" />
                <span className="font-medium">Módulos Inactivos</span>
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {inactiveModules.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {inactiveModules.map((userModule) => (
                  <div key={userModule.module_key} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm opacity-60">
                        {getModuleIcon(userModule.module_key, userModule.module)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">
                          {getModuleDisplayName(userModule.module_key, userModule.module)}
                        </p>
                      </div>
                      <XCircle className="w-3 h-3 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ID del Usuario y Información Adicional */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Información Técnica</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500">
              <div>
                <span className="font-medium">ID de Usuario:</span>
                <p className="font-mono mt-1 p-2 bg-gray-100 rounded text-xs break-all">
                  {user?.id || ''}
                </p>
              </div>
              <div>
                <span className="font-medium">Total de Módulos:</span>
                <p className="mt-1">
                  {user.modules?.length || 0} módulos asignados 
                  ({activeModules.length} activos, {inactiveModules.length} inactivos)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cerrar
          </button>
          
          <button
            onClick={() => {
              const debugInfo = {
                user_id: user.id,
                email: user.email,
                full_name: user.full_name,
                roles: user.roles?.map(r => r.name) || [],
                active_modules: activeModules.map(m => m.module_key),
                inactive_modules: inactiveModules.map(m => m.module_key),
                total_modules: user.modules?.length || 0
              };
              navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
              alert('Información del usuario copiada al portapapeles');
            }}
            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
          >
            Copiar Info Debug
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserDetailsModal;