// server/routes/runners.js
import express from 'express';
import { authenticateToken, requirePermission, requireAnyPermission, enrichUserData } from '../middleware/auth.js';
import { assignRunnerNumbers } from '../utils/runnerNumberAssignment.js';

const router = express.Router();

// Register a group of runners (public or authenticated)
router.post('/register-group', async (req, res) => {
  try {
    const { 
      registrant_email, 
      registrant_phone,
      payment_method,
      payment_reference,
      payment_proof_url,
      runners,
      bank_id
    } = req.body;

    // Validaciones detalladas
    const missingFields = [];
    
    if (!registrant_email) missingFields.push('registrant_email');
    if (!registrant_phone) missingFields.push('registrant_phone');
    if (!payment_method) missingFields.push('payment_method');
    if (!runners || !Array.isArray(runners)) missingFields.push('runners');
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Faltan campos requeridos en la solicitud',
        error_code: 'MISSING_REQUIRED_FIELDS',
        missing_fields: missingFields,
        details: {
          registrant_email: 'Email del responsable del grupo',
          registrant_phone: 'Teléfono del responsable del grupo',
          payment_method: 'Método de pago seleccionado',
          runners: 'Array con la información de los corredores'
        }
      });
    }

    // Validar email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registrant_email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'El formato del email no es válido',
        error_code: 'INVALID_EMAIL_FORMAT',
        field: 'registrant_email',
        value: registrant_email
      });
    }

    // Validar teléfono
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(registrant_phone)) {
      return res.status(400).json({ 
        success: false, 
        message: 'El formato del teléfono no es válido',
        error_code: 'INVALID_PHONE_FORMAT',
        field: 'registrant_phone',
        value: registrant_phone,
        hint: 'Use solo números, espacios, guiones y paréntesis'
      });
    }

    // Validar cantidad de corredores
    if (runners.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Debe registrar al menos un corredor',
        error_code: 'NO_RUNNERS_PROVIDED',
        field: 'runners',
        runners_count: 0
      });
    }

    if (runners.length > 5) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se excedió el límite máximo de corredores por grupo',
        error_code: 'EXCEEDS_GROUP_LIMIT',
        field: 'runners',
        runners_count: runners.length,
        max_allowed: 5,
        hint: 'Puede registrar hasta 5 corredores por grupo'
      });
    }

    // Validar información de cada corredor
    const runnerErrors = [];
    runners.forEach((runner, index) => {
      const runnerMissingFields = [];
      
      if (!runner.full_name) runnerMissingFields.push('full_name');
      if (!runner.identification) runnerMissingFields.push('identification');
      if (!runner.birth_date) runnerMissingFields.push('birth_date');
      if (!runner.gender) runnerMissingFields.push('gender');
      if (!runner.shirt_size) runnerMissingFields.push('shirt_size');
      
      if (runnerMissingFields.length > 0) {
        runnerErrors.push({
          runner_index: index + 1,
          runner_name: `${runner.first_name || 'Sin nombre'} ${runner.last_name || ''}`.trim(),
          missing_fields: runnerMissingFields,
          message: `Corredor ${index + 1}: Faltan campos requeridos`
        });
      }

      // Validar formato de fecha
      if (runner.birth_date && !Date.parse(runner.birth_date)) {
        runnerErrors.push({
          runner_index: index + 1,
          field: 'birth_date',
          value: runner.birth_date,
          message: `Corredor ${index + 1}: Formato de fecha de nacimiento inválido`
        });
      }

      // Validar género
      if (runner.gender && !['M', 'F'].includes(runner.gender)) {
        runnerErrors.push({
          runner_index: index + 1,
          field: 'gender',
          value: runner.gender,
          message: `Corredor ${index + 1}: El género debe ser 'M' o 'F'`
        });
      }

      // Validar talla
      const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
      if (runner.shirt_size && !validSizes.includes(runner.shirt_size)) {
        runnerErrors.push({
          runner_index: index + 1,
          field: 'shirt_size',
          value: runner.shirt_size,
          valid_values: validSizes,
          message: `Corredor ${index + 1}: Talla de camisa inválida`
        });
      }
    });

    if (runnerErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Se encontraron errores en la información de los corredores',
        error_code: 'INVALID_RUNNER_DATA',
        errors: runnerErrors,
        total_errors: runnerErrors.length
      });
    }

    // Validar métodos de pago
    const validPaymentMethods = ['zelle', 'transferencia_nacional', 'transferencia_internacional', 'paypal', 'pago_movil_p2c'];
    if (!validPaymentMethods.includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: 'Método de pago no válido',
        error_code: 'INVALID_PAYMENT_METHOD',
        field: 'payment_method',
        value: payment_method,
        valid_methods: validPaymentMethods
      });
    }

    const manualMethods = ['zelle', 'transferencia_nacional', 'transferencia_internacional', 'paypal'];
    if (manualMethods.includes(payment_method) && !payment_proof_url && !payment_reference) {
      return res.status(400).json({
        success: false,
        message: 'El comprobante de pago o referencia es requerido para este método de pago',
        error_code: 'MISSING_PAYMENT_PROOF',
        payment_method: payment_method,
        hint: 'Debe proporcionar payment_proof_url (URL del comprobante) o payment_reference (número de referencia)'
      });
    }

    // Validar banco para transferencias nacionales
    if (payment_method === 'transferencia_nacional' && !bank_id) {
      return res.status(400).json({
        success: false,
        message: 'Debe seleccionar un banco para transferencias nacionales',
        error_code: 'MISSING_BANK_ID',
        field: 'bank_id',
        payment_method: payment_method
      });
    }

    // Generar código de grupo
    const groupCode = `G${Date.now().toString(36).toUpperCase()}`;

    // CAMBIO CRÍTICO: Manejar P2C diferente
    if (payment_method === 'pago_movil_p2c') {
      
      // Para P2C: Crear grupo SIN corredores
      const { data: group, error: groupError } = await req.supabase
      .from('registration_groups')
      .insert({
        group_code: groupCode,
        registrant_email,
        registrant_phone,
        registrant_identification: runners[0]?.identification || null,
        total_runners: runners.length,
        payment_method: 'pago_movil_p2c',
        payment_reference: null,
        payment_proof_url: null,
        payment_status: 'pendiente', // CAMBIO: usar 'pendiente' en lugar de 'pendiente_p2c'
        reserved_until: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      })
      .select()
      .single();

      if (groupError) {
        console.error('Error creating P2C group:', groupError);
        return res.status(500).json({ 
          success: false, 
          message: 'Error al crear el grupo',
          error_code: 'GROUP_CREATION_FAILED',
          details: groupError.message
        });
      }

      // Guardar datos de runners en payment_events para crear después
      await req.supabase
        .from('payment_events')
        .insert({
          group_id: group.id,
          event_type: 'pending_runners_p2c',
          event_data: {
            runners: runners.map(r => ({
              full_name: r.full_name,
              identification_type: r.identification_type,
              identification: r.identification,
              birth_date: r.birth_date,
              gender: r.gender,
              email: r.email,
              phone: r.phone,
              shirt_size: r.shirt_size
            })),
            total_count: runners.length
          }
        });

      console.log(`✅ Grupo P2C ${groupCode} creado (ID: ${group.id}) - esperando pago`);

      return res.json({
        success: true,
        message: 'Grupo creado. Proceda con el pago P2C para completar el registro.',
        group_code: groupCode,
        group: {
          ...group,
          runners: []
        },
        summary: {
          total_runners: runners.length,
          payment_method: 'pago_movil_p2c',
          payment_status: 'pendiente_p2c',
          reserved_until: group.reserved_until,
          requires_payment: true,
          note: 'Los corredores se crearán al confirmar el pago'
        }
      });

    } else {
      // Para OTROS métodos: flujo normal
      const { data: group, error: groupError } = await req.supabase
        .from('registration_groups')
        .insert({
          group_code: groupCode,
          registrant_email,
          registrant_phone,
          total_runners: runners.length,
          payment_method,
          payment_reference: payment_reference || null,
          payment_proof_url: payment_proof_url || null,
          payment_status: manualMethods.includes(payment_method) ? 'pendiente' : 'procesando',
          reserved_until: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      if (groupError) {
        console.error('Error creating group:', groupError);
        return res.status(500).json({ 
          success: false, 
          message: 'Error al crear el grupo',
          error_code: 'GROUP_CREATION_FAILED',
          details: groupError.message
        });
      }

      // Crear corredores normalmente
      const runnersToInsert = runners.map((runner, index) => ({
        full_name: runner.full_name || `${runner.first_name || ''} ${runner.last_name || ''}`.trim(),
        identification_type: runner.identification_type,
        identification: runner.identification,
        birth_date: runner.birth_date || null,
        gender: runner.gender,
        email: runner.email,
        phone: runner.phone,
        shirt_size: runner.shirt_size,
        group_id: group.id,
        payment_status: 'pendiente',
        registered_by: req.user?.id || null
      }));

      const { data: insertedRunners, error: runnersError } = await req.supabase
        .from('runners')
        .insert(runnersToInsert)
        .select();

      if (runnersError) {
        await req.supabase
          .from('registration_groups')
          .delete()
          .eq('id', group.id);

        console.error('Error creating runners:', runnersError);
        
        let errorMessage = 'Error al registrar los corredores';
        let errorCode = 'RUNNER_REGISTRATION_FAILED';
        
        if (runnersError.code === '23505') {
          errorMessage = 'Uno o más corredores ya están registrados';
          errorCode = 'DUPLICATE_RUNNER';
        }
        
        return res.status(500).json({ 
          success: false, 
          message: errorMessage,
          error_code: errorCode,
          details: runnersError.message
        });
      }

      // Resto del flujo normal...
      if (payment_method === 'transferencia_nacional' && bank_id) {
        await req.supabase
          .from('group_bank_accounts')
          .insert({
            group_id: group.id,
            bank_id: bank_id
          });
      }

      const inventoryReservations = insertedRunners.map(runner => ({
        runner_id: runner.id,
        group_id: group.id,
        shirt_size: runner.shirt_size,
        gender: runner.gender,
        quantity: 1,
        status: 'active',
      }));

      await req.supabase
        .from('inventory_reservations')
        .insert(inventoryReservations);

      console.log(`✅ Grupo ${groupCode} creado con ${runners.length} corredores`);

      return res.json({
        success: true,
        message: 'Registro exitoso',
        group_code: groupCode,
        group: {
          ...group,
          runners: insertedRunners
        },
        summary: {
          total_runners: runners.length,
          payment_method: payment_method,
          payment_status: group.payment_status,
          reserved_until: group.reserved_until,
          requires_manual_confirmation: manualMethods.includes(payment_method)
        }
      });
    }

  } catch (error) {
    console.error('Error in register-group:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor',
      error_code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Admin/Store group registration with auto-confirm option
router.post('/admin-register-group', authenticateToken, requireAnyPermission(
  { resource: 'runners', action: 'create' },
  { resource: 'runners', action: 'register_group' }
), async (req, res) => {
  try {
    const {
      registrant_email,
      registrant_phone,
      payment_method,
      payment_reference,
      runners,
      auto_confirm
    } = req.body;

    // Validate inputs (same as public registration)
    if (!registrant_email || !registrant_phone || !payment_method || !runners || !Array.isArray(runners)) {
      return res.status(400).json({ 
        message: 'Datos del registrante y corredores son requeridos'
      });
    }

    if (runners.length < 1 || runners.length > 5) {
      return res.status(400).json({ 
        message: 'El grupo debe tener entre 1 y 5 corredores'
      });
    }

    // ⭐ NUEVO: Determinar métodos que se confirman automáticamente
    const storePaymentMethods = [
      'tienda', 
      'tarjeta_debito', 
      'tarjeta_credito', 
      'efectivo_bs', 
      'efectivo_usd',
      'obsequio_exonerado'
    ];
    
    // Para tienda y métodos automáticos, confirmar inmediatamente
    const shouldAutoConfirm = (storePaymentMethods.includes(payment_method) && 
                              (req.user.permissions.includes('runners:register_group') || 
                              (req.user.permissions.includes('runners:manage') && auto_confirm))) ||
                              payment_method === 'pago_movil_p2c'; // P2C también se confirma automáticamente cuando es exitoso

    // Create the group
    const { data: result, error: createError } = await req.supabase
      .rpc('create_registration_group_with_runners', {
        p_registrant_email: registrant_email,
        p_registrant_phone: registrant_phone,
        p_payment_method: payment_method,
        p_runners: runners,
        p_registered_by: req.user.id
      });

    if (createError) {
      console.error('Error creating group:', createError);
      return res.status(500).json({ 
        message: 'Error al crear el grupo de registro',
        error: createError.message
      });
    }

    // Update with payment reference
    if (payment_reference) {
      await req.supabase
        .from('registration_groups')
        .update({ payment_reference })
        .eq('id', result.group_id);
    }

    // Auto-confirm if applicable
    if (shouldAutoConfirm) {
      const { error: confirmError } = await req.supabase
        .rpc('confirm_group_payment', {
          p_group_id: result.group_id,
          p_confirmed_by: req.user.id
        });
      
      if (confirmError) {
        console.error('Error confirming payment:', confirmError);
      } else {
        result.payment_status = 'confirmado';
        
        // ⭐ ASIGNAR NÚMEROS AUTOMÁTICAMENTE para métodos confirmados
        try {
          const numberAssignment = await assignRunnerNumbers(result.group_id, req.supabase);
          if (numberAssignment.success) {
            console.log(`✅ Números asignados automáticamente: ${numberAssignment.assigned} corredores`);
            result.numbers_assigned = numberAssignment.assigned;
            result.assigned_numbers = numberAssignment.numbers;
          } else {
            console.error('❌ Error asignando números:', numberAssignment.error);
            result.number_assignment_error = numberAssignment.error;
          }
        } catch (numberError) {
          console.error('❌ Error en asignación de números:', numberError);
          result.number_assignment_error = numberError.message;
        }
      }
    }

    // Get full group details
    const { data: groupDetails } = await req.supabase
      .from('runner_group_summary')
      .select('*')
      .eq('group_id', result.group_id)
      .single();

    res.status(201).json({
      message: 'Grupo registrado exitosamente' + (shouldAutoConfirm ? ' y pago confirmado' : ''),
      group: groupDetails || result,
      auto_confirmed: shouldAutoConfirm,
      numbers_assigned: result.numbers_assigned || 0
    });

  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get all runners (with filters) - accessible by all authenticated users
router.get('/', authenticateToken, enrichUserData, async (req, res) => {
  try {
    // 🔍 LOGS DE DEBUG DETALLADOS
    console.log('\n=== DEBUG GET /api/runners ===');
    console.log('1. Usuario:', req.user?.email || 'NO USER');
    console.log('2. Rol:', req.user?.role);
    console.log('3. Tipo de req.user:', typeof req.user);
    
    if (req.user) {
      console.log('4. Claves en req.user:', Object.keys(req.user));
      console.log('5. Tipo de permissions:', typeof req.user.permissions);
      console.log('6. Es array permissions:', Array.isArray(req.user.permissions));
      
      if (req.user.permissions) {
        console.log('7. Contenido permissions:', req.user.permissions);
        
        if (Array.isArray(req.user.permissions)) {
          console.log('8. Total permisos:', req.user.permissions.length);
          console.log('9. Primeros 5 permisos:', req.user.permissions.slice(0, 5));
          console.log('10. Tiene runners:read:', req.user.permissions.includes('runners:read'));
          console.log('11. Tiene runners:manage:', req.user.permissions.includes('runners:manage'));
          console.log('12. Tiene system:manage_all:', req.user.permissions.includes('system:manage_all'));
        } else {
          console.log('⚠️ permissions NO es un array, es:', req.user.permissions);
        }
      } else {
        console.log('⚠️ req.user.permissions es undefined o null');
      }
      
      // Verificar otras propiedades que podrían tener los permisos
      if (req.user.permissionsList) {
        console.log('13. permissionsList existe:', Array.isArray(req.user.permissionsList));
        console.log('14. permissionsList contenido:', req.user.permissionsList?.slice(0, 5));
      }
      
      if (req.user.permissionsObject) {
        console.log('15. permissionsObject existe:', typeof req.user.permissionsObject);
      }
    }
    console.log('==============================\n');

    // Tu código existente continúa aquí...
    const { 
      payment_status, 
      payment_method, 
      shirt_size,
      gender,
      search,
      group_id,
      has_number,
      limit = 100,
      offset = 0
    } = req.query;

    let query = req.supabase
      .from('runners')
      .select(`
        *,
        group:registration_groups!group_id(
          id,
          group_code,
          registrant_email,
          payment_status,
          payment_method,
          payment_confirmed_at,
          payment_confirmed_by
        ),
        registered_by_user:users!registered_by(
          id,
          email,
          role
        )
      `, { count: 'exact' });

    // Apply filters based on permissions
    console.log('16. Verificando permisos...');
    
    // IMPORTANTE: Verificar que permissions sea un array antes de usar .some()
    if (!Array.isArray(req.user.permissions)) {
      console.log('⚠️ PROBLEMA: permissions no es un array, intentando recuperar...');
      
      // Intentar recuperar de otras propiedades
      if (req.user.permissionsList && Array.isArray(req.user.permissionsList)) {
        console.log('✅ Usando permissionsList como fallback');
        req.user.permissions = req.user.permissionsList;
      } else {
        console.log('❌ No se pudo recuperar un array de permisos');
        return res.status(403).json({ 
          message: 'Error en la estructura de permisos del usuario',
          debug: process.env.NODE_ENV === 'development' ? {
            hasPermissions: !!req.user.permissions,
            permissionsType: typeof req.user.permissions,
            permissionsKeys: req.user.permissions ? Object.keys(req.user.permissions) : null
          } : undefined
        });
      }
    }
    
    const hasViewAllPermission = req.user.permissions.some(p => 
      ['runners:read', 'runners:manage'].includes(p)
    );
    
    console.log('17. hasViewAllPermission:', hasViewAllPermission);
    console.log('18. Continuando con la lógica normal...\n');

    // Apply additional filters
    if (payment_status) {
      query = query.eq('payment_status', payment_status);
    }

    if (payment_method) {
      query = query.eq('payment_method', payment_method);
    }

    if (shirt_size) {
      query = query.eq('shirt_size', shirt_size);
    }

    if (gender) {
      query = query.eq('gender', gender);
    }

    if (group_id) {
      query = query.eq('group_id', group_id);
    }

    if (has_number === 'true') {
      query = query.not('runner_number', 'is', null);
    } else if (has_number === 'false') {
      query = query.is('runner_number', null);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,identification.ilike.%${search}%,runner_number.ilike.%${search}%`);
    }

    // Apply pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: runners, error, count } = await query;

    if (error) {
      console.error('Error fetching runners:', error);
      return res.status(500).json({ message: 'Error al obtener corredores' });
    }

    res.json({ 
      runners: runners || [],
      pagination: {
        total: count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get runner by ID
router.get('/:id', authenticateToken, enrichUserData, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: runner, error } = await req.supabase
      .from('runners')
      .select(`
        *,
        group:registration_groups!group_id(
          id,
          group_code,
          registrant_email,
          registrant_phone,
          total_runners,
          payment_status,
          payment_method,
          payment_reference,
          payment_confirmed_at,
          reserved_until
        ),
        registered_by_user:users!registered_by(
          id,
          email,
          role
        )
      `)
      .eq('id', id)
      .single();

    if (error || !runner) {
      return res.status(404).json({ message: 'Corredor no encontrado' });
    }

    // Check permissions
    const hasViewAllPermission = req.user.permissions.some(p => 
      ['runners:read', 'runners:manage'].includes(p)
    );

    const canView = hasViewAllPermission ||
                    (req.user.permissions.includes('runners:register_group') && runner.registered_by === req.user.id) ||
                    (req.user.permissions.includes('runners:view_own') && runner.group.registrant_email === req.user.email);

    if (!canView) {
      return res.status(403).json({ 
        message: 'No tienes permisos para ver este corredor' 
      });
    }

    // Calculate age
    const birthDate = new Date(runner.birth_date);
    const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    runner.age = age;

    res.json({ runner });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Update runner (limited fields)
router.put('/:id', authenticateToken, enrichUserData, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get current runner data
    const { data: currentRunner, error: fetchError } = await req.supabase
      .from('runners')
      .select(`
        *,
        group:registration_groups!group_id(
          registrant_email,
          payment_status
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !currentRunner) {
      return res.status(404).json({ message: 'Corredor no encontrado' });
    }

    // Check permissions
    const hasUpdatePermission = req.user.permissions.includes('runners:update') || 
                                req.user.permissions.includes('runners:manage');

    const canUpdate = hasUpdatePermission ||
                      (req.user.permissions.includes('runners:register_group') && currentRunner.registered_by === req.user.id) ||
                      (req.user.permissions.includes('runners:view_own') && currentRunner.group.registrant_email === req.user.email);

    if (!canUpdate) {
      return res.status(403).json({ 
        message: 'No tienes permisos para actualizar este corredor' 
      });
    }

    // Don't allow updates if payment is confirmed (unless admin)
    if (currentRunner.group.payment_status === 'confirmado' && !hasUpdatePermission) {
      return res.status(400).json({ 
        message: 'No se puede modificar un corredor con pago confirmado' 
      });
    }

    // Restrict which fields can be updated
    const allowedUpdates = {};
    
    if (hasUpdatePermission) {
      // Admin/Boss can update more fields
      const adminFields = ['phone', 'email', 'profile_photo_url', 'shirt_size', 'gender'];
      adminFields.forEach(field => {
        if (updates[field] !== undefined) {
          allowedUpdates[field] = updates[field];
        }
      });
    } else {
      // Non-admins can only update limited fields
      const userFields = ['phone', 'email', 'profile_photo_url'];
      userFields.forEach(field => {
        if (updates[field] !== undefined) {
          allowedUpdates[field] = updates[field];
        }
      });
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({ 
        message: 'No hay campos permitidos para actualizar' 
      });
    }

    // Handle shirt size/gender changes
    if ((allowedUpdates.shirt_size && allowedUpdates.shirt_size !== currentRunner.shirt_size) ||
        (allowedUpdates.gender && allowedUpdates.gender !== currentRunner.gender)) {
      
      const newSize = allowedUpdates.shirt_size || currentRunner.shirt_size;
      const newGender = allowedUpdates.gender || currentRunner.gender;
      
      // Check new size availability
      const { data: newInventory } = await req.supabase
        .from('inventory')
        .select('stock, reserved')
        .eq('shirt_size', newSize)
        .eq('gender', newGender)
        .single();

      if (!newInventory || (newInventory.stock - newInventory.reserved) < 1) {
        return res.status(400).json({ 
          message: 'La nueva talla/género no está disponible' 
        });
      }

      // This would require updating inventory reservations
      // Should be handled through a proper SQL function
    }

    // Update runner
    const { data: updatedRunner, error: updateError } = await req.supabase
      .from('runners')
      .update(allowedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ message: 'Error al actualizar corredor' });
    }

    res.json({
      message: 'Corredor actualizado exitosamente',
      runner: updatedRunner
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get runner statistics (admin, boss only)
router.get('/stats/summary', authenticateToken, requireAnyPermission(
  { resource: 'runners', action: 'manage' },
  { resource: 'dashboard', action: 'view_boss' }
), async (req, res) => {
  try {
    // Use views for statistics
    const { data: dailyStats } = await req.supabase
      .from('daily_statistics')
      .select('*')
      .order('date', { ascending: false })
      .limit(30);

    // Get runners with age
    const { data: ageStats } = await req.supabase
      .from('runners_with_age')
      .select('age, gender')
      .eq('payment_status', 'confirmado');

    // Process age distribution by gender
    const ageDistribution = {
      M: { '16-20': 0, '21-30': 0, '31-40': 0, '41-50': 0, '51-60': 0, '60+': 0 },
      F: { '16-20': 0, '21-30': 0, '31-40': 0, '41-50': 0, '51-60': 0, '60+': 0 }
    };

    ageStats?.forEach(runner => {
      const ageRange = 
        runner.age <= 20 ? '16-20' :
        runner.age <= 30 ? '21-30' :
        runner.age <= 40 ? '31-40' :
        runner.age <= 50 ? '41-50' :
        runner.age <= 60 ? '51-60' : '60+';
      
      if (ageDistribution[runner.gender]) {
        ageDistribution[runner.gender][ageRange]++;
      }
    });

    // Get size distribution by gender
    const { data: sizeStats } = await req.supabase
      .from('runners')
      .select('shirt_size, gender')
      .eq('payment_status', 'confirmado');

    const sizeDistribution = {
      M: {},
      F: {}
    };

    sizeStats?.forEach(runner => {
      if (sizeDistribution[runner.gender]) {
        sizeDistribution[runner.gender][runner.shirt_size] = 
          (sizeDistribution[runner.gender][runner.shirt_size] || 0) + 1;
      }
    });

    // Get current inventory status
    const { data: inventoryStatus } = await req.supabase
      .from('inventory_status_by_gender')
      .select('*')
      .order('gender')
      .order('shirt_size');

    res.json({
      dailyStats: dailyStats || [],
      ageDistribution,
      sizeDistribution,
      inventoryStatus: inventoryStatus || [],
      totals: {
        confirmed: ageStats?.length || 0,
        male: ageStats?.filter(r => r.gender === 'M').length || 0,
        female: ageStats?.filter(r => r.gender === 'F').length || 0
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Check if identification exists (public endpoint)
router.post('/check-identification', async (req, res) => {
  try {
    const { identification_type, identification } = req.body;

    if (!identification_type || !identification) {
      return res.status(400).json({ 
        message: 'Tipo e identificación son requeridos' 
      });
    }

    const { data: existingRunner } = await req.supabase
      .from('runners')
      .select(`
        id, 
        full_name, 
        payment_status,
        runner_number,
        group:registration_groups!group_id(
          group_code,
          payment_status
        )
      `)
      .eq('identification_type', identification_type)
      .eq('identification', identification)
      .single();

    res.json({
      exists: !!existingRunner,
      runner: existingRunner ? {
        id: existingRunner.id,
        full_name: existingRunner.full_name,
        payment_status: existingRunner.payment_status,
        runner_number: existingRunner.runner_number,
        group_code: existingRunner.group?.group_code,
        group_payment_status: existingRunner.group?.payment_status
      } : null
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get groups (for authenticated users)
router.get('/groups/my-groups', authenticateToken, enrichUserData, async (req, res) => {
  try {
    let query = req.supabase
      .from('runner_group_summary')
      .select('*');

    // Filter based on permissions
    const hasViewAllPermission = req.user.permissions.some(p => 
      ['runners:read', 'runners:manage'].includes(p)
    );

    if (!hasViewAllPermission) {
      if (req.user.permissions.includes('runners:register_group')) {
        // Tienda sees groups where they registered runners
        const { data: storeRunners } = await req.supabase
          .from('runners')
          .select('group_id')
          .eq('registered_by', req.user.id);
        
        const groupIds = [...new Set(storeRunners?.map(r => r.group_id) || [])];
        query = query.in('group_id', groupIds);
      } else if (req.user.permissions.includes('runners:view_own')) {
        // Regular users see their own groups
        query = query.eq('registrant_email', req.user.email);
      } else {
        return res.status(403).json({ message: 'No tienes permisos para ver grupos' });
      }
    }

    const { data: groups, error } = await query
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ 
      groups: groups || [],
      count: groups?.length || 0
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

router.put('/groups/:groupId/confirm-payment', authenticateToken, requireAnyPermission(
  { resource: 'payments', action: 'manage' },
  { resource: 'runners', action: 'manage' }
), async (req, res) => {
  const supabase = req.supabase;
  const { groupId } = req.params;
  const { approved, rejectionReason } = req.body;

  try {
    // Obtener el grupo con todos los corredores ANTES de cualquier actualización
    const { data: originalGroup, error: groupError } = await supabase
      .from('registration_groups')
      .select('*, runners(*)')
      .eq('id', groupId)
      .single();

    if (groupError || !originalGroup) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado',
        error: groupError?.message
      });
    }

    if (originalGroup.payment_status === 'confirmado') {
      return res.status(400).json({
        success: false,
        message: 'Este grupo ya tiene el pago confirmado'
      });
    }

    if (approved) {
      // Usar transacción para actualizar todo atómicamente
      const confirmationTimestamp = new Date().toISOString();
      
      // Actualizar estado del grupo
      const { error: updateError } = await supabase
        .from('registration_groups')
        .update({ 
          payment_status: 'confirmado',
          payment_confirmed_at: confirmationTimestamp,
          payment_confirmed_by: req.user.userId || req.user.id
        })
        .eq('id', groupId);

      if (updateError) {
        throw new Error(`Error actualizando grupo: ${updateError.message}`);
      }

      // Actualizar estado de los corredores
      const { error: runnersError } = await supabase
        .from('runners')
        .update({ 
          payment_status: 'confirmado',
          payment_confirmed_at: confirmationTimestamp
        })
        .eq('group_id', groupId);

      if (runnersError) {
        throw new Error(`Error actualizando corredores: ${runnersError.message}`);
      }

      // Variables para tracking
      let numbersAssigned = 0;
      let assignedNumbers = [];
      let finalRunnersData = originalGroup.runners;
      let numberAssignmentError = null;
      
      // ASIGNAR NÚMEROS DE DORSAL
      try {
        const { assignRunnerNumbers } = await import('../utils/runnerNumberAssignment.js');
        const numberAssignment = await assignRunnerNumbers(groupId, supabase);
        
        if (numberAssignment.success) {
          console.log(`✅ Números de dorsales asignados: ${numberAssignment.assigned} corredores`);
          numbersAssigned = numberAssignment.assigned;
          assignedNumbers = numberAssignment.numbers;
        } else {
          console.error('⚠️ Error asignando números:', numberAssignment.error);
          numberAssignmentError = numberAssignment.error;
        }
      } catch (numberError) {
        console.error('Error en asignación de números:', numberError);
        numberAssignmentError = numberError.message;
      }

      // Obtener datos ACTUALIZADOS del grupo y corredores para el email
      const { data: updatedGroup, error: fetchError } = await supabase
        .from('registration_groups')
        .select('*, runners(*)')
        .eq('id', groupId)
        .single();

      if (!fetchError && updatedGroup) {
        finalRunnersData = updatedGroup.runners;
      }

      // ENVIAR EMAIL DE CONFIRMACIÓN con datos actualizados
      let emailSent = false;
      let emailError = null;
      
      try {
        // Validar que tengamos datos completos antes de enviar
        if (!updatedGroup?.registrant_email) {
          throw new Error('Email del registrante no disponible');
        }

        if (!finalRunnersData || finalRunnersData.length === 0) {
          throw new Error('No hay corredores para confirmar');
        }

        const { sendRunnerConfirmationEmail } = await import('../utils/emailService.js');
        
        // Preparar datos del pago con toda la información necesaria
        const paymentData = {
          payment_method: updatedGroup.payment_method,
          payment_reference: updatedGroup.payment_reference,
          payment_confirmed_at: confirmationTimestamp,
          payment_confirmed_by: req.user.userId || req.user.id,
          exchange_rate: updatedGroup.exchange_rate || process.env.DEFAULT_EXCHANGE_RATE || '40',
          amount_usd: updatedGroup.amount_usd || (finalRunnersData.length * 25),
          amount_bs: updatedGroup.amount_bs,
          transaction_id: updatedGroup.transaction_id
        };
        
        // Enviar email con los datos actualizados
        const emailResult = await sendRunnerConfirmationEmail(
          updatedGroup,
          finalRunnersData,
          paymentData
        );
        
        if (emailResult.success) {
          emailSent = true;
          console.log('✅ Email de confirmación enviado exitosamente');
          
          // Registrar el envío exitoso del email
          await supabase
            .from('email_logs')
            .insert({
              type: 'runner_confirmation',
              recipient: updatedGroup.registrant_email,
              group_id: groupId,
              status: 'sent',
              message_id: emailResult.messageId,
              sent_at: new Date().toISOString(),
              metadata: {
                runners_count: finalRunnersData.length,
                numbers_assigned: numbersAssigned,
                cc_emails: emailResult.emailsSent?.cc || []
              }
            });
        }
      } catch (emailErr) {
        emailError = emailErr.message;
        console.error('⚠️ Error enviando email de confirmación:', emailErr);
        
        // Registrar el fallo del email
        await supabase
          .from('email_logs')
          .insert({
            type: 'runner_confirmation',
            recipient: updatedGroup?.registrant_email || originalGroup.registrant_email,
            group_id: groupId,
            status: 'failed',
            error: emailError,
            failed_at: new Date().toISOString()
          });
      }

      // Responder con éxito incluso si el email falló
      res.json({
        success: true,
        message: 'Pago confirmado exitosamente',
        group: {
          id: groupId,
          group_code: updatedGroup?.group_code || originalGroup.group_code,
          payment_status: 'confirmado',
          payment_confirmed_at: confirmationTimestamp,
          total_runners: finalRunnersData.length
        },
        numbersAssigned,
        assignedNumbers,
        numberAssignmentError,
        emailSent,
        emailError: emailSent ? null : emailError,
        // Incluir instrucción para reenviar email si falló
        ...(emailError && {
          retryEmailUrl: `/api/runners/groups/${groupId}/resend-confirmation-email`
        })
      });

    } else {
      // RECHAZAR EL PAGO
      const { error: updateError } = await supabase
        .from('registration_groups')
        .update({ 
          payment_status: 'rechazado',
          rejection_reason: rejectionReason || 'Pago rechazado por administrador',
          rejected_at: new Date().toISOString(),
          rejected_by: req.user.userId || req.user.id
        })
        .eq('id', groupId);

      if (updateError) {
        throw new Error(`Error rechazando pago: ${updateError.message}`);
      }

      // Enviar email de rechazo
      let rejectionEmailSent = false;
      try {
        const { sendRejectionEmail } = await import('../utils/emailService.js');
        
        const ticketData = {
          buyer_name: originalGroup.registrant_email.split('@')[0],
          buyer_email: originalGroup.registrant_email
        };
        
        const paymentData = {
          payment_method: originalGroup.payment_method,
          reference: originalGroup.payment_reference,
          amount_usd: (originalGroup.total_runners * 25).toString(),
          amount_bs: originalGroup.amount_bs,
          created_at: originalGroup.created_at
        };
        
        const rejectionResult = await sendRejectionEmail(
          ticketData, 
          paymentData, 
          rejectionReason
        );
        
        if (rejectionResult.success) {
          rejectionEmailSent = true;
          console.log('✅ Email de rechazo enviado');
          
          await supabase
            .from('email_logs')
            .insert({
              type: 'payment_rejection',
              recipient: originalGroup.registrant_email,
              group_id: groupId,
              status: 'sent',
              message_id: rejectionResult.messageId,
              sent_at: new Date().toISOString()
            });
        }
      } catch (emailError) {
        console.error('⚠️ Error enviando email de rechazo:', emailError);
      }

      res.json({
        success: true,
        message: 'Pago rechazado',
        group: {
          id: originalGroup.id,
          group_code: originalGroup.group_code,
          payment_status: 'rechazado'
        },
        rejectionEmailSent
      });
    }

  } catch (error) {
    console.error('Error confirmando pago manual:', error);
    
    // Intentar revertir cambios si algo falló
    try {
      await supabase
        .from('registration_groups')
        .update({ 
          payment_status: 'pendiente',
          payment_confirmed_at: null,
          payment_confirmed_by: null
        })
        .eq('id', groupId);
    } catch (rollbackError) {
      console.error('Error revirtiendo cambios:', rollbackError);
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error procesando confirmación de pago',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Endpoint para disparar email de confirmación (para grupos ya creados y confirmados)
router.post('/groups/:groupId/trigger-confirmation-email', authenticateToken, async (req, res) => {
  const supabase = req.supabase;
  const { groupId } = req.params;
  
  try {
    // Obtener el grupo con los corredores
    const { data: group, error: groupError } = await supabase
      .from('registration_groups')
      .select('*, runners(*)')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado'
      });
    }

    // Verificar que el pago esté confirmado
    if (group.payment_status !== 'confirmado') {
      return res.status(400).json({
        success: false,
        message: 'Solo se puede enviar confirmación para grupos con pago confirmado'
      });
    }

    // Importar y enviar el email
    const { sendRunnerConfirmationEmail } = await import('../utils/emailService.js');
    
    // Preparar datos del pago
    const paymentData = {
      payment_method: group.payment_method,
      payment_reference: group.payment_reference,
      payment_confirmed_at: group.payment_confirmed_at,
      exchange_rate: group.exchange_rate || process.env.DEFAULT_EXCHANGE_RATE || '40',
      amount_usd: group.amount_usd || (group.runners.length * 25),
      amount_bs: group.amount_bs,
      transaction_id: group.transaction_id
    };
    
    const emailResult = await sendRunnerConfirmationEmail(
      group,
      group.runners,
      paymentData
    );
    
    if (emailResult.success) {
      // Registrar el envío
      await supabase
        .from('email_logs')
        .insert({
          type: 'runner_confirmation_triggered',
          recipient: group.registrant_email,
          group_id: groupId,
          status: 'sent',
          message_id: emailResult.messageId,
          sent_at: new Date().toISOString(),
          sent_by: req.user?.id || 'system'
        });
      
      res.json({
        success: true,
        message: 'Email de confirmación enviado exitosamente',
        emailsSent: emailResult.emailsSent,
        messageId: emailResult.messageId
      });
    } else {
      throw new Error('Error al enviar el email');
    }

  } catch (error) {
    console.error('Error enviando email de confirmación:', error);
    
    // Registrar el fallo
    await supabase
      .from('email_logs')
      .insert({
        type: 'runner_confirmation_triggered',
        group_id: groupId,
        status: 'failed',
        error: error.message,
        failed_at: new Date().toISOString()
      });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error enviando email de confirmación'
    });
  }
});

// ⭐ NUEVA FUNCIÓN: Endpoint para reenviar email de confirmación
router.post('/groups/:groupId/resend-confirmation-email', authenticateToken, requireAnyPermission(
  { resource: 'payments', action: 'manage' },
  { resource: 'runners', action: 'manage' }
), async (req, res) => {
  const supabase = req.supabase;
  const { groupId } = req.params;
  
  try {
    // Obtener el grupo con los corredores
    const { data: group, error: groupError } = await supabase
      .from('registration_groups')
      .select('*, runners(*)')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado'
      });
    }

    if (group.payment_status !== 'confirmado') {
      return res.status(400).json({
        success: false,
        message: 'Solo se puede reenviar confirmación para grupos con pago confirmado'
      });
    }

    // Importar y enviar el email
    const { sendRunnerConfirmationEmail } = await import('../utils/emailService.js');
    
    const paymentData = {
      payment_method: group.payment_method,
      payment_reference: group.payment_reference,
      payment_confirmed_at: group.payment_confirmed_at,
      exchange_rate: group.exchange_rate || process.env.DEFAULT_EXCHANGE_RATE || '40'
    };
    
    const emailResult = await sendRunnerConfirmationEmail(
      group,
      group.runners,
      paymentData
    );
    
    if (emailResult.success) {
      // Registrar el reenvío
      await supabase
        .from('email_logs')
        .insert({
          type: 'runner_confirmation_resend',
          recipient: group.registrant_email,
          group_id: groupId,
          status: 'sent',
          message_id: emailResult.messageId,
          sent_at: new Date().toISOString(),
          sent_by: req.user.userId
        });
      
      res.json({
        success: true,
        message: 'Email de confirmación reenviado exitosamente',
        emailsSent: emailResult.emailsSent
      });
    } else {
      throw new Error('Error al enviar el email');
    }

  } catch (error) {
    console.error('Error reenviando email:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error reenviando email de confirmación'
    });
  }
});

// Delete runner by ID
router.delete('/:id', authenticateToken, enrichUserData, async (req, res) => {
  const supabase = req.supabase;
  const { id } = req.params;
  const { force = false } = req.query; 

  try {
    // Obtener información del corredor y su grupo
    const { data: runner, error: fetchError } = await supabase
      .from('runners')
      .select(`
        *,
        group:registration_groups!group_id(
          id,
          group_code,
          registrant_email,
          payment_status,
          total_runners,
          payment_method
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !runner) {
      return res.status(404).json({ 
        success: false,
        message: 'Corredor no encontrado',
        error_code: 'RUNNER_NOT_FOUND'
      });
    }

    // Verificar permisos
    const hasDeletePermission = req.user.permissions.some(p => 
      ['runners:delete', 'runners:manage', 'system:manage_all'].includes(p)
    );

    const isGroupOwner = runner.group.registrant_email === req.user.email;
    const isRegisteredBy = runner.registered_by === req.user.id;

    // Solo admin/boss pueden eliminar
    if (!hasDeletePermission) {
      return res.status(403).json({ 
        success: false,
        message: 'No tienes permisos para eliminar corredores',
        error_code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Verificar si el pago está confirmado
    if (runner.group.payment_status === 'confirmado' && !force) {
      return res.status(400).json({ 
        success: false,
        message: 'No se puede eliminar un corredor con pago confirmado. Use force=true para forzar eliminación.',
        error_code: 'PAYMENT_CONFIRMED',
        hint: 'El pago de este grupo ya fue confirmado. Solo un administrador puede forzar la eliminación.'
      });
    }

    // Verificar si es el último corredor del grupo
    if (runner.group.total_runners === 1) {
      console.log(`⚠️ Eliminando último corredor del grupo ${runner.group.group_code}, se eliminará el grupo completo`);
      
      // Eliminar el grupo completo (esto eliminará el corredor en cascada)
      const { error: deleteGroupError } = await supabase
        .from('registration_groups')
        .delete()
        .eq('id', runner.group.id);
      
      if (deleteGroupError) {
        return res.status(500).json({ 
          success: false,
          message: 'Error al eliminar el grupo',
          error_code: 'DELETE_GROUP_FAILED',
          details: deleteGroupError.message
        });
      }

      // Registrar en auditoría
      await supabase
        .from('audit_logs')
        .insert({
          action: 'last_runner_and_group_deleted',
          entity_type: 'runner_and_group',
          entity_id: id,
          performed_by: req.user.id,
          details: {
            runner_name: runner.full_name,
            group_code: runner.group.group_code,
            message: 'Último corredor eliminado, grupo eliminado automáticamente'
          },
          created_at: new Date().toISOString()
        });

      return res.json({
        success: true,
        message: 'Último corredor eliminado, grupo eliminado automáticamente',
        deleted_runner: {
          id: runner.id,
          full_name: runner.full_name,
          identification: `${runner.identification_type}-${runner.identification}`,
          runner_number: runner.runner_number
        },
        deleted_group: {
          id: runner.group.id,
          group_code: runner.group.group_code
        },
        note: 'El grupo fue eliminado porque este era el último corredor'
      });
    } // <-- ESTA LLAVE FALTABA

    // Si el corredor tiene número asignado, liberarlo
    if (runner.runner_number) {
      console.log(`🔓 Liberando número de dorsal: ${runner.runner_number}`);
      
      // Marcar el número como disponible nuevamente (opcional, depende de tu lógica)
      await supabase
        .from('runner_numbers')
        .update({ 
          is_used: false,
          runner_id: null,
          released_at: new Date().toISOString(),
          released_by: req.user.id
        })
        .eq('number', runner.runner_number);
    }

    // Eliminar reservas de inventario asociadas
    const { error: inventoryError } = await supabase
      .from('inventory_reservations')
      .delete()
      .eq('runner_id', id);

    if (inventoryError) {
      console.error('Error eliminando reservas de inventario:', inventoryError);
      // No fallar, pero registrar
    }

    // Eliminar el corredor
    const { error: deleteError } = await supabase
      .from('runners')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error eliminando corredor:', deleteError);
      return res.status(500).json({ 
        success: false,
        message: 'Error al eliminar el corredor',
        error_code: 'DELETE_FAILED',
        details: deleteError.message
      });
    }

    // Actualizar el total de corredores en el grupo
    const { error: updateGroupError } = await supabase
      .from('registration_groups')
      .update({ 
        total_runners: runner.group.total_runners - 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', runner.group.id);

    if (updateGroupError) {
      console.error('Error actualizando grupo:', updateGroupError);
      // No fallar la eliminación por esto
    }

    // Registrar la eliminación en un log de auditoría (opcional)
    await supabase
      .from('audit_logs')
      .insert({
        action: 'runner_deleted',
        entity_type: 'runner',
        entity_id: id,
        performed_by: req.user.id,
        details: {
          runner_name: runner.full_name,
          runner_identification: `${runner.identification_type}-${runner.identification}`,
          group_code: runner.group.group_code,
          runner_number: runner.runner_number,
          forced: force === 'true',
          payment_status: runner.group.payment_status
        },
        created_at: new Date().toISOString()
      });

    console.log(`✅ Corredor ${runner.full_name} (${id}) eliminado exitosamente del grupo ${runner.group.group_code}`);

    res.json({
      success: true,
      message: 'Corredor eliminado exitosamente',
      deleted_runner: {
        id: runner.id,
        full_name: runner.full_name,
        identification: `${runner.identification_type}-${runner.identification}`,
        runner_number: runner.runner_number,
        group_code: runner.group.group_code
      },
      group_updated: {
        id: runner.group.id,
        group_code: runner.group.group_code,
        new_total_runners: runner.group.total_runners - 1
      }
    });

  } catch (error) {
    console.error('Error en eliminación de corredor:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      error_code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Delete entire group with all runners
router.delete('/groups/:groupId', authenticateToken, requireAnyPermission(
  { resource: 'runners', action: 'delete' },
  { resource: 'runners', action: 'manage' }
), async (req, res) => {
  const supabase = req.supabase;
  const { groupId } = req.params;
  const { force = false } = req.query;

  try {
    // Obtener información del grupo
    const { data: group, error: groupError } = await supabase
      .from('registration_groups')
      .select('*, runners(*)')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado',
        error_code: 'GROUP_NOT_FOUND'
      });
    }

    // Verificar estado del pago
    if (group.payment_status === 'confirmado' && !force) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar un grupo con pago confirmado',
        error_code: 'PAYMENT_CONFIRMED',
        hint: 'Use force=true para forzar la eliminación'
      });
    }

    // Liberar números de dorsal
    const runnersWithNumbers = group.runners.filter(r => r.runner_number);
    if (runnersWithNumbers.length > 0) {
      const numbers = runnersWithNumbers.map(r => r.runner_number);
      
      await supabase
        .from('runner_numbers')
        .update({ 
          is_used: false,
          runner_id: null,
          released_at: new Date().toISOString(),
          released_by: req.user.id
        })
        .in('number', numbers);
      
      console.log(`🔓 Liberados ${numbers.length} números de dorsal del grupo ${group.group_code}`);
    }

    // NUEVO: Eliminar payment_events relacionados
    const { error: paymentEventsError } = await supabase
      .from('payment_events')
      .delete()
      .eq('group_id', groupId);

    if (paymentEventsError) {
      console.error('Error eliminando eventos de pago:', paymentEventsError);
      // Continuar aunque falle
    }

    // NUEVO: Eliminar email_logs relacionados (si existe la tabla)
    await supabase
      .from('email_logs')
      .delete()
      .eq('group_id', groupId);

    // Eliminar reservas de inventario
    await supabase
      .from('inventory_reservations')
      .delete()
      .eq('group_id', groupId);

    // Eliminar todos los corredores del grupo
    const { error: deleteRunnersError } = await supabase
      .from('runners')
      .delete()
      .eq('group_id', groupId);

    if (deleteRunnersError) {
      console.error('Error eliminando corredores:', deleteRunnersError);
      // No retornar error, continuar con la eliminación
    }

    // Eliminar el grupo
    const { error: deleteGroupError } = await supabase
      .from('registration_groups')
      .delete()
      .eq('id', groupId);

    if (deleteGroupError) {
      console.error('Error eliminando grupo:', deleteGroupError);
      
      // Si aún falla, dar más información sobre el error
      if (deleteGroupError.code === '23503') {
        return res.status(500).json({
          success: false,
          message: 'No se puede eliminar el grupo porque tiene registros relacionados en otras tablas',
          error_code: 'FOREIGN_KEY_CONSTRAINT',
          details: deleteGroupError.details,
          hint: 'Contacte al administrador del sistema para resolver las dependencias'
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error eliminando el grupo',
        error_code: 'DELETE_GROUP_FAILED',
        details: deleteGroupError.message
      });
    }

    // Registrar en auditoría
    await supabase
      .from('audit_logs')
      .insert({
        action: 'group_deleted',
        entity_type: 'registration_group',
        entity_id: groupId,
        performed_by: req.user.id,
        details: {
          group_code: group.group_code,
          runners_deleted: group.runners.length,
          payment_status: group.payment_status,
          payment_method: group.payment_method,
          forced: force === 'true',
          numbers_released: runnersWithNumbers.length
        },
        created_at: new Date().toISOString()
      });

    console.log(`✅ Grupo ${group.group_code} y sus ${group.runners.length} corredores eliminados exitosamente`);

    res.json({
      success: true,
      message: 'Grupo eliminado exitosamente',
      deleted_group: {
        id: group.id,
        group_code: group.group_code,
        runners_deleted: group.runners.length,
        payment_status: group.payment_status
      },
      numbers_released: runnersWithNumbers.length
    });

  } catch (error) {
    console.error('Error eliminando grupo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error_code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

export default router;