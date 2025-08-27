import React, { useState, useEffect } from 'react';
import { 
  Search, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Package, 
  User, 
  Database, 
  RefreshCw, 
  Copy, 
  Eye,
  Download,
  Filter,
  Clock,
  Users,
  BarChart3
} from 'lucide-react';

interface Endpoint {
  name: string;
  url: string;
  method: string;
  description: string;
  expectedField: string;
  category: 'auth' | 'rbac' | 'debug';
}

interface TestResult {
  status: 'success' | 'error' | 'pending';
  statusCode?: number;
  data?: any;
  responseSize?: number;
  timestamp?: string;
  error?: string;
  responseTime?: number;
}

interface Analysis {
  found: boolean;
  value: number | null;
  path: string | null;
  extraInfo?: any;
  fullUser?: any;
  error?: string;
}

const EndpointDebugger: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState('d4dd5fda-0a3d-4878-9911-8a5e340d5f50');
  const [customUserId, setCustomUserId] = useState('');
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [loading, setLoading] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'auth' | 'rbac' | 'debug'>('all');
  const [availableUsers, setAvailableUsers] = useState<Array<{id: string, email: string}>>([]);

  const endpoints: Endpoint[] = [
    {
      name: 'Lista de Usuarios',
      url: '/api/auth/users',
      method: 'GET',
      description: 'Endpoint que muestra "8 módulos" en la lista',
      expectedField: 'users[].modules_count',
      category: 'auth'
    },
    {
      name: 'Detalles de Usuario',
      url: `/api/auth/users/${selectedUserId}`,
      method: 'GET', 
      description: 'Endpoint usado por UserDetailsModal',
      expectedField: 'user.modules_count',
      category: 'auth'
    },
    {
      name: 'Módulos del Usuario (RBAC)',
      url: `/api/rbac/users/${selectedUserId}/modules`,
      method: 'GET',
      description: 'Endpoint usado por ModulesManager',
      expectedField: 'modules[]',
      category: 'rbac'
    },
    {
      name: 'Información de Usuario (Auth)',
      url: `/api/auth/user-info/${selectedUserId}`,
      method: 'GET',
      description: 'Endpoint de información general del usuario',
      expectedField: 'user.active_modules',
      category: 'auth'
    },
    {
      name: 'Debug User Modules',
      url: `/api/rbac/users/${selectedUserId}/modules/quick-check`,
      method: 'GET',
      description: 'Endpoint de verificación rápida (si existe)',
      expectedField: 'modules_count',
      category: 'debug'
    },
    {
      name: 'Estadísticas RBAC',
      url: '/api/rbac/statistics',
      method: 'GET',
      description: 'Estadísticas generales del sistema',
      expectedField: 'total_modules',
      category: 'rbac'
    }
  ];

  // Cargar usuarios disponibles
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/auth/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setAvailableUsers(data.users?.slice(0, 10) || []); // Primeros 10 usuarios
        }
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };

    loadUsers();
  }, []);

  const testEndpoint = async (endpoint: Endpoint): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      return {
        status: response.ok ? 'success' : 'error',
        statusCode: response.status,
        data: data,
        responseSize: JSON.stringify(data).length,
        timestamp: new Date().toISOString(),
        responseTime
      };
    } catch (error) {
      return {
        status: 'error',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  };

  const testAllEndpoints = async () => {
    setLoading(true);
    const newResults: Record<string, TestResult> = {};

    // Inicializar con estado pending
    endpoints.forEach(endpoint => {
      newResults[endpoint.name] = { status: 'pending' };
    });
    setResults(newResults);

    for (const endpoint of endpoints) {
      console.log(`🔍 Testing ${endpoint.name}...`);
      const result = await testEndpoint(endpoint);
      newResults[endpoint.name] = result;
      setResults({...newResults}); // Update UI progressively
      await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
    }

    setLoading(false);
  };

  const testSingleEndpoint = async (endpointName: string) => {
    const endpoint = endpoints.find(e => e.name === endpointName);
    if (!endpoint) return;

    setResults(prev => ({
      ...prev,
      [endpointName]: { status: 'pending' }
    }));

    const result = await testEndpoint(endpoint);
    setResults(prev => ({
      ...prev,
      [endpointName]: result
    }));
  };

  const copyToClipboard = (text: string, endpointName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(endpointName);
    setTimeout(() => setCopiedEndpoint(''), 2000);
  };

  const exportResults = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      userId: selectedUserId,
      results: Object.entries(results).map(([name, result]) => ({
        endpoint: name,
        ...result,
        analysis: result.data ? analyzeResponse(result, endpoints.find(e => e.name === name)?.expectedField || '') : null
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `endpoint-debug-${selectedUserId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending': return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const analyzeResponse = (result: TestResult, expectedField: string): Analysis => {
    if (!result.data) return { found: false, value: null, path: null };

    try {
      const data = result.data;
      
      // Análisis específico por campo esperado
      if (expectedField === 'users[].modules_count') {
        const users = data.users || [];
        const targetUser = users.find((u: any) => u.id === selectedUserId);
        return {
          found: !!targetUser?.modules_count,
          value: targetUser?.modules_count || 0,
          path: `users[${users.indexOf(targetUser)}].modules_count`,
          fullUser: targetUser,
          extraInfo: {
            totalUsers: users.length,
            usersWithModules: users.filter((u: any) => u.modules_count > 0).length
          }
        };
      }
      
      if (expectedField === 'user.modules_count') {
        return {
          found: !!data.user?.modules_count,
          value: data.user?.modules_count || 0,
          path: 'user.modules_count',
          extraInfo: {
            active_modules: data.user?.active_modules?.length || 0,
            total_modules: data.user?.total_modules || 0,
            user_id: data.user?.id,
            user_email: data.user?.email
          }
        };
      }
      
      if (expectedField === 'modules[]') {
        const modules = data.modules || [];
        const activeModules = modules.filter((m: any) => m.is_active);
        return {
          found: modules.length > 0,
          value: modules.length,
          path: 'modules[]',
          extraInfo: {
            total: modules.length,
            active: activeModules.length,
            inactive: modules.length - activeModules.length,
            sampleModules: modules.slice(0, 3).map((m: any) => ({
              key: m.module_key,
              active: m.is_active,
              hasModule: !!m.module,
              module_name: m.module?.name
            }))
          }
        };
      }
      
      if (expectedField === 'user.active_modules') {
        return {
          found: !!data.active_modules,
          value: data.active_modules?.length || 0,
          path: 'active_modules[]',
          extraInfo: {
            total_modules: data.total_modules,
            inactive_modules: data.inactive_modules?.length || 0,
            sample_modules: data.active_modules?.slice(0, 3)
          }
        };
      }
      
      if (expectedField === 'modules_count') {
        return {
          found: typeof data.modules_count === 'number',
          value: data.modules_count || 0,
          path: 'modules_count'
        };
      }

      if (expectedField === 'total_modules') {
        return {
          found: typeof data.total_modules === 'number',
          value: data.total_modules || 0,
          path: 'total_modules',
          extraInfo: {
            users_without_modules: data.users_without_modules,
            total_users: data.total_users
          }
        };
      }
      
      return { found: false, value: null, path: null };
    } catch (error) {
      return { found: false, value: null, path: null, error: (error as Error).message };
    }
  };

  const filteredEndpoints = endpoints.filter(endpoint => 
    filterCategory === 'all' || endpoint.category === filterCategory
  );

  const handleUserIdChange = (newUserId: string) => {
    setSelectedUserId(newUserId);
    setResults({}); // Clear previous results when changing user
  };

  const applyCustomUserId = () => {
    if (customUserId.trim()) {
      handleUserIdChange(customUserId.trim());
      setCustomUserId('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Database className="w-8 h-8 mr-3 text-orange-600" />
              Debugger de Endpoints - Módulos
            </h1>
            <p className="text-gray-600 mt-1">Verificar inconsistencias en la información de módulos</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={testAllEndpoints}
              disabled={loading}
              className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {loading ? 'Probando...' : 'Probar Todos'}
            </button>
            
            {Object.keys(results).length > 0 && (
              <button
                onClick={exportResults}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* User Selection */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="font-medium text-gray-900 mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Selección de Usuario
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Usuarios Disponibles
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => handleUserIdChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="d4dd5fda-0a3d-4878-9911-8a5e340d5f50">
                Rpalencia@clxlatin.com (Caso problemático)
              </option>
              {availableUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.email} ({user.id.slice(0, 8)}...)
                </option>
              ))}
            </select>
          </div>

          {/* Custom ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ID Personalizado
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customUserId}
                onChange={(e) => setCustomUserId(e.target.value)}
                placeholder="Ingresa un UUID de usuario"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                onClick={applyCustomUserId}
                disabled={!customUserId.trim()}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Usuario Actual:</strong> {selectedUserId}<br/>
            <strong>Problema:</strong> Lista muestra "8 módulos" pero detalles muestran "0 módulos"
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <div className="flex gap-2">
            {['all', 'auth', 'rbac', 'debug'].map(category => (
              <button
                key={category}
                onClick={() => setFilterCategory(category as any)}
                className={`px-3 py-1 text-sm rounded-full ${
                  filterCategory === category
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {category === 'all' ? 'Todos' : category.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Endpoints Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredEndpoints.map((endpoint) => {
          const result = results[endpoint.name];
          const analysis = result ? analyzeResponse(result, endpoint.expectedField) : null;

          return (
            <div key={endpoint.name} className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{endpoint.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        endpoint.category === 'auth' ? 'bg-blue-100 text-blue-800' :
                        endpoint.category === 'rbac' ? 'bg-green-100 text-green-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {endpoint.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{endpoint.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {result && getStatusIcon(result.status)}
                    <button
                      onClick={() => testSingleEndpoint(endpoint.name)}
                      disabled={loading || result?.status === 'pending'}
                      className="p-1 text-gray-400 hover:text-orange-600 disabled:opacity-50"
                      title="Probar solo este endpoint"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="mt-3 flex items-center gap-2">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1">
                    {endpoint.method} {endpoint.url}
                  </code>
                  <button
                    onClick={() => copyToClipboard(endpoint.url, endpoint.name)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Copiar URL"
                  >
                    {copiedEndpoint === endpoint.name ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {result && result.status !== 'pending' && (
                <div className="p-4 space-y-3">
                  {/* Status & Performance */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Estado:</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        result.status === 'success' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {result.status === 'success' ? `${result.statusCode} OK` : `${result.statusCode || 'ERROR'}`}
                      </span>
                    </div>
                    
                    {result.responseTime && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Tiempo:</span>
                        <span className={`text-xs ${
                          result.responseTime < 200 ? 'text-green-600' :
                          result.responseTime < 1000 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {result.responseTime}ms
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Analysis */}
                  {analysis && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Módulos encontrados:</span>
                        <span className={`font-bold ${
                          analysis.found && analysis.value && analysis.value > 0 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {analysis.value || 0}
                        </span>
                      </div>
                      
                      {analysis.path && (
                        <div className="text-xs text-gray-500">
                          Campo: <code>{analysis.path}</code>
                        </div>
                      )}

                      {analysis.extraInfo && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-gray-600 hover:text-gray-800 mb-1">
                            Ver información adicional
                          </summary>
                          <div className="bg-gray-50 p-2 rounded">
                            <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(analysis.extraInfo, null, 2)}
                            </pre>
                          </div>
                        </details>
                      )}
                    </div>
                  )}

                  {/* Raw Response Preview */}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                      Ver respuesta raw ({result.responseSize} bytes)
                    </summary>
                    <pre className="mt-2 bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto max-h-40">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>

                  {result.error && (
                    <div className="text-xs bg-red-50 text-red-700 p-2 rounded">
                      <strong>Error:</strong> {result.error}
                    </div>
                  )}
                </div>
              )}

              {result?.status === 'pending' && (
                <div className="p-4 text-center text-blue-500">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p className="text-sm">Probando endpoint...</p>
                </div>
              )}

              {!result && !loading && (
                <div className="p-4 text-center text-gray-500">
                  <Eye className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Haz clic en "Probar Todos" para verificar este endpoint</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {Object.keys(results).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Resumen del Análisis
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {endpoints.map(endpoint => {
              const result = results[endpoint.name];
              const analysis = result ? analyzeResponse(result, endpoint.expectedField) : null;
              
              return (
                <div key={endpoint.name} className={`p-3 rounded-lg border ${
                  analysis?.found && analysis?.value && analysis?.value > 0 
                    ? 'bg-green-50 border-green-200' 
                    : result?.status === 'success'
                    ? 'bg-yellow-50 border-yellow-200'
                    : result?.status === 'error'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <h4 className="font-medium text-sm">{endpoint.name}</h4>
                  <p className="text-lg font-bold">
                    {analysis?.value || 0} módulos
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-600 mt-1">
                    <span>{result?.status === 'success' ? 'Funciona' : result?.status || 'No probado'}</span>
                    {result?.responseTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {result.responseTime}ms
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h3 className="font-medium text-orange-900 mb-2">🎯 Próximos Pasos</h3>
            <ul className="text-sm text-orange-800 space-y-1">
              <li>• Identifica qué endpoint devuelve los módulos correctamente</li>
              <li>• Compara las consultas SQL de los endpoints con diferentes resultados</li>
              <li>• Verifica la consistencia en las tablas utilizadas</li>
              <li>• Aplica la lógica correcta a todos los endpoints</li>
              <li>• Considera crear un endpoint unificado para módulos de usuario</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default EndpointDebugger;