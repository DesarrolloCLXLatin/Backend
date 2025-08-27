// src/components/tickets/IframeTicketPurchase/components/Zones/ZoneSelector.tsx

import React from 'react';
import { TicketZone } from '../../types';
import ZoneCard from './ZoneCard';

interface ZoneSelectorProps {
  zones: TicketZone[];
  selectedZone: TicketZone | null;
  onSelectZone: (zone: TicketZone) => void;
}

const ZoneSelector: React.FC<ZoneSelectorProps> = ({ 
  zones, 
  selectedZone, 
  onSelectZone 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {zones.map((zone) => (
        <ZoneCard
          key={zone.id}
          zone={zone}
          isSelected={selectedZone?.id === zone.id}
          onSelect={onSelectZone}
        />
      ))}
    </div>
  );
};

export default ZoneSelector;