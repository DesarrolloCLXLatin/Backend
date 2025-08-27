import React, { useState, useEffect } from 'react';
import { DollarSign, Clock, TrendingUp, TrendingDown, Calendar, AlertCircle } from 'lucide-react';

interface CurrentRateData {
  rate: number;
  source: string;
  date: string;
  timestamp: string;
  age_hours: number;
  is_current: boolean;
  formatted: string;
}

const CurrentRate: React.FC = () => {
  const [currentRate, setCurrentRate] = useState<CurrentRateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [previousRate, setPreviousRate] = useState<number | null>(null);

  useEffect(() => {
    fetchCurrentRate();
    // Obtener tasa anterior del localStorage para comparación
    const stored = localStorage.getItem('previousRate');
    if (stored) {
      setPreviousRate(parseFloat(stored));
    }
  }, []);

  const fetchCurrentRate = async () => {
    try {
      const response = await fetch('/api/exchange-rates/current');
      
      if (!response.ok) {
        throw new Error('Error al obtener la tasa');
      }

      const data = await response.json();
      setCurrentRate(data);
      
      // Guardar la tasa actual como "anterior" para la próxima vez
      if (data.rate && previousRate === null) {
        localStorage.setItem('previousRate', data.rate.toString());
      }
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

  if (!currentRate) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No hay información de tasa disponible</p>
      </div>
    );
  }

  const percentageChange = previousRate 
    ? ((currentRate.rate - previousRate) / previousRate) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Main Rate Display */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-lg p-8 text-white">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">Tasa de Cambio Actual</p>
          <div className="flex items-center justify-center mb-4">
            <DollarSign className="w-12 h-12 mr-2" />
            <span className="text-5xl font-bold">{currentRate.rate.toFixed(2)}</span>
            <span className="text-2xl ml-3">Bs/USD</span>
          </div>
          
          {previousRate && percentageChange !== 0 && (
            <div className="flex items-center justify-center">
              {percentageChange > 0 ? (
                <TrendingUp className="w-5 h-5 mr-1" />
              ) : (
                <TrendingDown className="w-5 h-5 mr-1" />
              )}
              <span className="text-sm">
                {percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(2)}% desde la última actualización
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center text-gray-600 mb-2">
            <Calendar className="w-5 h-5 mr-2" />
            <span className="font-medium">Fecha</span>
          </div>
          <p className="text-gray-900">
            {new Date(currentRate.date).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center text-gray-600 mb-2">
            <Clock className="w-5 h-5 mr-2" />
            <span className="font-medium">Antigüedad</span>
          </div>
          <p className="text-gray-900">
            {currentRate.age_hours < 1 
              ? 'Menos de 1 hora' 
              : `${currentRate.age_hours} horas`}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {currentRate.is_current 
              ? 'Tasa vigente' 
              : 'Requiere actualización'}
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center text-gray-600 mb-2">
            <DollarSign className="w-5 h-5 mr-2" />
            <span className="font-medium">Fuente</span>
          </div>
          <p className="text-gray-900">{currentRate.source}</p>
          <p className="text-sm text-gray-500 mt-1">
            {currentRate.source === 'BCV' ? 'Banco Central de Venezuela' : 'Establecida manualmente'}
          </p>
        </div>
      </div>

      {/* Status Alert */}
      {!currentRate.is_current && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Tasa desactualizada</p>
              <p>La tasa tiene más de 24 horas. Se recomienda actualizar para obtener el valor más reciente.</p>
            </div>
          </div>
        </div>
      )}

      {/* Conversion Examples */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Ejemplos de Conversión</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[10, 25, 50, 100].map((usd) => (
            <div key={usd} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-gray-600">${usd} USD</span>
              <span className="font-medium text-gray-900">
                = {(usd * currentRate.rate).toFixed(2)} Bs
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CurrentRate;