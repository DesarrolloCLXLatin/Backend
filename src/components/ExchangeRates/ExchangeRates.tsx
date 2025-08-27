import React, { useState, useEffect } from 'react';
import { TrendingUp, RefreshCw, Calculator, Calendar, Edit, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CurrentRate from './CurrentRate';
import RateHistory from './RateHistory';
import RateStatistics from './RateStatistics';
import ManualRateModal from './ManualRateModal';
import toast from 'react-hot-toast';

type TabType = 'current' | 'history' | 'statistics';

const ExchangeRates: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('current');
  const [showManualModal, setShowManualModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isAdmin = hasPermission('system', 'manage_all') || user?.role === 'admin';

  const handleForceUpdate = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch('/api/exchange-rates/update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al actualizar la tasa');
      }

      const data = await response.json();
      toast.success('Tasa actualizada exitosamente');
      setRefreshKey(prev => prev + 1); // Forzar recarga de datos
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar la tasa de cambio');
    } finally {
      setIsUpdating(false);
    }
  };

  const tabs = [
    { id: 'current', label: 'Tasa Actual', icon: Calculator },
    { id: 'history', label: 'Historial', icon: Calendar },
    { id: 'statistics', label: 'Estadísticas', icon: TrendingUp }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Calculator className="w-8 h-8 mr-3 text-orange-600" />
              Tasas de Cambio
            </h1>
            <p className="text-gray-600 mt-1">
              Gestión de tasas USD/VES para el sistema
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowManualModal(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                <Edit className="w-4 h-4 mr-2" />
                Establecer Manual
              </button>
              <button
                onClick={handleForceUpdate}
                disabled={isUpdating}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
                {isUpdating ? 'Actualizando...' : 'Actualizar Ahora'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Información sobre las tasas:</p>
            <ul className="mt-1 list-disc list-inside">
              <li>Las tasas se actualizan automáticamente cada 6 horas</li>
              <li>Los datos provienen del Banco Central de Venezuela (BCV)</li>
              <li>Todas las transacciones usan la tasa más reciente disponible</li>
              {isAdmin && <li>Como administrador, puedes forzar actualizaciones o establecer tasas manualmente</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`
                    flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'current' && <CurrentRate key={refreshKey} />}
          {activeTab === 'history' && <RateHistory key={refreshKey} />}
          {activeTab === 'statistics' && <RateStatistics key={refreshKey} />}
        </div>
      </div>

      {/* Manual Rate Modal */}
      {showManualModal && (
        <ManualRateModal
          onClose={() => setShowManualModal(false)}
          onSuccess={() => {
            setShowManualModal(false);
            setRefreshKey(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
};

export default ExchangeRates;