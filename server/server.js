// server/server.js
import dotenv from 'dotenv';
import cron from 'node-cron';

// Cargar variables de entorno PRIMERO
dotenv.config();

// Importar el cliente de Supabase del middleware
import supabase from './middleware/supabase.js';

// Importar app y funciones necesarias
import { app, configureSupabase, updateAllowedOrigins } from './app.js';

// Importar utilidades de base de datos
import { 
  initDatabase, 
  checkSupabaseConnection, 
  verifyDatabaseSchema,
  displaySystemInfo,
  monitorSystem,
  cleanExpiredReservations
} from './utils/database.js';

// Importar cron de tasa de cambio
import { startExchangeRateCron } from './cron/exchangeRateCron.js';

// Verificar variables de entorno críticas
const requiredEnvVars = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key',
  // Variables del gateway de pagos
  PAYMENT_GATEWAY_URL: process.env.PAYMENT_GATEWAY_URL,
  PAYMENT_SOAP_URL: process.env.PAYMENT_SOAP_URL,
  PAYMENT_COD_AFILIACION: process.env.PAYMENT_COD_AFILIACION,
  PAYMENT_USERNAME: process.env.PAYMENT_USERNAME,
  PAYMENT_PASSWORD: process.env.PAYMENT_PASSWORD,
  RACE_PRICE_USD: process.env.RACE_PRICE_USD || '55.00',
  // Variables para iframe
  HCAPTCHA_SITE_KEY: process.env.HCAPTCHA_SITE_KEY,
  HCAPTCHA_SECRET_KEY: process.env.HCAPTCHA_SECRET_KEY,
  IFRAME_ALLOWED_ORIGINS: process.env.IFRAME_ALLOWED_ORIGINS || '*',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000'
};

// Verificar variables críticas
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value && ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].includes(key))
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('❌ Faltan variables de entorno críticas:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.log('\n📝 Ejemplo de archivo .env:');
  console.log('VITE_SUPABASE_URL=https://tu-proyecto.supabase.co');
  console.log('SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...');
  console.log('JWT_SECRET=tu-clave-secreta');
  console.log('PAYMENT_GATEWAY_URL=https://paytest.megasoft.com.ve/action');
  console.log('PAYMENT_SOAP_URL=https://paytest.megasoft.com.ve/soap/v2/transacciones');
  console.log('PAYMENT_COD_AFILIACION=20250325');
  console.log('PAYMENT_USERNAME=multimax');
  console.log('PAYMENT_PASSWORD=tu-password');
  console.log('RACE_PRICE_USD=55');
  console.log('HCAPTCHA_SITE_KEY=tu-site-key');
  console.log('HCAPTCHA_SECRET_KEY=tu-secret-key');
  console.log('IFRAME_ALLOWED_ORIGINS=https://sitio1.com,https://sitio2.com');
  console.log('FRONTEND_URL=http://localhost:5173');
  process.exit(1);
}

// Mostrar advertencias para variables opcionales
const optionalVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value && !['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'].includes(key))
  .map(([key]) => key);

if (optionalVars.length > 0) {
  console.log('⚠️  Variables de entorno opcionales no configuradas:');
  optionalVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
  if (!requiredEnvVars.HCAPTCHA_SITE_KEY || !requiredEnvVars.HCAPTCHA_SECRET_KEY) {
    console.log('   (hCaptcha no configurado - se deshabilitará para desarrollo)');
  }
  console.log('\n');
}

// Configurar Supabase en la app (ya no necesita pasar la instancia)
configureSupabase(app);

const PORT = process.env.PORT || 3001;

// Configurar limpieza periódica de reservas (cada 30 minutos)
let cleanupInterval;
if (process.env.NODE_ENV !== 'test') {
  cleanupInterval = setInterval(async () => {
    console.log('🔄 Ejecutando limpieza automática de reservas...');
    await cleanExpiredReservations(supabase);
  }, 30 * 60 * 1000); // 30 minutos
}

// Función para limpiar transacciones expiradas de tickets
async function cleanupExpiredTransactions() {
  try {
    await supabase.rpc('cancel_expired_ticket_transactions');
    console.log('[CRON] Transacciones de tickets expiradas limpiadas');
  } catch (error) {
    console.error('[CRON] Error limpiando transacciones:', error);
  }
}

// Configurar cron job para ejecutar cada 15 minutos
if (process.env.NODE_ENV === 'production') {
  cron.schedule('*/15 * * * *', cleanupExpiredTransactions);
  console.log('[CRON] Job configurado para limpiar transacciones expiradas');
}

