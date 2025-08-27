import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  FileText,
  Calculator,
  Building,
  Users,
  Shirt,
  Calendar,
  Download,
  Eye,
  Settings,
  Activity,
  BarChart3
} from 'lucide-react';

// Mock useAuth hook for demo
const useAuth = () => ({
  user: {
    email: 'admin@example.com',
    role: 'admin',
    permissions: ['payments:manage', 'runners:manage', 'tickets:manage']
  }
});

interface DashboardData {
  // Pagos
  pendingPayments: number;
  confirmedPayments: number;
  rejectedPayments: number;
  processingPayments: number;
  totalRevenueUSD: number;
  totalRevenueBs: number;
  exchangeRate: number;
  
  // Corredores
  totalRunners: number;
  confirmedRunners: number;
  pendingRunners: number;
  
  // Tickets
  totalTickets: number;
  soldTickets: number;
  availableTickets: number;
  
  // Inventario
  lowStockAlerts: number;
  outOfStockSizes: string[];
  
  // Datos detallados
  pendingValidations: Array<{
    id: string;
    reference_number: string;
    amount: string;
    user_name: string;
    user_email: string;
    created_at: string;
    type: 'payment' | 'runner' | 'ticket';
  }>;
  
  recentTransactions: Array<{
    id: string;
    amount_usd: string;
    status: string;
    payment_method: string;
    created_at: string;
    type: 'payment' | 'ticket';
  }>;
}

const AdministracionDashboard: React.FC = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'runners' | 'tickets' | 'inventory'>('overview');

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 2 * 60 * 1000); // Cada 2 minutos
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      
      // Simular datos de múltiples endpoints
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data - En producción esto vendría de múltiples APIs
      const mockData: DashboardData = {
        // Pagos
        pendingPayments: 12,
        confirmedPayments: 145,
        rejectedPayments: 8,
        processingPayments: 5,
        totalRevenueUSD: 8250.50,
        totalRevenueBs: 297420.75,
        exchangeRate: 36.05,
        
        // Corredores
        totalRunners: 234,
        confirmedRunners: 189,
        pendingRunners: 45,
        
        // Tickets
        totalTickets: 1250,
        soldTickets: 890,
        availableTickets: 360,
        
        // Inventario
        lowStockAlerts: 3,
        outOfStockSizes: ['XS', 'XXL'],
        
        pendingValidations: [
          {
            id: '1',
            reference_number: 'REF001',
            amount: '$55.00',
            user_name: 'Juan Pérez',
            user_email: 'juan@email.com',
            created_at: new Date().toISOString(),
            type: 'payment'
          },
          {
            id: '2',
            reference_number: 'T-12345',
            amount: '$35.00',
            user_name: 'María García',
            user_email: 'maria@email.com',
            created_at: new Date().toISOString(),
            type: 'ticket'
          }
        ],
        
        recentTransactions: [
          {
            id: '1',
            amount_usd: '55.00',
            status: 'approved',
            payment_method: 'pago_movil_p2c',
            created_at: new Date().toISOString(),
            type: 'payment'
          },
          {
            id: '2',
            amount_usd: '35.00',
            status: 'pending',
            payment_method: 'zelle',
            created_at: new Date().toISOString(),
            type: 'ticket'
          }
        ]
      };

      setDashboardData(mockData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchDashboardData();
  };

  const navigateToSection = (section: string) => {
    // En producción, usar router.push() o window.location.href
    console.log(`Navegando a: ${section}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Cargando panel de administración...</p>
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
            className="mt-4 w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  const mainStatCards = [
    {
      title: 'Pagos Pendientes',
      value: dashboardData.pendingPayments,
      icon: Clock,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      description: 'Requieren validación',
      change: '+2 desde ayer',
      route: '/admin/payments?status=pending'
    },
    {
      title: 'Pagos Confirmados',
      value: dashboardData.confirmedPayments,
      icon: CheckCircle,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50',
      description: `$${dashboardData.totalRevenueUSD.toLocaleString()} USD`,
      change: '+15 hoy',
      route: '/admin/payments?status=confirmed'
    },
    {
      title: 'Corredores Activos',
      value: dashboardData.confirmedRunners,
      icon: Users,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: `${dashboardData.pendingRunners} pendientes`,
      change: '+8 hoy',
      route: '/admin/runners'
    },
    {
      title: 'Tickets Vendidos',
      value: dashboardData.soldTickets,
      icon: FileText,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: `${dashboardData.availableTickets} disponibles`,
      change: '+23 hoy',
      route: '/admin/tickets'
    }
  ];

  const TabButton: React.FC<{ 
    tab: string; 
    label: string; 
    icon: React.ComponentType<any>;
    isActive: boolean;
    onClick: () => void;
  }> = ({ tab, label, icon: Icon, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center px-4 py-2 rounded-lg transition-all duration-200 ${
        isActive 
          ? 'bg-blue-600 text-white shadow-md' 
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon className="w-4 h-4 mr-2" />
      {label}
    </button>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
          <p className="text-gray-600 mt-1">Gestión integral del sistema</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            Actualizado: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Alertas importantes */}
      {(dashboardData.pendingPayments > 0 || dashboardData.lowStockAlerts > 0) && (
        <div className="space-y-3">
          {dashboardData.pendingPayments > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-yellow-800">
                    {dashboardData.pendingPayments} Pagos Pendientes de Validación
                  </h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Hay pagos esperando validación. Revisa las referencias y confirma los pagos válidos.
                  </p>
                  <button
                    onClick={() => navigateToSection('/admin/payments?status=pending')}
                    className="mt-2 text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
                  >
                    Ir a validar pagos →
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {dashboardData.lowStockAlerts > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start">
                <Shirt className="w-5 h-5 text-orange-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-orange-800">
                    Stock Bajo en {dashboardData.lowStockAlerts} Tallas
                  </h4>
                  <p className="text-sm text-orange-700 mt-1">
                    Tallas agotadas: {dashboardData.outOfStockSizes.join(', ')}
                  </p>
                  <button
                    onClick={() => navigateToSection('/admin/inventory')}
                    className="mt-2 text-sm font-medium text-orange-800 hover:text-orange-900 underline"
                  >
                    Ver inventario →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {mainStatCards.map((card) => (
          <div 
            key={card.title} 
            className={`${card.bgColor} rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-200 cursor-pointer`}
            onClick={() => navigateToSection(card.route)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{card.value.toLocaleString()}</p>
                <p className="text-sm text-gray-600 mt-1">{card.description}</p>
                <p className="text-xs text-green-600 font-medium mt-1">{card.change}</p>
              </div>
              <div className={`p-3 rounded-full ${card.color}`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs de navegación */}
      <div className="flex flex-wrap gap-2 bg-white p-4 rounded-lg shadow-sm border">
        <TabButton 
          tab="overview" 
          label="Resumen" 
          icon={BarChart3}
          isActive={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
        />
        <TabButton 
          tab="payments" 
          label="Pagos" 
          icon={CreditCard}
          isActive={activeTab === 'payments'}
          onClick={() => setActiveTab('payments')}
        />
        <TabButton 
          tab="runners" 
          label="Corredores" 
          icon={Users}
          isActive={activeTab === 'runners'}
          onClick={() => setActiveTab('runners')}
        />
        <TabButton 
          tab="tickets" 
          label="Tickets" 
          icon={FileText}
          isActive={activeTab === 'tickets'}
          onClick={() => setActiveTab('tickets')}
        />
        <TabButton 
          tab="inventory" 
          label="Inventario" 
          icon={Shirt}
          isActive={activeTab === 'inventory'}
          onClick={() => setActiveTab('inventory')}
        />
      </div>

      {/* Contenido por tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Resumen de ingresos */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Resumen de Ingresos</h3>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Total en USD</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${dashboardData.totalRevenueUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Total en Bs</p>
                <p className="text-xl font-semibold text-gray-900">
                  Bs. {dashboardData.totalRevenueBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Tasa de cambio: {dashboardData.exchangeRate.toFixed(2)} Bs/USD
                </p>
                <button
                  onClick={() => navigateToSection('/admin/exchange-rates')}
                  className="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
                >
                  Actualizar tasa →
                </button>
              </div>
            </div>
          </div>

          {/* Validaciones pendientes */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Validaciones Pendientes</h3>
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            {dashboardData.pendingValidations.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {dashboardData.pendingValidations.map((validation) => (
                  <div key={validation.id} className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 hover:bg-yellow-100 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{validation.user_name}</p>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            validation.type === 'payment' ? 'bg-blue-100 text-blue-800' :
                            validation.type === 'ticket' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {validation.type === 'payment' ? 'Pago' : 
                             validation.type === 'ticket' ? 'Ticket' : 'Corredor'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{validation.user_email}</p>
                        <p className="text-xs text-gray-600">Ref: {validation.reference_number}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">{validation.amount}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(validation.created_at).toLocaleDateString()}
                        </p>
                        <button
                          onClick={() => navigateToSection(`/admin/${validation.type}s/${validation.id}`)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
                        >
                          Ver detalles
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-500">No hay validaciones pendientes</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Acciones rápidas mejoradas */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Acciones Rápidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { icon: CreditCard, label: 'Gestionar Pagos', route: '/admin/payments', color: 'blue' },
            { icon: Clock, label: 'Validar Pendientes', route: '/admin/payments/pending', color: 'yellow' },
            { icon: Users, label: 'Ver Corredores', route: '/admin/runners', color: 'green' },
            { icon: FileText, label: 'Gestionar Tickets', route: '/admin/tickets', color: 'purple' },
            { icon: Shirt, label: 'Inventario', route: '/admin/inventory', color: 'orange' },
            { icon: Calculator, label: 'Tasas de Cambio', route: '/admin/exchange-rates', color: 'indigo' },
            { icon: BarChart3, label: 'Reportes', route: '/admin/reports', color: 'gray' },
            { icon: Settings, label: 'Configuración', route: '/admin/settings', color: 'gray' }
          ].map((action) => (
            <button 
              key={action.route}
              onClick={() => navigateToSection(action.route)}
              className={`flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-${action.color}-500 hover:bg-${action.color}-50 transition-all duration-200 group`}
            >
              <action.icon className={`w-8 h-8 mb-3 text-gray-600 group-hover:text-${action.color}-600`} />
              <span className={`text-sm font-medium text-gray-700 group-hover:text-${action.color}-700 text-center`}>
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Transacciones recientes */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Transacciones Recientes</h3>
          <button
            onClick={() => navigateToSection('/admin/transactions')}
            className="text-sm text-blue-600 hover:text-blue-800 underline flex items-center"
          >
            Ver todas <Eye className="w-4 h-4 ml-1" />
          </button>
        </div>
        
        {dashboardData.recentTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Tipo</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Monto</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Método</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Estado</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dashboardData.recentTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        transaction.type === 'payment' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {transaction.type === 'payment' ? 'Pago' : 'Ticket'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">${transaction.amount_usd}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{transaction.payment_method}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        transaction.status === 'approved' ? 'bg-green-100 text-green-800' :
                        transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {transaction.status === 'approved' ? 'Aprobado' :
                         transaction.status === 'pending' ? 'Pendiente' : 'Rechazado'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => navigateToSection(`/admin/${transaction.type}s/${transaction.id}`)}
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No hay transacciones recientes</p>
          </div>
        )}
      </div>

      {/* Stats secundarios */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Corredores</h4>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total registrados</span>
              <span className="font-semibold">{dashboardData.totalRunners}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Pagos confirmados</span>
              <span className="font-semibold text-green-600">{dashboardData.confirmedRunners}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Pendientes</span>
              <span className="font-semibold text-yellow-600">{dashboardData.pendingRunners}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Tasa de confirmación</span>
                <span className="text-xs font-medium text-green-600">
                  {Math.round((dashboardData.confirmedRunners / dashboardData.totalRunners) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Tickets de Concierto</h4>
            <FileText className="w-5 h-5 text-purple-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Capacidad total</span>
              <span className="font-semibold">{dashboardData.totalTickets}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Vendidos</span>
              <span className="font-semibold text-purple-600">{dashboardData.soldTickets}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Disponibles</span>
              <span className="font-semibold text-green-600">{dashboardData.availableTickets}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(dashboardData.soldTickets / dashboardData.totalTickets) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round((dashboardData.soldTickets / dashboardData.totalTickets) * 100)}% vendido
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Estado del Sistema</h4>
            <Activity className="w-5 h-5 text-green-600" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Gateway de Pagos</span>
              <span className="flex items-center text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                Activo
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Base de Datos</span>
              <span className="flex items-center text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                Conectada
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Email Service</span>
              <span className="flex items-center text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                Operativo
              </span>
            </div>
            <div className="pt-2 border-t">
              <button
                onClick={() => navigateToSection('/admin/system-status')}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Ver estado completo →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de exportaciones */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Exportar Datos</h3>
          <Download className="w-5 h-5 text-gray-600" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Reporte de Pagos', route: '/admin/exports/payments', description: 'Excel con todas las transacciones' },
            { label: 'Lista de Corredores', route: '/admin/exports/runners', description: 'PDF con corredores confirmados' },
            { label: 'Reporte de Tickets', route: '/admin/exports/tickets', description: 'Excel con ventas de tickets' },
            { label: 'Reporte Completo', route: '/admin/exports/complete', description: 'Todos los datos del sistema' }
          ].map((exportOption) => (
            <button
              key={exportOption.route}
              onClick={() => navigateToSection(exportOption.route)}
              className="p-4 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 text-left"
            >
              <div className="flex items-center mb-2">
                <Download className="w-4 h-4 text-gray-600 mr-2" />
                <span className="font-medium text-gray-900">{exportOption.label}</span>
              </div>
              <p className="text-xs text-gray-600">{exportOption.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdministracionDashboard;