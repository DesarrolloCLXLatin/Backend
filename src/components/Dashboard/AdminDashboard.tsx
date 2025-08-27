import React, { useState, useEffect } from 'react';
import { 
  Users, 
  CreditCard, 
  Package, 
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  RefreshCw,
  UserCheck,
  Activity,
  ShoppingBag,
  AlertCircle
} from 'lucide-react';

interface GenderStats {
  M: number;
  F: number;
}

interface InventoryByGender {
  M: Array<{
    shirt_size: string;
    gender: string;
    stock: number;
    reserved: number;
    available: number;
  }>;
  F: Array<{
    shirt_size: string;
    gender: string;
    stock: number;
    reserved: number;
    available: number;
  }>;
}

interface PaymentStats {
  pendiente: number;
  confirmado: number;
  rechazado: number;
  procesando: number;
}

interface PaymentMethods {
  tienda: number;
  zelle: number;
  transferencia_nacional: number;
  transferencia_internacional: number;
  paypal: number;
  pago_movil_p2c: number;
}

interface GroupStats {
  total: number;
  confirmed: number;
  pending: number;
  withReservation: number;
}

interface TransactionStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  totalUSD: number;
  totalBs: number;
}

interface DashboardData {
  totalRunners: number;
  confirmedPayments: number;
  pendingPayments: number;
  rejectedPayments: number;
  totalRevenue: number;
  availableStock: number;
  
  stats: {
    totalRunners: number;
    totalGroups: number;
    availableRunnerNumbers: number;
    paymentStats: PaymentStats;
    totalRevenueUSD: number;
    totalRevenueBs: number;
    exchangeRate: number;
    exchangeRateDate: string;
    pricePerRunner: number;
    totalStock: number;
    totalReserved: number;
    availableStock: number;
    inventoryByGender: InventoryByGender;
    paymentMethods: PaymentMethods;
    genderDistribution: GenderStats;
    groupStats: GroupStats;
    transactionStats: TransactionStats;
    todayRegistrations: number;
    todayConfirmed: number;
    todayP2C: number;
    todayStore: number;
    weeklyTrend: Array<{
      date: string;
      total_registrations: number;
      confirmed_registrations: number;
    }>;
  };
}

const AdminDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    fetchDashboardStats();
    // Auto-refresh cada 5 minutos
    const interval = setInterval(fetchDashboardStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No se encontró token de autenticación');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/dashboard/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError('No tienes permisos para ver esta página. Necesitas rol de administrador.');
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
      console.error('Error fetching dashboard stats:', error);
      setError('Error de conexión. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchDashboardStats();
  };

  const getPaymentMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
      tienda: 'Tienda',
      zelle: 'Zelle',
      transferencia_nacional: 'Transfer. Nacional',
      transferencia_internacional: 'Transfer. Internacional',
      paypal: 'PayPal',
      pago_movil_p2c: 'Pago Móvil P2C'
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
            <AlertTriangle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-medium text-red-800">Error</h3>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchDashboardStats();
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
      title: 'Total Corredores',
      value: dashboardData.totalRunners,
      icon: Users,
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      description: `${dashboardData.stats.totalGroups} grupos registrados`
    },
    {
      title: 'Pagos Confirmados',
      value: dashboardData.confirmedPayments,
      icon: CheckCircle,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      description: `$${dashboardData.totalRevenue.toLocaleString()} USD`
    },
    {
      title: 'Pagos Pendientes',
      value: dashboardData.pendingPayments,
      icon: Clock,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600',
      description: `${dashboardData.stats.paymentStats.procesando} procesando`
    },
    {
      title: 'Stock Disponible',
      value: dashboardData.availableStock,
      icon: Package,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      description: `${dashboardData.stats.totalReserved} reservados`
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Administrativo</h1>
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

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div key={card.title} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                <p className="text-xs text-gray-500 mt-1">{card.description}</p>
              </div>
              <div className={`p-3 rounded-full ${card.color} opacity-90`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue and Groups Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Ingresos Totales</h3>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-3xl font-bold text-green-600">
                ${dashboardData.stats.totalRevenueUSD.toLocaleString()} USD
              </div>
              {dashboardData.stats.totalRevenueBs > 0 && (
                <div className="text-lg text-gray-600 mt-1">
                  Bs. {dashboardData.stats.totalRevenueBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600">
              Precio por corredor: ${dashboardData.stats.pricePerRunner} USD
            </p>
            {dashboardData.stats.exchangeRate > 0 && (
              <p className="text-xs text-gray-500">
                Tasa: {dashboardData.stats.exchangeRate.toFixed(2)} Bs/USD
                {dashboardData.stats.exchangeRateDate && (
                  <span className="ml-1">
                    ({new Date(dashboardData.stats.exchangeRateDate).toLocaleDateString()})
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Grupos</h3>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total:</span>
              <span className="font-medium">{dashboardData.stats.groupStats.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Confirmados:</span>
              <span className="font-medium text-green-600">{dashboardData.stats.groupStats.confirmed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Con reserva activa:</span>
              <span className="font-medium text-yellow-600">{dashboardData.stats.groupStats.withReservation}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Números disponibles:</span>
              <span className="font-medium">{dashboardData.stats.availableRunnerNumbers}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Distribución por Género</h3>
            <UserCheck className="w-5 h-5 text-purple-600" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {dashboardData.stats.genderDistribution.M}
              </div>
              <p className="text-sm text-gray-600">Masculino</p>
              <p className="text-xs text-gray-500">
                {((dashboardData.stats.genderDistribution.M / dashboardData.totalRunners) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-600">
                {dashboardData.stats.genderDistribution.F}
              </div>
              <p className="text-sm text-gray-600">Femenino</p>
              <p className="text-xs text-gray-500">
                {((dashboardData.stats.genderDistribution.F / dashboardData.totalRunners) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Stats */}
      {(dashboardData.stats.todayRegistrations > 0 || dashboardData.stats.todayConfirmed > 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-blue-800">Estadísticas de Hoy</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                <div>
                  <span className="text-2xl font-bold text-blue-900">{dashboardData.stats.todayRegistrations}</span>
                  <p className="text-xs text-blue-700">Nuevos registros</p>
                </div>
                <div>
                  <span className="text-2xl font-bold text-blue-900">{dashboardData.stats.todayConfirmed}</span>
                  <p className="text-xs text-blue-700">Confirmados</p>
                </div>
                <div>
                  <span className="text-2xl font-bold text-blue-900">{dashboardData.stats.todayP2C}</span>
                  <p className="text-xs text-blue-700">Pago P2C</p>
                </div>
                <div>
                  <span className="text-2xl font-bold text-blue-900">{dashboardData.stats.todayStore}</span>
                  <p className="text-xs text-blue-700">En tienda</p>
                </div>
              </div>
            </div>
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      )}

      {/* Payment Methods and Transaction Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Métodos de Pago</h3>
          <div className="space-y-3">
            {Object.entries(dashboardData.stats.paymentMethods).map(([method, count]) => {
              const total = Object.values(dashboardData.stats.paymentMethods).reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? (count / total) * 100 : 0;
              
              return (
                <div key={method} className="flex items-center justify-between">
                  <div className="flex items-center flex-1">
                    <span className="text-sm font-medium text-gray-700 w-40">
                      {getPaymentMethodLabel(method)}
                    </span>
                    <div className="flex-1 mx-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-orange-600 h-2 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-16 text-right">
                    {count} ({percentage.toFixed(0)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Transacciones Gateway</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{dashboardData.stats.transactionStats.total}</p>
              <p className="text-xs text-gray-600">Total</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{dashboardData.stats.transactionStats.approved}</p>
              <p className="text-xs text-green-700">Aprobadas</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{dashboardData.stats.transactionStats.pending}</p>
              <p className="text-xs text-yellow-700">Pendientes</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{dashboardData.stats.transactionStats.rejected}</p>
              <p className="text-xs text-red-700">Rechazadas</p>
            </div>
          </div>
          {dashboardData.stats.transactionStats.totalUSD > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">
                Total procesado: 
                <span className="font-medium text-gray-900 ml-1">
                  ${dashboardData.stats.transactionStats.totalUSD.toFixed(2)} USD
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Inventory by Gender */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventario por Género y Talla</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Masculino */}
          <div>
            <h4 className="text-md font-medium text-blue-800 mb-3 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Masculino
            </h4>
            <div className="space-y-2">
              {dashboardData.stats.inventoryByGender.M.map((item) => (
                <div key={`M-${item.shirt_size}`} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                  <span className="font-medium text-gray-700">Talla {item.shirt_size}</span>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-gray-600">Stock: {item.stock}</span>
                    <span className="text-yellow-600">Reservado: {item.reserved}</span>
                    <span className={`font-medium ${item.available > 5 ? 'text-green-600' : 'text-red-600'}`}>
                      Disponible: {item.available}
                    </span>
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
              {dashboardData.stats.inventoryByGender.F.map((item) => (
                <div key={`F-${item.shirt_size}`} className="flex items-center justify-between p-2 bg-pink-50 rounded">
                  <span className="font-medium text-gray-700">Talla {item.shirt_size}</span>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-gray-600">Stock: {item.stock}</span>
                    <span className="text-yellow-600">Reservado: {item.reserved}</span>
                    <span className={`font-medium ${item.available > 5 ? 'text-green-600' : 'text-red-600'}`}>
                      Disponible: {item.available}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => window.location.href = '/admin/runners'}
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all duration-200 group"
          >
            <Users className="w-5 h-5 mr-2 text-gray-600 group-hover:text-orange-600" />
            <span className="text-sm font-medium text-gray-700 group-hover:text-orange-700">Ver Corredores</span>
          </button>
          
          <button 
            onClick={() => window.location.href = '/admin/payments'}
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all duration-200 group"
          >
            <CreditCard className="w-5 h-5 mr-2 text-gray-600 group-hover:text-green-600" />
            <span className="text-sm font-medium text-gray-700 group-hover:text-green-700">Gestionar Pagos</span>
          </button>
          
          <button 
            onClick={() => window.location.href = '/admin/inventory'}
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group"
          >
            <Package className="w-5 h-5 mr-2 text-gray-600 group-hover:text-purple-600" />
            <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700">Actualizar Inventario</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {dashboardData.pendingPayments > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800">
                Atención: Pagos Pendientes
              </h4>
              <p className="text-sm text-yellow-700 mt-1">
                Tienes {dashboardData.pendingPayments} pagos pendientes por revisar
                {dashboardData.stats.paymentStats.procesando > 0 && (
                  <span> y {dashboardData.stats.paymentStats.procesando} en proceso de verificación</span>
                )}.
                {dashboardData.stats.groupStats.withReservation > 0 && (
                  <span> Hay {dashboardData.stats.groupStats.withReservation} grupos con reservas activas.</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Low Stock Alert */}
      {dashboardData.availableStock < 50 && dashboardData.availableStock > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center">
            <Package className="w-5 h-5 text-orange-600 mr-2 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-orange-800">
                Stock Bajo
              </h4>
              <p className="text-sm text-orange-700 mt-1">
                Quedan solo {dashboardData.availableStock} camisetas disponibles en total. 
                Revisa el inventario por talla y género para identificar las tallas críticas.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;