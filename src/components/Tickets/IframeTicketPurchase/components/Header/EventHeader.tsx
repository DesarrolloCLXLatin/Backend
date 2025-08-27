// src/components/tickets/IframeTicketPurchase/components/Header/EventHeader.tsx

import React from 'react';
import { Music, Calendar, Clock, MapPin, Users, Zap } from 'lucide-react';
import { Inventory } from '../../types';
import { calculateAvailablePercentage, calculateOccupiedPercentage } from '../../utils/calculations';
import { EVENT_INFO } from '../../constants';

interface EventHeaderProps {
  inventory: Inventory;
}

const EventHeader: React.FC<EventHeaderProps> = ({ inventory }) => {
  const availablePercentage = calculateAvailablePercentage(inventory);
  const occupiedPercentage = calculateOccupiedPercentage(inventory);
  const isLowAvailability = availablePercentage < 20;

  return (
    <div className="relative bg-gradient-to-r from-[#FD8D6A] via-[#FD8D6A] to-[#f7764f] p-8 text-white overflow-hidden">
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl animate-pulse">
              <Music className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black">{EVENT_INFO.name}</h2>
              <p className="text-red-100 text-sm">{EVENT_INFO.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Detalles del evento */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <Calendar className="w-5 h-5 text-red-200" />
            <div>
              <p className="text-xs text-red-100">Fecha</p>
              <p className="text-sm font-bold">{EVENT_INFO.date}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <Clock className="w-5 h-5 text-red-200" />
            <div>
              <p className="text-xs text-red-100">Hora</p>
              <p className="text-sm font-bold">{EVENT_INFO.time}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <MapPin className="w-5 h-5 text-red-200" />
            <div>
              <p className="text-xs text-red-100">Lugar</p>
              <p className="text-sm font-bold">{EVENT_INFO.location}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <Users className="w-5 h-5 text-red-200" />
            <div>
              <p className="text-xs text-red-100">Disponibles</p>
              <p className="text-sm font-bold">{inventory.available_tickets}</p>
            </div>
          </div>
        </div>

        {/* Barra de disponibilidad */}
        <div className="relative">
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-yellow-400 transition-all duration-1000 ease-out relative"
              style={{ width: `${occupiedPercentage}%` }}
            >
              <div className="absolute inset-0 bg-white/30 animate-pulse" />
            </div>
          </div>
          {isLowAvailability && (
            <div className="mt-2 flex items-center gap-2 text-yellow-300 text-sm animate-pulse">
              <Zap className="w-4 h-4" />
              <span className="font-bold">¡Últimas entradas disponibles!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventHeader;