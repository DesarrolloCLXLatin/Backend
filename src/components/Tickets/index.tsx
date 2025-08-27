import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTicketManagement } from './hooks/useTicketManagement';
import TicketHeader from './components/TicketHeader';
import TicketTabs from './components/TicketTabs';
import SellSection from './sections/SellSection';
import TicketsSection from './sections/TicketsSection';
import PendingValidationsSection from './sections/PendingValidationsSection';
import StatsSection from './sections/StatsSection';
import { TabType } from './types';

const ConcertTicketManagement: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('tickets');
  
  const {
    tickets,
    inventory,
    venueStats,
    pendingValidations,
    pendingCount,
    loading,
    filters,
    setFilters,
    refreshData,
  } = useTicketManagement(activeTab);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'sell':
        return <SellSection onSuccess={refreshData} />;
      case 'tickets':
        return (
          <TicketsSection
            tickets={tickets}
            inventory={inventory}
            venueStats={venueStats}
            filters={filters}
            setFilters={setFilters}
            loading={loading}
            onRefresh={refreshData}
          />
        );
      case 'pending-validations':
        return user?.role === 'admin' ? (
          <PendingValidationsSection
            pendingValidations={pendingValidations}
            pendingCount={pendingCount}
            loading={loading}
            onRefresh={refreshData}
          />
        ) : null;
      case 'stats':
        return user?.role === 'admin' ? (
          <StatsSection
            tickets={tickets}
            venueStats={venueStats}
          />
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <TicketHeader userRole={user?.role} />
      <TicketTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={user?.role}
        pendingCount={pendingCount}
      />
      {renderTabContent()}
    </div>
  );
};

export default ConcertTicketManagement;