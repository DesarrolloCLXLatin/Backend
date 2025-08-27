import React, { useState } from 'react';
import { Search, X, Filter, Calendar } from 'lucide-react';

interface AdvancedSearchProps {
  onSearch: (criteria: SearchCriteria) => void;
  onReset: () => void;
}

export interface SearchCriteria {
  query: string;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  ticketStatus?: string;
  priceMin?: number;
  priceMax?: number;
  isBox?: boolean;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({ onSearch, onReset }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [criteria, setCriteria] = useState<SearchCriteria>({
    query: ''
  });

  const handleSearch = () => {
    onSearch(criteria);
  };

  const handleReset = () => {
    setCriteria({ query: '' });
    onReset();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="space-y-4">
        {/* Búsqueda básica */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, número de ticket..."
              value={criteria.query}
              onChange={(e) => setCriteria({ ...criteria, query: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-gradient-to-r from-orange-600 to-[#f08772] text-white rounded-md hover:shadow-lg transition-all"
          >
            Buscar
          </button>
        </div>

        {/* Búsqueda avanzada */}
        {showAdvanced && (
          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium text-gray-700">Filtros Avanzados</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Rango de fechas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Desde
                </label>
                <input
                  type="date"
                  value={criteria.dateFrom || ''}
                  onChange={(e) => setCriteria({ ...criteria, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hasta
                </label>
                <input
                  type="date"
                  value={criteria.dateTo || ''}
                  onChange={(e) => setCriteria({ ...criteria, dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Método de pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de Pago
                </label>
                <select
                  value={criteria.paymentMethod || ''}
                  onChange={(e) => setCriteria({ ...criteria, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todos</option>
                  <option value="pago_movil">Pago Móvil P2C</option>
                  <option value="zelle">Zelle</option>
                  <option value="transferencia_nacional">Transferencia Nacional</option>
                  <option value="paypal">PayPal</option>
                  <option value="tienda">Tienda</option>
                </select>
              </div>

              {/* Estado del pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado del Pago
                </label>
                <select
                  value={criteria.paymentStatus || ''}
                  onChange={(e) => setCriteria({ ...criteria, paymentStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todos</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="rechazado">Rechazado</option>
                </select>
              </div>

              {/* Rango de precio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio Mínimo
                </label>
                <input
                  type="number"
                  value={criteria.priceMin || ''}
                  onChange={(e) => setCriteria({ ...criteria, priceMin: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio Máximo
                </label>
                <input
                  type="number"
                  value={criteria.priceMax || ''}
                  onChange={(e) => setCriteria({ ...criteria, priceMax: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="1000"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={criteria.isBox || false}
                  onChange={(e) => setCriteria({ ...criteria, isBox: e.target.checked })}
                  className="mr-2 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">Solo boxes</span>
              </label>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Limpiar
              </button>
              <button
                onClick={handleSearch}
                className="px-6 py-2 bg-gradient-to-r from-orange-600 to-[#f08772] text-white rounded-md hover:shadow-lg transition-all"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedSearch;