import React, { useState, useEffect } from 'react';
import { 
  Users, 
  TrendingUp,
  DollarSign,
  Activity,
  Package,
  BarChart3,
  FileText,
  PieChart,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Target
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface BossDashboardData {
  totalRunners: number;
  confirmedPayments: number;
  pendingPayments: number;
  totalRevenue: number;
  availableStock: number;
  
  stats: {
    totalGroups: number;
    totalRevenueUSD: number;
    totalRevenueBs: number;
    exchangeRate: number;
    weeklyTrend: Array<{
      date: string;
      total: number;
      confirmed: number;
    }>;
    paymentMethods: Record<string, number>;
    genderDistribution: {
      M: number;
      F: number;
    };
    ageDistribution?: Record<string, number>;
    topSellers?: Array<{
      name: string;
      totalSales: number;
    }>;
  };
}

const BossDashboard: React.FC = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<BossDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    fetchDashboardStats();
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
        const errorData = await response.json();
        setError(errorData.message || 'Error al cargar las estadísticas');
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        <p className="mt-4 text-gray-600">Cargando estadísticas ejecutivas...</p>
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
            onClick={handleRefresh}
            className="mt-4 w-full bg-red-600 text-black px-4 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  const calculateGrowth = () => {
    const trend = dashboardData.stats.weeklyTrend;
    if (trend.length < 2) return 0;
    const lastWeek = trend[trend.length - 8]?.total || 0;
    const thisWeek = trend[trend.length - 1]?.total || 0;
    return lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;
  };

  const growth = calculateGrowth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel Ejecutivo</h1>
          <p className="text-gray-600 mt-1">Visión general del evento</p>
        </div>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-8 h-8 text-orange-600" />
            <span className={`text-sm font-medium ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Meta de Inscripciones</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{dashboardData.totalRunners}</p>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-orange-600 h-2 rounded-full" 
                style={{ width: `${Math.min((dashboardData.totalRunners / 2000) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{((dashboardData.totalRunners / 2000) * 100).toFixed(1)}% de 2000</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            ${dashboardData.stats.totalRevenueUSD.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Bs. {dashboardData.stats.totalRevenueBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-sm font-medium text-gray-600">Tasa de Conversión</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {dashboardData.totalRunners > 0 
              ? ((dashboardData.confirmedPayments / dashboardData.totalRunners) * 100).toFixed(1)
              : 0}%
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {dashboardData.confirmedPayments} confirmados de {dashboardData.totalRunners}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-sm font-medium text-gray-600">Capacidad Restante</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {dashboardData.availableStock}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {((dashboardData.availableStock / 2000) * 100).toFixed(1)}% disponible
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button 
          onClick={() => window.location.href = '/register-runner'}
          className="flex items-center justify-center p-6 bg-gradient-to-r from-[#F08772] to-[#F08772] rounded-lg text-black hover:from-[#F08772] hover:to-orange-400 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Calendar className="w-6 h-6 mr-3" />
          <span className="font-medium">Registro de Corredores</span>
        </button>
        
        <button 
          onClick={() => window.location.href = '/runners'}
          className="flex items-center justify-center p-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-black hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Users className="w-6 h-6 mr-3" />
          <span className="font-medium">Gestión de Corredores</span>
        </button>
        
        <button 
          onClick={() => window.location.href = '/reports'}
          className="flex items-center justify-center p-6 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-black hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <FileText className="w-6 h-6 mr-3" />
          <span className="font-medium">Ver Reportes Detallados</span>
        </button>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender Distribution */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <PieChart className="w-5 h-5 mr-2 text-gray-600" />
            Distribución por Género
          </h3>
          <div className="flex items-center justify-center space-x-8">
            <div className="text-center">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {dashboardData.stats.genderDistribution.M}
                    </p>
                    <p className="text-xs text-gray-600">Masculino</p>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm font-medium text-gray-700">
                {((dashboardData.stats.genderDistribution.M / dashboardData.totalRunners) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-pink-100 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-pink-600">
                      {dashboardData.stats.genderDistribution.F}
                    </p>
                    <p className="text-xs text-gray-600">Femenino</p>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm font-medium text-gray-700">
                {((dashboardData.stats.genderDistribution.F / dashboardData.totalRunners) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-gray-600" />
            Métodos de Pago Preferidos
          </h3>
          <div className="space-y-3">
            {Object.entries(dashboardData.stats.paymentMethods)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 5)
              .map(([method, count]) => {
                const total = Object.values(dashboardData.stats.paymentMethods).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? (count / total) * 100 : 0;
                
                return (
                  <div key={method} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {method.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center">
                      <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                        <div 
                          className="bg-gradient-to-r from-orange-500 to-orange-600 h-2 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-12 text-right">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Weekly Trend */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-gray-600" />
          Tendencia Semanal
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {dashboardData.stats.weeklyTrend.slice(-7).map((day, index) => (
            <div key={index} className="text-center">
              <p className="text-xs text-gray-600 mb-1">
                {new Date(day.date).toLocaleDateString('es', { weekday: 'short' })}
              </p>
              <div className="bg-gray-100 rounded p-2">
                <p className="text-lg font-bold text-gray-900">{day.total}</p>
                <p className="text-xs text-green-600">+{day.confirmed}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BossDashboard;