import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, 
  UserPlus, 
  Settings, 
  Package,
  Medal,
  CreditCard, 
  BarChart3,
  Home,
  Ticket,
  Shield,
  FileText,
  TrendingUp,
  Calculator,
  Frame
} from 'lucide-react';

interface MenuItem {
  name: string;
  href: string;
  icon: React.ElementType;
  requiredPermissions?: Array<{resource: string, action: string}>;
  requiredModule?: string;
  requireAll?: boolean; // Si true, requiere TODOS los permisos. Si false, requiere AL MENOS UNO
  showForAll?: boolean; // Si true, se muestra para todos los usuarios autenticados
}

const Sidebar: React.FC = () => {
  const { user, hasPermission, hasAnyPermission, hasAllPermissions, canAccessModule } = useAuth();

  const isSystemAdmin = user?.permissions?.includes('system:manage_all') || false;

  // Definir los elementos del menú con permisos
  const menuItems: MenuItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Home,
      showForAll: true // Todos los usuarios autenticados pueden ver su dashboard
    },
    {
      name: 'Registrar Corredor',
      href: '/register-runner',
      icon: Medal,
      requiredPermissions: [
        { resource: 'runners', action: 'create' },
        { resource: 'runners', action: 'register_group' }
      ],
      requiredModule: 'runner_registration'
    },
    {
      name: 'Lista Corredores',
      href: '/runners',
      icon: Users,
      requiredPermissions: [
        { resource: 'runners', action: 'read' },
        { resource: 'runners', action: 'manage' }
      ],
      requiredModule: 'runners_management'
    },
    {
      name: 'Gestión Pagos',
      href: '/payments',
      icon: CreditCard,
      requiredPermissions: [
        { resource: 'payments', action: 'read' },
        { resource: 'payments', action: 'manage' },
        { resource: 'payments', action: 'confirm' }
      ],
      requiredModule: 'payment_management'
    },
    {
      name: 'Inventario',
      href: '/inventory',
      icon: Package,
      requiredPermissions: [
        { resource: 'inventory', action: 'manage' },
        { resource: 'inventory', action: 'update' }
      ],
      requiredModule: 'inventory_management'
    },
    {
      name: 'Reportes',
      href: '/reports',
      icon: BarChart3,
      requiredPermissions: [
        { resource: 'dashboard', action: 'view_reports' },
        { resource: 'dashboard', action: 'view_admin' },
        { resource: 'dashboard', action: 'view_boss' }
      ],
      requiredModule: 'reports'
    },
    {
      name: 'Tickets Concierto',
      href: '/concert-tickets',
      icon: Ticket,
      requiredPermissions: [
        { resource: 'tickets', action: 'manage' },
        { resource: 'tickets', action: 'sell' },
        { resource: 'tickets', action: 'read' }
      ],
      requiredModule: 'ticket_management'
    },
    {
      name: 'Tokens iFrame',
      href: '/iframe-tokens',
      icon: Frame,
      requiredPermissions: [
        { resource: 'tickets', action: 'manage' },
        { resource: 'tickets', action: 'sell' }
      ],
      requiredModule: 'iframe_management'
    },
    {
      name: 'Analytics iFrame',
      href: '/iframe-analytics',
      icon: TrendingUp,
      requiredPermissions: [
        { resource: 'tickets', action: 'manage' }
      ],
      requiredModule: 'iframe_analytics'
    },
    {
      name: 'Gestión RBAC',
      href: '/rbac',
      icon: Shield,
      requiredPermissions: [
        { resource: 'system', action: 'manage_all' },
        { resource: 'users', action: 'manage' }
      ],
      requireAll: true,
      requiredModule: 'rbac_management'
    },
    {
      name: 'Tasas de Cambio',
      href: '/exchange-rates',
      icon: Calculator,
      requiredPermissions: [
        { resource: 'payments', action: 'manage' },
        { resource: 'dashboard', action: 'view_reports' }
      ],
      requiredModule: 'exchange_rates'
    }
  ];

  // Filtrar elementos del menú basado en permisos
  const filteredMenuItems = menuItems.filter(item => {
    if (!user) return false;

    // Si el usuario tiene permisos de admin total, mostrar todo
    if (user.permissions?.includes('system:manage_all')) return true;

    // Si el item es para todos los usuarios autenticados
    if (item.showForAll) return true;

    // Verificar módulo si está especificado
    if (item.requiredModule && !canAccessModule(item.requiredModule)) {
      return false;
    }

    // Verificar permisos si están especificados
    if (item.requiredPermissions && item.requiredPermissions.length > 0) {
      if (item.requireAll) {
        return hasAllPermissions(...item.requiredPermissions);
      } else {
        return hasAnyPermission(...item.requiredPermissions);
      }
    }

    // Si no hay requisitos específicos, no mostrar
    return false;
  });

  // Agrupar elementos por categoría para mejor organización
  const groupedItems = {
    general: filteredMenuItems.filter(item => 
      ['Dashboard', 'Mi Inscripción'].includes(item.name)
    ),
    gestion: filteredMenuItems.filter(item => 
      ['Registrar Corredor', 'Lista Corredores', 'Inventario'].includes(item.name)
    ),
    finanzas: filteredMenuItems.filter(item => 
      ['Gestión Pagos', 'Tasas de Cambio'].includes(item.name)
    ),
    tickets: filteredMenuItems.filter(item => 
      ['Tickets Concierto', 'Tokens iFrame', 'Analytics iFrame'].includes(item.name)
    ),
    reportes: filteredMenuItems.filter(item => 
      ['Reportes'].includes(item.name)
    ),
    sistema: filteredMenuItems.filter(item => 
      ['Gestión RBAC'].includes(item.name)
    )
  };

  const renderMenuGroup = (title: string, items: MenuItem[]) => {
    if (items.length === 0) return null;

    return (
      <div key={title} className="mb-6">
        {title !== 'General' && (
          <h3 className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {title}
          </h3>
        )}
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-lg transition-all duration-200 ease-in-out group ${
                    isActive
                      ? 'bg-orange-600 text-white font-semibold shadow-md'
                      : 'text-gray-700 hover:bg-orange-100 hover:text-orange-700'
                  }`
                }
              >
                <item.icon className="w-5 h-5 mr-3 transition-transform duration-200 group-hover:scale-110" />
                <span className="text-sm">{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <aside className="w-64 bg-white text-black flex flex-col min-h-screen shadow-xl border-r border-gray-200">
      {/* Header del Sidebar */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">CLX</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">CLX Nigth Run</h2>
            <p className="text-xs text-gray-500">Panel de Control</p>
          </div>
        </div>
      </div>
      
      {/* Contenedor de la navegación */}
      <nav className="flex-grow px-2 py-4 overflow-y-auto">
        {renderMenuGroup('General', groupedItems.general)}
        {renderMenuGroup('Gestión', groupedItems.gestion)}
        {renderMenuGroup('Finanzas', groupedItems.finanzas)}
        {renderMenuGroup('Tickets', groupedItems.tickets)}
        {renderMenuGroup('Reportes', groupedItems.reportes)}
        {renderMenuGroup('Sistema', groupedItems.sistema)}
      </nav>

      {/* Sección inferior con info del usuario */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-gray-600 font-medium text-sm">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">
              {user?.email}
            </p>
            <p className="text-xs text-gray-500">
              {user?.roles?.map(r => r.name).join(', ') || user?.role || 'Usuario'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;