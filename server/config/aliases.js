// server/config/aliases.js
// Aliases para facilitar la migración progresiva sin romper imports existentes

// ===== SERVICIOS REORGANIZADOS =====

// Servicios de pago (reorganizados por dominio)
export { default as MegasoftService } from '../services/payment/MegasoftService.js';
export { default as PaymentGatewayService } from '../services/payment/PaymentGatewayService.js';
export { default as PaymentProcessorService } from '../services/payment/PaymentProcessorService.js';

// Servicios externos
export { default as ExchangeRateService } from '../services/external/ExchangeRateService.js';

// ===== CONTROLADORES NUEVOS =====
// (Se irán agregando progresivamente)

// Controladores base
export { BaseController } from '../controllers/BaseController.js';

// Controladores específicos (agregar cuando estén listos)
export { AuthController } from '../controllers/AuthController.js';
export { TicketsController } from '../controllers/TicketsController.js';
export { PaymentsController } from '../controllers/PaymentsController.js';
export { RunnersController } from '../controllers/RunnersController.js';
export { DashboardController } from '../controllers/DashboardController.js';
export { InventoryController } from '../controllers/InventoryController.js';
export { BoxesController } from '../controllers/BoxesController.js';
export { UploadController } from '../controllers/UploadController.js';

// ===== MODELOS NUEVOS =====
// (Se irán agregando progresivamente)

// Modelo base
export { BaseModel } from '../models/BaseModel.js';

// Modelos específicos (agregar cuando estén listos)
export { UserModel } from '../models/User.js';
export { TicketModel } from '../models/Ticket.js';
export { PaymentModel } from '../models/Payment.js';
export { RunnerModel } from '../models/Runner.js';
export { InventoryModel } from '../models/Inventory.js';
export { BoxModel } from '../models/Box.js';
export { ExchangeRateModel } from '../models/ExchangeRate.js';
export { IframeTokenModel } from '../models/IframeToken.js';

// ===== SERVICIOS ESPECIALIZADOS =====
// (Para cuando se refactoricen utils/)

export { EmailService } from '../services/email/EmailService.js';
export { TemplateService } from '../services/email/TemplateService.js';
export { TicketService } from '../services/ticket/TicketService.js';
export { QRCodeService } from '../services/ticket/QRCodeService.js';
export { AuthService } from '../services/auth/AuthService.js';
export { PermissionService } from '../services/auth/PermissionService.js';

// ===== HELPERS DE MIGRACIÓN =====

/**
 * Helper para importar servicios con fallback a ubicación original
 * Uso: const service = await importWithFallback('MegasoftService', 'services/megasoftService.js');
 */
export async function importWithFallback(serviceName, originalPath) {
  try {
    // Intentar importar desde la nueva ubicación
    const newService = await import(`../services/payment/${serviceName}.js`);
    return newService.default || newService;
  } catch (error) {
    console.warn(`Fallback: Importando ${serviceName} desde ubicación original`);
    // Fallback a ubicación original
    const originalService = await import(`../${originalPath}`);
    return originalService.default || originalService;
  }
}

/**
 * Helper para importar controladores con fallback a lógica en routes
 */
export async function importController(controllerName) {
  try {
    const controller = await import(`../controllers/${controllerName}.js`);
    return controller.default || controller[controllerName];
  } catch (error) {
    console.warn(`Controller ${controllerName} no disponible, usando lógica original`);
    return null;
  }
}

/**
 * Helper para importar modelos con fallback a queries directas
 */
export async function importModel(modelName, supabase) {
  try {
    const ModelClass = await import(`../models/${modelName}.js`);
    const Model = ModelClass.default || ModelClass[`${modelName}Model`];
    return new Model(supabase);
  } catch (error) {
    console.warn(`Model ${modelName} no disponible, usando queries directas`);
    return null;
  }
}

// ===== CONFIGURACIÓN DE MIGRACIÓN =====

export const MIGRATION_CONFIG = {
  // Fases completadas
  phases: {
    phase1: false, // Estructura base
    phase2: false, // Modelos
    phase3: false, // AuthController
    phase4: false, // TicketsController
    phase5: false, // PaymentsController
    phase6: false, // RunnersController
    phase7: false, // Services reorganizados
    phase8: false  // Optimización final
  },
  
  // Configuración de fallbacks
  enableFallbacks: true,
  
  // Logging de migración
  logMigration: process.env.NODE_ENV === 'development'
};

/**
 * Verificar si una fase está completada
 */
export function isPhaseComplete(phaseNumber) {
  return MIGRATION_CONFIG.phases[`phase${phaseNumber}`];
}

/**
 * Marcar fase como completada
 */
export function markPhaseComplete(phaseNumber) {
  MIGRATION_CONFIG.phases[`phase${phaseNumber}`] = true;
  console.log(`✅ Fase ${phaseNumber} marcada como completada`);
}

/**
 * Obtener estado de migración
 */
export function getMigrationStatus() {
  const completed = Object.values(MIGRATION_CONFIG.phases).filter(Boolean).length;
  const total = Object.keys(MIGRATION_CONFIG.phases).length;
  
  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
    phases: MIGRATION_CONFIG.phases
  };
}