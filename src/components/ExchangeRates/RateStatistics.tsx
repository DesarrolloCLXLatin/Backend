import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';

interface Statistics {
  period_days: number;
  count: number;
  current_rate: number;
  average_rate: number;
  min_rate: number;
  max_rate: number;
  variation_percentage: number;
  trend: string;
  volatility: number;
}

const RateStatistics: React.FC = () => {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchStatistics();
  }, [days]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/exchange-rates/stats?days=${days}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al obtener estadísticas');
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No hay suficientes datos para generar estadísticas</p>
      </div>
    );
  }

  type StatColor = 'blue' | 'green' | 'red' | 'yellow';

  const statCards: {
    title: string;
    value: string;
    icon: React.ElementType;
    color: StatColor;
  }[] = [
    {
      title: 'Tasa Promedio',
      value: `${stats.average_rate.toFixed(2)} Bs`,
      icon: BarChart3,
      color: 'blue'
    },
    {
      title: 'Tasa Mínima',
      value: `${stats.min_rate.toFixed(2)} Bs`,
      icon: TrendingDown,
      color: 'green'
    },
    {
      title: 'Tasa Máxima',
      value: `${stats.max_rate.toFixed(2)} Bs`,
      icon: TrendingUp,
      color: 'red'
    },
    {
      title: 'Volatilidad',
      value: `${stats.volatility.toFixed(2)}%`,
      icon: Activity,
      color: stats.volatility > 5 ? 'yellow' : 'green'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Estadísticas de Tasas
        </h3>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
          <option value={60}>Últimos 60 días</option>
          <option value={90}>Últimos 90 días</option>
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const colorClasses = {
            blue: 'bg-blue-50 text-blue-600',
            green: 'bg-green-50 text-green-600',
            red: 'bg-red-50 text-red-600',
            yellow: 'bg-yellow-50 text-yellow-600'
          };
          
          return (
            <div key={stat.title} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className={`inline-flex p-2 rounded-lg ${colorClasses[stat.color]} mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-sm text-gray-600">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Trend Analysis */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Análisis de Tendencia</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Tendencia General</span>
            <div className={`flex items-center font-medium ${
              stats.trend === 'UPWARD' ? 'text-red-600' : 
              stats.trend === 'DOWNWARD' ? 'text-green-600' : 
              'text-gray-600'
            }`}>
              {stats.trend === 'UPWARD' && <TrendingUp className="w-5 h-5 mr-1" />}
              {stats.trend === 'DOWNWARD' && <TrendingDown className="w-5 h-5 mr-1" />}
              {stats.trend === 'UPWARD' ? 'Alcista' : 
               stats.trend === 'DOWNWARD' ? 'Bajista' : 
               'Estable'}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600">Variación Total</span>
            <span className={`font-medium ${
              stats.variation_percentage > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {stats.variation_percentage > 0 ? '+' : ''}{stats.variation_percentage.toFixed(2)}%
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600">Número de Cambios</span>
            <span className="font-medium text-gray-900">{stats.count}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600">Período Analizado</span>
            <span className="font-medium text-gray-900">{stats.period_days} días</span>
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Interpretación de Datos</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          {stats.volatility > 10 && (
            <li>• Alta volatilidad detectada. Las tasas han fluctuado significativamente.</li>
          )}
          {stats.volatility <= 10 && stats.volatility > 5 && (
            <li>• Volatilidad moderada. Las tasas muestran variaciones normales.</li>
          )}
          {stats.volatility <= 5 && (
            <li>• Baja volatilidad. Las tasas se han mantenido relativamente estables.</li>
          )}
          {stats.trend === 'UPWARD' && (
            <li>• Tendencia alcista: El bolívar se ha depreciado frente al dólar.</li>
          )}
          {stats.trend === 'DOWNWARD' && (
            <li>• Tendencia bajista: El bolívar se ha apreciado frente al dólar.</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default RateStatistics;