// server/routes/inventory.js
import express from 'express';
import { authenticateToken, requirePermission, requireAnyPermission, enrichUserData, authenticateIframe } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Crear cliente de Supabase para rutas que no usan middleware de auth
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Middleware mejorado que permite tanto autenticación normal como iframe
const authenticateTokenOrIframe = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const iframeToken = req.headers['x-iframe-token'];
  
  // Si tiene token Bearer, usar autenticación normal
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateToken(req, res, next);
  }
  
  // Si tiene token de iframe, usar autenticación de iframe
  if (iframeToken) {
    return authenticateIframe(req, res, next);
  }
  
  // Si no tiene ninguno, rechazar
  return res.status(401).json({ 
    success: false,
    message: 'Token requerido' 
  });
};

// Función auxiliar para validar token de iframe
const validateIframeToken = async (token, supabase) => {
  try {
    const { data: iframeToken, error } = await supabase
      .from('iframe_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (error || !iframeToken) {
      return { valid: false, error: 'Token inválido o expirado' };
    }

    // Verificar expiración
    if (new Date(iframeToken.expires_at) < new Date()) {
      await supabase
        .from('iframe_tokens')
        .update({ is_active: false })
        .eq('token', token);
      
      return { valid: false, error: 'Token expirado' };
    }

    // Verificar límite de transacciones para tokens públicos
    if (iframeToken.token_type === 'public_token' && iframeToken.max_transactions) {
      if (iframeToken.transactions_count >= iframeToken.max_transactions) {
        return { 
          valid: false, 
          error: 'Límite de transacciones alcanzado para este token' 
        };
      }
    }

    return { valid: true, token: iframeToken };
  } catch (error) {
    console.error('Error validating iframe token:', error);
    return { valid: false, error: 'Error interno validando token' };
  }
};

// Get all inventory items with status - accessible by authenticated users OR iframe
{/*router.get('/', authenticateTokenOrIframe, enrichUserData, async (req, res) => {
  try {
    // Usar el supabase del request si está disponible, sino usar el admin
    const supabase = req.supabase || supabaseAdmin;
    
    // Si es un iframe, solo retornar información básica
    if (req.iframeToken || req.isIframe) {
      const { data: inventory, error } = await supabase
        .from('inventory_status')
        .select('shirt_size, available, status')
        .order('shirt_size');

      if (error) {
        console.error('Inventory fetch error:', error);
        return res.status(500).json({ 
          success: false,
          message: 'Error al obtener inventario' 
        });
      }

      // Registrar uso del token si es iframe
      if (req.iframeToken) {
        await supabase
          .from('iframe_token_usage')
          .insert({
            token_id: req.iframeToken.id,
            action: 'inventory_view',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            metadata: {
              items_count: inventory?.length || 0
            }
          });
      }

      return res.json({
        success: true,
        data: inventory || []
      });
    }
    
    // Para usuarios normales autenticados, verificar permisos
    const userPermissions = req.user.permissions || [];
    
    // Check if user has any inventory read permissions
    if (!userPermissions.some(p => p.includes('inventory:') || p === 'system:manage_all')) {
      return res.status(403).json({ 
        success: false,
        message: 'No tienes permisos para ver el inventario' 
      });
    }

    // Use the inventory_status view for complete information
    const { data: inventory, error } = await supabase
      .from('inventory_status')
      .select('*')
      .order('shirt_size');

    if (error) {
      console.error('Inventory fetch error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error al obtener inventario' 
      });
    }

    res.json({
      success: true,
      data: inventory || []
    });
    
  } catch (error) {
    console.error('Inventory error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});*/}

// Agregar después de las importaciones existentes
// Nueva función para manejar transiciones de estado
router.post('/transition-state', authenticateToken, requirePermission('inventory', 'manage'), async (req, res) => {
  try {
    const { 
      shirt_size, 
      gender, 
      quantity, 
      from_state, 
      to_state,
      reason 
    } = req.body;
    
    const supabase = req.supabase || supabaseAdmin;

    // Validar parámetros
    if (!shirt_size || !gender || !quantity || !from_state || !to_state) {
      return res.status(400).json({ 
        success: false,
        message: 'Faltan parámetros requeridos' 
      });
    }

    // Ejecutar la transición usando la función SQL
    const { data, error } = await supabase
      .rpc('transition_inventory_state', {
        p_shirt_size: shirt_size,
        p_gender: gender,
        p_quantity: quantity,
        p_from_state: from_state,
        p_to_state: to_state
      });

    if (error) {
      console.error('Error en transición de estado:', error);
      return res.status(400).json({ 
        success: false,
        message: error.message || 'Error al cambiar estado del inventario' 
      });
    }

    // Log de auditoría
    console.log(`Transición de inventario: ${shirt_size}/${gender} - ${quantity} unidades de ${from_state} a ${to_state}. Razón: ${reason || 'No especificada'}`);

    res.json({
      success: true,
      message: 'Estado actualizado exitosamente',
      data,
      transition: {
        shirt_size,
        gender,
        quantity,
        from: from_state,
        to: to_state,
        reason
      }
    });

  } catch (error) {
    console.error('Error en transición de estado:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Modificar el endpoint GET / para incluir el campo assigned
router.get('/', authenticateTokenOrIframe, enrichUserData, async (req, res) => {
  try {
    const supabase = req.supabase || supabaseAdmin;
    
    if (req.iframeToken || req.isIframe) {
      const { data: inventory, error } = await supabase
        .from('inventory_status')
        .select('shirt_size, gender, available, reserved, assigned, status') // Agregar assigned
        .order('shirt_size');

      if (error) {
        console.error('Inventory fetch error:', error);
        return res.status(500).json({ 
          success: false,
          message: 'Error al obtener inventario' 
        });
      }

      return res.json({
        success: true,
        data: inventory || []
      });
    }
    
    // Para usuarios autenticados - incluir assigned
    const { data: inventory, error } = await supabase
      .from('inventory_status')
      .select('*') // Ya incluye assigned por la vista actualizada
      .order('shirt_size');

    if (error) {
      console.error('Inventory fetch error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error al obtener inventario' 
      });
    }

    res.json({
      success: true,
      data: inventory || []
    });
    
  } catch (error) {
    console.error('Inventory error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Modificar el endpoint de summary para incluir assigned
router.get('/summary', authenticateToken, requireAnyPermission(
  { resource: 'inventory', action: 'read' },
  { resource: 'inventory', action: 'manage' }
), async (req, res) => {
  try {
    const supabase = req.supabase || supabaseAdmin;
    
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory_status')
      .select('*');

    if (inventoryError) {
      throw inventoryError;
    }

    const summary = inventory?.map(item => ({
      shirt_size: item.shirt_size,
      gender: item.gender,
      stock: item.stock,
      reserved: item.reserved,
      assigned: item.assigned, // Nuevo campo
      available: item.available,
      status: item.status,
      percentage_available: item.stock > 0 
        ? Math.round((item.available / item.stock) * 100) 
        : 0,
      percentage_assigned: item.stock > 0 
        ? Math.round((item.assigned / item.stock) * 100) 
        : 0
    }));

    const totals = summary?.reduce((acc, item) => ({
      total_stock: acc.total_stock + item.stock,
      total_reserved: acc.total_reserved + item.reserved,
      total_assigned: acc.total_assigned + item.assigned, // Nuevo total
      total_available: acc.total_available + item.available
    }), {
      total_stock: 0,
      total_reserved: 0,
      total_assigned: 0,
      total_available: 0
    });

    res.json({
      success: true,
      data: {
        summary: summary || [],
        totals: totals || {}
      }
    });
    
  } catch (error) {
    console.error('Inventory summary error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Public inventory endpoint - no auth required
router.get('/public', async (req, res) => {
  try {
    // Use the inventory_status view but only return size and availability
    const { data: inventory, error } = await supabaseAdmin
      .from('inventory_status')
      .select('shirt_size, available, status')
      .order('shirt_size');

    if (error) {
      console.error('Public inventory fetch error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error al obtener inventario' 
      });
    }

    // Transformar para solo mostrar información básica
    const publicInventory = (inventory || []).map(item => ({
      shirt_size: item.shirt_size,
      available: item.available,
      status: item.status
    }));

    res.json({
      success: true,
      data: publicInventory
    });
    
  } catch (error) {
    console.error('Public inventory error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

router.get('/iframe', async (req, res) => {
  try {
    const iframeToken = req.headers['x-iframe-token'] || req.query.token;
    
    if (!iframeToken) {
      return res.status(401).json({ 
        success: false,
        message: 'Token de iframe requerido' 
      });
    }

    // Validar token
    const tokenValidation = await validateIframeToken(iframeToken, supabaseAdmin);
    
    if (!tokenValidation.valid) {
      return res.status(401).json({ 
        success: false,
        message: tokenValidation.error 
      });
    }

    // Obtener inventario básico
    const { data: inventory, error } = await supabaseAdmin
      .from('inventory_status')
      .select('shirt_size, available, status')
      .order('shirt_size');

    if (error) {
      console.error('Iframe inventory fetch error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error al obtener inventario' 
      });
    }

    // Registrar uso del token
    await supabaseAdmin
      .from('iframe_token_usage')
      .insert({
        token_id: tokenValidation.token.id,
        action: 'inventory_iframe_view',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        metadata: {
          items_count: inventory?.length || 0,
          endpoint: 'iframe'
        }
      });

    res.json({
      success: true,
      data: inventory || [],
      token_info: {
        type: tokenValidation.token.token_type,
        remaining_transactions: tokenValidation.token.max_transactions 
          ? (tokenValidation.token.max_transactions - tokenValidation.token.transactions_count)
          : null
      }
    });
    
  } catch (error) {
    console.error('Iframe inventory error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Get raw inventory data - admin only
router.get('/raw', authenticateToken, requirePermission('inventory', 'manage'), async (req, res) => {
  try {
    const supabase = req.supabase || supabaseAdmin;
    
    const { data: inventory, error } = await supabase
      .from('inventory')
      .select('*')
      .order('shirt_size', { 
        ascending: true,
        nullsFirst: false 
      });

    if (error) {
      console.error('Raw inventory fetch error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error al obtener inventario' 
      });
    }

    res.json({
      success: true,
      data: inventory || []
    });
    
  } catch (error) {
    console.error('Raw inventory error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Update inventory stock - admin only
router.put('/:size', authenticateToken, requirePermission('inventory', 'update'), async (req, res) => {
  try {
    const { size } = req.params;
    const { stock, adjustment_reason } = req.body;
    const supabase = req.supabase || supabaseAdmin;

    if (typeof stock !== 'number' || stock < 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Valor de stock inválido' 
      });
    }

    // Get current inventory to check constraints
    const { data: current, error: fetchError } = await supabase
      .from('inventory')
      .select('*')
      .eq('shirt_size', size)
      .single();

    if (fetchError || !current) {
      return res.status(404).json({ 
        success: false,
        message: 'Talla no encontrada' 
      });
    }

    // Check if new stock is less than reserved
    if (stock < current.reserved) {
      return res.status(400).json({ 
        success: false,
        message: 'El stock no puede ser menor que las unidades reservadas',
        current_reserved: current.reserved,
        requested_stock: stock
      });
    }

    // Update stock
    const { data, error } = await supabase
      .from('inventory')
      .update({ 
        stock,
        updated_at: new Date().toISOString() 
      })
      .eq('shirt_size', size)
      .select()
      .single();

    if (error) {
      console.error('Inventory update error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error al actualizar inventario' 
      });
    }

    // Log the adjustment if reason provided
    if (adjustment_reason) {
      console.log(`Inventory adjustment for ${size}: ${current.stock} -> ${stock}. Reason: ${adjustment_reason}`);
    }

    // Return with calculated available
    res.json({
      success: true,
      data: {
        ...data,
        available: data.stock - data.reserved,
        previous_stock: current.stock
      }
    });
    
  } catch (error) {
    console.error('Inventory update error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Bulk update inventory - admin only
router.put('/', authenticateToken, requirePermission('inventory', 'update'), async (req, res) => {
  try {
    const { updates } = req.body; // Array of { shirt_size, stock }

    if (!Array.isArray(updates)) {
      return res.status(400).json({ message: 'Las actualizaciones deben ser un array' });
    }

    // Validate all updates first
    for (const update of updates) {
      if (!update.shirt_size || typeof update.stock !== 'number' || update.stock < 0) {
        return res.status(400).json({ 
          message: 'Datos de actualización inválidos',
          invalid_item: update
        });
      }
    }

    // Check constraints for each update
    const validationPromises = updates.map(async update => {
      const { data: current } = await req.supabase
        .from('inventory')
        .select('reserved')
        .eq('shirt_size', update.shirt_size)
        .single();
      
      if (current && update.stock < current.reserved) {
        throw new Error(`Stock para ${update.shirt_size} no puede ser menor que ${current.reserved} (reservado)`);
      }
      
      return update;
    });

    try {
      await Promise.all(validationPromises);
    } catch (validationError) {
      return res.status(400).json({ 
        message: validationError.message 
      });
    }

    // Perform updates
    const updatePromises = updates.map(update => 
      req.supabase
        .from('inventory')
        .update({ 
          stock: update.stock, 
          updated_at: new Date().toISOString() 
        })
        .eq('shirt_size', update.shirt_size)
        .select()
    );

    const results = await Promise.all(updatePromises);
    
    // Check if any updates failed
    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      console.error('Some inventory updates failed:', errors);
      return res.status(500).json({ 
        message: 'Algunas actualizaciones fallaron', 
        errors: errors.map(e => ({
          size: e.data?.shirt_size,
          error: e.error.message
        }))
      });
    }

    // Get updated inventory with status
    const { data: inventory } = await req.supabase
      .from('inventory_status')
      .select('*');

    res.json(inventory);
    
  } catch (error) {
    console.error('Bulk inventory update error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get inventory summary with detailed breakdown - accessible by multiple roles
{/*router.get('/summary', authenticateToken, requireAnyPermission(
  { resource: 'inventory', action: 'read' },
  { resource: 'inventory', action: 'manage' },
  { resource: 'dashboard', action: 'view_store' },
  { resource: 'dashboard', action: 'view_reports' }
), async (req, res) => {
  try {
    const supabase = req.supabase || supabaseAdmin;
    
    // Get inventory with status
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory_status')
      .select('*');

    if (inventoryError) {
      throw inventoryError;
    }

    // Get confirmed runners count by size
    const { data: confirmedRunners } = await supabase
      .from('runners')
      .select('shirt_size')
      .eq('payment_status', 'confirmado');

    // Get pending/processing runners count by size  
    const { data: pendingRunners } = await supabase
      .from('runners')
      .select('shirt_size')
      .in('payment_status', ['pendiente', 'procesando']);

    // Count by size
    const confirmed = {};
    const pending = {};
    
    confirmedRunners?.forEach(runner => {
      confirmed[runner.shirt_size] = (confirmed[runner.shirt_size] || 0) + 1;
    });
    
    pendingRunners?.forEach(runner => {
      pending[runner.shirt_size] = (pending[runner.shirt_size] || 0) + 1;
    });

    // Build detailed summary
    const summary = inventory?.map(item => ({
      shirt_size: item.shirt_size,
      stock: item.stock,
      reserved: item.reserved,
      available: item.available,
      status: item.status,
      confirmed_count: confirmed[item.shirt_size] || 0,
      pending_count: pending[item.shirt_size] || 0,
      percentage_available: item.stock > 0 
        ? Math.round((item.available / item.stock) * 100) 
        : 0
    }));

    // Calculate totals
    const totals = summary?.reduce((acc, item) => ({
      total_stock: acc.total_stock + item.stock,
      total_reserved: acc.total_reserved + item.reserved,
      total_available: acc.total_available + item.available,
      total_confirmed: acc.total_confirmed + item.confirmed_count,
      total_pending: acc.total_pending + item.pending_count
    }), {
      total_stock: 0,
      total_reserved: 0,
      total_available: 0,
      total_confirmed: 0,
      total_pending: 0
    });

    res.json({
      success: true,
      data: {
        summary: summary || [],
        totals: totals || {}
      }
    });
    
  } catch (error) {
    console.error('Inventory summary error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});*/}

// Adjust reserved inventory manually - admin only
router.post('/adjust-reserved', authenticateToken, requirePermission('inventory', 'manage'), async (req, res) => {
  try {
    const { shirt_size, reserved, reason } = req.body;
    const supabase = req.supabase || supabaseAdmin;

    if (!shirt_size || typeof reserved !== 'number' || reserved < 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Datos inválidos' 
      });
    }

    if (!reason) {
      return res.status(400).json({ 
        success: false,
        message: 'Se requiere una razón para ajustar las reservas' 
      });
    }

    // Get current inventory
    const { data: current, error: fetchError } = await supabase
      .from('inventory')
      .select('*')
      .eq('shirt_size', shirt_size)
      .single();

    if (fetchError || !current) {
      return res.status(404).json({ 
        success: false,
        message: 'Talla no encontrada' 
      });
    }

    // Check constraint
    if (reserved > current.stock) {
      return res.status(400).json({ 
        success: false,
        message: 'Las reservas no pueden exceder el stock',
        current_stock: current.stock,
        requested_reserved: reserved
      });
    }

    // Update reserved
    const { data, error } = await supabase
      .from('inventory')
      .update({ 
        reserved,
        updated_at: new Date().toISOString() 
      })
      .eq('shirt_size', shirt_size)
      .select()
      .single();

    if (error) {
      console.error('Reserved adjustment error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error al ajustar reservas' 
      });
    }

    // Log the adjustment
    console.log(`Reserved adjustment for ${shirt_size}: ${current.reserved} -> ${reserved}. Reason: ${reason}`);

    res.json({
      success: true,
      data: {
        ...data,
        available: data.stock - data.reserved,
        previous_reserved: current.reserved,
        adjustment_reason: reason
      }
    });
    
  } catch (error) {
    console.error('Reserved adjustment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Reservar inventario desde iframe
router.post('/reserve', authenticateTokenOrIframe, async (req, res) => {
  try {
    const { items } = req.body; // [{ shirt_size: 'M', quantity: 1 }]
    const supabase = req.supabase || supabaseAdmin;
    
    // Validar datos
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Datos de reserva inválidos' 
      });
    }

    // Validar cada item
    for (const item of items) {
      if (!item.shirt_size || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({ 
          success: false,
          message: 'Cada item debe tener shirt_size y quantity válidos' 
        });
      }
    }

    console.log('=== Iniciando reserva de inventario ===');
    console.log('Items a reservar:', items);
    console.log('Usuario/Token:', req.user?.email || req.iframeToken?.token_type || 'público');

    // Iniciar transacción - verificar disponibilidad primero
    const updates = [];
    const verificaciones = [];
    
    for (const item of items) {
      // Obtener inventario actual
      const { data: current, error: fetchError } = await supabase
        .from('inventory')
        .select('*')
        .eq('shirt_size', item.shirt_size)
        .single();

      if (fetchError || !current) {
        return res.status(404).json({ 
          success: false,
          message: `Talla ${item.shirt_size} no encontrada` 
        });
      }

      const available = current.stock - current.reserved;
      
      if (available < item.quantity) {
        return res.status(400).json({ 
          success: false,
          message: `Solo hay ${available} unidades disponibles de talla ${item.shirt_size}`,
          available,
          requested: item.quantity
        });
      }

      verificaciones.push({
        shirt_size: item.shirt_size,
        current_stock: current.stock,
        current_reserved: current.reserved,
        available,
        requested: item.quantity
      });
    }

    console.log('Verificaciones completadas:', verificaciones);

    // Si todas las verificaciones pasaron, proceder con las actualizaciones
    for (const item of items) {
      const verificacion = verificaciones.find(v => v.shirt_size === item.shirt_size);
      
      // Actualizar reservado
      const { data, error } = await supabase
        .from('inventory')
        .update({ 
          reserved: verificacion.current_reserved + item.quantity,
          updated_at: new Date().toISOString() 
        })
        .eq('shirt_size', item.shirt_size)
        .select()
        .single();

      if (error) {
        console.error('Error actualizando reserva:', error);
        // TODO: Rollback de las actualizaciones previas
        throw error;
      }

      updates.push({
        shirt_size: item.shirt_size,
        quantity: item.quantity,
        previous_reserved: verificacion.current_reserved,
        new_reserved: data.reserved,
        new_available: data.stock - data.reserved
      });
    }

    // Registrar uso del token si es iframe
    if (req.iframeToken) {
      await supabase
        .from('iframe_token_usage')
        .insert({
          token_id: req.iframeToken.id,
          action: 'inventory_reserve',
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          metadata: {
            items,
            updates,
            total_quantity: items.reduce((sum, item) => sum + item.quantity, 0)
          }
        });
    }

    console.log('Reserva completada exitosamente:', updates);

    res.json({
      success: true,
      message: 'Inventario reservado exitosamente',
      data: {
        updates,
        total_reserved: items.reduce((sum, item) => sum + item.quantity, 0),
        reservation_id: `RES_${Date.now()}`,
        reserved_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Reserve inventory error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al reservar inventario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/confirm-purchase', async (req, res) => {
  try {
    const { 
      token, // Token del iframe
      items, // [{ shirt_size: 'M', quantity: 1 }]
      transaction_reference, // Referencia de la transacción de pago
      purchase_details
    } = req.body;

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Token requerido' 
      });
    }

    // Validar token
    const tokenValidation = await validateIframeToken(token, supabaseAdmin);
    
    if (!tokenValidation.valid) {
      return res.status(401).json({ 
        success: false,
        message: tokenValidation.error 
      });
    }

    console.log('=== Confirmando compra ===');
    console.log('Items:', items);
    console.log('Referencia:', transaction_reference);

    // Confirmar la compra - convertir reservas en ventas reales
    const confirmations = [];
    
    for (const item of items) {
      // Obtener inventario actual
      const { data: current, error: fetchError } = await supabaseAdmin
        .from('inventory')
        .select('*')
        .eq('shirt_size', item.shirt_size)
        .single();

      if (fetchError || !current) {
        return res.status(404).json({ 
          success: false,
          message: `Talla ${item.shirt_size} no encontrada` 
        });
      }

      // La lógica aquí depende de cómo manejes las reservas vs stock real
      // Opción 1: Reducir stock y reservado
      const newStock = current.stock - item.quantity;
      const newReserved = Math.max(0, current.reserved - item.quantity);

      const { data, error } = await supabaseAdmin
        .from('inventory')
        .update({ 
          stock: newStock,
          reserved: newReserved,
          updated_at: new Date().toISOString() 
        })
        .eq('shirt_size', item.shirt_size)
        .select()
        .single();

      if (error) {
        console.error('Error confirmando compra:', error);
        throw error;
      }

      confirmations.push({
        shirt_size: item.shirt_size,
        quantity: item.quantity,
        previous_stock: current.stock,
        new_stock: data.stock,
        previous_reserved: current.reserved,
        new_reserved: data.reserved
      });
    }

    // Registrar la compra
    await supabaseAdmin
      .from('iframe_token_usage')
      .insert({
        token_id: tokenValidation.token.id,
        action: 'purchase_confirmed',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        metadata: {
          items,
          confirmations,
          transaction_reference,
          purchase_details
        }
      });

    console.log('Compra confirmada exitosamente:', confirmations);

    res.json({
      success: true,
      message: 'Compra confirmada exitosamente',
      data: {
        confirmations,
        transaction_reference,
        confirmed_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Confirm purchase error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al confirmar compra' 
    });
  }
});

// Get inventory stats - accessible by multiple roles
router.get('/stats', authenticateToken, requireAnyPermission(
  { resource: 'inventory', action: 'read' },
  { resource: 'inventory', action: 'manage' },
  { resource: 'dashboard', action: 'view_store' },
  { resource: 'dashboard', action: 'view_boss' }
), async (req, res) => {
  try {
    const supabase = req.supabase || supabaseAdmin;
    
    const { data: inventory, error } = await supabase
      .from('inventory')
      .select('*');

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Error fetching inventory stats' 
      });
    }

    const stats = {
      totalStock: inventory.reduce((sum, item) => sum + item.stock, 0),
      totalReserved: inventory.reduce((sum, item) => sum + item.reserved, 0),
      totalAvailable: inventory.reduce((sum, item) => sum + (item.stock - item.reserved), 0),
      sizeBreakdown: inventory.map(item => ({
        size: item.shirt_size,
        stock: item.stock,
        reserved: item.reserved,
        available: item.stock - item.reserved
      }))
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get inventory stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
});

// Recalculate reserved based on actual pending runners - admin only
router.post('/recalculate-reserved', authenticateToken, requirePermission('inventory', 'manage'), async (req, res) => {
  try {
    const supabase = req.supabase || supabaseAdmin;
    
    // Get all pending/processing runners
    const { data: pendingRunners, error: runnersError } = await supabase
      .from('runners')
      .select('shirt_size')
      .in('payment_status', ['pendiente', 'procesando']);

    if (runnersError) {
      throw runnersError;
    }

    // Count by size
    const reservedCounts = {};
    pendingRunners?.forEach(runner => {
      reservedCounts[runner.shirt_size] = (reservedCounts[runner.shirt_size] || 0) + 1;
    });

    // Get all inventory items
    const { data: inventory } = await supabase
      .from('inventory')
      .select('*');

    // Update each inventory item
    const updates = [];
    for (const item of inventory || []) {
      const calculatedReserved = reservedCounts[item.shirt_size] || 0;
      
      if (item.reserved !== calculatedReserved) {
        updates.push({
          shirt_size: item.shirt_size,
          old_reserved: item.reserved,
          new_reserved: calculatedReserved
        });

        await supabase
          .from('inventory')
          .update({ 
            reserved: calculatedReserved,
            updated_at: new Date().toISOString()
          })
          .eq('shirt_size', item.shirt_size);
      }
    }

    // Get updated inventory
    const { data: updatedInventory } = await supabase
      .from('inventory_status')
      .select('*');

    res.json({
      success: true,
      message: 'Reservas recalculadas exitosamente',
      data: {
        updates,
        inventory: updatedInventory
      }
    });
    
  } catch (error) {
    console.error('Recalculate reserved error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Get low stock alerts - accessible by admin and boss
router.get('/alerts', authenticateToken, requireAnyPermission(
  { resource: 'inventory', action: 'manage' },
  { resource: 'dashboard', action: 'view_boss' }
), async (req, res) => {
  try {
    const { threshold = 10 } = req.query;
    const supabase = req.supabase || supabaseAdmin;
    
    const { data: inventory, error } = await supabase
      .from('inventory_status')
      .select('*')
      .lt('available', threshold)
      .order('available');

    if (error) {
      throw error;
    }

    const alerts = inventory?.map(item => ({
      ...item,
      alert_level: item.available === 0 ? 'critical' : 
                    item.available < 5 ? 'high' : 'medium',
      message: item.available === 0 
        ? `Talla ${item.shirt_size} agotada`
        : `Solo quedan ${item.available} unidades de talla ${item.shirt_size}`
    }));

    res.json({
      success: true,
      data: {
        alerts: alerts || [],
        total_alerts: alerts?.length || 0,
        threshold
      }
    });
    
  } catch (error) {
    console.error('Inventory alerts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

export default router;