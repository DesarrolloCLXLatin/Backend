// scripts/migratePhase1.js
// Script para ejecutar la FASE 1 de migración automáticamente

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Colores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Directorios a crear
const directoriesToCreate = [
  'server/controllers',
  'server/models',
  'server/services/payment',
  'server/services/external',
  'server/services/email',
  'server/services/ticket',
  'server/services/auth'
];

function createDirectories() {
  log(`📁 Creando estructura de directorios...`, 'blue');
  
  directoriesToCreate.forEach(dir => {
    const fullPath = path.join(projectRoot, dir);
    
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      log(`  ✅ Creado: ${dir}`, 'green');
    } else {
      log(`  ℹ️  Ya existe: ${dir}`, 'yellow');
    }
  });
}

function createBaseFiles() {
  log(`\n📄 Creando archivos base...`, 'blue');
  
  // BaseController ya existe, verificar
  const baseControllerPath = path.join(projectRoot, 'server/controllers/BaseController.js');
  if (fs.existsSync(baseControllerPath)) {
    log(`  ✅ BaseController.js ya existe`, 'green');
  } else {
    log(`  ⚠️  BaseController.js no existe - debe crearse`, 'yellow');
  }
  
  // BaseModel ya existe, verificar
  const baseModelPath = path.join(projectRoot, 'server/models/BaseModel.js');
  if (fs.existsSync(baseModelPath)) {
    log(`  ✅ BaseModel.js ya existe`, 'green');
  } else {
    log(`  ⚠️  BaseModel.js no existe - debe crearse`, 'yellow');
  }
}

function moveExistingServices() {
  log(`\n🔄 Reorganizando servicios existentes...`, 'blue');
  
  const servicesToMove = [
    {
      from: 'server/services/megasoftService.js',
      to: 'server/services/payment/MegasoftService.js'
    },
    {
      from: 'server/services/exchangeRateService.js',
      to: 'server/services/external/ExchangeRateService.js'
    },
    {
      from: 'server/services/paymentServices.js',
      to: 'server/services/payment/PaymentGatewayService.js'
    },
    {
      from: 'server/services/paymentProcessorService.js',
      to: 'server/services/payment/PaymentProcessorService.js'
    }
  ];
  
  servicesToMove.forEach(service => {
    const fromPath = path.join(projectRoot, service.from);
    const toPath = path.join(projectRoot, service.to);
    
    if (fs.existsSync(fromPath)) {
      if (!fs.existsSync(toPath)) {
        // Crear directorio destino si no existe
        const toDir = path.dirname(toPath);
        if (!fs.existsSync(toDir)) {
          fs.mkdirSync(toDir, { recursive: true });
        }
        
        // Copiar archivo (no mover para mantener compatibilidad)
        fs.copyFileSync(fromPath, toPath);
        log(`  ✅ Copiado: ${service.from} → ${service.to}`, 'green');
      } else {
        log(`  ℹ️  Ya existe: ${service.to}`, 'yellow');
      }
    } else {
      log(`  ⚠️  No encontrado: ${service.from}`, 'yellow');
    }
  });
}

function createAliasFile() {
  log(`\n🔗 Creando archivo de aliases...`, 'blue');
  
  const aliasContent = `// server/config/aliases.js
// Aliases para facilitar la migración progresiva

// Servicios reorganizados
export { default as MegasoftService } from '../services/payment/MegasoftService.js';
export { default as ExchangeRateService } from '../services/external/ExchangeRateService.js';
export { default as PaymentGatewayService } from '../services/payment/PaymentGatewayService.js';
export { default as PaymentProcessorService } from '../services/payment/PaymentProcessorService.js';

// Controladores nuevos (cuando estén listos)
export { AuthController } from '../controllers/AuthController.js';
export { TicketsController } from '../controllers/TicketsController.js';
export { PaymentsController } from '../controllers/PaymentsController.js';
export { RunnersController } from '../controllers/RunnersController.js';
export { DashboardController } from '../controllers/DashboardController.js';
export { InventoryController } from '../controllers/InventoryController.js';
export { BoxesController } from '../controllers/BoxesController.js';
export { UploadController } from '../controllers/UploadController.js';

// Modelos nuevos (cuando estén listos)
export { UserModel } from '../models/User.js';
export { TicketModel } from '../models/Ticket.js';
export { PaymentModel } from '../models/Payment.js';
export { RunnerModel } from '../models/Runner.js';
export { InventoryModel } from '../models/Inventory.js';
export { BoxModel } from '../models/Box.js';
export { ExchangeRateModel } from '../models/ExchangeRate.js';
`;
  
  const aliasPath = path.join(projectRoot, 'server/config/aliases.js');
  
  if (!fs.existsSync(aliasPath)) {
    fs.writeFileSync(aliasPath, aliasContent);
    log(`  ✅ Archivo de aliases creado`, 'green');
  } else {
    log(`  ℹ️  Archivo de aliases ya existe`, 'yellow');
  }
}

