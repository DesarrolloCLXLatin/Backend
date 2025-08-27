import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  BarChart3, 
  Download, 
  Users, 
  CreditCard, 
  Package,
  Calendar,
  TrendingUp,
  PieChart,
  UserCheck,
  Hash,
  RefreshCw,
  FileText,
  Activity,
  Shirt  // ← Agregar esta línea
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ChartData {
  date: string;
  registrations: number;
  confirmed: number;
  pending: number;
}

interface PaymentMethodData {
  [key: string]: number;
}

interface SizeDistributionData {
  M: { [size: string]: number };
  F: { [size: string]: number };
}

interface AgeDistributionData {
  [range: string]: number;
}

interface AnalyticsData {
  dailyRegistrations: ChartData[];
  paymentMethods: PaymentMethodData;
  sizeDistributionByGender: SizeDistributionData;
  ageDistribution: AgeDistributionData;
}

interface DashboardStats {
  totalRunners: number;
  totalGroups: number;
  confirmedPayments: number;
  pendingPayments: number;
  totalRevenueUSD: number;
  totalRevenueBs: number;
  exchangeRate: number;
  pricePerRunner: number;
  inventoryByGender: {
    M: Array<{ shirt_size: string; available: number; reserved: number }>;
    F: Array<{ shirt_size: string; available: number; reserved: number }>;
  };
  genderDistribution: {
    M: number;
    F: number;
  };
}

const ReportsManagement: React.FC = () => {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState({
    days: 30
  });

  useEffect(() => {
    fetchAllData();
  }, [dateRange]);

  const fetchAllData = async () => {
    await Promise.all([
      fetchAnalytics(),
      fetchDashboardStats()
    ]);
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard/charts?days=${dateRange.days}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      } else {
        toast.error('Error al cargar análisis');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
    toast.success('Datos actualizados');
  };

  const exportData = async (type: 'runners' | 'groups' | 'inventory' | 'payments') => {
    try {
      let endpoint = '';
      let filename = '';

      switch (type) {
        case 'runners':
          endpoint = '/api/runners?limit=10000';
          filename = `corredores_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        case 'groups':
          endpoint = '/api/groups?limit=10000';
          filename = `grupos_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        case 'payments':
          endpoint = '/api/payments?limit=10000';
          filename = `pagos_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        case 'inventory':
          endpoint = '/api/inventory';
          filename = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
          break;
      }

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        let csvContent = '';
        
        switch (type) {
          case 'runners':
            csvContent = generateRunnersCSV(data.runners || []);
            break;
          case 'groups':
            csvContent = generateGroupsCSV(data.groups || []);
            break;
          case 'inventory':
            csvContent = generateInventoryCSV(data);
            break;
          case 'payments':
            csvContent = generatePaymentsCSV(data.payments || data);
            break;
        }
        
        downloadCSV(csvContent, filename);
        toast.success(`Reporte de ${type} exportado correctamente`);
      } else {
        toast.error(`Error al exportar ${type}`);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Error al exportar datos');
    }
  };

  const generateRunnersCSV = (runners: any[]) => {
    if (!runners.length) return '';
    
    const headers = [
      'Número Corredor', 'Código Grupo', 'Nombre Completo', 'Tipo ID', 'Identificación',
      'Fecha Nacimiento', 'Edad', 'Género', 'Email', 'Teléfono', 'Talla',
      'Estado Pago', 'Método Pago', 'Email Registrante', 'Fecha Registro'
    ];
    
    const csvRows = [headers.join(',')];
    
    runners.forEach(runner => {
      const birthDate = new Date(runner.birth_date);
      const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      
      const row = [
        runner.runner_number || 'N/A',
        runner.group?.group_code || 'N/A',
        `"${runner.full_name}"`,
        runner.identification_type,
        runner.identification,
        birthDate.toLocaleDateString(),
        age,
        runner.gender,
        `"${runner.email}"`,
        `"${runner.phone}"`,
        runner.shirt_size,
        runner.payment_status,
        runner.payment_method,
        `"${runner.group?.registrant_email || 'N/A'}"`,
        new Date(runner.created_at).toLocaleDateString()
      ];
      
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  };

  const generateGroupsCSV = (groups: any[]) => {
    if (!groups.length) return '';
    
    const headers = [
      'Código Grupo', 'Total Corredores', 'Email Registrante', 'Teléfono',
      'Estado Pago', 'Método Pago', 'Referencia', 'Fecha Registro',
      'Fecha Confirmación', 'Reserva Expira', 'Nombres Corredores'
    ];
    
    const csvRows = [headers.join(',')];
    
    groups.forEach(group => {
      const row = [
        group.group_code,
        group.total_runners,
        `"${group.registrant_email}"`,
        `"${group.registrant_phone}"`,
        group.payment_status,
        group.payment_method,
        `"${group.payment_reference || 'N/A'}"`,
        new Date(group.created_at).toLocaleDateString(),
        group.payment_confirmed_at ? new Date(group.payment_confirmed_at).toLocaleDateString() : 'N/A',
        group.reserved_until ? new Date(group.reserved_until).toLocaleDateString() : 'N/A',
        `"${group.runner_names?.join(', ') || 'N/A'}"`
      ];
      
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  };

  const generateInventoryCSV = (inventory: any[]) => {
    if (!inventory.length) return '';
    
    const headers = [
      'Talla', 'Género', 'Stock Total', 'Reservado', 'Disponible', 'Estado'
    ];
    
    const csvRows = [headers.join(',')];
    
    inventory.forEach(item => {
      const status = item.available <= 0 ? 'Agotado' : 
                    item.available <= 5 ? 'Stock Bajo' : 'Disponible';
      
      const row = [
        item.shirt_size,
        item.gender,
        item.stock,
        item.reserved,
        item.available,
        status
      ];
      
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  };

  const generatePaymentsCSV = (payments: any[]) => {
    if (!payments.length) return '';
    
    const headers = [
      'ID Pago', 'Código Grupo', 'Método', 'Estado', 'Monto USD', 'Monto Bs',
      'Referencia', 'Fecha Pago', 'Confirmado Por', 'Fecha Confirmación'
    ];
    
    const csvRows = [headers.join(',')];
    
    payments.forEach(payment => {
      const row = [
        payment.id || 'N/A',
        payment.group_code || 'N/A',
        payment.payment_method,
        payment.status || payment.payment_status,
        payment.amount_usd || payment.amount || '0',
        payment.amount_bs || '0',
        `"${payment.reference || payment.payment_reference || 'N/A'}"`,
        new Date(payment.created_at).toLocaleDateString(),
        payment.confirmed_by || 'N/A',
        payment.confirmed_at ? new Date(payment.confirmed_at).toLocaleDateString() : 'N/A'
      ];
      
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      'tienda': 'bg-orange-500',
      'zelle': 'bg-purple-500',
      'transferencia_nacional': 'bg-indigo-500',
      'transferencia_internacional': 'bg-blue-500',
      'paypal': 'bg-sky-500',
      'pago_movil_p2c': 'bg-green-500'
    };
    return colors[method] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reportes y Análisis</h1>
        <div className="flex items-center space-x-3">
          <select
            value={dateRange.days}
            onChange={(e) => setDateRange({ days: parseInt(e.target.value) })}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={60}>Últimos 60 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-orange-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Corredores</h3>
                <p className="text-sm text-gray-600">Lista completa</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => exportData('runners')}
            className="w-full flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Hash className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Grupos</h3>
                <p className="text-sm text-gray-600">Registros grupales</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => exportData('groups')}
            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <CreditCard className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Pagos</h3>
                <p className="text-sm text-gray-600">Transacciones</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => exportData('payments')}
            className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Inventario</h3>
                <p className="text-sm text-gray-600">Stock por género</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => exportData('inventory')}
            className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Summary Statistics */}
      {dashboardStats && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center mb-6">
            <TrendingUp className="w-6 h-6 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Resumen Estadístico</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {dashboardStats.totalGroups}
              </div>
              <div className="text-sm text-orange-700">Grupos</div>
            </div>

            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {dashboardStats.totalRunners}
              </div>
              <div className="text-sm text-blue-700">Corredores</div>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {dashboardStats.confirmedPayments}
              </div>
              <div className="text-sm text-green-700">Confirmados</div>
            </div>

            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {dashboardStats.pendingPayments}
              </div>
              <div className="text-sm text-yellow-700">Pendientes</div>
            </div>

            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                ${dashboardStats.totalRevenueUSD.toLocaleString()}
              </div>
              <div className="text-sm text-purple-700">Ingresos USD</div>
            </div>

            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">
                {dashboardStats.genderDistribution.M}/{dashboardStats.genderDistribution.F}
              </div>
              <div className="text-sm text-indigo-700">M/F</div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Section */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Methods Chart */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center mb-4">
              <PieChart className="w-6 h-6 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Distribución por Método de Pago</h3>
            </div>
            
            <div className="space-y-3">
              {Object.entries(analytics.paymentMethods).map(([method, count]) => {
                const total = Object.values(analytics.paymentMethods).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? (count / total) * 100 : 0;
                
                return (
                  <div key={method} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full ${getMethodColor(method)} mr-2`}></div>
                        <span className="text-sm font-medium">{getPaymentMethodLabel(method)}</span>
                      </div>
                      <span className="text-sm text-gray-600">{count} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`${getMethodColor(method)} h-2 rounded-full transition-all duration-300`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Age Distribution */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center mb-4">
              <UserCheck className="w-6 h-6 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Distribución por Edad</h3>
            </div>
            
            <div className="space-y-3">
              {Object.entries(analytics.ageDistribution).map(([range, count]) => {
                const total = Object.values(analytics.ageDistribution).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? (count / total) * 100 : 0;
                
                return (
                  <div key={range} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-sm font-medium w-20">{range} años</span>
                      <div className="w-32 bg-gray-200 rounded-full h-2 mx-3">
                        <div 
                          className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-sm text-gray-600">{count} ({percentage.toFixed(1)}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Size Distribution by Gender */}
          <div className="bg-white rounded-lg shadow-sm border p-6 lg:col-span-2">
            <div className="flex items-center mb-4">
              <Shirt className="w-6 h-6 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Distribución de Tallas por Género</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Masculino */}
              <div>
                <h4 className="text-sm font-medium text-blue-800 mb-3">Masculino</h4>
                <div className="space-y-2">
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(size => {
                    const count = analytics.sizeDistributionByGender.M[size] || 0;
                    const total = Object.values(analytics.sizeDistributionByGender.M).reduce((a, b) => a + b, 0);
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    
                    return (
                      <div key={`M-${size}`} className="flex items-center justify-between">
                        <span className="text-sm font-medium w-12">Talla {size}</span>
                        <div className="flex-1 mx-3">
                          <div className="w-full bg-blue-100 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className="text-sm text-gray-600 w-16 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Femenino */}
              <div>
                <h4 className="text-sm font-medium text-pink-800 mb-3">Femenino</h4>
                <div className="space-y-2">
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(size => {
                    const count = analytics.sizeDistributionByGender.F[size] || 0;
                    const total = Object.values(analytics.sizeDistributionByGender.F).reduce((a, b) => a + b, 0);
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    
                    return (
                      <div key={`F-${size}`} className="flex items-center justify-between">
                        <span className="text-sm font-medium w-12">Talla {size}</span>
                        <div className="flex-1 mx-3">
                          <div className="w-full bg-pink-100 rounded-full h-2">
                            <div 
                              className="bg-pink-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className="text-sm text-gray-600 w-16 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Daily Registrations Chart */}
          <div className="bg-white rounded-lg shadow-sm border p-6 lg:col-span-2">
            <div className="flex items-center mb-4">
              <BarChart3 className="w-6 h-6 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Registros Diarios</h3>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {analytics.dailyRegistrations.map((day) => (
                <div key={day.date} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(day.date).toLocaleDateString('es-ES', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div className="text-xs text-gray-600">
                      {day.confirmed} confirmados, {day.pending} pendientes
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-900">{day.registrations}</span>
                      <p className="text-xs text-gray-500">total</p>
                    </div>
                    <div className="w-24">
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${day.registrations > 0 ? (day.confirmed / day.registrations) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${day.registrations > 0 ? (day.pending / day.registrations) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inventory Summary by Gender */}
      {dashboardStats && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center mb-4">
            <Package className="w-6 h-6 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Estado del Inventario por Género</h3>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Masculino */}
            <div>
              <h4 className="text-sm font-medium text-blue-800 mb-3">Masculino</h4>
              <div className="space-y-2">
                {dashboardStats.inventoryByGender.M.map((item) => (
                  <div key={`inv-M-${item.shirt_size}`} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                    <span className="text-sm font-medium">Talla {item.shirt_size}</span>
                    <div className="flex items-center space-x-3 text-sm">
                      <span className="text-gray-600">Reservado: {item.reserved}</span>
                      <span className={`font-medium ${
                        item.available > 10 ? 'text-green-600' : 
                        item.available > 5 ? 'text-yellow-600' : 
                        'text-red-600'
                      }`}>
                        Disponible: {item.available}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Femenino */}
            <div>
              <h4 className="text-sm font-medium text-pink-800 mb-3">Femenino</h4>
              <div className="space-y-2">
                {dashboardStats.inventoryByGender.F.map((item) => (
                  <div key={`inv-F-${item.shirt_size}`} className="flex items-center justify-between p-2 bg-pink-50 rounded">
                    <span className="text-sm font-medium">Talla {item.shirt_size}</span>
                    <div className="flex items-center space-x-3 text-sm">
                      <span className="text-gray-600">Reservado: {item.reserved}</span>
                      <span className={`font-medium ${
                        item.available > 10 ? 'text-green-600' : 
                        item.available > 5 ? 'text-yellow-600' : 
                        'text-red-600'
                      }`}>
                        Disponible: {item.available}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsManagement;