import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface RateHistoryItem {
  id: string;
  rate: number;
  source: string;
  date: string;
  created_at: string;
}

const RateHistory: React.FC = () => {
  const [history, setHistory] = useState<RateHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchHistory();
  }, [days]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/exchange-rates/history?days=${days}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al obtener el historial');
      }

      const data = await response.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = {
    labels: history.map(item => 
      new Date(item.date).toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short' 
      })
    ).reverse(),
    datasets: [
      {
        label: 'Tasa USD/VES',
        data: history.map(item => item.rate).reverse(),
        borderColor: 'rgb(251, 146, 60)',
        backgroundColor: 'rgba(251, 146, 60, 0.1)',
        tension: 0.1
      }
    ]
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: `Evolución de la Tasa - Últimos ${days} días`
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: function(value) {
            return value + ' Bs';
          }
        }
      }
    }
  };

  const calculateChange = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    return {
      value: change,
      formatted: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Historial de Tasas</h3>
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-400" />
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
      </div>

      {/* Chart */}
      {history.length > 0 && (
        <div className="bg-white p-4 rounded-lg border">
          <Line data={chartData} options={chartOptions} />
        </div>
      )}

      {/* History Table */}
      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tasa
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cambio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fuente
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {history.map((item, index) => {
              const previousRate = index < history.length - 1 ? history[index + 1].rate : null;
              const change = previousRate ? calculateChange(item.rate, previousRate) : null;
              
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      {new Date(item.date).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {item.rate.toFixed(2)} Bs/USD
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {change && (
                      <div className={`flex items-center text-sm ${
                        change.value > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {change.value > 0 ? (
                          <TrendingUp className="w-4 h-4 mr-1" />
                        ) : (
                          <TrendingDown className="w-4 h-4 mr-1" />
                        )}
                        {change.formatted}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.source}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {history.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No hay datos históricos disponibles para el período seleccionado
        </div>
      )}
    </div>
  );
};

export default RateHistory;