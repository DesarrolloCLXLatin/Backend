// server/routes/paymentMethods.js
import express from 'express';
import { authenticateToken, enrichUserData } from '../middleware/auth.js';


const router = express.Router();

// Obtener métodos de pago permitidos según rol del usuario
router.get('/allowed', authenticateToken, enrichUserData, async (req, res) => {
  try {
    const userRole = req.user.role || 'guest';
    
    // Si es usuario sin rol específico, tratarlo como 'usuario'
    const effectiveRole = userRole === 'guest' ? 'usuario' : userRole;
    
    // Obtener métodos permitidos usando la función SQL
    const { data: methods, error } = await req.supabase
      .rpc('get_allowed_payment_methods', { p_user_role: effectiveRole });

    if (error) {
      console.error('Error fetching payment methods:', error);
      return res.status(500).json({ 
        message: 'Error al obtener métodos de pago' 
      });
    }

    // Enriquecer con información adicional según el contexto
    const enrichedMethods = methods?.map(method => ({
      ...method,
      // Para métodos de tienda, agregar información específica
      isStoreMethod: method.payment_method.includes('_tienda') || 
                      ['tarjeta_debito', 'tarjeta_credito', 'efectivo_bs', 'efectivo_usd'].includes(method.payment_method),
      // Para obsequio exonerado
      isGift: method.payment_method === 'obsequio_exonerado',
      // Configuración adicional
      config: getMethodConfig(method.payment_method)
    })) || [];

    res.json({
      success: true,
      role: effectiveRole,
      methods: enrichedMethods,
      summary: {
        total: enrichedMethods.length,
        requiresProof: enrichedMethods.filter(m => m.requires_proof).length,
        autoConfirm: enrichedMethods.filter(m => m.auto_confirm).length
      }
    });

  } catch (error) {
    console.error('Error in allowed payment methods:', error);
    res.status(500).json({ 
      message: 'Error interno del servidor' 
    });
  }
});

// Validar si un método de pago es permitido para el usuario
router.post('/validate', authenticateToken, enrichUserData, async (req, res) => {
  try {
    const { payment_method } = req.body;
    
    if (!payment_method) {
      return res.status(400).json({ 
        message: 'Método de pago requerido' 
      });
    }

    const userRole = req.user.role || 'usuario';
    
    // Verificar si el método es permitido
    const { data: isAllowed, error } = await req.supabase
      .from('payment_methods_configuration')
      .select('*')
      .eq('role_name', userRole)
      .eq('payment_method', payment_method)
      .eq('is_active', true)
      .single();

    if (error || !isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'Método de pago no permitido para tu rol',
        allowed: false
      });
    }

    res.json({
      success: true,
      allowed: true,
      method_config: isAllowed
    });

  } catch (error) {
    console.error('Error validating payment method:', error);
    res.status(500).json({ 
      message: 'Error interno del servidor' 
    });
  }
});

// Obtener configuración específica de un método
function getMethodConfig(method) {
  const configs = {
    'pago_movil_p2c': {
      gateway: 'megasoft',
      requires_phone: true,
      requires_bank: true,
      requires_id: true
    },
    'tarjeta_debito': {
      requires_terminal: true,
      immediate_confirmation: true
    },
    'tarjeta_credito': {
      requires_terminal: true,
      immediate_confirmation: true
    },
    'efectivo_bs': {
      requires_exchange_rate: true,
      immediate_confirmation: true
    },
    'efectivo_usd': {
      immediate_confirmation: true
    },
    'obsequio_exonerado': {
      skip_payment: true,
      requires_authorization: true,
      deduct_inventory: true
    },
    'transferencia_nacional': {
      requires_proof: true,
      bank_details_required: true
    },
    'transferencia_internacional': {
      requires_proof: true,
      swift_required: true
    },
    'zelle': {
      requires_proof: true,
      email_required: true
    },
    'paypal': {
      requires_proof: true,
      transaction_id_required: true
    }
  };

  // Para métodos de tienda, usar la configuración base
  const baseMethod = method.replace('_tienda', '');
  return configs[method] || configs[baseMethod] || {};
}

// Obtener información de todos los métodos (admin only)
router.get('/all', authenticateToken, enrichUserData, async (req, res) => {
  try {
    // Verificar permisos de admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Acceso denegado' 
      });
    }

    const { data: allMethods, error } = await req.supabase
      .from('payment_methods_configuration')
      .select('*')
      .order('role_name', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      throw error;
    }

    // Agrupar por rol
    const methodsByRole = allMethods?.reduce((acc, method) => {
      if (!acc[method.role_name]) {
        acc[method.role_name] = [];
      }
      acc[method.role_name].push(method);
      return acc;
    }, {}) || {};

    res.json({
      success: true,
      methodsByRole,
      totalMethods: allMethods?.length || 0,
      roles: Object.keys(methodsByRole)
    });

  } catch (error) {
    console.error('Error fetching all methods:', error);
    res.status(500).json({ 
      message: 'Error interno del servidor' 
    });
  }
});

// Actualizar configuración de método (admin only)
router.put('/:methodId', authenticateToken, enrichUserData, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Acceso denegado' 
      });
    }

    const { methodId } = req.params;
    const updates = req.body;

    const { data: updated, error } = await req.supabase
      .from('payment_methods_configuration')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', methodId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      method: updated
    });

  } catch (error) {
    console.error('Error updating method:', error);
    res.status(500).json({ 
      message: 'Error interno del servidor' 
    });
  }
});

export default router;