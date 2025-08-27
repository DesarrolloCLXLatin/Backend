// server/app.js
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import multer from 'multer';
import fs from 'fs';

// Importar middlewares personalizados
import { supabaseMiddleware } from './middleware/supabase.js';
import supabase from './middleware/supabase.js';
import { dynamicCorsMiddleware, updateAllowedOrigins as updateOrigins } from './middleware/cors.js';

// Importar rutas
import authRoutes from './routes/auth.js';
import runnerRoutes from './routes/runners.js';
import paymentRoutes from './routes/payments.js';
import inventoryRoutes from './routes/inventory.js';
import dashboardRoutes from './routes/dashboard.js';
import paymentGatewayRoutes from './routes/paymentGateway.js';
import exchangeRateRoutes from './routes/exchangeRate.js';
import uploadRoutes from './routes/upload.js';
import ticketRoutes from './routes/tickets.js';
import ticketPaymentRoutes from './routes/ticketPaymentMovil.js';
import manualPaymentRoutes from './routes/manualPayment.js';
import rbacRoutes from './routes/rbac.js';
import paymentMethodsRoutes from './routes/paymentMethods.js';
import corsSettingsRoutes from './routes/corsSettings.js';
import boxesRoutes from './routes/boxesRoutes.js';

import { checkSupabaseConnection, cleanExpiredReservations } from './utils/database.js';

// Configuración de ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Crear aplicación Express
const app = express();

// Aplicar el middleware CORS dinámico PRIMERO
app.use(dynamicCorsMiddleware);

// Middleware para rutas específicas de iframe
app.use('/api/tickets/payment/pago-movil/iframe', dynamicCorsMiddleware);
app.use('/api/tickets/payment/pago-movil/public', dynamicCorsMiddleware);

// Middleware general
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// IMPORTANTE: Agregar el middleware de Supabase DESPUÉS de los middlewares generales pero ANTES de las rutas
app.use(supabaseMiddleware);

// Crear directorio de uploads si no existe
const uploadsDir = join(__dirname, '../uploads');
const paymentProofsDir = join(uploadsDir, 'payment-proofs');

[uploadsDir, paymentProofsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Directorio creado: ${dir}`);
  }
});

// Configurar carpeta de uploads
app.use('/uploads', express.static(uploadsDir, {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
    
    if (filePath.match(/\.(jpg|jpeg|png)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// Configurar multer para subida de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = file.originalname.split('.').pop();
    cb(null, `${uniqueSuffix}.${extension}`);
  }
});

export const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// Función para configurar el supabase en el app (simplificada)
export function configureSupabase(app, supabaseInstance = null) {
  // Si se pasa una instancia específica, usarla
  // Si no, usar la del middleware
  const instance = supabaseInstance || supabase;
  
  // Actualizar la instancia global para funciones que la necesiten
  global.supabase = instance;
  
  console.log('✅ Supabase configurado en la aplicación');
}

// Middleware de logging (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Rutas base
app.get('/', (req, res) => {
  res.json({ 
    message: 'API de Registro de Corredores - Maratón 10K', 
    version: '2.1.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      runners: '/api/runners',
      payments: '/api/payments',
      inventory: '/api/inventory',
      dashboard: '/api/dashboard',
      paymentGateway: '/api/payment-gateway',
      exchangeRates: '/api/exchange-rates',
      tickets: '/api/tickets',
      rbac: '/api/rbac',
      health: '/api/health',
      test: '/api/test'
    },
    documentation: '/api/docs'
  });
});

// Configurar rutas
app.use('/api/auth', authRoutes);
app.use('/api/runners', runnerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payment-gateway', paymentGatewayRoutes);
app.use('/api/exchange-rates', exchangeRateRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/tickets/payment/pago-movil', ticketPaymentRoutes);
app.use('/api/tickets/manual', manualPaymentRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/payment-methods', paymentMethodsRoutes);
app.use('/api/cors-settings', corsSettingsRoutes);
app.use('/api/boxes', boxesRoutes);

// Rutas específicas de iframe - asegurar que no se sobrescriban los headers
app.get('/iframe/ticket-purchase', (req, res, next) => {
  // Asegurar que no hay X-Frame-Options
  res.removeHeader('X-Frame-Options');
  res.removeHeader('x-frame-options');
  
  // Servir el archivo HTML de React
  next();
});

app.use((req, res, next) => {
  if (req.path.startsWith('/iframe/')) {
    res.removeHeader('X-Frame-Options');
    res.removeHeader('x-frame-options');
  }
  next();
});

// Ruta de salud del servidor
app.get('/api/health', async (req, res) => {
  try {
    const dbConnected = await checkSupabaseConnection(req.supabase);
    const uptime = process.uptime();
    
    // Get system stats
    const { data: stats } = await req.supabase
      .from('runners')
      .select('count', { count: 'exact', head: true });
    
    const { data: groupStats } = await req.supabase
      .from('registration_groups')
      .select('count', { count: 'exact', head: true });
    
    const { data: ticketStats } = await req.supabase
      .from('concert_tickets')
      .select('count', { count: 'exact', head: true });
    
    res.json({ 
      status: dbConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 60)} minutos`,
      database: dbConnected ? 'connected' : 'disconnected',
      version: '2.1.0',
      environment: process.env.NODE_ENV || 'development',
      stats: {
        totalRunners: stats || 0,
        totalGroups: groupStats || 0,
        totalTickets: ticketStats || 0
      },
      features: {
        iframeEnabled: !!process.env.IFRAME_ALLOWED_ORIGINS,
        captchaEnabled: !!(process.env.HCAPTCHA_SITE_KEY && process.env.HCAPTCHA_SECRET_KEY),
        rbacEnabled: true
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error.message 
    });
  }
});

