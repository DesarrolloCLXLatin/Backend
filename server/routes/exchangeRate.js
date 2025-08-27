import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Obtener tasa actual
router.get('/current', async (req, res) => {
  try {
    const { data: currentRate, error } = await req.supabase
      .from('exchange_rates')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (error || !currentRate) {
      return res.status(404).json({ 
        message: 'No hay tasa de cambio disponible' 
      });
    }

    // Calcular antigüedad
    const rateDate = new Date(currentRate.date);
    const now = new Date();
    const hoursSinceUpdate = Math.floor((now - rateDate) / (1000 * 60 * 60));

    res.json({
      rate: currentRate.rate,
      source: currentRate.source,
      date: currentRate.date,
      timestamp: currentRate.created_at,
      age_hours: hoursSinceUpdate,
      is_current: hoursSinceUpdate < 24,
      formatted: `${currentRate.rate} Bs/USD`
    });

  } catch (error) {
    console.error('Error obteniendo tasa:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Obtener historial
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Calcular fecha de inicio
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const { data: history, error } = await req.supabase
      .from('exchange_rates')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) throw error;

    res.json({
      history: history || [],
      count: history?.length || 0,
      period_days: days
    });

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Obtener estadísticas
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Calcular fecha de inicio
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const { data: history, error } = await req.supabase
      .from('exchange_rates')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;

    if (!history || history.length < 2) {
      return res.status(404).json({ 
        message: 'No hay suficientes datos para generar estadísticas' 
      });
    }

    // Calcular estadísticas
    const rates = history.map(h => h.rate);
    const currentRate = rates[rates.length - 1];
    const firstRate = rates[0];
    
    const sum = rates.reduce((a, b) => a + b, 0);
    const average = sum / rates.length;
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    
    // Calcular volatilidad (desviación estándar)
    const variance = rates.reduce((acc, rate) => {
      return acc + Math.pow(rate - average, 2);
    }, 0) / rates.length;
    const stdDev = Math.sqrt(variance);
    const volatility = (stdDev / average) * 100;
    
    // Determinar tendencia
    const variation = ((currentRate - firstRate) / firstRate) * 100;
    const trend = variation > 1 ? 'UPWARD' : variation < -1 ? 'DOWNWARD' : 'STABLE';

    res.json({
      period_days: parseInt(days),
      count: history.length,
      current_rate: currentRate,
      average_rate: average,
      min_rate: min,
      max_rate: max,
      variation_percentage: variation,
      trend: trend,
      volatility: volatility
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Actualizar tasa manualmente (admin only)
router.post('/update', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    console.log('Actualización manual solicitada por:', req.user.email);
    
    // En un caso real, aquí llamarías a un servicio externo como el BCV
    // Por ahora, simularemos una actualización
    const newRate = 36.50 + (Math.random() * 2 - 1); // Simular variación
    const today = new Date().toISOString().split('T')[0];
    
    // Verificar si ya existe una tasa para hoy
    const { data: existing } = await req.supabase
      .from('exchange_rates')
      .select('id')
      .eq('date', today)
      .single();

    if (existing) {
      // Actualizar
      const { error } = await req.supabase
        .from('exchange_rates')
        .update({ rate: newRate, source: 'BCV' })
        .eq('id', existing.id);
        
      if (error) throw error;
    } else {
      // Insertar
      const { error } = await req.supabase
        .from('exchange_rates')
        .insert({ 
          rate: newRate, 
          source: 'BCV', 
          date: today 
        });
        
      if (error) throw error;
    }
    
    res.json({
      message: 'Tasa actualizada exitosamente',
      rate: newRate,
      source: 'BCV',
      date: today
    });

  } catch (error) {
    console.error('Error actualizando tasa:', error);
    res.status(500).json({ 
      message: 'Error actualizando tasa de cambio',
      error: error.message 
    });
  }
});

// Establecer tasa manualmente (admin only)
router.post('/manual', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    const { rate, source = 'MANUAL' } = req.body;

    if (!rate || rate <= 0) {
      return res.status(400).json({ 
        message: 'Tasa inválida' 
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // Verificar si ya existe
    const { data: existing } = await req.supabase
      .from('exchange_rates')
      .select('id')
      .eq('date', today)
      .single();

    if (existing) {
      // Actualizar
      const { error } = await req.supabase
        .from('exchange_rates')
        .update({ rate, source })
        .eq('id', existing.id);
        
      if (error) throw error;
    } else {
      // Insertar
      const { error } = await req.supabase
        .from('exchange_rates')
        .insert({ rate, source, date: today });
        
      if (error) throw error;
    }

    res.json({
      message: 'Tasa establecida manualmente',
      rate,
      source,
      date: today
    });

  } catch (error) {
    console.error('Error estableciendo tasa:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

export default router;