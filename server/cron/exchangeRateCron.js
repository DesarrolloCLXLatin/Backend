import cron from 'node-cron';
import { scheduledUpdate } from '../services/exchangeRateService.js';

// Programar actualización diaria a las 8:00 AM hora de Venezuela
export const startExchangeRateCron = () => {
  // Configurar timezone de Venezuela
  const timezone = 'America/Caracas';
  
  // Ejecutar todos los días a las 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('\n⏰ Ejecutando actualización programada de tasa de cambio...');
    
    try {
      await scheduledUpdate();
    } catch (error) {
      console.error('Error en cron de tasa de cambio:', error);
    }
  }, {
    timezone
  });

  // También ejecutar a las 2:00 PM por si falla la primera
  cron.schedule('0 14 * * *', async () => {
    console.log('\n⏰ Ejecutando actualización de respaldo de tasa de cambio...');
    
    try {
      // Verificar si ya se actualizó hoy
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('exchange_rates')
        .select('created_at')
        .eq('date', today)
        .single();

      if (data) {
        const created = new Date(data.created_at);
        const hoursSince = (new Date() - created) / (1000 * 60 * 60);
        
        if (hoursSince < 6) {
          console.log('✅ Tasa ya actualizada recientemente, omitiendo...');
          return;
        }
      }

      await scheduledUpdate();
    } catch (error) {
      console.error('Error en cron de respaldo:', error);
    }
  }, {
    timezone
  });

  console.log('✅ Cron de tasa de cambio iniciado (8:00 AM y 2:00 PM VET)');
};