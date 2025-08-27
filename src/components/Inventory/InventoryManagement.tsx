import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Package, Plus, Minus, AlertTriangle, TrendingUp, Save, Users, User, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

// Interfaces actualizadas para incluir género
interface InventoryItem {
  id?: string;
  shirt_size: string;
  gender: 'M' | 'F';
  stock: number;
  reserved: number;
  assigned: number; // Nuevo campo
  available: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

// Actualizar la interface InventoryStats
interface InventoryStats {
  total: {
    stock: number;
    reserved: number;
    assigned: number; // Nuevo campo
    available: number;
  };
  byGender: {
    M: {
      stock: number;
      reserved: number;
      assigned: number;
      available: number;
    };
    F: {
      stock: number;
      reserved: number;
      assigned: number;
      available: number;
    };
  };
}

interface InventoryAlert {
  shirt_size: string;
  gender: string;
  available: number;
  alert_level: 'critical' | 'high' | 'medium';
  message?: string;
}

// Interfaces para las respuestas del API
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface SummaryResponse {
  summary: Array<{
    shirt_size: string;
    gender?: string;
    stock: number;
    reserved: number;
    available: number;
    status: string;
  }>;
  totals: {
    total_stock: number;
    total_reserved: number;
    total_available: number;
  };
}

interface AlertsResponse {
  alerts: InventoryAlert[];
  total_alerts: number;
  threshold: number;
}

const InventoryManagement: React.FC = () => {
  const { token } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<InventoryStats>({
    total: {
      stock: 0,
      reserved: 0,
      available: 0
    },
    byGender: {
      M: { stock: 0, available: 0 },
      F: { stock: 0, available: 0 }
    }
  });
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState<Record<string, number>>({});
  const [selectedGender, setSelectedGender] = useState<'all' | 'M' | 'F'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Función para cargar inventario
  const fetchInventory = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/inventory', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('No se pudo cargar el inventario. Verifique sus permisos.');
      }
      
      const result = await response.json();
      
      // ✅ NUEVO: Manejar la estructura { success, data }
      let inventoryData: InventoryItem[] = [];
      
      if (result.success && Array.isArray(result.data)) {
        inventoryData = result.data;
      } else if (Array.isArray(result)) {
        // Compatibilidad hacia atrás
        inventoryData = result;
      } else {
        console.error('Formato de respuesta inesperado:', result);
        throw new Error('Formato de datos de inventario inválido');
      }

      setInventory(inventoryData);
      
      // Inicializar updates con valores actuales
      const initialUpdates: Record<string, number> = {};
      inventoryData.forEach((item: InventoryItem) => {
        const key = `${item.shirt_size}-${item.gender}`;
        initialUpdates[key] = item.stock;
      });
      setUpdates(initialUpdates);

