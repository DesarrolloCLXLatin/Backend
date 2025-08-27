import React, { useState } from 'react';
import { ConcertTicket, TicketInventory } from '../../../types';
import TicketStats from '../components/TicketStats';
import TicketFilters from '../components/TicketFilters';
import TicketTable from '../components/TicketTable';
import TicketAlerts from '../components/TicketAlerts';
import VerifyTicketModal from '../components/modals/VerifyTicketModal';
import { FilterState } from '../types';
import { calculateEmailStats } from '../utils/ticketHelpers';

interface TicketsSectionProps {
  tickets: ConcertTicket[];
  inventory: TicketInventory | null;
  venueStats: any;
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  loading: boolean;
  onRefresh: () => void;
}

const TicketsSection: React.FC<TicketsSectionProps> = ({
  tickets,
  inventory,
  venueStats,
  filters,
  setFilters,
  loading,
  onRefresh
}) => {
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const emailStats = calculateEmailStats(tickets);

  return (
    <>
      <TicketStats 
        inventory={inventory}
        venueStats={venueStats}
        emailStats={emailStats}
      />
      
      <TicketAlerts 
        inventory={inventory}
        pendingCount={emailStats.pending_verification}
      />
      
      <TicketFilters 
        filters={filters}
        setFilters={setFilters}
      />
      
      <TicketTable 
        tickets={tickets}
        loading={loading}
        onRefresh={onRefresh}
      />
      
      <VerifyTicketModal 
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        onVerify={onRefresh}
      />
    </>
  );
};

export default TicketsSection;