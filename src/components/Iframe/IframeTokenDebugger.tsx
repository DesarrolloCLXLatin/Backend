import React, { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, XCircle, Copy, Globe, Key, Clock, Database } from 'lucide-react';

const IframeTokenDebugger = () => {
  const [token, setToken] = useState('31c9232539e5692670e068f3834d1afd255aec78dced832552ef7c3442e60157');
  const [origin, setOrigin] = useState('https://clxnightrun.com');
  const [debugResult, setDebugResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testUrl, setTestUrl] = useState('');

  const runDiagnostic = async () => {
    setLoading(true);
    setDebugResult(null);

    const results = {
      timestamp: new Date().toISOString(),
      token: token,
      origin: origin,
      tests: []
    };

    try {
      // Test 1: Validar formato del token
      results.tests.push({
        name: 'Formato del Token',
        status: token && token.length === 64 ? 'success' : 'error',
        message: token && token.length === 64 
          ? 'Token tiene el formato correcto (64 caracteres hex)'
          : `Token inválido: ${token ? token.length : 0} caracteres`,
        details: {
          length: token?.length || 0,
          expectedLength: 64,
          isHex: /^[a-fA-F0-9]+$/.test(token || '')
        }
      });

      // Test 2: Validar origen
      let originValid = false;
      let originDetails = {};
      try {
        const url = new URL(origin);
        originValid = ['http:', 'https:'].includes(url.protocol);
        originDetails = {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port,
          pathname: url.pathname
        };
      } catch (e) {
        originDetails = { error: e.message };
      }

      results.tests.push({
        name: 'Validación del Origen',
        status: originValid ? 'success' : 'error',
        message: originValid ? 'Origen válido' : 'Origen inválido',
        details: originDetails
      });

      // Test 3: Simular request como iframe
      try {
        const iframeTestUrl = `${window.location.origin}/iframe/runner-registration?token=${token}`;
        const iframeResponse = await fetch(iframeTestUrl, {
          method: 'HEAD',
          headers: {
            'Origin': origin,
            'Referer': origin
          }
        });

        results.tests.push({
          name: 'Acceso a página de iFrame',
          status: iframeResponse.ok ? 'success' : 'error',
          message: iframeResponse.ok 
            ? `Página accesible (${iframeResponse.status})`
            : `Error de acceso: ${iframeResponse.status} ${iframeResponse.statusText}`,
          details: {
            status: iframeResponse.status,
            statusText: iframeResponse.statusText,
            url: iframeTestUrl,
            headers: Object.fromEntries(iframeResponse.headers.entries())
          }
        });

        setTestUrl(iframeTestUrl);
      } catch (error) {
        results.tests.push({
          name: 'Acceso a página de iFrame',
          status: 'error',
          message: `Error de conexión: ${error.message}`,
          details: { error: error.message }
        });
      }

      // Test 4: Validar token en API (simulando desde iframe)
      try {
        const apiResponse = await fetch('/api/tickets/payment/pago-movil/validate-iframe-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': origin,
            'X-Iframe-Token': token
          },
          body: JSON.stringify({ token, origin })
        });

        const apiData = apiResponse.ok ? await apiResponse.json() : null;

        results.tests.push({
          name: 'Validación de Token en API',
          status: apiResponse.ok ? 'success' : 'error',
          message: apiResponse.ok 
            ? 'Token válido en API'
            : `Error en API: ${apiResponse.status} ${apiResponse.statusText}`,
          details: {
            status: apiResponse.status,
            statusText: apiResponse.statusText,
            response: apiData,
            headers: Object.fromEntries(apiResponse.headers.entries())
          }
        });
      } catch (error) {
        results.tests.push({
          name: 'Validación de Token en API',
          status: 'error',
          message: `Error de API: ${error.message}`,
          details: { error: error.message }
        });
      }

      // Test 5: Verificar CORS
      try {
        const corsTestResponse = await fetch('/api/tickets/payment/pago-movil/cors-settings', {
          method: 'OPTIONS',
          headers: {
            'Origin': origin,
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type, X-Iframe-Token'
          }
        });

        results.tests.push({
          name: 'Configuración CORS',
          status: corsTestResponse.ok ? 'success' : 'warning',
          message: corsTestResponse.ok 
            ? 'CORS configurado correctamente'
            : 'Posible problema de CORS',
          details: {
            status: corsTestResponse.status,
            allowOrigin: corsTestResponse.headers.get('Access-Control-Allow-Origin'),
            allowMethods: corsTestResponse.headers.get('Access-Control-Allow-Methods'),
            allowHeaders: corsTestResponse.headers.get('Access-Control-Allow-Headers')
          }
        });
      } catch (error) {
        results.tests.push({
          name: 'Configuración CORS',
          status: 'error',  
          message: `Error verificando CORS: ${error.message}`,
          details: { error: error.message }
        });
      }

    } catch (error) {
      results.tests.push({
        name: 'Error General',
        status: 'error',
        message: `Error durante diagnóstico: ${error.message}`,
        details: { error: error.message }
      });
    }

    setDebugResult(results);
    setLoading(false);
  };

  const copyDebugInfo = () => {
    const debugText = JSON.stringify(debugResult, null, 2);
    navigator.clipboard.writeText(debugText);
  };

  const generateIframeCode = () => {
    return `<iframe 
  src="${window.location.origin}/iframe/runner-registration?token=${token}"
  width="100%"
  height="800"
  frameborder="0"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
  allow="payment"
></iframe>`;
  };

  const copyIframeCode = () => {
    navigator.clipboard.writeText(generateIframeCode());
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'border-green-200 bg-green-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'error': return 'border-red-200 bg-red-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Search className="w-6 h-6 text-blue-600" />
          Depurador de Tokens de iFrame
        </h1>
        <p className="text-gray-600">
          Diagnostica problemas con tokens de iframe que no funcionan correctamente.
        </p>
      </div>

      {/* Formulario de entrada */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Información del Token</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Token de iFrame
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Token hex de 64 caracteres"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Origen del Sitio
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://ejemplo.com"
              />
            </div>
          </div>
        </div>

        <button
          onClick={runDiagnostic}
          disabled={loading || !token || !origin}
          className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Diagnosticando...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Ejecutar Diagnóstico
            </>
          )}
        </button>
      </div>

      {/* Resultados del diagnóstico */}
      {debugResult && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Resultados del Diagnóstico</h2>
              <button
                onClick={copyDebugInfo}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition"
              >
                <Copy className="w-4 h-4" />
                Copiar Info
              </button>
            </div>

            <div className="space-y-3">
              {debugResult.tests.map((test, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${getStatusColor(test.status)}`}
                >
                  <div className="flex items-start gap-3">
                    {getStatusIcon(test.status)}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{test.name}</h3>
                      <p className="text-sm text-gray-700 mt-1">{test.message}</p>
                      
                      {test.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                            Ver detalles
                          </summary>
                          <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-x-auto">
                            {JSON.stringify(test.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Código de iframe generado */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Código de iFrame</h2>
              <button
                onClick={copyIframeCode}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 rounded-md transition"
              >
                <Copy className="w-4 h-4" />
                Copiar Código
              </button>
            </div>
            
            <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-x-auto border">
              {generateIframeCode()}
            </pre>
          </div>

          {/* URL de prueba */}
          {testUrl && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Prueba Directa</h2>
              <p className="text-sm text-gray-600 mb-3">
                Puedes probar el formulario directamente en esta URL:
              </p>
              <div className="bg-gray-100 p-3 rounded-md">
                <a
                  href={testUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline break-all"
                >
                  {testUrl}
                </a>
              </div>
            </div>
          )}

          {/* Recomendaciones */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-4">Recomendaciones</h2>
            <div className="space-y-2 text-sm text-blue-800">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                <p>Verifica que el dominio esté configurado en la sección CORS del administrador</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                <p>Asegúrate de que el token no haya expirado</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                <p>Revisa que el servidor esté procesando correctamente el header X-Iframe-Token</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                <p>Si todos los tests pasan pero aún hay problemas, revisa los logs del servidor</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IframeTokenDebugger;