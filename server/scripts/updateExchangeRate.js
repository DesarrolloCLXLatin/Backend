// server/scripts/updateExchangeRate.js
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import exchangeRateService from '../services/exchangeRateService.js';

// Cargar variables de entorno
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Inicializar Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configurar el servicio con Supabase
global.supabase = supabase;

// Función principal
async function updateRates() {
  console.log('\n📊 ACTUALIZADOR DE TASAS DE CAMBIO');
  console.log('===================================');
  console.log(`📅 Fecha: ${new Date().toLocaleString('es-VE')}\n`);

  try {
    // Actualizar tasa
    const result = await exchangeRateService.forceUpdate();
    
    console.log('\n✅ ACTUALIZACIÓN EXITOSA');
    console.log(`💱 Tasa: ${result.rate} Bs/USD`);
    console.log(`📡 Fuente: ${result.source}`);
    console.log(`🕒 Hora: ${new Date(result.date).toLocaleTimeString('es-VE')}`);

    // Mostrar estadísticas
    const stats = await exchangeRateService.getRateStatistics(7);
    if (stats) {
      console.log('\n📈 ESTADÍSTICAS (Últimos 7 días)');
      console.log(`   Promedio: ${stats.average} Bs/USD`);
      console.log(`   Máximo: ${stats.max} Bs/USD`);
      console.log(`   Mínimo: ${stats.min} Bs/USD`);
      console.log(`   Variación: ${stats.variation}%`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

// Ejecutar
updateRates();