import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  CreditCard, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Search,
  Filter,
  Eye,
  X,
  AlertCircle,
  Users,
  User,
  Calendar,
  FileText,
  Image as ImageIcon,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';

// Interfaces actualizadas para el esquema de grupos
interface Runner {
  id: string;
  full_name: string;
  email: string;
  identification_type: string;
  identification: string;
  runner_number?: string;
}

interface Group {
  id: string;
  group_id?: string; // Para compatibilidad
  group_code: string;
  registrant_email: string;
  registrant_phone: string;
  total_runners: number;
  payment_status: 'pendiente' | 'confirmado' | 'rechazado' | 'procesando';
  payment_method: string;
  payment_reference?: string;
  payment_proof_url?: string;
  payment_confirmed_at?: string;
  payment_confirmed_by?: string;
  reserved_until?: string;
  created_at: string;
  runners: Runner[];
  runners_detail?: any[]; // Para compatibilidad con el modal
  runner_names?: string; // Para compatibilidad con el modal
}

interface PaymentTransaction {
  id: string;
  group_id: string;
  control?: string;
  invoice?: string;
  amount_usd: number;
  amount_bs?: number;
  exchange_rate?: number;
  status: 'pending' | 'approved' | 'rejected' | 'failed' | 'cancelled';
  gateway_response?: any;
  auth_id?: string;
  reference?: string;
  created_at: string;
  processed_at?: string;
  group: Group;
}

interface PaymentStats {
  groups: {
    total: number;
    byStatus: {
      pendiente: number;
      confirmado: number;
      rechazado: number;
      procesando: number;
    };
    totalRunners: number;
    confirmedRunners: number;
  };
  revenue: {
    potentialUSD: number;
    confirmedUSD: number;
    pendingUSD: number;
  };
  pricePerRunner: number;
}

