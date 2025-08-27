// server/services/external/ExchangeRateService.js
// Servicio reorganizado - copia del original para nueva estructura

import axios from 'axios';
import * as cheerio from 'cheerio';

class ExchangeRateService {
  constructor() {
    this.sources = [
      {
        name: 'BCV',
        url: 'https://www.bcv.org.ve/',
        method: 'scrape',
        selector: '#dolar .centrado strong',
        priority: 1
      },
      {
        name: 'ExchangeRate-API',
        url: 'https://api.exchangerate-api.com/v4/latest/USD',
        method: 'api',
        path: 'rates.VES',
        priority: 2
      },
      {
        name: 'DolarToday',
        url: 'https://s3.amazonaws.com/dolartoday/data.json',
        method: 'api',
        path: 'USD.promedio',
        priority: 3
      },
      {
        name: 'Yadio',
        url: 'https://api.yadio.io/exrates/VES',
        method: 'api',
        path: 'USD.rate',
        priority: 4
      }
    ];
  }

  // Método principal para actualizar la tasa
  async updateExchangeRate() {
    console.log('🔄 Iniciando actualización de tasa de cambio...');
    
    let rate = null;
    let source = null;
    let errors = [];

    // Intentar obtener la tasa de cada fuente en orden de prioridad
    for (const provider of this.sources.sort((a, b) => a.priority - b.priority)) {
      try {
        console.log(`📡 Intentando obtener tasa de ${provider.name}...`);
        
        if (provider.method === 'scrape') {
          rate = await this.scrapeRate(provider);
        } else {
          rate = await this.fetchFromAPI(provider);
        }

        if (rate && rate > 0) {
          source = provider.name;
          console.log(`✅ Tasa obtenida de ${source}: ${rate} Bs/USD`);
          break;
        }
      } catch (error) {
        console.error(`❌ Error con ${provider.name}:`, error.message);
        errors.push({ source: provider.name, error: error.message });
      }
    }

    // Si no se pudo obtener de ninguna fuente
    if (!rate) {
      console.error('❌ No se pudo obtener la tasa de cambio de ninguna fuente');
      await this.logError('ALL_SOURCES_FAILED', errors);
      throw new Error('No se pudo obtener la tasa de cambio de ninguna fuente');
    }

    // Validar que la tasa sea razonable (entre 1 y 1000 Bs/USD)
    if (rate < 1 || rate > 1000) {
      console.warn(`⚠️ Tasa sospechosa: ${rate} Bs/USD`);
      await this.logError('SUSPICIOUS_RATE', { rate, source });
      
      // Obtener la última tasa conocida
      const lastRate = await this.getLastKnownRate();
      if (lastRate && Math.abs(rate - lastRate) / lastRate > 0.5) {
        // Si la variación es mayor al 50%, rechazar
        throw new Error(`Tasa sospechosa: ${rate} Bs/USD (variación > 50%)`);
      }
    }

    // Guardar la tasa en la base de datos
    await this.saveRate(rate, source);
    
    return {
      rate,
      source,
      date: new Date().toISOString()
    };
  }

  // Scraping para fuentes HTML
  async scrapeRate(provider) {
    const response = await axios.get(provider.url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const rateText = $(provider.selector).text().trim();
    
    // Limpiar y convertir el texto a número
    const rate = parseFloat(
      rateText
        .replace(/[^\d,.-]/g, '')
        .replace(',', '.')
    );

    if (isNaN(rate)) {
      throw new Error(`No se pudo parsear la tasa: ${rateText}`);
    }

    return rate;
  }

  // Obtener de APIs JSON
  async fetchFromAPI(provider) {
    const response = await axios.get(provider.url, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json'
      }
    });

    // Navegar por el path para obtener el valor
    let data = response.data;
    const paths = provider.path.split('.');
    
    for (const path of paths) {
      data = data[path];
      if (data === undefined) {
        throw new Error(`Path no encontrado: ${provider.path}`);
      }
    }

    const rate = parseFloat(data);
    if (isNaN(rate)) {
      throw new Error(`Valor no numérico: ${data}`);
    }

    return rate;
  }

  // Guardar tasa en la base de datos
  async saveRate(rate, source) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Usar supabase global si está disponible
      const supabase = global.supabase;
      if (!supabase) {
        throw new Error('Supabase no está disponible');
      }

      // Verificar si ya existe una tasa para hoy
      const { data: existing } = await supabase
        .from('exchange_rates')
        .select('id')
        .eq('date', today)
        .single();

      if (existing) {
        // Actualizar la tasa existente
        const { error } = await supabase
          .from('exchange_rates')
          .update({
            rate: rate,
            source: source
          })
          .eq('id', existing.id);

        if (error) throw error;
        console.log(`📝 Tasa actualizada para ${today}`);
      } else {
        // Insertar nueva tasa
        const { error } = await supabase
          .from('exchange_rates')
          .insert({
            rate: rate,
            source: source,
            date: today
          });

        if (error) throw error;
        console.log(`📝 Nueva tasa guardada para ${today}`);
      }

      // Limpiar tasas antiguas (mantener últimos 90 días)
      await this.cleanOldRates();

    } catch (error) {
      console.error('Error guardando tasa:', error);
      throw error;
    }
  }

  // Obtener la última tasa conocida
  async getLastKnownRate() {
    try {
      const supabase = global.supabase;
      if (!supabase) return null;

      const { data } = await supabase
        .from('exchange_rates')
        .select('rate')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      return data?.rate || null;
    } catch (error) {
      return null;
    }
  }

  // Limpiar tasas antiguas
  async cleanOldRates() {
    try {
      const supabase = global.supabase;
      if (!supabase) return;

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      await supabase
        .from('exchange_rates')
        .delete()
        .lt('date', ninetyDaysAgo.toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error limpiando tasas antiguas:', error);
    }
  }

  // Registrar errores
  async logError(type, details) {
    try {
      const supabase = global.supabase;
      if (!supabase) return;

      await supabase
        .from('payment_errors')
        .insert({
          error_code: type,
          error_message: 'Error obteniendo tasa de cambio',
          error_details: details
        });
    } catch (error) {
      console.error('Error registrando error:', error);
    }
  }

  // Obtener historial de tasas
  async getRateHistory(days = 30) {
    try {
      const supabase = global.supabase;
      if (!supabase) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) {
        console.error('Error obteniendo historial:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      return [];
    }
  }

  // Obtener estadísticas de tasas
  async getRateStatistics(days = 30) {
    const history = await this.getRateHistory(days);
    
    if (history.length === 0) {
      return null;
    }

    const rates = history.map(h => h.rate);
    const average = rates.reduce((a, b) => a + b, 0) / rates.length;
    const max = Math.max(...rates);
    const min = Math.min(...rates);
    
    return {
      current: rates[0],
      average: parseFloat(average.toFixed(4)),
      max,
      min,
      variation: parseFloat(((max - min) / average * 100).toFixed(2)),
      lastUpdate: history[0].date,
      dataPoints: history.length
    };
  }

  // Método para ejecutar manualmente
  async forceUpdate() {
    console.log('⚡ Forzando actualización de tasa de cambio...');
    return await this.updateExchangeRate();
  }
}

// Crear instancia única
const exchangeRateService = new ExchangeRateService();

// Función para ejecutar actualización programada
export const scheduledUpdate = async () => {
  try {
    const result = await exchangeRateService.updateExchangeRate();
    console.log('✅ Actualización programada completada:', result);
    return result;
  } catch (error) {
    console.error('❌ Error en actualización programada:', error);
    throw error;
  }
};

export default exchangeRateService;