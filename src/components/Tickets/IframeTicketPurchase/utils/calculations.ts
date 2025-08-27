// src/components/tickets/IframeTicketPurchase/utils/calculations.ts

import { TicketZone, Seat, Inventory } from '../types';

export const calculateTotalPrice = (
  selectedZone: TicketZone | null,
  selectedSeats: Seat[],
  generalQuantity: number
): number => {
  if (!selectedZone) return 0;
  
  // Detectar si es una compra de box
  const isBoxPurchase = (selectedZone as any).is_box_purchase === true;
  const isFullBoxPurchase = (selectedZone as any).box_full_purchase === true;
  const boxQuantity = (selectedZone as any).box_quantity;
  
  // Para boxes
  if (isBoxPurchase) {
    // Si es box completo, precio fijo de $750
    if (isFullBoxPurchase) {
      return 750; // Precio fijo para box completo
    }
    // Si son puestos individuales, multiplicar cantidad por precio unitario
    const quantity = boxQuantity || generalQuantity || 1;
    return quantity * 75; // $75 por puesto
  }
  
  // Para asientos numerados regulares
  if (selectedZone.is_numbered) {
    return selectedSeats.length * selectedZone.price_usd;
  }
  
  // Para entrada general
  return generalQuantity * selectedZone.price_usd;
};

export const calculateBsAmount = (
  usdAmount: number,
  exchangeRate: number | null
): string => {
  if (!exchangeRate) return '0.00';
  return (usdAmount * exchangeRate).toFixed(2);
};

export const calculateAvailablePercentage = (inventory: Inventory): number => {
  if (inventory.total_tickets === 0) return 0;
  return (inventory.available_tickets / inventory.total_tickets) * 100;
};

export const calculateOccupiedPercentage = (inventory: Inventory): number => {
  if (inventory.total_tickets === 0) return 0;
  return 100 - calculateAvailablePercentage(inventory);
};

export const calculateZoneAvailabilityPercentage = (zone: TicketZone): number => {
  if (zone.total_capacity === 0) return 0;
  return (zone.available / zone.total_capacity) * 100;
};

export const isLowAvailability = (
  availablePercentage: number,
  threshold: number = 20
): boolean => {
  return availablePercentage < threshold;
};

export const formatCurrency = (
  amount: number,
  currency: 'USD' | 'BS' = 'USD'
): string => {
  const symbol = currency === 'USD' ? '$' : 'Bs.';
  return `${symbol} ${amount.toFixed(2)}`;
};

export const calculateTicketQuantity = (
  selectedZone: TicketZone | null,
  selectedSeats: Seat[],
  generalQuantity: number
): number => {
  if (!selectedZone) return 0;
  
  // Para boxes, usar la cantidad específica del box
  const isBoxPurchase = (selectedZone as any).is_box_purchase === true;
  if (isBoxPurchase) {
    const boxQuantity = (selectedZone as any).box_quantity;
    return boxQuantity || generalQuantity || 1;
  }
  
  // Para asientos numerados regulares
  if (selectedZone.is_numbered) {
    return selectedSeats.length;
  }
  
  // Para entrada general
  return generalQuantity;
};

// Nueva función para obtener el precio unitario correcto
export const getUnitPrice = (selectedZone: TicketZone | null): number => {
  if (!selectedZone) return 0;
  
  // Para boxes, siempre retornar el precio por puesto
  const isBoxPurchase = (selectedZone as any).is_box_purchase === true;
  if (isBoxPurchase) {
    return 75; // Precio fijo por puesto en box
  }
  
  // Para otras zonas, usar el precio de la zona
  return selectedZone.price_usd;
};

// Nueva función para obtener descripción de la compra
export const getPurchaseDescription = (
  selectedZone: TicketZone | null,
  quantity: number
): string => {
  if (!selectedZone) return '';
  
  const isBoxPurchase = (selectedZone as any).is_box_purchase === true;
  const isFullBoxPurchase = (selectedZone as any).box_full_purchase === true;
  
  if (isBoxPurchase) {
    if (isFullBoxPurchase) {
      return 'Box Completo (10 puestos)';
    }
    return `${quantity} ${quantity === 1 ? 'puesto' : 'puestos'} en box`;
  }
  
  if (selectedZone.zone_type === 'general') {
    return `${quantity} ${quantity === 1 ? 'entrada' : 'entradas'} general${quantity === 1 ? '' : 'es'}`;
  }
  
  return `${quantity} ${quantity === 1 ? 'entrada' : 'entradas'} VIP`;
};