import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Info, Shield, Key, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface DebugInfo {
  userId: string;
  cache: {
    permissions: Record<string, string[]>;
    permissionsList: string[];
    roles: any[];
  };
  database: {
    roles: any[];
    permissions: any[];
  };
  modules: any[];
  timestamp: string;
}

const PermissionsDebugger: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [testResource, setTestResource] = useState('');
  const [testAction, setTestAction] = useState('');
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const fetchDebugInfo = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/rbac/debug/permissions/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDebugInfo(data.debug);
      }
    } catch (error) {
      console.error('Error fetching debug info:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async () => {
    try {
      const response = await fetch(`/api/rbac/cache/clear/${user?.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  const testPermission = () => {
    if (testResource && testAction) {
      const result = hasPermission(testResource, testAction);
      setTestResult(result);
    }
  };

  useEffect(() => {
    fetchDebugInfo();
  }, [user?.id]);

  if (!user) {
    return <div>No hay usuario autenticado</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <AlertCircle className="w-6 h-6 mr-2 text-orange-600" />
              Debug de Permisos RBAC
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Herramienta para diagnosticar problemas de acceso
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={fetchDebugInfo}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recargar
            </button>
            <button
              onClick={clearCache}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
            >
              Limpiar Caché
            </button>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <User className="w-5 h-5 mr-2" />
          Información del Usuario
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">ID de Usuario</p>
            <p className="font-mono text-sm">{user.id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Rol (legacy)</p>
            <p className="font-medium">{user.role || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Última actualización</p>
            <p className="font-mono text-sm">{debugInfo?.timestamp || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Permission Tester */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Key className="w-5 h-5 mr-2" />
          Probar Permisos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Recurso (ej: users)"
            value={testResource}
            onChange={(e) => setTestResource(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <input
            type="text"
            placeholder="Acción (ej: read)"
            value={testAction}
            onChange={(e) => setTestAction(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={testPermission}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
          >
            Probar
          </button>
        </div>
        {testResult !== null && (
          <div className={`mt-4 p-4 rounded-lg flex items-center ${
            testResult ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {testResult ? (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Permiso CONCEDIDO para {testResource}:{testAction}
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 mr-2" />
                Permiso DENEGADO para {testResource}:{testAction}
              </>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
      ) : debugInfo && (
        <>
          {/* Roles from Cache */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Roles en Caché
            </h3>
            {debugInfo.cache.roles && debugInfo.cache.roles.length > 0 ? (
              <div className="space-y-2">
                {debugInfo.cache.roles.map((role: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{role.name || role}</span>
                    <span className="text-sm text-gray-600">
                      {typeof role === 'object' ? `ID: ${role.id}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No hay roles en caché</p>
            )}
          </div>

          {/* Roles from Database */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Roles en Base de Datos
            </h3>
            {debugInfo.database.roles && debugInfo.database.roles.length > 0 ? (
              <div className="space-y-2">
                {debugInfo.database.roles.map((userRole: any) => (
                  <div key={userRole.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{userRole.roles?.name}</span>
                      <span className="text-sm text-gray-600">
                        Asignado: {new Date(userRole.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {userRole.roles?.description && (
                      <p className="text-sm text-gray-600 mt-1">{userRole.roles.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No hay roles en la base de datos</p>
            )}
          </div>

          {/* Permissions List */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Permisos Efectivos ({debugInfo.cache.permissionsList?.length || 0})
            </h3>
            {debugInfo.cache.permissionsList && debugInfo.cache.permissionsList.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {debugInfo.cache.permissionsList.map((perm: string) => (
                  <div key={perm} className="px-3 py-2 bg-orange-50 text-orange-700 rounded-md text-sm font-mono">
                    {perm}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No hay permisos en caché</p>
            )}
          </div>

          {/* Database Permissions */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Permisos en Base de Datos
            </h3>
            {debugInfo.database.permissions && debugInfo.database.permissions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recurso</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {debugInfo.database.permissions.map((perm: any, index: number) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{perm.resource}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{perm.action}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{perm.scope || 'global'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No hay permisos en la base de datos</p>
            )}
          </div>

          {/* Troubleshooting */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-yellow-900 mb-4 flex items-center">
              <Info className="w-5 h-5 mr-2" />
              Posibles Causas de "Acceso Denegado"
            </h3>
            <ol className="space-y-2 text-sm text-yellow-800 list-decimal list-inside">
              <li>
                <strong>Caché desactualizado:</strong> Los permisos se cachean. Intenta limpiar el caché y recargar.
              </li>
              <li>
                <strong>Permisos no sincronizados:</strong> Verifica que los permisos en caché coincidan con la BD.
              </li>
              <li>
                <strong>Formato incorrecto:</strong> Los permisos deben estar en formato "recurso:acción".
              </li>
              <li>
                <strong>Middleware no actualizado:</strong> El middleware auth.js debe estar actualizado.
              </li>
              <li>
                <strong>Función SQL faltante:</strong> La función get_user_permissions debe existir en Supabase.
              </li>
              <li>
                <strong>Rol sin permisos:</strong> El rol puede estar asignado pero sin permisos configurados.
              </li>
            </ol>
            
            <div className="mt-4 p-4 bg-yellow-100 rounded-md">
              <p className="text-sm font-medium text-yellow-900">Comparación rápida:</p>
              <ul className="mt-2 space-y-1 text-sm">
                <li>Roles en caché: {debugInfo.cache.roles?.length || 0}</li>
                <li>Roles en BD: {debugInfo.database.roles?.length || 0}</li>
                <li>Permisos en caché: {debugInfo.cache.permissionsList?.length || 0}</li>
                <li>Permisos en BD: {debugInfo.database.permissions?.length || 0}</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PermissionsDebugger;