const PaymentManagement: React.FC = () => {
  const { token, user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<'confirm' | 'reject' | 'view' | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'groups' | 'transactions'>('groups');
  const [filters, setFilters] = useState({
    status: 'all',
    payment_method: 'all',
    search: ''
  });

  // Función para obtener estadísticas
  const fetchStats = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/payments/stats/summary', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [token]);

  // Función para obtener todos los grupos
  const fetchGroups = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setAuthError('No hay sesión activa. Por favor, inicia sesión.');
      return;
    }

    setLoading(true);
    setAuthError(null);
    
    try {
      // Construir URL con parámetros de filtro
      const params = new URLSearchParams();
      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.payment_method !== 'all') {
        params.append('payment_method', filters.payment_method);
      }
      if (filters.search) {
        params.append('search', filters.search);
      }

      const response = await fetch(`/api/payments/groups?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 403) {
        const errorData = await response.json();
        setAuthError('No tienes permisos para ver los pagos. Contacta al administrador.');
        return;
      }

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      const data = await response.json();
      setGroups(data.groups || []);

    } catch (error: any) {
      console.error('Fetch error:', error);
      toast.error('Error al cargar los grupos');
    } finally {
      setLoading(false);
    }
  }, [token, filters]);

  // Función para obtener transacciones
  const fetchTransactions = useCallback(async () => {
    if (!token) return;

    try {
      const params = new URLSearchParams();
      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }
      
      const response = await fetch(`/api/payments?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  }, [token, filters]);

  useEffect(() => {
    if (token) {
      fetchStats();
      if (activeTab === 'groups') {
        fetchGroups();
      } else {
        fetchTransactions();
      }
    }
  }, [token, activeTab, fetchStats, fetchGroups, fetchTransactions]);

  const handleGroupAction = async () => {
    if (!selectedGroup || !actionType || (actionType !== 'confirm' && actionType !== 'reject')) return;

    if (!token) {
      toast.error('Sesión expirada');
      return;
    }

    const groupId = selectedGroup.group_id || selectedGroup.id;
    const body = actionType === 'reject' 
      ? { reason: actionNotes } 
      : { reference: selectedGroup.payment_reference, notes: actionNotes };

    try {
      const endpoint = actionType === 'confirm' ? 'confirm' : 'reject';
      const response = await fetch(`/api/payments/group/${groupId}/${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || 'Grupo actualizado exitosamente');
        closeModal();
        fetchGroups();
        fetchStats();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Error al actualizar el grupo');
      }
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Error de conexión');
    }
  };

  const openModal = (group: Group, type: 'confirm' | 'reject' | 'view') => {
    setSelectedGroup(group);
    setActionType(type);
    setActionNotes('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedGroup(null);
    setActionType(null);
    setActionNotes('');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmado':
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rechazado':
      case 'rejected':
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'procesando':
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado':
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rechazado':
      case 'rejected':
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'procesando':
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      'tienda': 'Tienda',
      'zelle': 'Zelle',
      'transferencia_nacional': 'Transf. Nacional',
      'transferencia_internacional': 'Transf. Internacional',
      'paypal': 'PayPal',
      'pago_movil_p2c': 'Pago Móvil P2C'
    };
    return labels[method] || method;
  };

  const isReservationExpired = (reservedUntil?: string) => {
    if (!reservedUntil) return false;
    return new Date(reservedUntil) < new Date();
  };

  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
            <p className="text-gray-600 mb-6">{authError}</p>
            <button
              onClick={() => window.location.href = '/login'}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Ir al Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading && groups.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Pagos</h1>
        <div className="text-sm text-gray-500">
          {activeTab === 'groups' ? `${groups.length} grupos` : `${transactions.length} transacciones`}
        </div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-sm text-gray-600">Total Grupos</div>
            <div className="text-2xl font-bold text-gray-900">{stats.groups.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-sm text-green-600">Confirmados</div>
            <div className="text-2xl font-bold text-green-600">{stats.groups.byStatus.confirmado}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-sm text-yellow-600">Pendientes</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.groups.byStatus.pendiente}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-sm text-gray-600">Total Corredores</div>
            <div className="text-2xl font-bold text-gray-900">{stats.groups.totalRunners}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-sm text-gray-600">Ingresos Confirmados</div>
            <div className="text-2xl font-bold text-gray-900">${stats.revenue.confirmedUSD}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('groups')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'groups'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Todos los Grupos
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'transactions'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Transacciones
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Código de grupo, email, nombre..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="procesando">Procesando</option>
              <option value="confirmado">Confirmado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
            <select
              value={filters.payment_method}
              onChange={(e) => setFilters(prev => ({ ...prev, payment_method: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Todos</option>
              <option value="tienda">Tienda</option>
              <option value="zelle">Zelle</option>
              <option value="transferencia_nacional">Transf. Nacional</option>
              <option value="transferencia_internacional">Transf. Internacional</option>
              <option value="paypal">PayPal</option>
              <option value="pago_movil_p2c">Pago Móvil P2C</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'groups' ? (
        /* Groups Table */
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registrante</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Corredores</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reserva</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groups.map((group) => {
                  const isExpired = isReservationExpired(group.reserved_until);
                  const total = group.total_runners * (stats?.pricePerRunner || 55);
                  const groupId = group.group_id || group.id;
                  
                  return (
                    <tr key={groupId} className={`hover:bg-gray-50 ${isExpired ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 text-gray-400 mr-2" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{group.group_code}</div>
                            <div className="text-sm text-gray-500">{new Date(group.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{group.registrant_email}</div>
                        <div className="text-sm text-gray-500">{group.registrant_phone || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="w-4 h-4 text-gray-400 mr-1" />
                          <span className="text-sm text-gray-900">{group.total_runners}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          {getMethodLabel(group.payment_method)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(group.payment_status)}`}>
                          {getStatusIcon(group.payment_status)}
                          <span className="ml-1 capitalize">{group.payment_status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {group.reserved_until ? (
                          <div className={`flex items-center ${isExpired ? 'text-red-600' : 'text-gray-500'}`}>
                            <Calendar className="w-4 h-4 mr-1" />
                            {isExpired ? 'Expirada' : new Date(group.reserved_until).toLocaleString()}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button 
                          onClick={() => openModal(group, 'view')} 
                          className="text-gray-600 hover:text-gray-900 transition-colors p-1"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {group.payment_status === 'pendiente' && (
                          <>
                            <button 
                              onClick={() => openModal(group, 'confirm')} 
                              className="text-green-600 hover:text-green-900 transition-colors p-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => openModal(group, 'reject')} 
                              className="text-red-600 hover:text-red-900 transition-colors p-1"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {groups.length === 0 && !loading && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron grupos</h3>
              <p className="text-gray-500">Intente ajustar los filtros o el término de búsqueda.</p>
            </div>
          )}
        </div>
      ) : (
        /* Transactions Table */
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Control/Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tasa</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referencia</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{transaction.control || '-'}</div>
                      <div className="text-sm text-gray-500">{transaction.invoice || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{transaction.group?.group_code}</div>
                      <div className="text-sm text-gray-500">{transaction.group?.total_runners} corredores</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">${transaction.amount_usd.toFixed(2)} USD</div>
                      {transaction.amount_bs && (
                        <div className="text-sm text-gray-500">Bs. {transaction.amount_bs.toFixed(2)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.exchange_rate?.toFixed(4) || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(transaction.status)}`}>
                        {getStatusIcon(transaction.status)}
                        <span className="ml-1 capitalize">{transaction.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(transaction.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.reference || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {transactions.length === 0 && !loading && (
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron transacciones</h3>
              <p className="text-gray-500">Las transacciones aparecerán aquí cuando se procesen pagos.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {actionType === 'confirm' && 'Confirmar Pago del Grupo'}
                {actionType === 'reject' && 'Rechazar Pago del Grupo'}
                {actionType === 'view' && 'Detalles del Grupo'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Código de Grupo</p>
                  <p className="font-medium">{selectedGroup.group_code}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Corredores</p>
                  <p className="font-medium">{selectedGroup.total_runners}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Registrante</p>
                  <p className="font-medium">{selectedGroup.registrant_email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Método de Pago</p>
                  <p className="font-medium">{getMethodLabel(selectedGroup.payment_method)}</p>
                </div>
                {selectedGroup.payment_reference && (
                  <div>
                    <p className="text-sm text-gray-600">Referencia</p>
                    <p className="font-medium">{selectedGroup.payment_reference}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Total a Pagar</p>
                  <p className="font-medium">${(selectedGroup.total_runners * (stats?.pricePerRunner || 55)).toFixed(2)}</p>
                </div>
              </div>

              {/* Lista de corredores */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Corredores en el Grupo:</p>
                <div className="bg-gray-50 rounded-md p-3 space-y-2">
                  {selectedGroup.runners_detail?.map((runner: any, index: number) => (
                    <div key={runner.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <span>{runner.name}</span>
                      </div>
                      <span className="text-gray-500">{runner.identification}</span>
                    </div>
                  )) || selectedGroup.runners?.map((runner, index) => (
                    <div key={runner.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <span>{runner.full_name}</span>
                      </div>
                      <span className="text-gray-500">{runner.identification_type}-{runner.identification}</span>
                    </div>
                  )) || (
                    <p className="text-sm text-gray-500">{selectedGroup.runner_names || 'No hay información de corredores'}</p>
                  )}
                </div>
              </div>

              {/* Comprobante de pago */}
              {selectedGroup.payment_proof_url && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Comprobante de Pago:</p>
                  <div className="bg-gray-50 rounded-md p-3">
                    {selectedGroup.payment_proof_url.toLowerCase().endsWith('.pdf') ? (
                      <a 
                        href={selectedGroup.payment_proof_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center text-blue-600 hover:text-blue-800"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Ver PDF del comprobante
                      </a>
                    ) : (
                      <div className="space-y-2">
                        <img 
                          src={selectedGroup.payment_proof_url} 
                          alt="Comprobante de pago"
                          className="max-w-full h-auto rounded-md border border-gray-300 cursor-pointer"
                          onClick={() => window.open(selectedGroup.payment_proof_url, '_blank')}
                        />
                        <a 
                          href={selectedGroup.payment_proof_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver en tamaño completo
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notas para acciones */}
              {(actionType === 'confirm' || actionType === 'reject') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {actionType === 'confirm' ? 'Notas (opcional)' : 'Motivo del rechazo (requerido)'}
                  </label>
                  <textarea
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder={actionType === 'confirm' ? 'Notas adicionales...' : 'Motivo del rechazo...'}
                  />
                </div>
              )}

              {/* Estado de la reserva */}
              {selectedGroup.reserved_until && actionType === 'view' && (
                <div className={`p-3 rounded-md ${isReservationExpired(selectedGroup.reserved_until) ? 'bg-red-50' : 'bg-blue-50'}`}>
                  <p className="text-sm font-medium text-gray-700 mb-1">Estado de la Reserva</p>
                  <p className={`text-sm ${isReservationExpired(selectedGroup.reserved_until) ? 'text-red-600' : 'text-blue-600'}`}>
                    {isReservationExpired(selectedGroup.reserved_until) 
                      ? 'Reserva expirada - El inventario ha sido liberado'
                      : `Reserva válida hasta: ${new Date(selectedGroup.reserved_until).toLocaleString()}`}
                  </p>
                </div>
              )}
            </div>

            {(actionType === 'confirm' || actionType === 'reject') && (
              <div className="flex justify-end space-x-3 mt-6">
                <button 
                  onClick={closeModal} 
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGroupAction}
                  disabled={actionType === 'reject' && !actionNotes.trim()}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    actionType === 'confirm' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionType === 'confirm' ? 'Confirmar Pago' : 'Rechazar Pago'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentManagement;