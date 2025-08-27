// utils/helpers.ts
import { Runner, InventoryItem, Bank } from '../types';

/**
 * Formatea un número de teléfono venezolano
 */
export const formatPhoneNumber = (phone: string): string => {
  // Eliminar todo lo que no sea número
  const cleaned = phone.replace(/\D/g, '');
  
  // Formatear como 0414 123 4567
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  
  return phone;
};

/**
 * Formatea un número de cédula con puntos
 */
export const formatIdentification = (identification: string, type: string = 'V'): string => {
  const cleaned = identification.replace(/\D/g, '');
  
  // Agregar puntos cada 3 dígitos desde la derecha
  const formatted = cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return `${type}-${formatted}`;
};

/**
 * Calcula la edad a partir de la fecha de nacimiento
 */
export const calculateAge = (birthDate: string): number => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Formatea una fecha en formato legible
 */
export const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  return d.toLocaleDateString('es-VE', options);
};

/**
 * Formatea una fecha y hora en formato legible
 */
export const formatDateTime = (date: string | Date): string => {
  const d = new Date(date);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return d.toLocaleDateString('es-VE', options);
};

/**
 * Formatea un monto en USD
 */
export const formatUSD = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Formatea un monto en Bolívares
 */
export const formatBs = (amount: number): string => {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Convierte USD a Bs usando la tasa de cambio
 */
export const convertUSDtoBs = (amountUSD: number, exchangeRate: number): number => {
  return amountUSD * exchangeRate;
};

/**
 * Obtiene el nombre del banco por su código
 */
export const getBankName = (bankCode: string, banks: Bank[]): string => {
  const bank = banks.find(b => b.code === bankCode);
  return bank?.name || bankCode;
};

/**
 * Genera un código único para grupo
 */
export const generateGroupCode = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `GRP-${timestamp}-${random}`.toUpperCase();
};

/**
 * Valida si un email es válido
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valida si un teléfono venezolano es válido
 */
export const isValidVenezuelanPhone = (phone: string): boolean => {
  const phoneRegex = /^04[0-9]{9}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
};

/**
 * Obtiene el género en texto
 */
export const getGenderLabel = (gender: string): string => {
  const genders: Record<string, string> = {
    'M': 'Masculino',
    'F': 'Femenino'
  };
  return genders[gender] || gender;
};

/**
 * Obtiene el tipo de identificación en texto
 */
export const getIdentificationTypeLabel = (type: string): string => {
  const types: Record<string, string> = {
    'V': 'Venezolano',
    'E': 'Extranjero',
    'J': 'Jurídico',
    'P': 'Pasaporte'
  };
  return types[type] || type;
};

/**
 * Calcula el total de inventario disponible para una talla
 */
export const getTotalAvailableBySize = (size: string, inventory: InventoryItem[]): number => {
  return inventory
    .filter(item => item.shirt_size === size)
    .reduce((total, item) => total + (item.available || 0), 0);
};

/**
 * Agrupa corredores por talla y género
 */
export const groupRunnersByShirt = (runners: Runner[]): Record<string, number> => {
  return runners.reduce((acc, runner) => {
    const key = `${runner.shirt_size}-${runner.gender}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
};

/**
 * Trunca un texto a un número máximo de caracteres
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Capitaliza la primera letra de cada palabra
 */
export const capitalizeWords = (text: string): string => {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Genera un mensaje de resumen de registro
 */
export const generateRegistrationSummary = (
  groupCode: string,
  runnersCount: number,
  totalUSD: number,
  exchangeRate?: number
): string => {
  let summary = `Registro exitoso!\n`;
  summary += `Código de grupo: ${groupCode}\n`;
  summary += `Corredores registrados: ${runnersCount}\n`;
  summary += `Total: ${formatUSD(totalUSD)}`;
  
  if (exchangeRate) {
    const totalBs = convertUSDtoBs(totalUSD, exchangeRate);
    summary += ` / ${formatBs(totalBs)}`;
  }
  
  return summary;
};

/**
 * Verifica si una fecha está dentro del rango de reserva
 */
export const isWithinReservationTime = (reservedUntil: string | Date): boolean => {
  const now = new Date();
  const reservation = new Date(reservedUntil);
  return now < reservation;
};

/**
 * Obtiene el tiempo restante de reserva en formato legible
 */
export const getReservationTimeRemaining = (reservedUntil: string | Date): string => {
  const now = new Date();
  const reservation = new Date(reservedUntil);
  
  if (now >= reservation) return 'Expirado';
  
  const diff = reservation.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} día${days > 1 ? 's' : ''}`;
  }
  
  return `${hours}h ${minutes}min`;
};

/**
 * Sanitiza un string para evitar XSS
 */
export const sanitizeString = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Descarga un archivo JSON con los datos
 */
export const downloadJSON = (data: any, filename: string): void => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};