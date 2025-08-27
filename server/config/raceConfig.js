// server/config/raceConfig.js
export const RACE_CONFIG = {
  PRICE_USD: 0.0699, // Precio único por corredor
  PLATFORM_COMMISSION_PERCENT: 5,
  TAX_PERCENT: 16,
  MAX_RUNNERS_PER_GROUP: 5,
  RESERVATION_HOURS: 72
};

// Validación de configuración al iniciar
export function validateConfig() {
  const requiredEnvVars = [
    'PAYMENT_GATEWAY_URL',
    'PAYMENT_COD_AFILIACION', 
    'PAYMENT_USERNAME',
    'PAYMENT_PASSWORD',
    'COMMERCE_PHONE',
    'COMMERCE_BANK_CODE'
  ];
  
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Variables de entorno faltantes: ${missing.join(', ')}`);
  }
  
  console.log('✅ Configuración validada:', {
    priceUSD: RACE_CONFIG.PRICE_USD,
    commission: RACE_CONFIG.PLATFORM_COMMISSION_PERCENT + '%',
    tax: RACE_CONFIG.TAX_PERCENT + '%'
  });
}