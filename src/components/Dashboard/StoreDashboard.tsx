import React, { useState, useEffect } from 'react';
import { 
  Users, 
  CreditCard, 
  UserPlus, 
  Clock, 
  Package, 
  TrendingUp,
  Calendar,
  CheckCircle,
  AlertCircle,
  DollarSign,
  RefreshCw,
  Hash
} from 'lucide-react';

interface InventoryItem {
  shirt_size: string;
  gender: 'M' | 'F';
  stock: number;
  reserved: number;
  available: number;
}

interface RecentGroup {
  group_id: string;
  group_code: string;
  total_runners: number;
  runner_names: string[];
  payment_status: string;
  payment_method: string;
  created_at: string;
  reserved_until?: string;
}

interface StoreDashboardData {
  totalGroups: number;
  totalRunners: number;
  confirmedPayments: number;
  pendingPayments: number;
  rejectedPayments: number;
  processingPayments: number;
  storeRevenueUSD: number;
  pricePerRunner: number;
  todayRegistrations: number;
  weekRegistrations: number;
  inventory: InventoryItem[];
  recentGroups: RecentGroup[];
}

const StoreDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<StoreDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    fetchStoreDashboardStats();
    // Auto-refresh cada 5 minutos
    const interval = setInterval(fetchStoreDashboardStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchStoreDashboardStats = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No se encontró token de autenticación');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/dashboard/store', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError('No tienes permisos para ver esta página.');
        } else if (response.status === 401) {
          setError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        } else {
          const errorData = await response.json();
          setError(errorData.message || 'Error al cargar las estadísticas');
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      setDashboardData(data);
      setLastUpdate(new Date());
      
    } catch (error) {
      console.error('Error fetching store dashboard stats:', error);
      setError('Error de conexión. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchStoreDashboardStats();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmado':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'rechazado':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'procesando':
        return <Clock className="w-4 h-4 text-blue-600" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'bg-green-100 text-green-800';
      case 'rechazado':
        return 'bg-red-100 text-red-800';
      case 'procesando':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getPaymentMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
      'tienda': 'Tienda',
      'zelle': 'Zelle',
      'transferencia_nacional': 'Transfer. Nacional',
      'transferencia_internacional': 'Transfer. Internacional',
      'paypal': 'PayPal',
      'pago_movil_p2c': 'Pago Móvil P2C'
    };
    return labels[method] || method;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        <p className="mt-4 text-gray-600">Cargando estadísticas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-medium text-red-800">Error</h3>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchStoreDashboardStats();
            }}
            className="mt-4 w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const statCards = [
    {
      title: 'Corredores Registrados',
      value: dashboardData.totalGroups,
      icon: Users,
      color: 'bg-orange-500',
      description: `${dashboardData.totalRunners} corredores`
    },
    {
      title: 'Registros Hoy',
      value: dashboardData.todayRegistrations,
      icon: UserPlus,
      color: 'bg-green-500',
      description: `${dashboardData.weekRegistrations} esta semana`
    }
  ];

  // Group inventory by gender
  const inventoryByGender = {
    M: dashboardData.inventory.filter(item => item.gender === 'M'),
    F: dashboardData.inventory.filter(item => item.gender === 'F')
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Tienda</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="text-sm text-gray-500">
            Actualizado: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div key={card.title} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                <p className="text-xs text-gray-500 mt-1">{card.description}</p>
              </div>
              <div className={`p-3 rounded-full ${card.color}`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-1 gap-2">
          <button 
            onClick={() => window.location.href = '/register-runner'}
            className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors group"
          >
            <UserPlus className="w-12 h-6 mr-3 text-gray-600 group-hover:text-orange-600" />
            <div className="text-center">
              <div className="text-sm font-medium text-gray-700 group-hover:text-orange-700">
                Registrar Corredor /es
              </div>
              <div className="text-xs text-gray-500">
                Nuevo registro
              </div>
            </div>
          </button>
          
          {/*<button 
            onClick={() => window.location.href = '/runners'}
            className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors group"
          >
            <Users className="w-6 h-6 mr-3 text-gray-600 group-hover:text-green-600" />
            <div className="text-left">
              <div className="text-sm font-medium text-gray-700 group-hover:text-green-700">
                Ver Mis Registros
              </div>
              <div className="text-xs text-gray-500">
                Corredores registrados por esta tienda
              </div>
            </div>
          </button>*/}
        </div>
      </div>

      {/* Revenue Info */}
      {/*<div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Información de Ingresos</h3>
          <DollarSign className="w-5 h-5 text-green-600" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">
              ${dashboardData.storeRevenueUSD.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 mt-1">Total en USD</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">
              ${dashboardData.pricePerRunner}
            </p>
            <p className="text-sm text-gray-600 mt-1">Precio por corredor</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">
              {dashboardData.confirmedPayments}
            </p>
            <p className="text-sm text-gray-600 mt-1">Grupos confirmados</p>
          </div>
        </div>
      </div>*/}

      {/* Inventory Status */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Estado del Inventario</h3>
          <Package className="w-5 h-5 text-orange-600" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Masculino */}
          <div>
            <h4 className="text-md font-medium text-blue-800 mb-3 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Masculino
            </h4>
            <div className="space-y-2">
              {inventoryByGender.M.map((item) => (
                <div key={`M-${item.shirt_size}`} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                  <span className="font-medium text-gray-700">Talla {item.shirt_size}</span>
                  <div className="flex items-center space-x-3 text-sm">
                    <span className={`font-medium ${
                      item.available > 10 ? 'text-green-600' : 
                      item.available > 5 ? 'text-yellow-600' : 
                      'text-red-600'
                    }`}>
                      {item.available} disponibles
                    </span>
                    {item.available <= 5 && item.available > 0 && (
                      <span className="text-xs text-orange-600">¡Stock bajo!</span>
                    )}
                    {item.available === 0 && (
                      <span className="text-xs text-red-600 font-medium">Agotado</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Femenino */}
          <div>
            <h4 className="text-md font-medium text-pink-800 mb-3 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Femenino
            </h4>
            <div className="space-y-2">
              {inventoryByGender.F.map((item) => (
                <div key={`F-${item.shirt_size}`} className="flex items-center justify-between p-2 bg-pink-50 rounded">
                  <span className="font-medium text-gray-700">Talla {item.shirt_size}</span>
                  <div className="flex items-center space-x-3 text-sm">
                    <span className={`font-medium ${
                      item.available > 10 ? 'text-green-600' : 
                      item.available > 5 ? 'text-yellow-600' : 
                      'text-red-600'
                    }`}>
                      {item.available} disponibles
                    </span>
                    {item.available <= 5 && item.available > 0 && (
                      <span className="text-xs text-orange-600">¡Stock bajo!</span>
                    )}
                    {item.available === 0 && (
                      <span className="text-xs text-red-600 font-medium">Agotado</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Registrations */}
      {dashboardData.recentGroups.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Registros Recientes</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Corredores
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Método Pago
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dashboardData.recentGroups.map((group) => (
                  <tr key={group.group_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <Hash className="w-4 h-4 text-gray-400 mr-1" />
                        <span className="text-sm font-medium text-gray-900">
                          {group.group_code}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {group.total_runners} {group.total_runners === 1 ? 'corredor' : 'corredores'}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          {group.runner_names.slice(0, 2).join(', ')}
                          {group.runner_names.length > 2 && ` y ${group.runner_names.length - 2} más`}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {getPaymentMethodLabel(group.payment_method)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(group.payment_status)}`}>
                        {getStatusIcon(group.payment_status)}
                        <span className="ml-1">{group.payment_status}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(group.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-orange-900 mb-2">Información Importante</h3>
          <ul className="space-y-2 text-sm text-orange-800">
            <li>• Los pagos en tienda se confirman automáticamente</li>
            <li>• El número de corredor se asigna inmediatamente al confirmar</li>
            <li>• Verifica el stock por talla y género antes de registrar</li>
            <li>• Las reservas de inventario duran 72 horas</li>
          </ul>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-2">Proceso de Registro</h3>
          <ol className="space-y-2 text-sm text-green-800">
            <li>1. Completa el formulario con los datos del grupo</li>
            <li>2. Selecciona tallas según género de cada corredor</li>
            <li>3. Confirma el pago recibido en tienda</li>
            <li>4. El sistema asigna números automáticamente</li>
            <li>5. Entrega los números de corredor al grupo</li>
          </ol>
        </div>
      </div>

      {/* Alerts */}
      {dashboardData.pendingPayments > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800">
                Pagos Pendientes
              </h4>
              <p className="text-sm text-yellow-700 mt-1">
                Tienes {dashboardData.pendingPayments} grupos con pagos pendientes. 
                Estos pagos deben ser confirmados por un administrador.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreDashboard;