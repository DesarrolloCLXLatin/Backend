// components/RBAC/RBACStats.tsx
import React, { useState, useEffect } from 'react';
import { Users, Shield, Key, TrendingUp, AlertCircle } from 'lucide-react';

interface RBACStatistics {
  total_users: number;
  total_roles: number;
  total_permissions: number;
  active_sessions: number;
  recent_changes: number;
  unused_permissions: number;
  users_without_roles: number;
  system_health: 'good' | 'warning' | 'critical';
}

const RBACStats: React.FC = () => {
  const [stats, setStats] = useState<RBACStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/rbac/statistics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching RBAC statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Usuarios Totales',
      value: stats.total_users,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Roles Activos',
      value: stats.total_roles,
      icon: Shield,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Permisos Definidos',
      value: stats.total_permissions,
      icon: Key,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Cambios Recientes',
      value: stats.recent_changes,
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* System Health */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Estado del Sistema</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${
              stats.system_health === 'good' ? 'bg-green-500' :
              stats.system_health === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm font-medium text-gray-900">
              {stats.system_health === 'good' ? 'Sistema Saludable' :
               stats.system_health === 'warning' ? 'Advertencias Detectadas' : 'Requiere Atención'}
            </span>
          </div>
          <span className="text-sm text-gray-500">
            {stats.active_sessions} sesiones activas
          </span>
        </div>
      </div>

      {/* Warnings */}
      {(stats.unused_permissions > 0 || stats.users_without_roles > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-2">Advertencias del Sistema:</p>
              <ul className="list-disc list-inside space-y-1">
                {stats.unused_permissions > 0 && (
                  <li>{stats.unused_permissions} permisos no están asignados a ningún rol</li>
                )}
                {stats.users_without_roles > 0 && (
                  <li>{stats.users_without_roles} usuarios no tienen roles asignados</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 text-left border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors">
            <Users className="w-5 h-5 text-orange-600 mb-2" />
            <p className="text-sm font-medium text-gray-900">Revisar Usuarios sin Roles</p>
            <p className="text-xs text-gray-500 mt-1">Asignar roles a usuarios nuevos</p>
          </button>
          <button className="p-4 text-left border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors">
            <Shield className="w-5 h-5 text-orange-600 mb-2" />
            <p className="text-sm font-medium text-gray-900">Auditar Permisos</p>
            <p className="text-xs text-gray-500 mt-1">Revisar permisos no utilizados</p>
          </button>
          <button className="p-4 text-left border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors">
            <Key className="w-5 h-5 text-orange-600 mb-2" />
            <p className="text-sm font-medium text-gray-900">Generar Reporte</p>
            <p className="text-xs text-gray-500 mt-1">Exportar informe de seguridad</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RBACStats;