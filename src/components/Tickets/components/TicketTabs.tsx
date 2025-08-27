import React from 'react';
import { ShoppingCart, Ticket, Clock, BarChart3, QrCode } from 'lucide-react';
import { TabType } from '../types';

interface TicketTabsProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  userRole?: string;
  pendingCount: number;
}

const TicketTabs: React.FC<TicketTabsProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  pendingCount
}) => {
  const tabs = [
    {
      id: 'sell' as TabType,
      label: 'Vender',
      icon: ShoppingCart,
      roles: ['admin', 'tienda']
    },
    {
      id: 'tickets' as TabType,
      label: 'Entradas',
      icon: Ticket,
      roles: ['admin', 'tienda', 'user']
    },
    {
      id: 'pending-validations' as TabType,
      label: 'Validaciones',
      icon: Clock,
      roles: ['admin'],
      badge: pendingCount
    },
    {
      id: 'stats' as TabType,
      label: 'Estadísticas',
      icon: BarChart3,
      roles: ['admin']
    }
  ];

  const visibleTabs = tabs.filter(tab => 
    !tab.roles || tab.roles.includes(userRole || 'user')
  );

  return (
    <div className="flex items-center justify-between">
      <div className="flex bg-white rounded-lg shadow-sm p-1">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 rounded-md transition-all flex items-center font-medium relative ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-orange-600 to-[#f08772] text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5 mr-2" />
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5 animate-pulse">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {['admin', 'tienda'].includes(userRole || '') && activeTab === 'tickets' && (
        <button className="flex items-center px-6 py-3 bg-gradient-to-r from-orange-600 to-[#f08772] text-white rounded-lg hover:shadow-lg transition-all font-medium">
          <QrCode className="w-5 h-5 mr-2" />
          Verificar Entrada
        </button>
      )}
    </div>
  );
};

export default TicketTabs;