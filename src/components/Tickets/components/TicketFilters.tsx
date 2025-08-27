import React from 'react';
import { Search, Filter } from 'lucide-react';
import { FilterState } from '../types';

interface TicketFiltersProps {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
}

const TicketFilters: React.FC<TicketFiltersProps> = ({ filters, setFilters }) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, search: e.target.value, page: 1 });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, status: e.target.value, page: 1 });
  };

  const handleClearFilters = () => {
    setFilters({ status: 'all', search: '', page: 1, limit: 50 });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Buscar
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Nombre, email, número..."
              value={filters.search}
              onChange={handleSearchChange}
              className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estado de Pago
          </label>
          <select
            value={filters.status}
            onChange={handleStatusChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="confirmado">Confirmado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={handleClearFilters}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            <Filter className="w-4 h-4 mr-2 inline" />
            Limpiar Filtros
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketFilters;