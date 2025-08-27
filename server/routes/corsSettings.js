// server/routes/corsSettings.js (nuevo archivo)
import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { updateCorsMiddleware } from '../middleware/cors.js';

const router = express.Router();

// Obtener configuración CORS actual
router.get('/cors-settings', authenticateToken, requirePermission('iframe_tokens', 'create'), async (req, res) => {
  try {
    // Obtener de gateway_config
    const { data: configData, error } = await req.supabase
      .from('gateway_config')
      .select('config_value')
      .eq('config_key', 'iframe_allowed_origins')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw error;
    }

    let allowed_origins = [];
    
    if (configData?.config_value) {
      try {
        allowed_origins = JSON.parse(configData.config_value);
      } catch (e) {
        allowed_origins = [];
      }
    }

    // También obtener dominios únicos de tokens activos
    const { data: tokens } = await req.supabase
      .from('iframe_tokens')
      .select('allowed_domains, origin')
      .eq('is_active', true);

    const tokenDomains = new Set();
    tokens?.forEach(token => {
      if (token.allowed_domains?.length > 0) {
        token.allowed_domains.forEach(domain => tokenDomains.add(domain));
      }
      if (token.origin) {
        tokenDomains.add(token.origin);
      }
    });

    // Combinar ambas fuentes
    const allOrigins = [...new Set([...allowed_origins, ...tokenDomains])];

    res.json({
      success: true,
      allowed_origins: allOrigins,
      configured_origins: allowed_origins,
      token_origins: Array.from(tokenDomains)
    });

  } catch (error) {
    console.error('Error fetching CORS settings:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener configuración CORS' 
    });
  }
});

// Agregar origen CORS
router.post('/cors-settings', authenticateToken, requirePermission('iframe_tokens', 'create'), async (req, res) => {
  try {
    const { origin } = req.body;

    if (!origin) {
      return res.status(400).json({ 
        success: false,
        message: 'Origen requerido' 
      });
    }

    // Validar formato de URL
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Protocolo inválido');
      }
    } catch (e) {
      return res.status(400).json({ 
        success: false,
        message: 'URL inválida. Use formato: https://ejemplo.com' 
      });
    }

    // Obtener configuración actual
    const { data: currentConfig } = await req.supabase
      .from('gateway_config')
      .select('config_value')
      .eq('config_key', 'iframe_allowed_origins')
      .single();

    let origins = [];
    if (currentConfig?.config_value) {
      try {
        origins = JSON.parse(currentConfig.config_value);
      } catch (e) {
        origins = [];
      }
    }

    // Verificar si ya existe
    if (origins.includes(origin)) {
      return res.status(400).json({ 
        success: false,
        message: 'Este origen ya está configurado' 
      });
    }

    // Agregar nuevo origen
    origins.push(origin);

    // Actualizar o insertar configuración
    const { error } = await req.supabase
      .from('gateway_config')
      .upsert({
        config_key: 'iframe_allowed_origins',
        config_value: JSON.stringify(origins),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'config_key'
      });

    if (error) throw error;

    // Actualizar middleware CORS inmediatamente
    updateCorsMiddleware();

    res.json({
      success: true,
      message: 'Origen agregado exitosamente'
    });

  } catch (error) {
    console.error('Error adding CORS origin:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al agregar origen' 
    });
  }
});

// Eliminar origen CORS
router.delete('/cors-settings', authenticateToken, requirePermission('iframe_tokens', 'create'), async (req, res) => {
  try {
    const { origin } = req.body;

    if (!origin) {
      return res.status(400).json({ 
        success: false,
        message: 'Origen requerido' 
      });
    }

    // Obtener configuración actual
    const { data: currentConfig } = await req.supabase
      .from('gateway_config')
      .select('config_value')
      .eq('config_key', 'iframe_allowed_origins')
      .single();

    let origins = [];
    if (currentConfig?.config_value) {
      try {
        origins = JSON.parse(currentConfig.config_value);
      } catch (e) {
        origins = [];
      }
    }

    // Filtrar el origen a eliminar
    origins = origins.filter(o => o !== origin);

    // Actualizar configuración
    const { error } = await req.supabase
      .from('gateway_config')
      .upsert({
        config_key: 'iframe_allowed_origins',
        config_value: JSON.stringify(origins),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'config_key'
      });

    if (error) throw error;

    // Actualizar middleware CORS inmediatamente
    updateCorsMiddleware();

    res.json({
      success: true,
      message: 'Origen eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error removing CORS origin:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al eliminar origen' 
    });
  }
});

export default router;