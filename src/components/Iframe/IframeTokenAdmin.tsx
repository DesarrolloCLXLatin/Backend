import React, { useState, useEffect } from 'react';
import { Key, Copy, Trash2, RefreshCw, Plus, ExternalLink, Clock, Activity, 
          AlertCircle, Shield, Ticket, Users, Eye, CreditCard, DollarSign, 
          Smartphone, Building, Globe, Store, Gift, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CorsSettings from './CorsSettings';
import IframeTokenDebugger from './IframeTokenDebugger';

const IframeTokenAdmin = () => {
  const { user, token: authToken, hasPermission, refreshUserPermissions } = useAuth();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewToken, setPreviewToken] = useState(null);
  const [copiedToken, setCopiedToken] = useState(null);
  const [error, setError] = useState(null);
  const [showDebugger, setShowDebugger] = useState(false);
  
  const [newTokenForm, setNewTokenForm] = useState({
    origin: '',
    allowed_domains: [],
    expires_in: 86400,
    token_type: 'seller_token',
    max_transactions: null,
    form_type: 'ticket',
    allowed_payment_methods: []
  });

  const availablePaymentMethods = [
    { value: 'pago_movil_p2c', label: 'Pago Móvil P2C', isOnline: true },
    { value: 'tarjeta_debito', label: 'Tarjeta de Débito', isOnline: true },
    { value: 'tarjeta_credito', label: 'Tarjeta de Crédito', isOnline: true },
    { value: 'zelle', label: 'Zelle', isOnline: true },
    { value: 'paypal', label: 'PayPal', isOnline: true },
    { value: 'transferencia_internacional', label: 'Transferencia Internacional', isOnline: true },
    { value: 'transferencia_nacional', label: 'Transferencia Nacional', isOnline: false },
    { value: 'efectivo_bs', label: 'Efectivo Bs', isOnline: false },
    { value: 'efectivo_usd', label: 'Efectivo USD', isOnline: false },
    { value: 'tienda', label: 'Pago en Tienda', isOnline: false },
    { value: 'obsequio_exonerado', label: 'Obsequio Exonerado', isOnline: false }
  ];

  const getPaymentMethodIcon = (method: string) => {
    const icons = {
      'pago_movil_p2c': <Smartphone className="w-3 h-3" />,
      'tarjeta_debito': <CreditCard className="w-3 h-3" />,
      'tarjeta_credito': <CreditCard className="w-3 h-3" />,
      'zelle': <DollarSign className="w-3 h-3" />,
      'paypal': <DollarSign className="w-3 h-3" />,
      'transferencia_nacional': <Building className="w-3 h-3" />,
      'transferencia_internacional': <Globe className="w-3 h-3" />,
      'efectivo_bs': <DollarSign className="w-3 h-3" />,
      'efectivo_usd': <DollarSign className="w-3 h-3" />,
      'tienda': <Store className="w-3 h-3" />,
      'obsequio_exonerado': <Gift className="w-3 h-3" />
    };
    return icons[method] || <CreditCard className="w-3 h-3" />;
  };

  const getPaymentMethodName = (method: string) => {
    const names = {
      'pago_movil_p2c': 'Pago Móvil',
      'tarjeta_debito': 'T. Débito',
      'tarjeta_credito': 'T. Crédito',
      'zelle': 'Zelle',
      'paypal': 'PayPal',
      'transferencia_nacional': 'Transf. Nacional',
      'transferencia_internacional': 'Transf. Int.',
      'efectivo_bs': 'Efectivo Bs',
      'efectivo_usd': 'Efectivo USD',
      'tienda': 'Tienda',
      'obsequio_exonerado': 'Obsequio'
    };
    return names[method] || method;
  };

  useEffect(() => {
  if (newTokenForm.token_type === 'public_token') {
    // Para tokens públicos, seleccionar automáticamente solo métodos online
    const onlineMethods = availablePaymentMethods
      .filter(m => m.isOnline)
      .map(m => m.value);
    setNewTokenForm(prev => ({
      ...prev,
      allowed_payment_methods: onlineMethods
    }));
  }
}, [newTokenForm.token_type]);

  // Tipos de formularios disponibles
  const formTypes = [
    {
      value: 'ticket',
      label: 'Compra de Tickets - Concierto',
      icon: Ticket,
      description: 'Formulario para venta de entradas del concierto de Caramelos de Cianuro',
      color: 'red',
      path: '/iframe/ticket-purchase'
    },
    {
      value: 'runner',
      label: 'Registro de Corredores',
      icon: Users,
      description: 'Formulario para inscripción en la carrera 10K',
      color: 'blue',
      path: '/embed'
    }
  ];

  useEffect(() => {
    if (user) {
      fetchTokens();
    }
  }, [user, authToken]);

  const fetchTokens = async () => {
    if (!authToken) {
      setError('No se encontró token de autenticación');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/tickets/payment/pago-movil/my-tokens', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTokens(data);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Error al cargar tokens');
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
      setError('Error de conexión al cargar tokens');
    } finally {
      setLoading(false);
    }
  };

  const createToken = async () => {
    if (!authToken) {
      alert('No se encontró sesión activa. Por favor, inicie sesión nuevamente.');
      return;
    }

    try {
      const formData = {
        ...newTokenForm,
        allowed_domains: newTokenForm.origin ? [newTokenForm.origin] : [],
        max_transactions: newTokenForm.max_transactions ? parseInt(newTokenForm.max_transactions) : null,
        metadata: {
          form_type: newTokenForm.form_type,
          allowed_payment_methods: newTokenForm.allowed_payment_methods
        }
      };

      const response = await fetch('/api/tickets/payment/pago-movil/generate-iframe-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        // Generar la URL correcta según el tipo de formulario
        const formConfig = formTypes.find(f => f.value === newTokenForm.form_type);
        const embedUrl = `${window.location.origin}${formConfig.path}?token=${data.token}`;
        const iframeCode = getIframeCode(data.token, newTokenForm.form_type);
        
        navigator.clipboard.writeText(iframeCode);
        
        alert(`Token creado exitosamente!\n\nTipo de formulario: ${formConfig.label}\n\nToken: ${data.token}\n\nURL de embed: ${embedUrl}\n\n¡El código iframe ha sido copiado al portapapeles!`);
        
        setShowCreateForm(false);
        setNewTokenForm({
          origin: '',
          allowed_domains: [],
          expires_in: 86400,
          token_type: 'seller_token',
          max_transactions: null,
          form_type: 'ticket'
        });
        
        fetchTokens();
      } else {
        if (response.status === 403) {
          alert(`Error de permisos: ${data.message}`);
          await refreshUserPermissions();
        } else {
          alert(`Error: ${data.message}`);
        }
      }
    } catch (error) {
      console.error('Error creating token:', error);
      alert('Error al crear token: ' + error.message);
    }
  };

  const previewIframe = (token) => {
    setPreviewToken(token);
    setShowPreviewModal(true);
  };

  const copyToClipboard = (text, tokenId) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(tokenId);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getIframeCode = (token, formType = 'ticket') => {
    const baseUrl = window.location.origin;
    const formConfig = formTypes.find(f => f.value === formType);
    const path = formConfig?.path || '/iframe/ticket-purchase';
    
    return `<iframe 
  src="${baseUrl}${path}?token=${token}"
  width="100%"
  height="${formType === 'runner' ? '800' : '600'}"
  frameborder="0"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
  allow="payment"
></iframe>`;
  };

  const getFormType = (token) => {
    // Obtener el tipo de formulario desde los metadatos del token
    return token.metadata?.form_type || 'ticket';
  };

  const getFormConfig = (token) => {
    const formType = getFormType(token);
    return formTypes.find(f => f.value === formType) || formTypes[0];
  };

  const revokeToken = async (token) => {
    if (!confirm('¿Está seguro de revocar este token? Esta acción no se puede deshacer.')) return;

    try {
      const response = await fetch('/api/tickets/payment/pago-movil/revoke-iframe-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ token })
      });

      if (response.ok) {
        alert('Token revocado exitosamente');
        fetchTokens();
      } else {
        const error = await response.json();
        alert(`Error al revocar token: ${error.message}`);
      }
    } catch (error) {
      console.error('Error revoking token:', error);
      alert('Error al revocar token');
    }
  };

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return 'N/A';
    
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;
    
    if (diff <= 0) return 'Expirado';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} día${days > 1 ? 's' : ''}`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  const canCreateTokens = user && (
    hasPermission('iframe_tokens', 'create') || 
    hasPermission('system', 'manage_all')
  );

  if (!user) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-yellow-900 mb-2">
            Sesión no encontrada
          </h2>
          <p className="text-yellow-700">
            Por favor, inicie sesión para acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Gestión de Tokens para iFrame
        </h1>
        <p className="text-gray-600">
          Administre los tokens de acceso para la integración de formularios en sitios externos.
        </p>
        
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Shield className="w-4 h-4" />
          <span>Usuario: {user.email}</span>
          <span>•</span>
          <span>Rol: {user.role || 'Usuario'}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      <CorsSettings onUpdate={fetchTokens} />

      <div className="mb-6 flex gap-3">
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          disabled={!canCreateTokens}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
        >
          <Plus className="w-4 h-4" />
          Crear Token
        </button>

        <button
          onClick={fetchTokens}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>

        {/* NUEVO BOTÓN */}
        <button
          onClick={() => setShowDebugger(!showDebugger)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition"
        >
          <Search className="w-4 h-4" />
          Depurador
        </button>
      </div>

      {showCreateForm && canCreateTokens && (
        <div className="mb-6 bg-white border rounded-lg p-6">
          <h3 className="font-semibold mb-4 text-lg">Crear Nuevo Token</h3>
          
          {/* Selector de tipo de formulario */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tipo de Formulario
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formTypes.map((formType) => {
                const Icon = formType.icon;
                const isSelected = newTokenForm.form_type === formType.value;
                
                return (
                  <button
                    key={formType.value}
                    type="button"
                    onClick={() => setNewTokenForm({...newTokenForm, form_type: formType.value})}
                    className={`
                      p-4 rounded-lg border-2 transition-all text-left
                      ${isSelected 
                        ? `border-${formType.color}-500 bg-${formType.color}-50` 
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`
                        p-2 rounded-lg
                        ${isSelected ? `bg-${formType.color}-100` : 'bg-gray-100'}
                      `}>
                        <Icon className={`
                          w-6 h-6
                          ${isSelected ? `text-${formType.color}-600` : 'text-gray-600'}
                        `} />
                      </div>
                      <div className="flex-1">
                        <h4 className={`
                          font-semibold
                          ${isSelected ? `text-${formType.color}-900` : 'text-gray-900'}
                        `}>
                          {formType.label}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {formType.description}
                        </p>
                      </div>
                      {isSelected && (
                        <div className={`text-${formType.color}-500`}>
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dominio Permitido
              </label>
              <input
                type="text"
                placeholder="https://ejemplo.com"
                value={newTokenForm.origin}
                onChange={(e) => setNewTokenForm({...newTokenForm, origin: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Deje vacío para permitir cualquier dominio (no recomendado)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tiempo de Expiración
              </label>
              <select
                value={newTokenForm.expires_in}
                onChange={(e) => setNewTokenForm({...newTokenForm, expires_in: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={3600}>1 hora</option>
                <option value={86400}>1 día</option>
                <option value={604800}>7 días</option>
                <option value={2592000}>30 días</option>
                <option value={7776000}>90 días</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Token
              </label>
              <select
                value={newTokenForm.token_type}
                onChange={(e) => setNewTokenForm({...newTokenForm, token_type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="seller_token">Token de Vendedor</option>
                <option value="public_token">Token Público</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Los tokens públicos requieren CAPTCHA
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Límite de Transacciones (opcional)
              </label>
              <input
                type="number"
                placeholder="Sin límite"
                value={newTokenForm.max_transactions || ''}
                onChange={(e) => setNewTokenForm({...newTokenForm, max_transactions: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Solo para tokens públicos
              </p>
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Métodos de Pago Permitidos
            </label>
            <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
              {availablePaymentMethods.map((method) => (
                <label key={method.value} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    value={method.value}
                    checked={newTokenForm.allowed_payment_methods.includes(method.value)}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewTokenForm(prev => ({
                        ...prev,
                        allowed_payment_methods: e.target.checked
                          ? [...prev.allowed_payment_methods, value]
                          : prev.allowed_payment_methods.filter(m => m !== value)
                      }));
                    }}
                    disabled={
                      // Deshabilitar métodos offline para tokens públicos
                      newTokenForm.token_type === 'public_token' && !method.isOnline
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`text-sm ${
                    newTokenForm.token_type === 'public_token' && !method.isOnline
                      ? 'text-gray-400 line-through'
                      : 'text-gray-700'
                  }`}>
                    {method.label}
                    {method.isOnline && (
                      <span className="text-xs text-blue-600 ml-1">(Online)</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {newTokenForm.token_type === 'public_token' 
                ? 'Solo métodos online disponibles para tokens públicos'
                : 'Seleccione los métodos de pago que estarán disponibles'
              }
            </p>
          </div>
          <div className="mt-6 flex gap-2">
            <button
              onClick={createToken}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
            >
              Crear Token
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewTokenForm({
                  origin: '',
                  allowed_domains: [],
                  expires_in: 86400,
                  token_type: 'seller_token',
                  max_transactions: null,
                  form_type: 'ticket'
                });
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
            <p className="text-gray-500">Cargando tokens...</p>
          </div>
        ) : tokens.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Token
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Formulario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Métodos de Pago
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dominio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uso
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expira
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tokens.map((token) => {
                  const isExpired = token.stats?.is_expired || new Date(token.expires_at) < new Date();
                  const formConfig = getFormConfig(token);
                  const FormIcon = formConfig.icon;
                  
                  return (
                    <tr key={token.id} className={isExpired ? 'bg-gray-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => previewIframe(token)}
                            className="text-green-600 hover:text-green-900"
                            title="Vista previa"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const code = getIframeCode(token.token, getFormType(token));
                              copyToClipboard(code, `code-${token.id}`);
                              alert('Código iframe copiado al portapapeles!');
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="Copiar código iframe"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          {token.is_active && hasPermission('iframe_tokens', 'delete') && (
                            <button
                              onClick={() => revokeToken(token.token)}
                              className="text-red-600 hover:text-red-900"
                              title="Revocar token"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Key className="w-4 h-4 text-gray-400 mr-2" />
                          <code className="text-sm font-mono">
                            {token.token.substring(0, 12)}...
                          </code>
                          <button
                            onClick={() => copyToClipboard(token.token, token.id)}
                            className="ml-2 text-gray-400 hover:text-gray-600"
                            title="Copiar token"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {copiedToken === token.id && (
                            <span className="ml-2 text-xs text-green-600">¡Copiado!</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <FormIcon className={`w-5 h-5 text-${formConfig.color}-500`} />
                          <span className="text-sm text-gray-900">{formConfig.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          token.token_type === 'public_token' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {token.token_type === 'public_token' ? 'Público' : 'Vendedor'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          {/* Si el token tiene métodos específicos configurados */}
                          {token.metadata?.allowed_payment_methods && token.metadata.allowed_payment_methods.length > 0 ? (
                            <div>
                              <div className="flex items-center gap-1 mb-1">
                                <Shield className="w-4 h-4 text-indigo-500" />
                                <span className="font-medium text-indigo-700">Personalizado</span>
                              </div>
                              <div className="text-xs text-gray-500 space-y-0.5">
                                {token.metadata.allowed_payment_methods.slice(0, 3).map((method, idx) => (
                                  <div key={idx} className="flex items-center gap-1">
                                    {getPaymentMethodIcon(method)}
                                    <span>{getPaymentMethodName(method)}</span>
                                  </div>
                                ))}
                                {token.metadata.allowed_payment_methods.length > 3 && (
                                  <div className="text-gray-400">
                                    +{token.metadata.allowed_payment_methods.length - 3} más
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : token.token_type === 'public_token' ? (
                            // Configuración por defecto para tokens públicos
                            <div>
                              <div className="flex items-center gap-1 mb-1">
                                <Shield className="w-4 h-4 text-purple-500" />
                                <span className="font-medium text-purple-700">Solo Online</span>
                              </div>
                              <div className="text-xs text-gray-500 space-y-0.5">
                                <div className="flex items-center gap-1">
                                  <Smartphone className="w-3 h-3" />
                                  <span>Pago Móvil P2C</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <CreditCard className="w-3 h-3" />
                                  <span>Tarjetas Débito/Crédito</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  <span>Zelle, PayPal</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            // Configuración por defecto para tokens de vendedor
                            <div>
                              <div className="flex items-center gap-1 mb-1">
                                <Users className="w-4 h-4 text-blue-500" />
                                <span className="font-medium text-blue-700">Todos</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                <div>Sin restricciones</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {token.allowed_domains?.length > 0 
                            ? token.allowed_domains.join(', ') 
                            : token.origin || 'Cualquiera'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!token.is_active ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            Revocado
                          </span>
                        ) : isExpired ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            Expirado
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Activo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div>Usos: {token.stats?.total_uses || 0}</div>
                          {token.max_transactions && (
                            <div className="text-xs">
                              Restantes: {token.stats?.transactions_remaining || 0}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock className="w-4 h-4 mr-1" />
                          {getTimeRemaining(token.expires_at)}
                        </div>
                      </td>
                      
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Key className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No hay tokens creados</p>
            <p className="text-gray-400 text-sm mt-2">
              {canCreateTokens 
                ? 'Crea tu primer token para comenzar a integrar formularios'
                : 'No tienes permisos para crear tokens. Contacta al administrador.'}
            </p>
          </div>
        )}
      </div>

      {/* Modal de vista previa */}
      {showPreviewModal && previewToken && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Vista Previa del Formulario</h3>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewToken(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 bg-gray-50">
              <p className="text-sm text-gray-600 mb-2">
                Así se verá el formulario en el sitio externo:
              </p>
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <iframe
                  src={`${window.location.origin}${getFormConfig(previewToken).path}?token=${previewToken.token}`}
                  width="100%"
                  height={getFormType(previewToken) === 'runner' ? '600' : '500'}
                  frameBorder="0"
                  style={{ border: '1px solid #e5e7eb' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3 text-lg">Instrucciones de Integración</h3>
        
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded p-3">
          <p className="text-sm text-yellow-800">
            <strong>⚠️ Importante:</strong> Antes de crear un token, asegúrate de agregar el dominio donde se usará el iframe en la configuración CORS arriba.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {formTypes.map((formType) => {
            const Icon = formType.icon;
            return (
              <div key={formType.value} className="bg-white rounded-lg p-4 border border-blue-100">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-2 bg-${formType.color}-100 rounded-lg`}>
                    <Icon className={`w-5 h-5 text-${formType.color}-600`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{formType.label}</h4>
                    <p className="text-sm text-gray-600">{formType.description}</p>
                  </div>
                </div>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {formType.path}
                </code>
              </div>
            );
          })}
        </div>

      </div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Información de Métodos de Pago */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="font-semibold text-purple-900 mb-3 text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Tokens Públicos
          </h3>
          <p className="text-sm text-purple-700 mb-3">
            Diseñados para ventas sin supervisión en sitios externos.
          </p>
          <div className="space-y-2">
            <h4 className="font-medium text-purple-800 text-sm">Métodos de pago disponibles:</h4>
            <ul className="list-disc list-inside text-sm text-purple-600 space-y-1">
              <li>Pago Móvil P2C (confirmación automática)</li>
              <li>Tarjeta de Débito/Crédito</li>
              <li>Zelle (requiere comprobante)</li>
              <li>PayPal (requiere comprobante)</li>
              <li>Transferencia Internacional</li>
            </ul>
            <div className="mt-3 p-3 bg-purple-100 rounded">
              <p className="text-xs text-purple-700">
                <strong>Nota:</strong> Los métodos en efectivo y tienda NO están disponibles
              </p>
            </div>
          </div>
        </div>

        {/* Información de Tokens de Vendedor */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3 text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Tokens de Vendedor
          </h3>
          <p className="text-sm text-blue-700 mb-3">
            Para vendedores autorizados con acceso completo.
          </p>
          <div className="space-y-2">
            <h4 className="font-medium text-blue-800 text-sm">Métodos de pago disponibles:</h4>
            <ul className="list-disc list-inside text-sm text-blue-600 space-y-1">
              <li>Todos los métodos online</li>
              <li>Pago en tienda</li>
              <li>Efectivo (Bs y USD)</li>
              <li>Transferencias nacionales</li>
              <li>Obsequio exonerado (si tiene permisos)</li>
            </ul>
            <div className="mt-3 p-3 bg-blue-100 rounded">
              <p className="text-xs text-blue-700">
                <strong>Ventaja:</strong> Confirmación inmediata para métodos en tienda
              </p>
            </div>
          </div>
        </div>
      </div>
      {showDebugger && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
            <h3 className="text-lg font-semibold">Depurador de Tokens</h3>
            <button
              onClick={() => setShowDebugger(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4">
            <IframeTokenDebugger />
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default IframeTokenAdmin;