      // Calcular estadísticas manualmente si el backend no las envía
      calculateStats(inventoryData);

    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      toast.error(error.message || 'Error al cargar inventario');
      setInventory([]); // ✅ Asegurar que inventory sea un array vacío en caso de error
    }
  }, [token]);

  // Función para calcular estadísticas desde el inventario
  const calculateStats = (inventoryData: InventoryItem[]) => {
    const newStats: InventoryStats = {
      total: {
        stock: 0,
        reserved: 0,
        assigned: 0,
        available: 0
      },
      byGender: {
        M: { stock: 0, reserved: 0, assigned: 0, available: 0 },
        F: { stock: 0, reserved: 0, assigned: 0, available: 0 }
      }
    };

    inventoryData.forEach(item => {
      newStats.total.stock += item.stock;
      newStats.total.reserved += item.reserved;
      newStats.total.assigned += item.assigned || 0;
      newStats.total.available += item.available;

      if (item.gender === 'M' || item.gender === 'F') {
        newStats.byGender[item.gender].stock += item.stock;
        newStats.byGender[item.gender].reserved += item.reserved;
        newStats.byGender[item.gender].assigned += item.assigned || 0;
        newStats.byGender[item.gender].available += item.available;
      }
    });

    setStats(newStats);
  };

  // Función para cargar estadísticas
  const fetchStats = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/inventory/summary', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        
        // ✅ NUEVO: Manejar la estructura { success, data }
        let summaryData: SummaryResponse | null = null;
        
        if (result.success && result.data) {
          summaryData = result.data;
        } else if (result.summary && result.totals) {
          // Compatibilidad hacia atrás
          summaryData = result;
        }

        if (summaryData && summaryData.totals) {
          const newStats: InventoryStats = {
            total: {
              stock: summaryData.totals.total_stock || 0,
              reserved: summaryData.totals.total_reserved || 0,
              available: summaryData.totals.total_available || 0
            },
            byGender: {
              M: { stock: 0, available: 0 },
              F: { stock: 0, available: 0 }
            }
          };

          // Calcular estadísticas por género desde el summary si está disponible
          if (summaryData.summary && Array.isArray(summaryData.summary)) {
            summaryData.summary.forEach((item: any) => {
              if (item.gender === 'M' || item.gender === 'F') {
                newStats.byGender[item.gender].stock += item.stock || 0;
                newStats.byGender[item.gender].available += item.available || 0;
              }
            });
          }

          setStats(newStats);
        }
      }
    } catch (error) {
      console.error('Error fetching inventory stats:', error);
      // No mostrar error, ya que las estadísticas se pueden calcular localmente
    }
  }, [token]);

  // Función para cargar alertas
  const fetchAlerts = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/inventory/alerts', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        
        // ✅ NUEVO: Manejar la estructura { success, data }
        let alertsData: InventoryAlert[] = [];
        
        if (result.success && result.data && result.data.alerts) {
          alertsData = result.data.alerts;
        } else if (result.alerts) {
          // Compatibilidad hacia atrás
          alertsData = result.alerts;
        }

        setAlerts(alertsData);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setAlerts([]); // ✅ Asegurar array vacío en caso de error
    }
  }, [token]);

  // Cargar datos iniciales
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      
      try {
        await Promise.all([
          fetchInventory(),
          fetchStats(),
          fetchAlerts()
        ]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [token, fetchInventory, fetchStats, fetchAlerts]);

  const handleStockUpdate = (size: string, gender: string, newStock: number) => {
    if (newStock < 0) return;
    const key = `${size}-${gender}`;
    setUpdates(prev => ({ ...prev, [key]: newStock }));
  };

  const saveInventoryUpdates = async () => {
    try {
      const inventoryUpdates = Object.entries(updates).map(([key, stock]) => {
        const [shirt_size, gender] = key.split('-');
        return { shirt_size, gender, stock };
      });

      const response = await fetch('/api/inventory', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ updates: inventoryUpdates }),
      });

      const result = await response.json();

      if (response.ok) {
        // ✅ NUEVO: Verificar estructura de respuesta
        if (result.success) {
          toast.success('Inventario actualizado correctamente');
        } else {
          toast.error(result.message || 'Error al actualizar inventario');
        }
        await Promise.all([fetchInventory(), fetchStats(), fetchAlerts()]);
      } else {
        toast.error(result.message || 'Error al actualizar inventario');
      }
    } catch (error) {
      console.error('Error updating inventory:', error);
      toast.error('Error al actualizar inventario');
    }
  };

  const refreshReservations = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/inventory/recalculate-reserved', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        // ✅ NUEVO: Verificar estructura de respuesta
        if (result.success) {
          toast.success('Reservas recalculadas correctamente');
        } else {
          toast.error(result.message || 'Error al recalcular reservas');
        }
        await Promise.all([fetchInventory(), fetchStats()]);
      } else {
        toast.error(result.message || 'Error al recalcular reservas');
      }
    } catch (error) {
      console.error('Error refreshing reservations:', error);
      toast.error('Error al recalcular reservas');
    } finally {
      setRefreshing(false);
    }
  };

  const getStockStatusColor = (available: number, total: number) => {
    if (total <= 0 || available <= 0) return 'text-red-600 bg-red-100';
    const percentage = (available / total) * 100;
    if (percentage <= 10) return 'text-red-600 bg-red-100';
    if (percentage <= 25) return 'text-orange-600 bg-orange-100';
    if (percentage <= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getStockStatusText = (available: number, total: number) => {
    if (total <= 0 || available <= 0) return 'Agotado';
    const percentage = (available / total) * 100;
    if (percentage <= 10) return 'Crítico';
    if (percentage <= 25) return 'Bajo';
    if (percentage <= 50) return 'Medio';
    return 'Disponible';
  };

  const getGenderLabel = (gender: string) => {
    return gender === 'M' ? 'Masculino' : 'Femenino';
  };

  const getGenderColor = (gender: string) => {
    return gender === 'M' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800';
  };

  const hasChanges = () => {
    return inventory.some(item => {
      const key = `${item.shirt_size}-${item.gender}`;
      return updates[key] !== item.stock;
    });
  };

  // ✅ NUEVO: Verificación adicional de que inventory sea un array
  const safeInventory = Array.isArray(inventory) ? inventory : [];

  // Filtrar inventario por género
  const filteredInventory = selectedGender === 'all' 
    ? safeInventory 
    : safeInventory.filter(item => item.gender === selectedGender);

  // Ordenar inventario: primero por género, luego por talla
  const sortedInventory = [...filteredInventory].sort((a, b) => {
    if (a.gender !== b.gender) return a.gender === 'M' ? -1 : 1;
    
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    return sizeOrder.indexOf(a.shirt_size) - sizeOrder.indexOf(b.shirt_size);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Inventario</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={refreshReservations}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Recalcular Reservas
          </button>
          {hasChanges() && (
            <button
              onClick={saveInventoryUpdates}
              className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar Cambios
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/*<div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stock Total</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total.stock}</p>
            </div>
            <div className="p-3 rounded-full bg-orange-500">
              <Package className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>*/}

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Reservado</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total.reserved}</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-500">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Asignado</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total.assigned}</p>
              <p className="text-xs text-gray-500 mt-1">Confirmados con pago</p>
            </div>
            <div className="p-3 rounded-full bg-blue-500">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Disponible</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total.available}</p>
            </div>
            <div className="p-3 rounded-full bg-green-500">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 flex items-center">
                <Users className="w-4 h-4 mr-1 text-blue-600" />
                Masculino
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.byGender.M.available} / {stats.byGender.M.stock}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 flex items-center">
                <Users className="w-4 h-4 mr-1 text-pink-600" />
                Femenino
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.byGender.F.available} / {stats.byGender.F.stock}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {Array.isArray(alerts) && alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Alertas de Inventario Bajo</h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc list-inside space-y-1">
                  {alerts.map((alert, index) => (
                    <li key={index}>
                      {alert.message || `Talla ${alert.shirt_size} ${getGenderLabel(alert.gender)}: Solo ${alert.available} disponibles`}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gender Filter Tabs */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Filtrar por género:</span>
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedGender('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedGender === 'all'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setSelectedGender('M')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedGender === 'M'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" />
              Masculino
            </button>
            <button
              onClick={() => setSelectedGender('F')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedGender === 'F'
                  ? 'bg-pink-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" />
              Femenino
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            Inventario por Tallas
            {selectedGender !== 'all' && ` - ${getGenderLabel(selectedGender)}`}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Talla
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Género
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reservado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Asignado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Disponible
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Array.isArray(sortedInventory) && sortedInventory.length > 0 ? (
                sortedInventory.map((item) => {
                  const key = `${item.shirt_size}-${item.gender}`;
                  const updatedStock = updates[key] ?? item.stock;
                  const updatedAvailable = updatedStock - item.reserved - (item.assigned || 0);

                  return (
                    <tr key={key} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-700">
                            {item.shirt_size}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getGenderColor(item.gender)}`}>
                          <User className="w-3 h-3 mr-1" />
                          {getGenderLabel(item.gender)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleStockUpdate(item.shirt_size, item.gender, Math.max(0, updatedStock - 1))}
                            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            disabled={updatedStock <= 0}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={updatedStock}
                            onChange={(e) => handleStockUpdate(item.shirt_size, item.gender, parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                          <button
                            onClick={() => handleStockUpdate(item.shirt_size, item.gender, updatedStock + 1)}
                            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.reserved}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.assigned || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${
                          updatedAvailable !== item.available ? 'text-orange-600' : 'text-gray-900'
                        }`}>
                          {updatedAvailable}
                        </span>
                        {updatedAvailable < 0 && (
                          <span className="ml-1 text-xs text-red-600">(Sobregiro)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          getStockStatusColor(updatedAvailable, updatedStock)
                        }`}>
                          {getStockStatusText(updatedAvailable, updatedStock)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {updatedStock !== item.stock && (
                          <span className="text-xs text-orange-600 font-medium">
                            Pendiente guardar
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No hay datos de inventario</h3>
                    <p className="text-gray-500">
                      {selectedGender !== 'all' 
                        ? `No hay inventario para el género ${getGenderLabel(selectedGender)}`
                        : 'No se encontraron datos de inventario'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryManagement;