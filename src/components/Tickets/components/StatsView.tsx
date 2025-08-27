import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Package,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Zap,
  Award,
  ShoppingBag,
  CreditCard
} from 'lucide-react';
import { ConcertTicket, TicketInventory } from '../../../types';
import { useTicketStatistics } from '../hooks/useTicketStatistics';
import StatsCharts from './StatsCharts';

interface StatsViewProps {
  tickets: ConcertTicket[];
  inventory: TicketInventory | null;
  venueStats: any;
  showCharts?: boolean;
  variant?: 'compact' | 'full' | 'dashboard';
}

const StatsView: React.FC<StatsViewProps> = ({
  tickets,
  inventory,
  venueStats,
  showCharts = true,
  variant = 'full'
}) => {
  const {
    emailStats,
    paymentMethodStats,
    statusStats,
    revenueStats,
    dailyStats
  } = useTicketStatistics(tickets);

  // Calcular estadísticas adicionales
  const additionalStats = useMemo(() => {
    const now = new Date();
    const thisMonth = tickets.filter(t => {
      const ticketDate = new Date(t.created_at);
      return ticketDate.getMonth() === now.getMonth() && 
             ticketDate.getFullYear() === now.getFullYear();
    });

    const lastMonth = tickets.filter(t => {
      const ticketDate = new Date(t.created_at);
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1);
      return ticketDate.getMonth() === lastMonthDate.getMonth() && 
             ticketDate.getFullYear() === lastMonthDate.getFullYear();
    });

    const growthRate = lastMonth.length > 0 
      ? ((thisMonth.length - lastMonth.length) / lastMonth.length) * 100 
      : 0;

    const conversionRate = tickets.length > 0
      ? (statusStats.confirmado / tickets.length) * 100
      : 0;

    const averageProcessingTime = tickets
      .filter(t => t.payment_status === 'confirmado' && t.updated_at)
      .reduce((acc, ticket) => {
        const created = new Date(ticket.created_at).getTime();
        const updated = new Date(ticket.updated_at!).getTime();
        return acc + (updated - created);
      }, 0) / (statusStats.confirmado || 1);

    return {
      thisMonthSales: thisMonth.length,
      lastMonthSales: lastMonth.length,
      growthRate,
      conversionRate,
      averageProcessingTime: averageProcessingTime / (1000 * 60 * 60), // En horas
      occupancyRate: venueStats?.venue?.occupancyRate || 0
    };
  }, [tickets, statusStats, venueStats]);

  if (variant === 'compact') {
    return <CompactStats stats={revenueStats} dailyStats={dailyStats} />;
  }

  if (variant === 'dashboard') {
    return (
      <DashboardView
        revenueStats={revenueStats}
        statusStats={statusStats}
        additionalStats={additionalStats}
        inventory={inventory}
        venueStats={venueStats}
        emailStats={emailStats}
        showCharts={showCharts}
        tickets={tickets}
        paymentMethodStats={paymentMethodStats}
      />
    );
  }

  // Variant 'full'
  return (
    <div className="space-y-6">
      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Ingresos Totales"
          value={`$${revenueStats.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          trend={additionalStats.growthRate}
          color="green"
        />
        
        <KPICard
          title="Entradas Vendidas"
          value={statusStats.confirmado}
          subtitle={`de ${inventory?.total_tickets || 5270}`}
          icon={Ticket}
          progress={(statusStats.confirmado / (inventory?.total_tickets || 5270)) * 100}
          color="blue"
        />
        
        <KPICard
          title="Tasa de Conversión"
          value={`${additionalStats.conversionRate.toFixed(1)}%`}
          icon={Target}
          color="purple"
        />
        
        <KPICard
          title="Ocupación"
          value={`${additionalStats.occupancyRate}%`}
          icon={Users}
          progress={additionalStats.occupancyRate}
          color="orange"
        />
      </div>

      {/* Estadísticas Detalladas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Estado de Pagos */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Estado de Pagos
          </h3>
          <div className="space-y-3">
            <StatItem
              label="Confirmados"
              value={statusStats.confirmado}
              icon={CheckCircle}
              color="text-green-600"
            />
            <StatItem
              label="Pendientes"
              value={statusStats.pendiente}
              icon={Clock}
              color="text-yellow-600"
            />
            <StatItem
              label="Rechazados"
              value={statusStats.rechazado}
              icon={XCircle}
              color="text-red-600"
            />
            <StatItem
              label="Canjeados"
              value={statusStats.canjeado}
              icon={Award}
              color="text-purple-600"
            />
          </div>
        </div>

        {/* Ventas del Día */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Ventas de Hoy
          </h3>
          <div className="space-y-3">
            <div className="text-3xl font-bold text-gray-900">
              {dailyStats.ticketsSoldToday}
            </div>
            <div className="text-sm text-gray-600">
              Entradas vendidas hoy
            </div>
            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Ingresos del día</span>
                <span className="font-semibold text-green-600">
                  ${dailyStats.revenueToday.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pendientes hoy</span>
              <span className="font-semibold text-yellow-600">
                {dailyStats.pendingToday}
              </span>
            </div>
          </div>
        </div>

        {/* Métodos de Pago */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            Métodos de Pago
          </h3>
          <div className="space-y-2">
            {Object.entries(paymentMethodStats).map(([method, count]) => (
              <div key={method} className="flex justify-between items-center">
                <span className="text-sm text-gray-600 capitalize">
                  {method.replace(/_/g, ' ')}
                </span>
                <div className="flex items-center">
                  <span className="font-semibold text-gray-900 mr-2">
                    {count}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({((count / tickets.length) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gráficos */}
      {showCharts && (
        <StatsCharts
          data={{
            daily: getLast7DaysData(tickets),
            methods: paymentMethodStats,
            revenue: revenueStats.totalRevenue
          }}
        />
      )}

      {/* Métricas Adicionales */}
      <div className="bg-gradient-to-r from-orange-600 to-[#f08772] rounded-lg p-6 text-white">
        <h3 className="text-lg font-semibold mb-4">Métricas de Rendimiento</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-white/80 text-sm">Crecimiento Mensual</p>
            <p className="text-2xl font-bold">
              {additionalStats.growthRate > 0 ? '+' : ''}{additionalStats.growthRate.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-white/80 text-sm">Tiempo Promedio de Procesamiento</p>
            <p className="text-2xl font-bold">
              {additionalStats.averageProcessingTime.toFixed(1)}h
            </p>
          </div>
          <div>
            <p className="text-white/80 text-sm">Precio Promedio</p>
            <p className="text-2xl font-bold">
              ${revenueStats.averageTicketPrice.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-white/80 text-sm">Emails Enviados Hoy</p>
            <p className="text-2xl font-bold">
              {emailStats.sent_today}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componentes auxiliares
const KPICard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: number;
  progress?: number;
  color: 'green' | 'blue' | 'purple' | 'orange';
}> = ({ title, value, subtitle, icon: Icon, trend, progress, color }) => {
  const colors = {
    green: 'text-green-600 bg-green-100',
    blue: 'text-blue-600 bg-blue-100',
    purple: 'text-purple-600 bg-purple-100',
    orange: 'text-orange-600 bg-orange-100'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-baseline">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && (
          <p className="ml-2 text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
      {trend !== undefined && (
        <div className="flex items-center mt-2">
          <TrendingUp className={`w-4 h-4 mr-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          <span className={`text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        </div>
      )}
      {progress !== undefined && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full bg-${color}-600`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const StatItem: React.FC<{
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}> = ({ label, value, icon: Icon, color }) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <Icon className={`w-4 h-4 mr-2 ${color}`} />
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
};

const CompactStats: React.FC<{
  stats: any;
  dailyStats: any;
}> = ({ stats, dailyStats }) => {
  return (
    <div className="flex items-center space-x-6 bg-white rounded-lg shadow-sm border px-6 py-3">
      <div className="flex items-center">
        <DollarSign className="w-5 h-5 text-green-600 mr-2" />
        <div>
          <p className="text-xs text-gray-600">Ingresos</p>
          <p className="font-semibold">${stats.totalRevenue.toLocaleString()}</p>
        </div>
      </div>
      <div className="flex items-center">
        <ShoppingBag className="w-5 h-5 text-blue-600 mr-2" />
        <div>
          <p className="text-xs text-gray-600">Vendidas Hoy</p>
          <p className="font-semibold">{dailyStats.ticketsSoldToday}</p>
        </div>
      </div>
      <div className="flex items-center">
        <Clock className="w-5 h-5 text-yellow-600 mr-2" />
        <div>
          <p className="text-xs text-gray-600">Pendientes</p>
          <p className="font-semibold">{dailyStats.pendingToday}</p>
        </div>
      </div>
    </div>
  );
};

const DashboardView: React.FC<any> = (props) => {
  // Implementación completa del dashboard
  return (
    <div className="space-y-6">
      {/* Implementar vista de dashboard completa */}
      <div className="text-2xl font-bold">Dashboard View</div>
      {/* ... más componentes del dashboard ... */}
    </div>
  );
};

// Función helper para obtener datos de los últimos 7 días
const getLast7DaysData = (tickets: ConcertTicket[]) => {
  const days = [];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const sales = tickets.filter(t => {
      const ticketDate = new Date(t.created_at).toISOString().split('T')[0];
      return ticketDate === dateStr && t.payment_status === 'confirmado';
    }).length;
    
    days.push({ date: dateStr, sales });
  }
  
  return days;
};

export default StatsView;