// src/components/tickets/IframeTicketPurchase/components/Zones/ZoneCard.tsx

import React from 'react';
import { Users, Star } from 'lucide-react';
import { TicketZone } from '../../types';

interface ZoneCardProps {
  zone: TicketZone;
  isSelected?: boolean;
  onSelect: (zone: TicketZone) => void;
}

const ZoneCard: React.FC<ZoneCardProps> = ({ zone, isSelected = false, onSelect }) => {
  const availabilityPercentage = (zone.available / zone.total_capacity) * 100;
  
  return (
    <button
      onClick={() => onSelect(zone)}
      className="relative group hover:scale-105 transition-all duration-300 w-full text-left"
    >
      <div className={`
        border-2 rounded-2xl p-6 h-full
        ${zone.zone_type === 'general' 
          ? 'border-gray-600 bg-gradient-to-b from-gray-800 to-gray-900 hover:border-[#FD8D6A]/50' 
          : 'border-[#FD8D6A]/50 bg-gradient-to-b from-[#FD8D6A]/10 to-[#FD8D6A]/5 hover:border-[#FD8D6A]'
        }
        ${isSelected ? 'border-[#FD8D6A] scale-105 shadow-lg shadow-[#FD8D6A]/30' : ''}
      `}>
        {/* Badge de tipo */}
        {zone.is_numbered && (
          <div className="absolute -top-3 right-4">
            <span className="bg-gradient-to-r from-[#FD8D6A] to-[#ff6b4a] text-white text-xs font-bold px-3 py-1 rounded-full">
              Asientos Numerados
            </span>
          </div>
        )}
        
        {/* Icono */}
        <div className="mb-4">
          {zone.zone_type === 'general' && <Users className="w-12 h-12 mx-auto text-gray-400" />}
          {zone.zone_type === 'vip' && <Star className="w-12 h-12 mx-auto text-[#FD8D6A]" />}
        </div>
        
        {/* Nombre y precio */}
        <h4 className="text-xl font-bold text-white mb-2">{zone.zone_name}</h4>
        <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FD8D6A] to-[#ff6b4a] mb-3">
          ${zone.price_usd}
        </p>
        
        {/* Descripción */}
        <p className="text-sm text-gray-400 mb-4">{zone.description}</p>
        
        {/* Disponibilidad */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Disponibles:</span>
            <span className="font-bold text-white">{zone.available}/{zone.total_capacity}</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#FD8D6A] to-[#ff6b4a] transition-all"
              style={{ width: `${availabilityPercentage}%` }}
            />
          </div>
        </div>
        
        {/* Hover effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#FD8D6A]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
      </div>
    </button>
  );
};

export default ZoneCard;