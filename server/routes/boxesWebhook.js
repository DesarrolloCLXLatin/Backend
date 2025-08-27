import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/webhooks/boxes/cleanup
 * Webhook para liberar reservas expiradas (llamar cada 5 minutos con un cron)
 */
router.post('/cleanup', async (req, res) => {
  try {
    // Verificar token secreto
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.WEBHOOK_SECRET_TOKEN;
    
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return res.status(401).json({ 
        message: 'Unauthorized' 
      });
    }

    // Ejecutar limpieza de reservas expiradas
    const { data: result, error } = await supabaseAdmin
      .rpc('release_expired_seat_reservations');

    if (error) {
      console.error('Cleanup error:', error);
      return res.status(500).json({ 
        message: 'Error during cleanup',
        error: error.message 
      });
    }

    // Obtener boxes que fueron liberados
    const { data: releasedBoxes } = await supabaseAdmin
      .from('concert_boxes')
      .select('box_code')
      .eq('status', 'available')
      .in('box_code', ['B11', 'B12', 'B13']); // Ajustar según necesidad

    console.log(`[Cleanup] Released ${releasedBoxes?.length || 0} boxes`);

    res.json({
      success: true,
      message: 'Cleanup completed',
      released: releasedBoxes?.length || 0
    });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ 
      message: 'Internal server error' 
    });
  }
});

export default router;