// Ruta de prueba para verificar Supabase
app.get('/api/test', async (req, res) => {
  try {
    const tests = {};
    
    // Test 1: Conexión básica
    const { data: userCount, error: userError } = await req.supabase
      .from('users')
      .select('count', { count: 'exact', head: true });
    
    tests.users = !userError;
    
    // Test 2: Verificar grupos
    const { data: groupCount, error: groupError } = await req.supabase
      .from('registration_groups')
      .select('count', { count: 'exact', head: true });
    
    tests.groups = !groupError;
    
    // Test 3: Verificar inventario
    const { data: inventoryCount, error: inventoryError } = await req.supabase
      .from('inventory')
      .select('count', { count: 'exact', head: true });
    
    tests.inventory = !inventoryError;
    
    // Test 4: Verificar vistas
    const { error: viewError } = await req.supabase
      .from('inventory_status_by_gender')
      .select('*')
      .limit(1);
    
    tests.views = !viewError;
    
    // Test 5: Verificar tablas de tickets
    const { error: ticketError } = await req.supabase
      .from('concert_tickets')
      .select('count', { count: 'exact', head: true });
    
    tests.tickets = !ticketError;
    
    // Test 6: Verificar iframe tokens
    const { error: iframeError } = await req.supabase
      .from('iframe_tokens')
      .select('count', { count: 'exact', head: true });
    
    tests.iframeTokens = !iframeError;
    
    // Test 7: Verificar tablas RBAC
    const { error: rolesError } = await req.supabase
      .from('roles')
      .select('count', { count: 'exact', head: true });
    
    tests.roles = !rolesError;
    
    const { error: permissionsError } = await req.supabase
      .from('permissions')
      .select('count', { count: 'exact', head: true });
    
    tests.permissions = !permissionsError;
    
    const allPassed = Object.values(tests).every(t => t === true);
    
    res.status(allPassed ? 200 : 500).json({ 
      success: allPassed,
      message: allPassed ? 'Todas las pruebas pasaron' : 'Algunas pruebas fallaron',
      tests,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor',
      error: error.message 
    });
  }
});

// Endpoint para limpiar reservas expiradas (admin only)
app.post('/api/maintenance/clean-reservations', async (req, res) => {
  try {
    // Simple auth check - in production use proper auth middleware
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.includes('Bearer')) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    
    const success = await cleanExpiredReservations(req.supabase);
    
    res.json({
      success,
      message: success ? 'Reservas expiradas limpiadas' : 'Error al limpiar reservas',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});3

// Documentación básica de la API
// Continuación de server/app.js

// Documentación básica de la API
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'API de Registro de Corredores',
    version: '2.1.0',
    description: 'Sistema de registro para maratón 10K con soporte de grupos, pagos P2C y sistema RBAC',
    authentication: 'Bearer token JWT en header Authorization',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Registrar nuevo usuario',
        'POST /api/auth/login': 'Iniciar sesión (devuelve permisos y módulos)',
        'GET /api/auth/me': 'Obtener perfil completo con permisos (autenticado)',
        'GET /api/auth/profile': 'Obtener perfil (autenticado)',
        'PUT /api/auth/profile': 'Actualizar perfil (autenticado)',
        'GET /api/auth/verify': 'Verificar token',
        'PUT /api/auth/users/:userId/role': 'Cambiar rol de usuario (admin) - DEPRECADO',
        'GET /api/auth/users': 'Listar usuarios (admin)'
      },
      rbac: {
        'GET /api/rbac/roles': 'Listar todos los roles (requiere permisos)',
        'POST /api/rbac/roles': 'Crear nuevo rol (admin)',
        'PUT /api/rbac/roles/:roleId': 'Actualizar rol (admin)',
        'DELETE /api/rbac/roles/:roleId': 'Eliminar rol no sistémico (admin)',
        'POST /api/rbac/users/:userId/roles': 'Asignar rol a usuario (admin)',
        'DELETE /api/rbac/users/:userId/roles/:roleId': 'Remover rol de usuario (admin)',
        'GET /api/rbac/users/:userId/permissions': 'Obtener permisos de usuario',
        'GET /api/rbac/users/:userId/modules': 'Obtener módulos accesibles'
      },
      runners: {
        'GET /api/runners': 'Listar corredores',
        'POST /api/runners/register': 'Registrar nuevo corredor',
        'POST /api/runners/group': 'Registrar grupo de corredores',
        'GET /api/runners/:id': 'Obtener corredor por ID',
        'PUT /api/runners/:id': 'Actualizar corredor',
        'DELETE /api/runners/:id': 'Eliminar corredor'
      },
      payments: {
        'GET /api/payments': 'Listar pagos',
        'POST /api/payments': 'Crear pago',
        'GET /api/payments/:id': 'Obtener pago por ID',
        'PUT /api/payments/:id/confirm': 'Confirmar pago',
        'PUT /api/payments/:id/reject': 'Rechazar pago'
      },
      inventory: {
        'GET /api/inventory': 'Obtener inventario',
        'GET /api/inventory/status': 'Estado del inventario',
        'PUT /api/inventory/:size': 'Actualizar stock'
      },
      tickets: {
        'GET /api/tickets': 'Listar tickets',
        'POST /api/tickets/purchase': 'Comprar tickets',
        'GET /api/tickets/availability': 'Verificar disponibilidad'
      },
      paymentGateway: {
        'POST /api/payment-gateway/mobile-payment/p2c/init': 'Iniciar pago P2C',
        'GET /api/payment-gateway/payment-status/:control': 'Consultar estado de pago',
        'GET /api/payment-gateway/banks': 'Obtener lista de bancos',
        'GET /api/payment-gateway/exchange-rate': 'Obtener tasa de cambio'
      }
    },
    permissions: {
      resources: ['runners', 'payments', 'tickets', 'inventory', 'dashboard', 'system', 'users'],
      actions: ['create', 'read', 'update', 'delete', 'manage', 'confirm', 'reject', 'sell', 'register_group', 'view_own'],
      roles: {
        admin: 'Acceso total al sistema',
        boss: 'Gestión ejecutiva y reportes',
        administracion: 'Gestión de pagos y reportes financieros',
        tienda: 'Registro y venta directa',
        user: 'Solo acceso personal'
      }
    },
    notes: [
      'Sistema RBAC implementado - los permisos se verifican dinámicamente',
      'Los endpoints devuelven permisos y módulos en el login',
      'Compatibilidad mantenida con el campo "role" legacy',
      'Los permisos son granulares por recurso y acción',
      'El middleware enrichUserData agrega permisos completos cuando es necesario'
    ]
  });
});

// Servir archivos estáticos de React
app.use(express.static(join(__dirname, '../dist')));

// Ruta catch-all para React Router
app.get(/.*/, (req, res) => {
  // Solo servir el index.html para rutas que no sean API
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(__dirname, '../dist/index.html'));
  }
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  // Errores de Multer
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'El archivo es demasiado grande. Máximo 5MB'
      });
    }
  }
  
  // Errores de CORS
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'Origen no permitido'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      error: err 
    })
  });
});

// Ruta 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.path}`,
    availableEndpoints: '/api'
  });
});

// Exportar app y la función updateAllowedOrigins desde el middleware de CORS
export { app, updateOrigins as updateAllowedOrigins };