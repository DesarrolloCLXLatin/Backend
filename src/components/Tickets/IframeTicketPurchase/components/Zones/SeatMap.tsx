// src/components/tickets/IframeTicketPurchase/components/Zones/SeatMap.tsx

import React from 'react';
import { CheckCircle, X } from 'lucide-react';
import { SeatMapProps, Seat } from '../../types';

const SeatMap: React.FC<SeatMapProps> = ({ seats, selectedSeats, onSelectSeat }) => {
  const rows = [...new Set(seats.map(s => s.row))].sort();
  
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6">
      {/* Escenario */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-[#FD8D6A] via-[#ff7b5a] to-[#FD8D6A] text-white text-center py-3 rounded-t-2xl shadow-lg">
          <span className="text-sm font-bold tracking-wider">🎤 ESCENARIO 🎤</span>
        </div>
        <div className="h-2 bg-gradient-to-b from-[#FD8D6A]/50 to-transparent"></div>
      </div>
      
      {/* Asientos */}
      <div className="space-y-4">
        {rows.map(row => {
          const rowSeats = seats.filter(s => s.row === row);
          return (
            <div key={row} className="flex items-center justify-center gap-3">
              <span className="text-gray-400 font-bold w-8 text-center">{row}</span>
              <div className="flex gap-2">
                {rowSeats.map((seat) => {
                  const isSelected = selectedSeats.some(s => s.id === seat.id);
                  
                  return (
                    <button
                      key={seat.id}
                      onClick={() => onSelectSeat(seat)}
                      disabled={seat.status === 'sold'}
                      className={`
                        relative w-12 h-12 rounded-lg transition-all duration-200 transform hover:scale-110
                        ${seat.status === 'sold' 
                          ? 'bg-gray-700 cursor-not-allowed opacity-50' 
                          : seat.status === 'reserved'
                          ? 'bg-yellow-600/50 cursor-not-allowed'
                          : isSelected 
                          ? 'bg-gradient-to-b from-green-500 to-green-600 ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900 scale-110 shadow-lg shadow-green-500/50'
                          : 'bg-gradient-to-b from-[#FD8D6A] to-[#ff6b4a] hover:from-[#ff7b5a] hover:to-[#ff5b3a] shadow-lg shadow-orange-500/20'
                        }
                      `}
                      title={`Asiento ${seat.seat_number} - $${seat.price}`}
                    >
                      {isSelected && (
                        <CheckCircle className="w-6 h-6 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                      )}
                      {seat.status === 'sold' && (
                        <X className="w-5 h-5 text-gray-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                      )}
                      <span className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">
                        {seat.column}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Leyenda */}
      <div className="mt-8 pt-6 border-t border-gray-700">
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-b from-[#FD8D6A] to-[#ff6b4a] rounded"></div>
            <span className="text-gray-400">Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-b from-green-500 to-green-600 rounded ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900"></div>
            <span className="text-gray-400">Seleccionado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-700 rounded opacity-50"></div>
            <span className="text-gray-400">Vendido</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeatMap;