// src/components/tickets/IframeTicketPurchase/hooks/useZoneSelection.ts

import { useState, useEffect, useCallback } from 'react';
import { TicketZone, Seat } from '../types';
import { MOCK_ZONES, VIP_SEAT_CONFIG, PURCHASE_LIMITS } from '../constants';
import toast from 'react-hot-toast';

export const useZoneSelection = () => {
  const [zones, setZones] = useState<TicketZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<TicketZone | null>(null);
  const [vipSeats, setVipSeats] = useState<Seat[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [generalQuantity, setGeneralQuantity] = useState(1);
  const [isLoadingZones, setIsLoadingZones] = useState(false);

  // Cargar zonas disponibles
  const loadZones = useCallback(async () => {
    setIsLoadingZones(true);
    try {
      // En producción esto vendría de una API
      // Por ahora usamos las zonas mock
      setZones(MOCK_ZONES);
    } catch (error) {
      console.error('Error loading zones:', error);
      toast.error('Error al cargar las zonas disponibles');
    } finally {
      setIsLoadingZones(false);
    }
  }, []);

  // Generar asientos VIP
  const generateVipSeats = useCallback((zone: TicketZone): Seat[] => {
    const seats: Seat[] = [];
    const { rows, seatsPerRow, soldSeats } = VIP_SEAT_CONFIG;
    
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      for (let col = 1; col <= seatsPerRow; col++) {
        const seatNumber = `V${rows[rowIndex]}${String(col).padStart(2, '0')}`;
        seats.push({
          id: `${zone.id}_${rowIndex}_${col}`,
          seat_number: seatNumber,
          row: rows[rowIndex],
          column: col,
          status: soldSeats.includes(seatNumber) ? 'sold' : 'available',
          seat_type: 'standard',
          price: zone.price_usd,
          zone_type: zone.zone_type
        });
      }
    }
    
    return seats;
  }, []);

  // Manejar selección de zona
  const handleZoneSelection = useCallback((zone: TicketZone | null) => {
    setSelectedZone(zone);
    setSelectedSeats([]);
    setGeneralQuantity(1);
    
    if (zone && zone.is_numbered && zone.zone_type === 'vip') {
      const seats = generateVipSeats(zone);
      setVipSeats(seats);
    } else {
      setVipSeats([]);
    }
  }, [generateVipSeats]);

  // Manejar selección de asiento
  const handleSeatSelection = useCallback((seat: Seat) => {
    if (seat.status !== 'available') {
      toast.error('Este asiento no está disponible');
      return;
    }
    
    const isSelected = selectedSeats.find(s => s.id === seat.id);
    
    if (isSelected) {
      // Deseleccionar asiento
      setSelectedSeats(prev => prev.filter(s => s.id !== seat.id));
    } else {
      // Seleccionar asiento
      if (selectedSeats.length >= PURCHASE_LIMITS.maxVipSeats) {
        toast.error(`Máximo ${PURCHASE_LIMITS.maxVipSeats} asientos por compra`);
        return;
      }
      setSelectedSeats(prev => [...prev, seat]);
    }
  }, [selectedSeats]);

  // Manejar cambio de cantidad para entrada general
  const handleQuantityChange = useCallback((quantity: number) => {
    if (quantity < PURCHASE_LIMITS.minTickets) {
      setGeneralQuantity(PURCHASE_LIMITS.minTickets);
      return;
    }
    
    if (quantity > PURCHASE_LIMITS.maxGeneralTickets) {
      toast.error(`Máximo ${PURCHASE_LIMITS.maxGeneralTickets} entradas por compra`);
      setGeneralQuantity(PURCHASE_LIMITS.maxGeneralTickets);
      return;
    }
    
    setGeneralQuantity(quantity);
  }, []);

  // Validar selección actual
  const validateSelection = useCallback((): boolean => {
    if (!selectedZone) {
      toast.error('Debe seleccionar un tipo de entrada');
      return false;
    }
    
    if (selectedZone.is_numbered && selectedSeats.length === 0) {
      toast.error('Debe seleccionar al menos un asiento');
      return false;
    }
    
    if (!selectedZone.is_numbered && generalQuantity < 1) {
      toast.error('Debe seleccionar al menos una entrada');
      return false;
    }
    
    return true;
  }, [selectedZone, selectedSeats, generalQuantity]);

  // Obtener resumen de selección
  const getSelectionSummary = useCallback(() => {
    if (!selectedZone) {
      return {
        zone: null,
        quantity: 0,
        seats: [],
        totalPrice: 0
      };
    }
    
    const quantity = selectedZone.is_numbered ? selectedSeats.length : generalQuantity;
    const totalPrice = quantity * selectedZone.price_usd;
    
    return {
      zone: selectedZone,
      quantity,
      seats: selectedSeats.map(s => s.seat_number),
      totalPrice
    };
  }, [selectedZone, selectedSeats, generalQuantity]);

  // Resetear selección
  const resetSelection = useCallback(() => {
    setSelectedZone(null);
    setSelectedSeats([]);
    setGeneralQuantity(1);
    setVipSeats([]);
  }, []);

  // Cargar zonas al montar
  useEffect(() => {
    loadZones();
  }, [loadZones]);

  return {
    // Estados
    zones,
    selectedZone,
    vipSeats,
    selectedSeats,
    generalQuantity,
    isLoadingZones,
    
    // Funciones
    handleZoneSelection,
    handleSeatSelection,
    handleQuantityChange,
    validateSelection,
    getSelectionSummary,
    resetSelection,
    reloadZones: loadZones
  };
};