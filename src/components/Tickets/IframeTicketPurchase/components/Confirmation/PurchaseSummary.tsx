// src/components/tickets/IframeTicketPurchase/components/Confirmation/PurchaseSummary.tsx

import React from 'react';
import { Sparkles, Package, ShoppingCart } from 'lucide-react';
import { TicketZone, Seat } from '../../types';

interface PurchaseSummaryProps {
  selectedZone: TicketZone | null;
  selectedSeats: Seat[];
  generalQuantity: number;
  totalPrice: number;
  totalBs: string;
  exchangeRate: number | null;
}

const PurchaseSummary: React.FC<PurchaseSummaryProps> = ({
  selectedZone,
  selectedSeats,
  generalQuantity,
  totalPrice,
  totalBs,
  exchangeRate
}) => {
  if (!selectedZone) return null;

  // Detectar si es una compra de box
  const isBoxPurchase = selectedZone.zone_type === 'vip' && selectedZone.zone_code?.startsWith('B');
  const isFullBoxPurchase = (selectedZone as any).box_full_purchase === true;
  const boxQuantity = (selectedZone as any).box_quantity || generalQuantity;
  const BOX_CAPACITY = 10;

  return (
    <div className="bg-gradient-to-r from-[#FD8D6A]/20 to-[#ff6b4a]/20 border border-[#FD8D6A]/30 rounded-2xl p-6">
      <h4 className="font-bold text-white mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-[#FD8D6A]" />
        Resumen de tu Compra
      </h4>
      
      <div className="space-y-3">
        <div className="flex justify-between text-gray-300">
          <span>Tipo de entrada:</span>
          <span className="font-semibold text-white">
            {selectedZone.zone_name}
            {isBoxPurchase && isFullBoxPurchase && (
              <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                Completo
              </span>
            )}
          </span>
        </div>

        {/* Detalles específicos para Box */}
        {isBoxPurchase && (
          <div className="flex justify-between items-center text-gray-300">
            <span className="flex items-center gap-2">
              {isFullBoxPurchase ? (
                <Package className="w-4 h-4 text-[#FD8D6A]" />
              ) : (
                <ShoppingCart className="w-4 h-4 text-[#FD8D6A]" />
              )}
              <span>Modalidad:</span>
            </span>
            <span className="font-semibold text-white">
              {isFullBoxPurchase ? 'Box Completo' : 'Puestos Individuales'}
            </span>
          </div>
        )}
        
        {/* Mostrar asientos numerados si los hay */}
        {selectedZone.is_numbered && selectedSeats.length > 0 ? (
          <div className="flex justify-between items-start text-gray-300">
            <span>Asientos:</span>
            <div className="text-right">
              <div className="flex flex-wrap gap-1 justify-end">
                {selectedSeats.map(seat => (
                  <span key={seat.id} className="bg-[#FD8D6A]/30 px-2 py-1 rounded text-xs text-white">
                    {seat.seat_number}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-between text-gray-300">
            <span>
              {isBoxPurchase && !isFullBoxPurchase ? 'Puestos:' : 'Cantidad:'}
            </span>
            <span className="font-semibold text-white">
              {isBoxPurchase ? (
                isFullBoxPurchase ? (
                  `${BOX_CAPACITY} puestos (box completo)`
                ) : (
                  `${boxQuantity} ${boxQuantity === 1 ? 'puesto' : 'puestos'}`
                )
              ) : (
                `${generalQuantity} ${generalQuantity === 1 ? 'entrada' : 'entradas'}`
              )}
            </span>
          </div>
        )}

        {/* Precio unitario para compras de puestos individuales */}
        {isBoxPurchase && !isFullBoxPurchase && boxQuantity > 1 && (
          <div className="flex justify-between text-gray-300 text-sm">
            <span>Precio por puesto:</span>
            <span className="text-white">$75.00</span>
          </div>
        )}

        {/* Ahorro en box completo */}
        {isBoxPurchase && isFullBoxPurchase && (
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mt-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-green-400">💰 Ahorro por box completo:</span>
              <span className="font-bold text-green-400">
                ${((BOX_CAPACITY * 75) - totalPrice).toFixed(2)}
              </span>
            </div>
          </div>
        )}
        
        <div className="pt-3 border-t border-[#FD8D6A]/30">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-white">Total:</span>
            <div className="text-right">
              <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FD8D6A] to-[#ff6b4a]">
                ${totalPrice.toFixed(2)}
              </p>
              {exchangeRate && (
                <p className="text-sm text-gray-400">≈ Bs. {totalBs}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseSummary;