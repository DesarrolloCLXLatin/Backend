import React from 'react';
import { BarChart3, TrendingUp, PieChart } from 'lucide-react';

interface StatsChartsProps {
  data: {
    daily: Array<{ date: string; sales: number }>;
    methods: Record<string, number>;
    revenue: number;
  };
}

const StatsCharts: React.FC<StatsChartsProps> = ({ data }) => {
  const maxSales = Math.max(...data.daily.map(d => d.sales));
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Gráfico de ventas diarias */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2" />
          Ventas Diarias
        </h3>
        <div className="space-y-2">
          {data.daily.slice(-7).map((day, index) => (
            <div key={index} className="flex items-center">
              <span className="text-sm text-gray-600 w-20">
                {new Date(day.date).toLocaleDateString('es-ES', { 
                  day: '2-digit',
                  month: 'short' 
                })}
              </span>
              <div className="flex-1 mx-2">
                <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-600 to-[#f08772]"
                    style={{ width: `${(day.sales / maxSales) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium text-gray-900 w-10 text-right">
                {day.sales}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Distribución por método de pago */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <PieChart className="w-5 h-5 mr-2" />
          Métodos de Pago
        </h3>
        <div className="space-y-3">
          {Object.entries(data.methods).map(([method, count]) => {
            const percentage = (count / Object.values(data.methods).reduce((a, b) => a + b, 0)) * 100;
            return (
              <div key={method} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${getMethodColorForChart(method)}`} />
                  <span className="text-sm text-gray-700 capitalize">
                    {method.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-900 mr-2">
                    {count}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Ingresos Totales</span>
            <span className="text-lg font-bold text-green-600">
              ${data.revenue.toLocaleString()} USD
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const getMethodColorForChart = (method: string): string => {
  const colors: Record<string, string> = {
    pago_movil: 'bg-pink-500',
    zelle: 'bg-blue-500',
    transferencia: 'bg-indigo-500',
    transferencia_nacional: 'bg-purple-500',
    paypal: 'bg-orange-500',
    tienda: 'bg-green-500'
  };
  return colors[method] || 'bg-gray-500';
};

export default StatsCharts;