// Iniciar servidor
const startServer = async () => {
  try {
    console.log('\n🚀 Iniciando servidor...\n');
    
    // Verificar conexión con Supabase
    console.log('1️⃣  Verificando conexión con Supabase...');
    const isConnected = await checkSupabaseConnection(supabase);
    
    if (!isConnected) {
      console.error('\n❌ No se pudo conectar a Supabase');
      console.log('\nPosibles causas:');
      console.log('1. Credenciales de Supabase inválidas');
      console.log('2. Tablas de base de datos no creadas');
      console.log('3. Políticas RLS bloqueando el acceso');
      console.log('\nEjecuta el script SQL en Supabase para crear las tablas');
      process.exit(1);
    }
    
    // Verificar esquema de base de datos
    console.log('2️⃣  Verificando esquema de base de datos...');
    const schemaValid = await verifyDatabaseSchema(supabase);
    
    if (!schemaValid) {
      console.error('\n❌ Esquema de base de datos incompleto');
      console.log('Por favor ejecuta el script SQL de creación de tablas');
      process.exit(1);
    }
    
    // Inicializar base de datos
    console.log('3️⃣  Inicializando datos por defecto...');
    await initDatabase(supabase);
    
    // Ejecutar monitoreo inicial
    console.log('4️⃣  Ejecutando monitoreo inicial del sistema...');
    await monitorSystem(supabase);
    
    // Mostrar información del sistema
    if (process.env.NODE_ENV !== 'production') {
      await displaySystemInfo(supabase);
    }
    
    // Iniciar cron de tasa de cambio si está configurado
    if (process.env.ENABLE_EXCHANGE_RATE_CRON === 'true') {
      console.log('5️⃣  Iniciando cron de tasa de cambio...');
      startExchangeRateCron(supabase);
    }
    
    // Inicializar cache de dominios permitidos
    await updateAllowedOrigins();
    
    // Iniciar servidor Express
    app.listen(PORT, () => {
      console.log('\n✅ Servidor iniciado exitosamente\n');
      console.log('========================================');
      console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
      console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 URL de API: http://localhost:${PORT}/api`);
      console.log(`📚 Documentación: http://localhost:${PORT}/api/docs`);
      console.log(`🏥 Estado: http://localhost:${PORT}/api/health`);
      console.log(`💱 Tasa actual: http://localhost:${PORT}/api/exchange-rates/current`);
      console.log(`🧪 Prueba: http://localhost:${PORT}/api/test`);
      console.log('========================================');
      console.log('\n🏃 Sistema de Registro de Carrera 10K');
      console.log('📝 Registro por grupos de 1-5 corredores');
      console.log('👕 Inventario diferenciado por género');
      console.log('⏰ Reservas válidas por 72 horas');
      console.log('🔢 Números de corredor: 0011-2000');
      console.log('🎫 Sistema de tickets para conciertos');
      console.log('🖼️  iFrames embebibles para ventas externas');
      console.log('🔐 Sistema RBAC con permisos granulares');
      console.log('========================================\n');
      
      if (process.env.HCAPTCHA_SITE_KEY && process.env.HCAPTCHA_SECRET_KEY) {
        console.log('✅ hCaptcha configurado correctamente');
      } else {
        console.log('⚠️  hCaptcha no configurado (se deshabilitará en desarrollo)');
      }
      
      if (process.env.IFRAME_ALLOWED_ORIGINS && process.env.IFRAME_ALLOWED_ORIGINS !== '*') {
        console.log(`✅ iFrames permitidos desde: ${process.env.IFRAME_ALLOWED_ORIGINS}`);
      } else {
        console.log('⚠️  iFrames permitidos desde cualquier origen');
      }
      
      console.log('✅ Sistema RBAC habilitado con 5 roles base');
      
      if (process.env.NODE_ENV === 'development') {
        console.log('\n💡 Consejo: Usa "npm run dev" para desarrollo con hot-reload\n');
      }
    });
    
  } catch (error) {
    console.error('\n❌ Error iniciando servidor:', error);
    process.exit(1);
  }
};

// Manejar señales de terminación
process.on('SIGTERM', () => {
  console.log('\n📤 SIGTERM recibido, cerrando servidor...');
  if (cleanupInterval) clearInterval(cleanupInterval);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n📤 SIGINT recibido, cerrando servidor...');
  if (cleanupInterval) clearInterval(cleanupInterval);
  process.exit(0);
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('\n❌ Excepción no capturada:', error);
  if (cleanupInterval) clearInterval(cleanupInterval);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('\n❌ Promesa rechazada no manejada:', error);
  if (cleanupInterval) clearInterval(cleanupInterval);
  process.exit(1);
});

// Iniciar el servidor
startServer();