import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, AlertCircle, CheckCircle, Globe } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const CorsSettings = ({ onUpdate }) => {
  const { token: authToken, hasPermission } = useAuth();
  const [corsOrigins, setCorsOrigins] = useState([]);
  const [newOrigin, setNewOrigin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchCorsSettings();
  }, [authToken]);

  const fetchCorsSettings = async () => {
    if (!authToken) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/tickets/payment/pago-movil/cors-settings', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCorsOrigins(data.allowed_origins || []);
      } else {
        setError('Error al cargar configuración CORS');
      }
    } catch (error) {
      console.error('Error fetching CORS settings:', error);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const validateOrigin = (origin) => {
    try {
      const url = new URL(origin);
      // Verificar que sea http o https
      if (!['http:', 'https:'].includes(url.protocol)) {
        return 'Solo se permiten protocolos HTTP o HTTPS';
      }
      // No debe tener path
      if (url.pathname !== '/') {
        return 'El origen no debe incluir rutas (path)';
      }
      return null;
    } catch (e) {
      return 'URL inválida. Formato: https://ejemplo.com';
    }
  };

  const addOrigin = async () => {
    setError('');
    setSuccess('');

    // Validar formato
    const validationError = validateOrigin(newOrigin);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Verificar duplicados
    if (corsOrigins.includes(newOrigin)) {
      setError('Este origen ya está configurado');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/tickets/payment/pago-movil/cors-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ origin: newOrigin })
      });

      if (response.ok) {
        await fetchCorsSettings();
        setNewOrigin('');
        setSuccess('Origen agregado exitosamente');
        if (onUpdate) onUpdate();
      } else {
        const error = await response.json();
        setError(error.message || 'Error al agregar origen');
      }
    } catch (error) {
      console.error('Error adding CORS origin:', error);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const removeOrigin = async (origin) => {
    if (!confirm(`¿Está seguro de eliminar el origen ${origin}?`)) return;
    
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/api/tickets/payment/pago-movil/cors-settings', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ origin })
      });

      if (response.ok) {
        await fetchCorsSettings();
        setSuccess('Origen eliminado');
        if (onUpdate) onUpdate();
      } else {
        const error = await response.json();
        setError(error.message || 'Error al eliminar origen');
      }
    } catch (error) {
      console.error('Error removing CORS origin:', error);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const canManageCors = hasPermission('iframe_tokens', 'create') || 
                        hasPermission('system', 'manage_all');

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Configuración CORS
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure los dominios permitidos para evitar bloqueos de conexión
          </p>
        </div>
        {loading && (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        )}
      </div>

      {/* Mensajes */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3 flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Información importante */}
      <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-3">
        <p className="text-sm text-blue-800">
          <strong>Importante:</strong> Agregue aquí los dominios donde planea usar el iframe 
          ANTES de crear tokens. Esto evitará errores de "conexión rechazada".
        </p>
      </div>

      {/* Formulario para agregar origen */}
      {canManageCors && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nuevo origen permitido
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://ejemplo.com"
              value={newOrigin}
              onChange={(e) => setNewOrigin(e.target.value)}
              disabled={loading}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              onKeyPress={(e) => e.key === 'Enter' && addOrigin()}
            />
            <button
              onClick={addOrigin}
              disabled={loading || !newOrigin}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Agregar
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Formato: https://dominio.com (sin barra final ni rutas)
          </p>
        </div>
      )}

      {/* Lista de orígenes */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Orígenes permitidos ({corsOrigins.length})
        </h4>
        
        {corsOrigins.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 rounded-md">
            <Globe className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              No hay orígenes configurados
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Los iframes solo funcionarán en los dominios agregados aquí
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {corsOrigins.map((origin, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between bg-gray-50 p-3 rounded-md border border-gray-200"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-mono text-gray-700">{origin}</span>
                </div>
                {canManageCors && (
                  <button
                    onClick={() => removeOrigin(origin)}
                    disabled={loading}
                    className="text-red-600 hover:text-red-800 disabled:text-gray-400 p-1 rounded hover:bg-red-50 transition"
                    title="Eliminar origen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nota sobre wildcards */}
      <div className="mt-4 text-xs text-gray-500">
        <p>• Cada dominio debe agregarse explícitamente</p>
        <p>• Los subdominios deben agregarse por separado</p>
        <p>• Los cambios se aplican inmediatamente</p>
      </div>
    </div>
  );
};

export default CorsSettings;