function updatePackageJson() {
  log(`\n📦 Actualizando package.json...`, 'blue');
  
  const packagePath = path.join(projectRoot, 'package.json');
  
  try {
    const packageContent = fs.readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(packageContent);
    
    // Agregar scripts de validación si no existen
    const newScripts = {
      'validate:structure': 'node scripts/validateStructure.js',
      'test:endpoints': 'node scripts/testEndpoints.js',
      'check:imports': 'node scripts/checkImports.js',
      'migrate:phase1': 'node scripts/migratePhase1.js',
      'migrate:phase2': 'node scripts/migratePhase2.js',
      'migrate:rollback': 'node scripts/rollback.js'
    };
    
    let scriptsAdded = 0;
    Object.entries(newScripts).forEach(([key, value]) => {
      if (!packageJson.scripts[key]) {
        packageJson.scripts[key] = value;
        scriptsAdded++;
      }
    });
    
    if (scriptsAdded > 0) {
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
      log(`  ✅ ${scriptsAdded} scripts agregados a package.json`, 'green');
    } else {
      log(`  ℹ️  Scripts ya existen en package.json`, 'yellow');
    }
    
  } catch (error) {
    log(`  ⚠️  Error actualizando package.json: ${error.message}`, 'yellow');
  }
}

function generateMigrationReport() {
  log(`\n📊 REPORTE DE MIGRACIÓN FASE 1`, 'bold');
  log(`=====================================`, 'bold');
  
  // Verificar directorios creados
  const createdDirs = directoriesToCreate.filter(dir => {
    return fs.existsSync(path.join(projectRoot, dir));
  });
  
  log(`📁 Directorios creados: ${createdDirs.length}/${directoriesToCreate.length}`, 'blue');
  
  // Verificar archivos base
  const baseFiles = [
    'server/controllers/BaseController.js',
    'server/models/BaseModel.js',
    'server/config/aliases.js'
  ];
  
  const existingBaseFiles = baseFiles.filter(file => {
    return fs.existsSync(path.join(projectRoot, file));
  });
  
  log(`📄 Archivos base: ${existingBaseFiles.length}/${baseFiles.length}`, 'blue');
  
  // Estado general
  const isComplete = createdDirs.length === directoriesToCreate.length && 
                     existingBaseFiles.length >= 2; // Al menos BaseController y BaseModel
  
  if (isComplete) {
    log(`\n✅ FASE 1 COMPLETADA EXITOSAMENTE`, 'green');
    log(`🚀 Listo para continuar con FASE 2`, 'green');
  } else {
    log(`\n⚠️  FASE 1 INCOMPLETA`, 'yellow');
    log(`🔧 Revisa los elementos faltantes arriba`, 'yellow');
  }
  
  // Próximos pasos
  log(`\n📋 PRÓXIMOS PASOS:`, 'blue');
  log(`1. Ejecutar: npm run validate:structure`, 'blue');
  log(`2. Ejecutar: npm run test:endpoints`, 'blue');
  log(`3. Si todo está bien, continuar con FASE 2`, 'blue');
  log(`4. Crear modelos específicos (User, Ticket, etc.)`, 'blue');
  log(`5. Extraer primer controlador (AuthController)`, 'blue');
  
  return isComplete;
}

async function executePhase1() {
  try {
    log(`🚀 EJECUTANDO MIGRACIÓN FASE 1`, 'bold');
    log(`Proyecto: ${path.basename(projectRoot)}`, 'blue');
    log(`Fecha: ${new Date().toLocaleString()}`, 'blue');
    
    // Paso 1: Crear directorios
    createDirectories();
    
    // Paso 2: Verificar archivos base
    createBaseFiles();
    
    // Paso 3: Reorganizar servicios existentes
    moveExistingServices();
    
    // Paso 4: Crear archivo de aliases
    createAliasFile();
    
    // Paso 5: Actualizar package.json
    updatePackageJson();
    
    // Paso 6: Generar reporte
    const success = generateMigrationReport();
    
    return success;
    
  } catch (error) {
    log(`💥 Error ejecutando FASE 1: ${error.message}`, 'red');
    return false;
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  executePhase1()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`💥 Error fatal: ${error.message}`, 'red');
      process.exit(1);
    });
}

export { executePhase1 };