import React from 'react';
import { Package, TrendingUp, Box, BarChart3, MailCheck, Clock } from 'lucide-react';
import { TicketInventory } from '../../../types';

interface TicketStatsProps {
  inventory: TicketInventory | null;
  venueStats: any;
  emailStats: {
    sent_today: number;
    p2c_confirmed_today: number;
    pending_verification: number;
    manual_pending_today: number;
  };
}

const TicketStats: React.FC<TicketStatsProps> = ({ inventory, venueStats, emailStats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
      <StatsCard
        title="Capacidad Total"
        value={venueStats?.venue?.totalCapacity || inventory?.total_tickets || 5270}
        icon={Package}
        iconColor="text-gray-400"
      />
      
      <StatsCard
        title="Vendidas"
        value={venueStats?.venue?.totalSold || inventory?.sold_tickets || 0}
        icon={TrendingUp}
        iconColor="text-green-500"
        valueColor="text-green-600"
      />
      
      <StatsCard
        title="Boxes Vendidos"
        value={`${venueStats?.boxes?.sold || 0}/${venueStats?.boxes?.total || 30}`}
        icon={Box}
        iconColor="text-orange-500"
        valueColor="text-orange-600"
      />
      
      <StatsCard
        title="Disponibles"
        value={venueStats?.venue?.totalAvailable || inventory?.available_tickets || 0}
        icon={BarChart3}
        iconColor="text-blue-500"
        valueColor="text-blue-600"
      />
      
      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/90">Emails Hoy</p>
            <p className="text-2xl font-bold">{emailStats.sent_today}</p>
            <p className="text-xs text-white/80 mt-1">
              {emailStats.p2c_confirmed_today} P2C confirmados
            </p>
          </div>
          <MailCheck className="w-8 h-8 text-white/80" />
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/90">Pendientes</p>
            <p className="text-2xl font-bold">{emailStats.pending_verification}</p>
            <p className="text-xs text-white/80 mt-1">
              {emailStats.manual_pending_today} nuevos hoy
            </p>
          </div>
          <Clock className="w-8 h-8 text-white/80" />
        </div>
      </div>
    </div>
  );
};

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconColor?: string;
  valueColor?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  iconColor = "text-gray-400",
  valueColor = "text-gray-900"
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-2xl font-bold ${valueColor}`}>
            {value}
          </p>
        </div>
        <Icon className={`w-8 h-8 ${iconColor}`} />
      </div>
    </div>
  );
};

export default TicketStats;