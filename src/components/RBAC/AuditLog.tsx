// components/RBAC/AuditLog.tsx
import React, { useState, useEffect } from 'react';
import { Clock, User, Shield, Activity, Filter, Search, Download } from 'lucide-react';

interface AuditEntry {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  target_user_id?: string;
  target_user_email?: string;
  target_role_id?: string;
  target_role_name?: string;
  permission_id?: string;
  old_value?: any;
  new_value?: any;
  reason?: string;
  ip_address?: string;
  created_at: string;
}

const AuditLog: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchAuditLog();
  }, [filters, currentPage]);

  const fetchAuditLog = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append('page', currentPage.toString());
      params.append('limit', '20');

      const response = await fetch(`/api/rbac/audit?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      setEntries(data.entries || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Error fetching audit log:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportAuditLog = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append('export', 'csv');

      const response = await fetch(`/api/rbac/audit/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting audit log:', error);
    }
  };

  type ActionType = 'grant' | 'revoke' | 'modify' | 'create' | 'delete' | 'login' | 'logout';
  const getActionColor = (action: string) => {
    const colors: Record<ActionType, string> = {
      grant: 'text-green-600 bg-green-100',
      revoke: 'text-red-600 bg-red-100',
      modify: 'text-blue-600 bg-blue-100',
      create: 'text-purple-600 bg-purple-100',
      delete: 'text-red-600 bg-red-100',
      login: 'text-gray-600 bg-gray-100',
      logout: 'text-gray-600 bg-gray-100'
    };
    return colors[action as ActionType] || 'text-gray-600 bg-gray-100';
  };

  const formatAction = (entry: AuditEntry) => {
    switch (entry.action) {
      case 'grant':
        return `otorgó el rol "${entry.target_role_name}" a ${entry.target_user_email}`;
      case 'revoke':
        return `revocó el rol "${entry.target_role_name}" de ${entry.target_user_email}`;
      case 'modify':
        return `modificó los permisos del rol "${entry.target_role_name}"`;
      case 'create':
        return `creó el rol "${entry.target_role_name}"`;
      case 'delete':
        return `eliminó el rol "${entry.target_role_name}"`;
      case 'login':
        return 'inició sesión';
      case 'logout':
        return 'cerró sesión';
      default:
        return entry.action;
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchAuditLog();
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
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Filter className="w-5 h-5 mr-2 text-gray-500" />
            <h3 className="font-medium text-gray-900">Filtros</h3>
          </div>
          <button
            onClick={exportAuditLog}
            className="flex items-center px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </button>
        </div>
        
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Buscar..."
              />
            </div>
            
            <select
              value={filters.action}
              onChange={(e) => setFilters({...filters, action: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Todas las acciones</option>
              <option value="grant">Otorgar</option>
              <option value="revoke">Revocar</option>
              <option value="modify">Modificar</option>
              <option value="create">Crear</option>
              <option value="delete">Eliminar</option>
              <option value="login">Inicio de sesión</option>
              <option value="logout">Cierre de sesión</option>
            </select>
            
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Desde"
            />
            
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Hasta"
            />
            
            <button
              type="button"
              onClick={() => {
                setFilters({ action: '', userId: '', dateFrom: '', dateTo: '', search: '' });
                setCurrentPage(1);
              }}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Limpiar Filtros
            </button>
          </div>
        </form>
      </div>

      {/* Audit Entries */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Registro de Auditoría
          </h3>
        </div>
        
        <div className="divide-y divide-gray-200">
          {entries.length > 0 ? (
            entries.map((entry) => (
              <div key={entry.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{entry.user_email}</span>{' '}
                        {formatAction(entry)}
                      </p>
                      {entry.reason && (
                        <p className="text-sm text-gray-500 mt-1">
                          Razón: {entry.reason}
                        </p>
                      )}
                      {(entry.old_value || entry.new_value) && (
                        <div className="mt-2 text-xs text-gray-500">
                          {entry.old_value && (
                            <p>Valor anterior: <code className="bg-gray-100 px-1 rounded">{JSON.stringify(entry.old_value)}</code></p>
                          )}
                          {entry.new_value && (
                            <p>Valor nuevo: <code className="bg-gray-100 px-1 rounded">{JSON.stringify(entry.new_value)}</code></p>
                          )}
                        </div>
                      )}
                      <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                        {entry.ip_address && (
                          <span>IP: {entry.ip_address}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`
                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${getActionColor(entry.action)}
                  `}>
                    {entry.action}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-center text-gray-500">
              No se encontraron entradas en el registro
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Página {currentPage} de {totalPages}
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm text-gray-600 bg-white border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm text-gray-600 bg-white border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLog;