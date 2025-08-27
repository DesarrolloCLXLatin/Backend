import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Runner } from '../../types';
import { 
  Users, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  UserCheck,
  Download,
  AlertCircle,
  Hash,
  CreditCard,
  Calendar,
  UserPlus,
  Shield,
  Lock
} from 'lucide-react';
import toast from 'react-hot-toast';

interface RunnerWithGroup extends Runner {
  group?: {
    id: string;
    group_code: string;
    registrant_email: string;
    payment_status: string;
    payment_method: string;
    payment_confirmed_at?: string;
    payment_confirmed_by?: string;
  };
  registered_by_user?: {
    id: string;
    email: string;
    role: string;
  };
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  pages: number;
}

const RunnersList: React.FC = () => {
  const { user, token, hasPermission } = useAuth();
  const [runners, setRunners] = useState<RunnerWithGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunner, setSelectedRunner] = useState<RunnerWithGroup | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    limit: 50,
    offset: 0,
    pages: 0
  });
  const [filters, setFilters] = useState({
    payment_status: '',
    payment_method: '',
    shirt_size: '',
    gender: '',
    search: '',
    group_id: '',
    has_number: '',
    limit: 50,
    offset: 0
  });

  // Verificar permisos
  const canView = hasPermission('runners', 'read') || hasPermission('runners', 'view_own');
  const canEdit = hasPermission('runners', 'update');
  const canDelete = hasPermission('runners', 'delete');
  const canExport = hasPermission('runners', 'export') || hasPermission('runners', 'read');
  const canViewPaymentDetails = hasPermission('payments', 'read');
  const canViewFullDetails = hasPermission('runners', 'read'); // Solo lectura completa
  const isViewOwnOnly = hasPermission('runners', 'view_own') && !hasPermission('runners', 'read');

  useEffect(() => {
    if (canView) {
      fetchRunners();
    }
  }, [filters, canView]);

  const fetchRunners = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      // Add filters to query params
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });

      // Si solo puede ver sus propios corredores, agregar filtro
      if (isViewOwnOnly && user) {
        params.append('registered_by', user.id);
      }

      const response = await fetch(`/api/runners?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRunners(data.runners || []);
        setPagination(data.pagination || {
          total: 0,
          limit: 50,
          offset: 0,
          pages: 0
        });
      } else {
        const error = await response.json();
        toast.error(error.message || 'Error al cargar corredores');
      }
    } catch (error) {
      console.error('Error fetching runners:', error);
      toast.error('Error al cargar corredores');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    const newOffset = (newPage - 1) * filters.limit;
    setFilters(prev => ({ ...prev, offset: newOffset }));
  };

  const exportRunners = async () => {
    if (!canExport) {
      toast.error('No tienes permisos para exportar');
      return;
    }

    try {
      const params = new URLSearchParams();
      if (isViewOwnOnly && user) {
        params.append('registered_by', user.id);
      }

      const response = await fetch(`/api/runners/export?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `corredores_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Lista exportada correctamente');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Error al exportar lista');
      }
    } catch (error) {
      console.error('Error exporting runners:', error);
      toast.error('Error al exportar lista');
    }
  };

  const handleDelete = async (runnerId: string) => {
  if (!canDelete) {
    toast.error('No tienes permisos para eliminar corredores');
    return;
  }

  try {
    // First, get runner details to check if it's the last in group
    const runnerResponse = await fetch(`/api/runners/${runnerId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!runnerResponse.ok) {
      toast.error('Error al obtener información del corredor');
      return;
    }

    const { runner } = await runnerResponse.json();
    
    // Check if this is the last runner in the group
    if (runner.group && runner.group.total_runners === 1) {
      // Ask user if they want to delete the entire group
      const confirmMessage = `Este es el último corredor del grupo ${runner.group.group_code}. ¿Deseas eliminar el grupo completo?`;
      
      if (!confirm(confirmMessage)) {
        return;
      }

      // Delete the entire group
      const deleteResponse = await fetch(`/api/runners/groups/${runner.group.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (deleteResponse.ok) {
        toast.success('Grupo y corredor eliminados correctamente');
        fetchRunners();
      } else {
        const error = await deleteResponse.json();
        
        // If payment is confirmed, ask if they want to force delete
        if (error.error_code === 'PAYMENT_CONFIRMED') {
          if (confirm('Este grupo tiene un pago confirmado. ¿Deseas forzar la eliminación?')) {
            const forceResponse = await fetch(`/api/runners/groups/${runner.group.id}?force=true`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (forceResponse.ok) {
              toast.success('Grupo y corredor eliminados correctamente');
              fetchRunners();
            } else {
              const forceError = await forceResponse.json();
              toast.error(forceError.message || 'Error al eliminar grupo');
            }
          }
        } else {
          toast.error(error.message || 'Error al eliminar grupo');
        }
      }
    } else {
      // Normal deletion for runners that aren't the last in group
      if (!confirm('¿Estás seguro de eliminar este corredor?')) {
        return;
      }

      const response = await fetch(`/api/runners/${runnerId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('Corredor eliminado correctamente');
        fetchRunners();
      } else {
        const error = await response.json();
        
        // Handle if payment is confirmed
        if (error.error_code === 'PAYMENT_CONFIRMED') {
          if (confirm('Este corredor tiene un pago confirmado. ¿Deseas forzar la eliminación?')) {
            const forceResponse = await fetch(`/api/runners/${runnerId}?force=true`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (forceResponse.ok) {
              toast.success('Corredor eliminado correctamente');
              fetchRunners();
            } else {
              const forceError = await forceResponse.json();
              toast.error(forceError.message || 'Error al eliminar corredor');
            }
          }
        } else {
          toast.error(error.message || 'Error al eliminar corredor');
        }
      }
    }
  } catch (error) {
    console.error('Error deleting runner:', error);
    toast.error('Error al eliminar corredor');
  }
};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmado':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'rechazado':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'procesando':
        return <AlertCircle className="w-4 h-4 text-blue-600" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rechazado':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'procesando':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'tienda':
        return 'bg-orange-100 text-orange-800';
      case 'zelle':
        return 'bg-purple-100 text-purple-800';
      case 'transferencia_nacional':
      case 'transferencia_internacional':
        return 'bg-indigo-100 text-indigo-800';
      case 'paypal':
        return 'bg-blue-100 text-blue-800';
      case 'pago_movil_p2c':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      'tienda': 'Tienda',
      'zelle': 'Zelle',
      'transferencia_nacional': 'Transfer. Nacional',
      'transferencia_internacional': 'Transfer. Internacional',
      'paypal': 'PayPal',
      'pago_movil_p2c': 'Pago Móvil P2C'
    };
    return labels[method] || method;
  };

  // Si no tiene permisos de lectura
  if (!canView) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600">RList No tienes permisos para ver la lista de corredores.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  const currentPage = Math.floor(filters.offset / filters.limit) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lista de Corredores</h1>
          {isViewOwnOnly && (
            <p className="text-sm text-gray-500 mt-1 flex items-center">
              <Lock className="w-4 h-4 mr-1" />
              Mostrando solo corredores registrados por ti
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {canExport && (
            <button
              onClick={exportRunners}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </button>
          )}
          <div className="text-sm text-gray-500">
            {pagination.total} corredores
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Nombre, email, cédula, número de corredor..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, offset: 0 }))}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado de Pago
            </label>
            <select
              value={filters.payment_status}
              onChange={(e) => setFilters(prev => ({ ...prev, payment_status: e.target.value, offset: 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="procesando">Procesando</option>
              <option value="confirmado">Confirmado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Método de Pago
            </label>
            <select
              value={filters.payment_method}
              onChange={(e) => setFilters(prev => ({ ...prev, payment_method: e.target.value, offset: 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Todos los métodos</option>
              <option value="tienda">Tienda</option>
              <option value="zelle">Zelle</option>
              <option value="transferencia_nacional">Transfer. Nacional</option>
              <option value="transferencia_internacional">Transfer. Internacional</option>
              <option value="paypal">PayPal</option>
              <option value="pago_movil_p2c">Pago Móvil P2C</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Género
            </label>
            <select
              value={filters.gender}
              onChange={(e) => setFilters(prev => ({ ...prev, gender: e.target.value, offset: 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Todos</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Talla
            </label>
            <select
              value={filters.shirt_size}
              onChange={(e) => setFilters(prev => ({ ...prev, shirt_size: e.target.value, offset: 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Todas las tallas</option>
              <option value="XS">XS</option>
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
              <option value="XXL">XXL</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número Asignado
            </label>
            <select
              value={filters.has_number}
              onChange={(e) => setFilters(prev => ({ ...prev, has_number: e.target.value, offset: 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Todos</option>
              <option value="true">Con número</option>
              <option value="false">Sin número</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({ 
                payment_status: '', 
                payment_method: '', 
                shirt_size: '', 
                gender: '', 
                search: '', 
                group_id: '', 
                has_number: '',
                limit: 50, 
                offset: 0 
              })}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              <Filter className="w-4 h-4 mr-2 inline" />
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Runners Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Número
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Corredor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grupo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Talla/Género
                </th>
                {canViewPaymentDetails && (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pago
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                  </>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {runners.map((runner) => {
                const birthDate = new Date(runner.birth_date);
                const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                
                return (
                  <tr key={runner.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {runner.profile_photo_url ? (
                          <img
                            src={runner.profile_photo_url}
                            alt={runner.full_name}
                            className="w-10 h-10 rounded-full object-cover mr-3"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                            <UserCheck className="w-5 h-5 text-gray-500" />
                          </div>
                        )}
                        <div className="text-sm font-medium text-gray-900">
                          {runner.runner_number ? (
                            <span className="flex items-center">
                              <Hash className="w-4 h-4 mr-1 text-orange-600" />
                              {runner.runner_number}
                            </span>
                          ) : (
                            <span className="text-gray-400">Pendiente</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {runner.full_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {runner.identification_type}-{runner.identification} • {age} años
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {runner.group && (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {runner.group.group_code}
                          </div>
                          <div className="text-xs text-gray-500">
                            {runner.group.registrant_email}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">{runner.email}</div>
                        <div className="text-sm text-gray-500">{runner.phone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {runner.shirt_size}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          runner.gender === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                        }`}>
                          {runner.gender === 'M' ? 'M' : 'F'}
                        </span>
                      </div>
                    </td>
                    {canViewPaymentDetails && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            {runner.group && runner.group.payment_method ? (
                              <>
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getMethodColor(runner.group.payment_method)}`}>
                                  {getMethodLabel(runner.group.payment_method)}
                                </span>
                                {runner.group.payment_reference && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Ref: {runner.group.payment_reference}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400 text-xs">Sin información</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(runner.group?.payment_status || runner.payment_status || 'pendiente')}`}>
                            {getStatusIcon(runner.group?.payment_status || runner.payment_status || 'pendiente')}
                            <span className="ml-1 capitalize">{runner.group?.payment_status || runner.payment_status || 'pendiente'}</span>
                          </span>
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedRunner({ ...runner, age });
                            setShowModal(true);
                          }}
                          className="text-orange-600 hover:text-orange-900 transition-colors"
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => {
                              // Implementar edición
                              toast('Función de edición en desarrollo');
                            }}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(runner.id)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {runners.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay corredores</h3>
            <p className="text-gray-500">
              No se encontraron corredores con los filtros aplicados.
            </p>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Anterior
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === pagination.pages}
                className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                  currentPage === pagination.pages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Siguiente
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Mostrando{' '}
                  <span className="font-medium">{filters.offset + 1}</span> a{' '}
                  <span className="font-medium">
                    {Math.min(filters.offset + filters.limit, pagination.total)}
                  </span>{' '}
                  de <span className="font-medium">{pagination.total}</span> resultados
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 text-sm font-medium ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                    Página {currentPage} de {pagination.pages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === pagination.pages}
                    className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 text-sm font-medium ${
                      currentPage === pagination.pages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Runner Details Modal */}
      {showModal && selectedRunner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Detalles del Corredor
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedRunner(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Profile Photo */}
              {selectedRunner.profile_photo_url && (
                <div className="text-center">
                  <img
                    src={selectedRunner.profile_photo_url}
                    alt={selectedRunner.full_name}
                    className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-gray-200"
                  />
                </div>
              )}

              {/* Runner Number */}
              {selectedRunner.runner_number && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-orange-700 mb-1">Número de Corredor</p>
                  <p className="text-3xl font-bold text-orange-900">#{selectedRunner.runner_number}</p>
                </div>
              )}

              {/* Group Information - Solo si tiene permisos para ver detalles completos */}
              {canViewFullDetails && selectedRunner.group && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Información del Grupo</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Código:</span>
                      <span className="ml-2 font-medium">{selectedRunner.group.group_code}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Registrante:</span>
                      <span className="ml-2 font-medium">{selectedRunner.group.registrant_email}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Personal Information */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-3">Información Personal</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedRunner.full_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Identificación</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedRunner.identification_type}-{selectedRunner.identification}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fecha de Nacimiento</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {new Date(selectedRunner.birth_date).toLocaleDateString()} ({selectedRunner.age} años)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Género</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedRunner.gender === 'M' ? 'Masculino' : 'Femenino'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Talla de Camiseta</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedRunner.shirt_size}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedRunner.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedRunner.phone}</p>
                  </div>
                </div>
              </div>

              {/* Payment Information - Solo si tiene permisos */}
              {canViewPaymentDetails && (
                <div className="border-t pt-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Información de Pago</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Método de Pago</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedRunner.group?.payment_method 
                          ? getMethodLabel(selectedRunner.group.payment_method) 
                          : 'No disponible'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Estado</label>
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(selectedRunner.group?.payment_status || selectedRunner.payment_status || 'pendiente')}`}>
                        {getStatusIcon(selectedRunner.group?.payment_status || selectedRunner.payment_status || 'pendiente')}
                        <span className="ml-1 capitalize">{selectedRunner.group?.payment_status || selectedRunner.payment_status || 'pendiente'}</span>
                      </span>
                    </div>
                    {selectedRunner.group?.payment_reference && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Referencia de Pago</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedRunner.group.payment_reference}</p>
                      </div>
                    )}
                    {selectedRunner.group?.payment_confirmed_at && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Fecha de Confirmación</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {new Date(selectedRunner.group.payment_confirmed_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Registration Information - Solo si tiene permisos completos */}
              {canViewFullDetails && (
                <div className="border-t pt-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Información de Registro</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Fecha de Registro</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {new Date(selectedRunner.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Última Actualización</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {new Date(selectedRunner.updated_at).toLocaleString()}
                      </p>
                    </div>
                    {selectedRunner.registered_by_user && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Registrado Por</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {selectedRunner.registered_by_user.email} ({selectedRunner.registered_by_user.role})
                        </p>
                      </div>
                    )}
                    {selectedRunner.reserved_until && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Reserva Válida Hasta</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {new Date(selectedRunner.reserved_until).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6 space-x-2">
              {canEdit && (
                <button
                  onClick={() => {
                    // Implementar edición
                    toast('Función de edición en desarrollo');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Edit className="w-4 h-4 mr-2 inline" />
                  Editar
                </button>
              )}
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedRunner(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunnersList;