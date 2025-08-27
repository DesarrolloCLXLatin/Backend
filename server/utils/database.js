// server/utils/database.js
import bcrypt from 'bcryptjs';

export const initDatabase = async (supabase) => {
  try {
    console.log('🔄 Inicializando base de datos...');
    
    // Create default admin user if not exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@maraton10k.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';

    const { data: existingAdmin, error: adminCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('email', adminEmail.toLowerCase())
      .single();

    if (!existingAdmin && adminCheckError?.code === 'PGRST116') {
      // User doesn't exist, create it
      const hashedPassword = await bcrypt.hash(adminPassword, 12);

      const { data, error } = await supabase
        .from('users')
        .insert([{
          email: adminEmail.toLowerCase(),
          password_hash: hashedPassword,
          role: 'admin'
        }])
        .select();

      if (error) {
        console.error('❌ Error creando usuario admin:', error);
      } else {
        console.log(`✅ Usuario admin creado: ${adminEmail}`);
        console.log(`⚠️  Contraseña por defecto: ${adminPassword}`);
        console.log('🔐 Por favor cambia la contraseña después del primer inicio de sesión');
      }
    } else if (existingAdmin) {
      console.log('✅ Usuario admin ya existe');
    }

    // Initialize inventory with gender if empty
    const { count: inventoryCount } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true });

    if (inventoryCount === 0) {
      const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
      const genders = ['M', 'F'];
      const defaultInventory = [];

      // Stock distribution by size
      const stockBySizeM = {
        'XS': 25,
        'S': 50,
        'M': 75,
        'L': 75,
        'XL': 50,
        'XXL': 25
      };

      const stockBySizeF = {
        'XS': 25,
        'S': 50,
        'M': 75,
        'L': 75,
        'XL': 50,
        'XXL': 25
      };

      // Create inventory for each size and gender combination
      for (const gender of genders) {
        const stockMap = gender === 'M' ? stockBySizeM : stockBySizeF;
        for (const size of sizes) {
          defaultInventory.push({
            shirt_size: size,
            gender: gender,
            stock: stockMap[size],
            reserved: 0
          });
        }
      }

      const { error: inventoryError } = await supabase
        .from('inventory')
        .insert(defaultInventory);

      if (inventoryError) {
        console.error('❌ Error inicializando inventario:', inventoryError);
      } else {
        console.log('✅ Inventario por género inicializado');
        console.log(`   Total franelas masculinas: ${Object.values(stockBySizeM).reduce((a, b) => a + b, 0)}`);
        console.log(`   Total franelas femeninas: ${Object.values(stockBySizeF).reduce((a, b) => a + b, 0)}`);
      }
    } else {
      console.log('✅ Inventario ya inicializado');
    }

    // Initialize runner numbers sequence if empty
    const { count: runnerNumbersCount } = await supabase
      .from('runner_numbers')
      .select('*', { count: 'exact', head: true });

    if (runnerNumbersCount === 0) {
      const { error: insertError } = await supabase
        .from('runner_numbers')
        .insert([{ 
          current_number: 10,  // Starts at 10, first number will be 11 (0011)
          max_number: 2000
        }]);

      if (insertError) {
        console.error('❌ Error inicializando secuencia de números:', insertError);
      } else {
        console.log('✅ Secuencia de números de corredor inicializada (0011-2000)');
      }
    } else {
      console.log('✅ Números de corredor ya inicializados');
    }

    // Initialize banks if empty (already in the schema but checking)
    const { count: banksCount } = await supabase
      .from('banks')
      .select('*', { count: 'exact', head: true });

    if (banksCount > 0) {
      console.log('✅ Bancos ya inicializados');
    }

    // Initialize gateway configuration if empty (already in the schema but checking)
    const { count: configCount } = await supabase
      .from('gateway_config')
      .select('*', { count: 'exact', head: true });

    if (configCount === 0) {
      const additionalConfig = [
        { 
          config_key: 'soap_url', 
          config_value: process.env.PAYMENT_SOAP_URL || 'https://paytest.megasoft.com.ve/soap/v2/transacciones',
          description: 'URL SOAP del gateway'
        },
        { 
          config_key: 'auto_approve_p2c', 
          config_value: 'true',
          description: 'Aprobar automáticamente pagos P2C exitosos'
        },
        { 
          config_key: 'fallback_exchange_rate', 
          config_value: '36.5',
          description: 'Tasa de cambio de respaldo si no hay tasa actual'
        }
      ];

      const { error: configError } = await supabase
        .from('gateway_config')
        .insert(additionalConfig);

      if (configError && configError.code !== '23505') { // Ignore duplicate key errors
        console.error('❌ Error agregando configuración adicional:', configError);
      }
    } else {
      console.log('✅ Configuración del gateway ya inicializada');
    }

    // Check if we need an initial exchange rate
    const { count: rateCount } = await supabase
      .from('exchange_rates')
      .select('*', { count: 'exact', head: true });

    if (rateCount === 0) {
      console.log('⚠️  No hay tasas de cambio. Agregando tasa inicial...');
      
      const { error: rateError } = await supabase
        .from('exchange_rates')
        .insert([{
          rate: 36.5, // Default rate
          source: 'MANUAL',
          date: new Date().toISOString().split('T')[0]
        }]);

      if (rateError) {
        console.error('❌ Error insertando tasa de cambio inicial:', rateError);
      } else {
        console.log('✅ Tasa de cambio inicial agregada (36.5 Bs/USD)');
        console.log('⚠️  Actualiza la tasa de cambio real lo antes posible');
      }
    }

    console.log('✅ Inicialización de base de datos completada exitosamente');

  } catch (error) {
    console.error('❌ Error de inicialización de base de datos:', error);
    throw error;
  }
};

// Función auxiliar para verificar la conexión con Supabase
export const checkSupabaseConnection = async (supabase) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Error de conexión con Supabase:', error);
      return false;
    }
    
    console.log('✅ Conexión con Supabase exitosa');
    return true;
  } catch (error) {
    console.error('❌ Fallo al conectar con Supabase:', error);
    return false;
  }
};

// Función para verificar que todas las tablas necesarias existen
export const verifyDatabaseSchema = async (supabase) => {
  console.log('🔍 Verificando esquema de base de datos...');
  
  const requiredTables = [
    'users',
    'banks',
    'exchange_rates',
    'gateway_config',
    'inventory',
    'runner_numbers',
    'registration_groups',
    'runners',
    'inventory_reservations',
    'payment_transactions',
    'payment_errors',
    'webhook_logs'
  ];

  const requiredViews = [
    'inventory_status_by_gender',
    'runners_with_age',
    'runner_group_summary',
    'daily_statistics'
  ];

  const missingTables = [];
  const missingViews = [];

  // Check tables
  for (const table of requiredTables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error && error.code === '42P01') {
        missingTables.push(table);
      }
    } catch (err) {
      console.error(`Error verificando tabla ${table}:`, err);
    }
  }

  // Check views
  for (const view of requiredViews) {
    try {
      const { error } = await supabase
        .from(view)
        .select('*')
        .limit(1);
      
      if (error && error.code === '42P01') {
        missingViews.push(view);
      }
    } catch (err) {
      // Views might fail differently, so we check if it's accessible
      missingViews.push(view);
    }
  }

  if (missingTables.length > 0) {
    console.error('❌ Tablas faltantes:', missingTables);
    console.log('📝 Por favor ejecuta el script SQL de creación de tablas en Supabase');
    return false;
  }

  if (missingViews.length > 0) {
    console.warn('⚠️  Vistas faltantes:', missingViews);
    console.log('📝 Algunas vistas no están disponibles, pero el sistema puede funcionar');
  }

  console.log('✅ Todas las tablas requeridas existen');
  return true;
};

// Función para limpiar reservas expiradas (manual trigger)
export const cleanExpiredReservations = async (supabase) => {
  console.log('🧹 Limpiando reservas expiradas...');

  try {
    // Call the SQL function to release expired reservations
    const { data, error } = await supabase
      .rpc('release_expired_reservations');

    if (error) {
      console.error('❌ Error limpiando reservas:', error);
      return false;
    }

    // Get count of cleaned reservations
    const { data: releasedCount } = await supabase
      .from('inventory_reservations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'released')
      .gte('updated_at', new Date(Date.now() - 60000).toISOString()); // Last minute

    console.log(`✅ Reservas liberadas: ${releasedCount || 0}`);
    return true;

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    return false;
  }
};

// Función para obtener estadísticas del sistema
export const getSystemStats = async (supabase) => {
  try {
    const stats = {};

    // Total de usuarios por rol
    const { data: users } = await supabase
      .from('users')
      .select('role');
    
    stats.users = {
      total: users?.length || 0,
      admin: users?.filter(u => u.role === 'admin').length || 0,
      tienda: users?.filter(u => u.role === 'tienda').length || 0,
      usuario: users?.filter(u => u.role === 'usuario').length || 0
    };

    // Total de grupos y corredores
    const { count: groupCount } = await supabase
      .from('registration_groups')
      .select('*', { count: 'exact', head: true });
    stats.totalGroups = groupCount || 0;

    const { count: runnerCount } = await supabase
      .from('runners')
      .select('*', { count: 'exact', head: true });
    stats.totalRunners = runnerCount || 0;

    // Grupos por estado
    const { data: groupsByStatus } = await supabase
      .from('registration_groups')
      .select('payment_status');
    
    stats.groupsByStatus = {
      pendiente: groupsByStatus?.filter(g => g.payment_status === 'pendiente').length || 0,
      procesando: groupsByStatus?.filter(g => g.payment_status === 'procesando').length || 0,
      confirmado: groupsByStatus?.filter(g => g.payment_status === 'confirmado').length || 0,
      rechazado: groupsByStatus?.filter(g => g.payment_status === 'rechazado').length || 0
    };

    // Corredores confirmados
    const { count: confirmedRunners } = await supabase
      .from('runners')
      .select('*', { count: 'exact', head: true })
      .eq('payment_status', 'confirmado');
    stats.confirmedRunners = confirmedRunners || 0;

    // Inventario por género
    const { data: inventory } = await supabase
      .from('inventory_status_by_gender')
      .select('*');
    
    stats.inventory = {
      total: {
        stock: inventory?.reduce((sum, item) => sum + item.stock, 0) || 0,
        reserved: inventory?.reduce((sum, item) => sum + item.reserved, 0) || 0,
        available: inventory?.reduce((sum, item) => sum + item.available, 0) || 0
      },
      byGender: {
        M: {
          stock: inventory?.filter(i => i.gender === 'M').reduce((sum, item) => sum + item.stock, 0) || 0,
          available: inventory?.filter(i => i.gender === 'M').reduce((sum, item) => sum + item.available, 0) || 0
        },
        F: {
          stock: inventory?.filter(i => i.gender === 'F').reduce((sum, item) => sum + item.stock, 0) || 0,
          available: inventory?.filter(i => i.gender === 'F').reduce((sum, item) => sum + item.available, 0) || 0
        }
      }
    };

    // Números de corredor disponibles
    const { data: runnerNumbers } = await supabase
      .from('runner_numbers')
      .select('current_number, max_number')
      .single();
    
    stats.runnerNumbers = {
      used: runnerNumbers?.current_number || 0,
      available: runnerNumbers ? (runnerNumbers.max_number - runnerNumbers.current_number) : 0,
      max: runnerNumbers?.max_number || 2000
    };

    // Tasa de cambio actual
    const { data: currentRate } = await supabase
      .from('exchange_rates')
      .select('rate, date, source')
      .order('date', { ascending: false })
      .limit(1)
      .single();
    
    stats.exchangeRate = {
      rate: currentRate?.rate || 'No disponible',
      date: currentRate?.date || 'N/A',
      source: currentRate?.source || 'N/A'
    };

    // Precio de la carrera
    const { data: priceConfig } = await supabase
      .from('gateway_config')
      .select('config_value')
      .eq('config_key', 'race_price_usd')
      .single();
    
    stats.racePrice = parseFloat(priceConfig?.config_value || '55.00');

    // Ingresos
    stats.revenue = {
      potentialUSD: stats.totalRunners * stats.racePrice,
      confirmedUSD: stats.confirmedRunners * stats.racePrice,
      potentialBs: stats.totalRunners * stats.racePrice * (currentRate?.rate || 36.5),
      confirmedBs: stats.confirmedRunners * stats.racePrice * (currentRate?.rate || 36.5)
    };

    return stats;
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return null;
  }
};

// Función para mostrar información del sistema
export const displaySystemInfo = async (supabase) => {
  console.log('\n📊 INFORMACIÓN DEL SISTEMA - CARRERA 10K');
  console.log('=========================================');
  
  const stats = await getSystemStats(supabase);
  
  if (stats) {
    console.log('\n👥 USUARIOS:');
    console.log(`   Total: ${stats.users.total}`);
    console.log(`   Admin: ${stats.users.admin} | Tienda: ${stats.users.tienda} | Usuario: ${stats.users.usuario}`);
    
    console.log('\n🏃 REGISTROS:');
    console.log(`   Grupos totales: ${stats.totalGroups}`);
    console.log(`   Corredores totales: ${stats.totalRunners}`);
    console.log(`   Corredores confirmados: ${stats.confirmedRunners}`);
    
    console.log('\n📋 GRUPOS POR ESTADO:');
    console.log(`   Pendientes: ${stats.groupsByStatus.pendiente}`);
    console.log(`   Procesando: ${stats.groupsByStatus.procesando}`);
    console.log(`   Confirmados: ${stats.groupsByStatus.confirmado}`);
    console.log(`   Rechazados: ${stats.groupsByStatus.rechazado}`);
    
    console.log('\n👕 INVENTARIO:');
    console.log(`   Stock total: ${stats.inventory.total.stock}`);
    console.log(`   Reservado: ${stats.inventory.total.reserved}`);
    console.log(`   Disponible: ${stats.inventory.total.available}`);
    console.log(`   Masculino disponible: ${stats.inventory.byGender.M.available}`);
    console.log(`   Femenino disponible: ${stats.inventory.byGender.F.available}`);
    
    console.log('\n🔢 NÚMEROS DE CORREDOR:');
    console.log(`   Usados: ${stats.runnerNumbers.used}`);
    console.log(`   Disponibles: ${stats.runnerNumbers.available}`);
    console.log(`   Rango: 0011-${stats.runnerNumbers.max}`);
    
    console.log('\n💰 FINANZAS:');
    console.log(`   Precio por corredor: $${stats.racePrice} USD`);
    console.log(`   Tasa de cambio: ${stats.exchangeRate.rate} Bs/USD (${stats.exchangeRate.source} - ${stats.exchangeRate.date})`);
    console.log(`   Ingresos potenciales: $${stats.revenue.potentialUSD.toFixed(2)} USD / ${stats.revenue.potentialBs.toFixed(2)} Bs`);
    console.log(`   Ingresos confirmados: $${stats.revenue.confirmedUSD.toFixed(2)} USD / ${stats.revenue.confirmedBs.toFixed(2)} Bs`);
  }
  
  console.log('\n=========================================\n');
};

// Función para monitorear el sistema (útil para cron jobs)
export const monitorSystem = async (supabase) => {
  console.log(`\n🔍 Monitor del sistema - ${new Date().toLocaleString()}`);
  
  // Check expired reservations
  const { data: expiredReservations } = await supabase
    .from('inventory_reservations')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .lt('reserved_until', new Date().toISOString());

  if (expiredReservations > 0) {
    console.log(`⚠️  Hay ${expiredReservations} reservas expiradas`);
    await cleanExpiredReservations(supabase);
  }

  // Check low inventory
  const { data: lowStock } = await supabase
    .from('inventory_status_by_gender')
    .select('shirt_size, gender, available')
    .lt('available', 10);

  if (lowStock && lowStock.length > 0) {
    console.log('⚠️  Inventario bajo:');
    lowStock.forEach(item => {
      console.log(`   Talla ${item.shirt_size} (${item.gender}): ${item.available} disponibles`);
    });
  }

  // Check pending transactions older than 24 hours
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const { data: oldPendingTransactions } = await supabase
    .from('payment_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('created_at', yesterday.toISOString());

  if (oldPendingTransactions > 0) {
    console.log(`⚠️  Hay ${oldPendingTransactions} transacciones pendientes de más de 24 horas`);
  }

  console.log('✅ Monitoreo completado\n');
};