import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Users, 
  Shield, 
  Key, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle,
  Activity,
  Lock,
  UserCheck,
  UserX,
  BarChart3,
  PieChart as PieChartIcon,
  Settings,
  Package, // Para ModulesManager
  Database // Para EndpointDebugger
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

import { useAuth } from '../../contexts/AuthContext';
import UsersList from './UsersList';
import RolesList from './RolesList';
import RoleAssignment from './RoleAssignment';
import EndpointDebugger from './EndpointDebugger';
import PermissionsManager from './PermissionsManager';
import AuditLog from './AuditLog';
import ModulesManager from './ModulesManager';

// --- Types Definition ---
type TabType = 'dashboard' | 'users' | 'roles' | 'assignments' | 'modules' | 'permissions' | 'audit' | 'debugger';

interface Role {
  id: string;
  name: string;
  display_name?: string;
  is_system: boolean;
  users_count?: number;
}

interface RBACStatistics {
  total_users: number;
  total_roles: number;
  total_permissions: number;
  recent_changes: number;
  unused_permissions: number;
  users_without_roles: number;
  system_health: 'good' | 'warning' | 'critical';
  total_modules?: number;
  users_without_modules?: number;
}

interface RoleDistribution {
  role: string;
  users: number;
}

interface PermissionUsage {
  resource: string;
  assignedCount: number;
}

interface AuditLogEntry {
  id: string;
  user_email: string;
  action: 'grant' | 'revoke' | 'modify' | string;
  target_role_name?: string;
  target_user_email?: string;
  created_at: string;
}

// --- Helper Functions ---
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  if (hours < 24) return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
  return `hace ${days} día${days > 1 ? 's' : ''}`;
};

const getResourceDisplayName = (resource: string): string => {
  const names: Record<string, string> = {
    runners: 'Corredores',
    payments: 'Pagos',
    tickets: 'Tickets',
    inventory: 'Inventario',
    dashboard: 'Dashboard',
    system: 'Sistema',
    users: 'Usuarios',
    modules: 'Módulos',
  };
  return names[resource] || resource;
};

// --- Main Component ---
const RBACManagement: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [refreshUsersFlag, setRefreshUsersFlag] = useState(0);

  // --- State Management ---
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // Data states
  const [stats, setStats] = useState<RBACStatistics | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleDistribution, setRoleDistribution] = useState<RoleDistribution[]>([]);
  const [permissionUsage, setPermissionUsage] = useState<PermissionUsage[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);

  // State for inter-component communication
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  // --- Memoized Values ---
  const canManageRBAC = useMemo(() => 
    hasPermission('system', 'manage_all') || hasPermission('users', 'manage'),
    [hasPermission]
  );

  const canAccessDebugger = useMemo(() => 
    hasPermission('system', 'manage_all') || hasPermission('system', 'debug'),
    [hasPermission]
  );

  const handleModulesUpdated = useCallback(() => {
    console.log('🔄 Incrementando refreshUsersFlag de', refreshUsersFlag, 'a', refreshUsersFlag + 1);
    setRefreshUsersFlag(prev => prev + 1);
  }, [refreshUsersFlag]);
  
  const tabs = useMemo(() => {
    const baseTabs = [
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
      { id: 'users', label: 'Usuarios', icon: Users },
      { id: 'roles', label: 'Roles', icon: Shield },
      { id: 'assignments', label: 'Asignaciones', icon: Key },
      { id: 'modules', label: 'Módulos', icon: Package },
      { id: 'permissions', label: 'Permisos', icon: Settings },
      { id: 'audit', label: 'Auditoría', icon: Activity },
    ];

    // Solo agregar el debugger si el usuario tiene permisos
    if (canAccessDebugger) {
      baseTabs.push({
        id: 'debugger',
        label: 'Debugger',
        icon: Database
      });
    }

    return baseTabs;
  }, [canAccessDebugger]);

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };

    try {
      const [statsRes, rolesRes, permissionsReportRes, auditRes] = await Promise.all([
        fetch('/api/rbac/statistics', { headers }),
        fetch('/api/rbac/roles', { headers }),
        fetch('/api/rbac/reports/permissions-by-role', { headers }),
        fetch('/api/rbac/audit?limit=5', { headers }),
      ]);

      if (!statsRes.ok || !rolesRes.ok || !permissionsReportRes.ok || !auditRes.ok) {
        throw new Error('No se pudo cargar la información del sistema RBAC.');
      }

      const statsData = await statsRes.json();
      const rolesData = await rolesRes.json();
      const permissionsReportData = await permissionsReportRes.json();
      const auditData = await auditRes.json();
      
      // Set state with fetched data
      setStats(statsData);
      setRoles(rolesData.roles || []);
      setRecentActivity(auditData.entries || []);
      
      // Process data for charts
      const fetchedRoles: Role[] = rolesData.roles || [];
      setRoleDistribution(
        fetchedRoles.map(role => ({
          role: role.display_name || role.name,
          users: role.users_count || 0,
        }))
      );

      const usage: Record<string, Set<string>> = {};
      permissionsReportData.report?.forEach((roleData: { permissions: { resource: string; id: string }[] }) => {
          roleData.permissions?.forEach(perm => {
              if (!usage[perm.resource]) {
                  usage[perm.resource] = new Set();
              }
              usage[perm.resource].add(perm.id);
          });
      });
      setPermissionUsage(Object.entries(usage).map(([resource, permIds]) => ({
        resource: getResourceDisplayName(resource),
        assignedCount: permIds.size,
      })));

    } catch (err) {
      console.error('Error fetching RBAC data:', err);
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManageRBAC) {
      fetchData();
    }
  }, [canManageRBAC, fetchData]);

  // --- Handlers ---
  const handleRoleSelect = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (role) {
      setSelectedRole(role);
      setActiveTab('permissions');
    }
  };

  const handleUserSelectForAssignment = (userId: string) => {
    setSelectedUserId(userId);
    setActiveTab('assignments');
  };

  const handleUserSelectForModules = (userId: string) => {
    setSelectedUserId(userId);
    setActiveTab('modules');
  };
  
  // --- Render Logic ---
  if (!canManageRBAC) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-4">
        <div>
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600">No tienes los permisos necesarios para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-4">
        <div>
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error al Cargar Datos</h2>
          <p className="text-gray-600">{error || 'No se pudieron obtener las estadísticas del sistema.'}</p>
          <button onClick={fetchData} className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    { title: 'Usuarios Totales', value: stats.total_users, icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { title: 'Roles Activos', value: stats.total_roles, icon: Shield, color: 'text-green-600', bgColor: 'bg-green-100' },
    { title: 'Permisos Definidos', value: stats.total_permissions, icon: Key, color: 'text-purple-600', bgColor: 'bg-purple-100' },
    { title: 'Cambios Recientes (24h)', value: stats.recent_changes, icon: TrendingUp, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  ];

  // Si hay estadísticas de módulos, agregar una tarjeta adicional
  if (stats.total_modules !== undefined) {
    statCards.push({
      title: 'Módulos Disponibles',
      value: stats.total_modules,
      icon: Package,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100'
    });
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardContent 
            stats={stats} 
            statCards={statCards} 
            roleDistribution={roleDistribution} 
            permissionUsage={permissionUsage} 
            recentActivity={recentActivity} 
            setActiveTab={setActiveTab} 
          />
        );
      case 'users':
        return (
          <UsersList 
            onSelectUser={handleUserSelectForAssignment} 
            onSelectUserForModules={handleUserSelectForModules}
            refreshTrigger={refreshUsersFlag}
          />
        );
      case 'roles':
        return <RolesList onSelectRole={handleRoleSelect} />;
      case 'assignments':
        return (
          <RoleAssignment 
            selectedUserId={selectedUserId} 
            onUserChange={setSelectedUserId} 
          />
        );
      case 'modules':
        return (
          <ModulesManager 
            selectedUserId={selectedUserId} 
            onUserChange={setSelectedUserId}
            onModulesUpdated={handleModulesUpdated}
          />
        );
      case 'permissions':
        return selectedRole ? (
          <PermissionsManager 
            roleId={selectedRole.id} 
            roleName={selectedRole.name} 
            isSystemRole={selectedRole.is_system} 
          />
        ) : (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Selecciona un rol desde la pestaña "Roles" para gestionar sus permisos.</p>
          </div>
        );
      case 'audit':
        return <AuditLog />;
      case 'debugger':
        return canAccessDebugger ? (
          <EndpointDebugger />
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-500">No tienes permisos para acceder al debugger.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Shield className="w-8 h-8 mr-3 text-orange-600" />
              Gestión RBAC
            </h1>
            <p className="text-gray-600 mt-1">
              Control de acceso basado en roles, permisos y módulos.
              {canAccessDebugger && (
                <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                  + Debugger
                </span>
              )}
            </p>
          </div>
          <div className="text-sm text-gray-500 text-left sm:text-right">
            <p>Usuario: <span className="font-medium">{user?.email}</span></p>
            <p>Roles: <span className="font-medium">{user?.roles?.map(r => r.name).join(', ') || 'N/A'}</span></p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b overflow-x-auto">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex-shrink-0 flex items-center px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } ${tab.id === 'debugger' ? 'bg-orange-50' : ''}`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
                {tab.id === 'debugger' && (
                  <span className="ml-2 text-xs bg-orange-200 text-orange-800 px-1 py-0.5 rounded">
                    DEV
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-4 sm:p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

// --- Dashboard Content Sub-Component ---
interface DashboardContentProps {
  stats: RBACStatistics;
  statCards: { title: string; value: number; icon: React.ElementType; color: string; bgColor: string }[];
  roleDistribution: RoleDistribution[];
  permissionUsage: PermissionUsage[];
  recentActivity: AuditLogEntry[];
  setActiveTab: (tab: TabType) => void;
}

const DashboardContent: React.FC<DashboardContentProps> = ({ 
  stats, 
  statCards, 
  roleDistribution, 
  permissionUsage, 
  recentActivity, 
  setActiveTab 
}) => {
  const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];
  const getHealthColor = (health: string) => health === 'good' ? 'text-green-600 bg-green-100' : health === 'warning' ? 'text-yellow-600 bg-yellow-100' : 'text-red-600 bg-red-100';
  const getHealthIcon = (health: string) => health === 'good' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />;

  return (
    <div className="space-y-6">
      {/* System Health */}
      <div className="bg-gray-50 rounded-lg border p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h3 className="text-lg font-medium text-gray-900">Estado del Sistema</h3>
          <div className={`flex items-center px-3 py-1.5 rounded-full text-sm ${getHealthColor(stats.system_health)}`}>
            {getHealthIcon(stats.system_health)}
            <span className="ml-2 font-medium">
              {stats.system_health === 'good' ? 'Protegido' : stats.system_health === 'warning' ? 'Advertencia' : 'Crítico'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value.toLocaleString()}</p>
              </div>
              <div className={`p-3 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <PieChartIcon className="w-5 h-5 mr-2" />
            Distribución de Usuarios por Rol
          </h3>
          {roleDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie 
                  data={roleDistribution} 
                  dataKey="users" 
                  nameKey="role" 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={80} 
                  label
                >
                  {roleDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-10">No hay datos de distribución.</p>
          )}
        </div>
        
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Permisos Asignados por Recurso
          </h3>
          {permissionUsage.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={permissionUsage} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="resource" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="assignedCount" name="Permisos Asignados" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-10">No hay datos de uso de permisos.</p>
          )}
        </div>
      </div>

      {/* Warnings & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          {stats.users_without_roles > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <UserX className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-medium text-yellow-900">Usuarios sin Rol</h4>
                <p className="text-sm text-yellow-700">{stats.users_without_roles} usuarios no tienen roles asignados.</p>
                <button onClick={() => setActiveTab('users')} className="mt-2 text-sm font-medium text-yellow-900 hover:underline">
                  Revisar →
                </button>
              </div>
            </div>
          )}
          
          {stats.users_without_modules !== undefined && stats.users_without_modules > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <Package className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-medium text-blue-900">Usuarios sin Módulos</h4>
                <p className="text-sm text-blue-700">{stats.users_without_modules} usuarios no tienen módulos asignados.</p>
                <button onClick={() => setActiveTab('modules')} className="mt-2 text-sm font-medium text-blue-900 hover:underline">
                  Asignar Módulos →
                </button>
              </div>
            </div>
          )}
          
          {stats.unused_permissions > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
              <Lock className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-medium text-purple-900">Permisos sin Uso</h4>
                <p className="text-sm text-purple-700">{stats.unused_permissions} permisos no están asignados.</p>
                <button onClick={() => setActiveTab('permissions')} className="mt-2 text-sm font-medium text-purple-900 hover:underline">
                  Auditar →
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Recent Activity */}
        <div className="bg-white rounded-lg border p-6 md:col-span-2">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Actividad Reciente
          </h3>
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 bg-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-800">
                      <span className="font-medium">{activity.user_email}</span> {activity.action}
                      {activity.target_role_name && (
                        <> el rol <span className="font-medium">{activity.target_role_name}</span></>
                      )}
                      {activity.target_user_email && (
                        <> a <span className="font-medium">{activity.target_user_email}</span></>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{formatRelativeTime(activity.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">No hay actividad reciente.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RBACManagement;