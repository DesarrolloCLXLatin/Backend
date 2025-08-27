// src/components/tickets/IframeTicketPurchase/components/Steps/ZoneSelectionStep.tsx

import React, { useState } from 'react';
import { Ticket, AlertCircle, Users, Star, X, Sparkles, MapPin, Package, ShoppingCart } from 'lucide-react';
import { ZoneSelectionProps } from '../../types';
import VenueMap from '../Zones/VenueMap';
import { calculateBsAmount } from '../../utils/calculations';

const ZoneSelectionStep: React.FC<ZoneSelectionProps> = ({
  zones = [],
  selectedZone,
  selectedSeats,
  generalQuantity,
  vipSeats,
  errors,
  exchangeRate,
  onZoneSelect,
  onSeatSelect,
  onQuantityChange
}) => {
  const [selectedZoneType, setSelectedZoneType] = useState<'preferencial' | 'box' | null>(null);
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [boxQuantity, setBoxQuantity] = useState(1);
  const [purchaseFullBox, setPurchaseFullBox] = useState(false);
  
  // Constantes para el box
  const BOX_CAPACITY = 10;
  const BOX_PRICE_PER_SEAT = 75; // $75 por puesto
  const BOX_FULL_PRICE = BOX_PRICE_PER_SEAT * BOX_CAPACITY; // $750 por box completo
  
  // Calcular precio basado en selección
  const calculatePrice = () => {
    if (selectedZoneType === 'preferencial') {
      return generalQuantity * 35;
    } else if (selectedZoneType === 'box' && selectedBox) {
      // Si compra el box completo, precio fijo de $750
      if (purchaseFullBox) {
        return BOX_FULL_PRICE;
      }
      // Si compra puestos individuales
      return boxQuantity * BOX_PRICE_PER_SEAT;
    }
    return 0;
  };
  
  const totalPrice = calculatePrice();
  const totalBs = calculateBsAmount(totalPrice, exchangeRate);
  
  // Manejar selección desde el mapa
  const handleMapSelection = (zoneType: 'preferencial' | 'box', boxNumber?: string) => {
    setSelectedZoneType(zoneType);
    
    if (zoneType === 'preferencial') {
      setSelectedBox(null);
      setPurchaseFullBox(false);
      setBoxQuantity(1);
      
      const prefZone: any = {
        id: 'preferencial',
        zone_code: 'PREF',
        zone_name: 'Zona Preferencial',
        zone_type: 'general',
        price_usd: 35,
        total_capacity: 3000,
        available: 2500,
        is_numbered: false,
        zone_color: '#FD8D6A',
        description: 'Entrada general - Área de pie con acceso directo al escenario'
      };
      onZoneSelect(prefZone);
      onQuantityChange(1);
    } else if (zoneType === 'box' && boxNumber) {
      setSelectedBox(boxNumber);
      
      // Crear zona box con información actualizada
      // IMPORTANTE: Al seleccionar inicialmente, usar precio por puesto y cantidad 1
      const boxZone: any = {
        id: boxNumber,
        zone_code: boxNumber,
        zone_name: `Box ${boxNumber}`,
        zone_type: 'vip',
        price_usd: BOX_PRICE_PER_SEAT, // Siempre precio unitario
        total_capacity: BOX_CAPACITY,
        available: BOX_CAPACITY,
        is_numbered: false,
        zone_color: '#FD8D6A',
        description: `Box privado ${boxNumber} - Capacidad para ${BOX_CAPACITY} personas`,
        is_box_purchase: true,
        box_full_purchase: false,
        box_quantity: 1
      };
      onZoneSelect(boxZone);
      onQuantityChange(1);
    }
  };

  // Manejar cambio de tipo de compra de box
  const handleBoxPurchaseTypeChange = (fullBox: boolean) => {
    setPurchaseFullBox(fullBox);
    
    const newQuantity = fullBox ? BOX_CAPACITY : 1;
    setBoxQuantity(newQuantity);
    onQuantityChange(newQuantity);
    
    // Actualizar la zona con la nueva información
    // IMPORTANTE: Siempre usar precio unitario, la cantidad determina el total
    if (selectedBox) {
      const boxZone: any = {
        id: selectedBox,
        zone_code: selectedBox,
        zone_name: `Box ${selectedBox}`,
        zone_type: 'vip',
        price_usd: BOX_PRICE_PER_SEAT, // Siempre precio unitario
        total_capacity: BOX_CAPACITY,
        available: BOX_CAPACITY,
        is_numbered: false,
        zone_color: '#FD8D6A',
        description: `Box privado ${selectedBox} - Capacidad para ${BOX_CAPACITY} personas`,
        is_box_purchase: true,
        box_full_purchase: fullBox,
        box_quantity: newQuantity,
        // Agregar precio total para referencia
        box_total_price: fullBox ? BOX_FULL_PRICE : (newQuantity * BOX_PRICE_PER_SEAT)
      };
      onZoneSelect(boxZone);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <MapPin className="w-8 h-8 text-[#FD8D6A]" />
        Selecciona tu Ubicación
      </h3>

      {/* Mapa del Venue */}
      <VenueMap
        onSelectZone={handleMapSelection}
        selectedZone={selectedZoneType}
        selectedBox={selectedBox}
        boxInventory={{}}
      />

      {/* Detalles de la selección */}
      {selectedZoneType && (
        <div className="space-y-6">
          {/* Zona seleccionada */}
          {/*<div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {selectedZoneType === 'preferencial' ? (
                <Users className="w-8 h-8 text-[#FD8D6A]" />
              ) : (
                <Star className="w-8 h-8 text-[#FD8D6A]" />
              )}
              <div>
                <h4 className="font-bold text-white text-lg">
                  {selectedZoneType === 'preferencial' ? 'Zona Preferencial' : `Box ${selectedBox}`}
                </h4>
                <p className="text-sm text-gray-400">
                  {selectedZoneType === 'preferencial' 
                    ? '$35 por entrada'
                    : purchaseFullBox 
                      ? `$${BOX_FULL_PRICE} por box completo`
                      : `$${BOX_PRICE_PER_SEAT} por puesto`
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedZoneType(null);
                setSelectedBox(null);
                setPurchaseFullBox(false);
                setBoxQuantity(1);
                onZoneSelect(null as any);
                onQuantityChange(1);
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
            >
              Cambiar
            </button>
          </div>*/}

          {/* Opciones de compra para Box */}
          {selectedZoneType === 'box' && (
            <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-2xl p-6 border border-purple-500/30">
              <h4 className="text-lg font-semibold text-white mb-4">Tipo de compra</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Opción: Puestos individuales */}
                <button
                  onClick={() => handleBoxPurchaseTypeChange(false)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    !purchaseFullBox 
                      ? 'border-[#FD8D6A] bg-[#FD8D6A]/10' 
                      : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  <ShoppingCart className="w-8 h-8 text-[#FD8D6A] mx-auto mb-2" />
                  <h5 className="font-bold text-white">Puestos Individuales</h5>
                  <p className="text-sm text-gray-400 mt-1">${BOX_PRICE_PER_SEAT} por puesto</p>
                  <p className="text-xs text-gray-500 mt-2">Compra de 1 a {BOX_CAPACITY} puestos</p>
                </button>

                {/* Opción: Box completo */}
                <button
                  onClick={() => handleBoxPurchaseTypeChange(true)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    purchaseFullBox 
                      ? 'border-[#FD8D6A] bg-[#FD8D6A]/10' 
                      : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  <Package className="w-8 h-8 text-[#FD8D6A] mx-auto mb-2" />
                  <h5 className="font-bold text-white">Box Completo</h5>
                  <p className="text-sm text-gray-400 mt-1">${BOX_FULL_PRICE} total</p>
                  <p className="text-xs text-gray-500 mt-2">Los {BOX_CAPACITY} puestos del box</p>
                  {purchaseFullBox && (
                    <span className="inline-block mt-2 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                      Ahorra ${(BOX_CAPACITY * BOX_PRICE_PER_SEAT) - BOX_FULL_PRICE}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Selector de cantidad */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-white">
              {selectedZoneType === 'box' && !purchaseFullBox 
                ? 'Cantidad de puestos' 
                : 'Cantidad de entradas'}
            </h4>
            
            {/* Solo mostrar selector si no es box completo */}
            {!(selectedZoneType === 'box' && purchaseFullBox) && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => {
                    const newQty = selectedZoneType === 'preferencial' 
                      ? Math.max(1, generalQuantity - 1)
                      : Math.max(1, boxQuantity - 1);
                    
                    if (selectedZoneType === 'preferencial') {
                      onQuantityChange(newQty);
                    } else {
                      setBoxQuantity(newQty);
                      onQuantityChange(newQty);
                      
                      // Actualizar zona con nueva cantidad
                      if (selectedBox) {
                        const boxZone: any = {
                          id: selectedBox,
                          zone_code: selectedBox,
                          zone_name: `Box ${selectedBox}`,
                          zone_type: 'vip',
                          price_usd: BOX_PRICE_PER_SEAT, // Siempre precio unitario
                          total_capacity: BOX_CAPACITY,
                          available: BOX_CAPACITY,
                          is_numbered: false,
                          zone_color: '#FD8D6A',
                          description: `Box privado ${selectedBox}`,
                          is_box_purchase: true,
                          box_full_purchase: false,
                          box_quantity: newQty,
                          box_total_price: newQty * BOX_PRICE_PER_SEAT
                        };
                        onZoneSelect(boxZone);
                      }
                    }
                  }}
                  className="w-12 h-12 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white text-xl transition-all flex items-center justify-center"
                >
                  −
                </button>
                
                <div className="text-center">
                  <div className="text-5xl font-black text-[#FD8D6A] mb-1">
                    {selectedZoneType === 'preferencial' ? generalQuantity : boxQuantity}
                  </div>
                  <div className="text-sm text-gray-400">
                    {selectedZoneType === 'box' && !purchaseFullBox
                      ? boxQuantity === 1 ? 'Puesto' : 'Puestos'
                      : (selectedZoneType === 'preferencial' ? generalQuantity : boxQuantity) === 1 
                        ? 'Entrada' 
                        : 'Entradas'}
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    const maxQty = selectedZoneType === 'box' ? BOX_CAPACITY : 10;
                    const currentQty = selectedZoneType === 'preferencial' ? generalQuantity : boxQuantity;
                    const newQty = Math.min(maxQty, currentQty + 1);
                    
                    if (selectedZoneType === 'preferencial') {
                      onQuantityChange(newQty);
                    } else {
                      setBoxQuantity(newQty);
                      onQuantityChange(newQty);
                      
                      // Actualizar zona con nueva cantidad
                      if (selectedBox) {
                        const boxZone: any = {
                          id: selectedBox,
                          zone_code: selectedBox,
                          zone_name: `Box ${selectedBox}`,
                          zone_type: 'vip',
                          price_usd: BOX_PRICE_PER_SEAT, // Siempre precio unitario
                          total_capacity: BOX_CAPACITY,
                          available: BOX_CAPACITY,
                          is_numbered: false,
                          zone_color: '#FD8D6A',
                          description: `Box privado ${selectedBox}`,
                          is_box_purchase: true,
                          box_full_purchase: false,
                          box_quantity: newQty,
                          box_total_price: newQty * BOX_PRICE_PER_SEAT
                        };
                        onZoneSelect(boxZone);
                      }
                    }
                  }}
                  className="w-12 h-12 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white text-xl transition-all flex items-center justify-center"
                >
                  +
                </button>
              </div>
            )}

            {/* Mensaje para box completo */}
            {selectedZoneType === 'box' && purchaseFullBox && (
              <div className="text-center p-4 bg-green-900/20 rounded-xl border border-green-500/30">
                <Package className="w-12 h-12 text-green-400 mx-auto mb-2" />
                <p className="text-lg font-bold text-white">Box Completo Seleccionado</p>
                <p className="text-sm text-gray-400 mt-1">{BOX_CAPACITY} puestos incluidos</p>
              </div>
            )}
            
            <p className="text-center text-sm text-gray-500">
              {selectedZoneType === 'box' && !purchaseFullBox
                ? `Máximo ${BOX_CAPACITY} puestos por box` 
                : selectedZoneType === 'box' && purchaseFullBox
                ? 'Incluye todos los puestos del box'
                : 'Máximo 10 entradas por compra'}
            </p>
          </div>

          {/* Información adicional para boxes */}
          {selectedZoneType === 'box' && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-300">
                  <p className="font-semibold mb-2">Beneficios del Box:</p>
                  <ul className="space-y-1">
                    <li>• Área privada con capacidad para {BOX_CAPACITY} personas</li>
                    <li>• Vista elevada y privilegiada del escenario</li>
                    <li>• Servicio de bebidas exclusivo</li>
                    <li>• Acceso VIP y baños privados</li>
                    <li>• Personal de atención dedicado</li>
                    {purchaseFullBox && (
                      <li className="text-green-400">• Box exclusivo para su grupo</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Resumen de precio */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total a pagar</p>
                <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FD8D6A] to-[#ff6b4a]">
                  ${totalPrice.toFixed(2)}
                </p>
                {exchangeRate && (
                  <p className="text-sm text-gray-500 mt-1">≈ Bs. {totalBs}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm mb-1">
                  {selectedZoneType === 'box' && purchaseFullBox ? 'Box Completo' : 'Cantidad'}
                </p>
                <p className="text-2xl font-bold text-white">
                  {selectedZoneType === 'preferencial' 
                    ? generalQuantity 
                    : purchaseFullBox 
                      ? `${BOX_CAPACITY} puestos`
                      : boxQuantity}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedZoneType === 'preferencial' 
                    ? 'Preferencial' 
                    : `Box ${selectedBox}`}
                </p>
                {selectedZoneType === 'box' && !purchaseFullBox && (
                  <p className="text-xs text-green-400 mt-1">
                    ${BOX_PRICE_PER_SEAT} x {boxQuantity} = ${totalPrice}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mensajes de error */}
      {errors.zone && (
        <div className="bg-red-900/30 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {errors.zone}
        </div>
      )}
    </div>
  );
};

export default ZoneSelectionStep;