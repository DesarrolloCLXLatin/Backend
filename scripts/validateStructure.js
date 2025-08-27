// scripts/validateStructure.js
// Script para validar la estructura del proyecto después de la refactorización

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Estructura esperada después de la refactorización
const expectedStructure = {
  'server/controllers': {
    required: true,
    files: [
      'BaseController.js',
      'AuthController.js',
      'TicketsController.js',
      'PaymentsController.js',
      'RunnersController.js',
      'DashboardController.js',
      'InventoryController.js',
      'BoxesController.js',
      'UploadController.js'
    ]
  },
  'server/models': {
    required: true,
    files: [
      'BaseModel.js',
      'User.js',
      'Ticket.js',
      'Payment.js',
      'Runner.js',
      'Inventory.js',
      'Box.js',
      'ExchangeRate.js'
    ]
  },
  'server/services/payment': {
    required: true,
    files: [
      'MegasoftService.js',
      'PaymentGatewayService.js',
      'PaymentProcessorService.js'
    ]
  },
  'server/services/external': {
    required: true,
    files: [
      'ExchangeRateService.js'
    ]
  },
  'server/services/email': {
    required: false,
    files: [
      'EmailService.js',
      'TemplateService.js'
    ]
  },
  'server/routes': {
    required: true,
    files: [
      'auth.js',
      'tickets.js',
      'payments.js',
      'runners.js',
      'dashboard.js',
      'inventory.js',
      'upload.js'
    ]
  }
};

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

function checkDirectory(dirPath, config) {
  const fullPath = path.join(projectRoot, dirPath);
  
  log(`\n📁 Verificando: ${dirPath}`, 'blue');
  
  if (!fs.existsSync(fullPath)) {
    if (config.required) {
      log(`  ❌ Directorio requerido no existe`, 'red');
      return false;
    } else {
      log(`  ⚠️  Directorio opcional no existe`, 'yellow');
      return true;
    }
  }
  
  log(`  ✅ Directorio existe`, 'green');
  
  // Verificar archivos
  let allFilesExist = true;
  
  config.files.forEach(filename => {
    const filePath = path.join(fullPath, filename);
    
    if (fs.existsSync(filePath)) {
      log(`    ✅ ${filename}`, 'green');
    } else {
      if (config.required) {
        log(`    ❌ ${filename} (requerido)`, 'red');
        allFilesExist = false;
      } else {
        log(`    ⚠️  ${filename} (opcional)`, 'yellow');
      }
    }
  });
  
  return allFilesExist;
}

function checkImports() {
  log(`\n🔍 Verificando imports...`, 'blue');
  
  const criticalFiles = [
    'server/app.js',
    'server/server.js',
    'server/routes/auth.js',
    'server/routes/tickets.js'
  ];
  
  let importsValid = true;
  
  criticalFiles.forEach(file => {
    const filePath = path.join(projectRoot, file);
    
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Verificar imports básicos
        const hasValidImports = content.includes('import') || content.includes('require');
        
        if (hasValidImports) {
          log(`  ✅ ${file}`, 'green');
        } else {
          log(`  ⚠️  ${file} - Sin imports detectados`, 'yellow');
        }
      } catch (error) {
        log(`  ❌ ${file} - Error leyendo archivo`, 'red');
        importsValid = false;
      }
    } else {
      log(`  ❌ ${file} - Archivo no existe`, 'red');
      importsValid = false;
    }
  });
  
  return importsValid;
}

function generateReport() {
  log(`\n📊 REPORTE DE VALIDACIÓN`, 'bold');
  log(`=====================================`, 'bold');
  
  let overallValid = true;
  
  // Verificar estructura
  Object.entries(expectedStructure).forEach(([dirPath, config]) => {
    const isValid = checkDirectory(dirPath, config);
    if (!isValid && config.required) {
      overallValid = false;
    }
  });
  
  // Verificar imports
  const importsValid = checkImports();
  if (!importsValid) {
    overallValid = false;
  }
  
  // Resultado final
  log(`\n📋 RESULTADO FINAL:`, 'bold');
  if (overallValid) {
    log(`✅ ESTRUCTURA VÁLIDA - Refactorización exitosa`, 'green');
    log(`🚀 El proyecto está listo para continuar con la siguiente fase`, 'green');
  } else {
    log(`❌ ESTRUCTURA INVÁLIDA - Requiere correcciones`, 'red');
    log(`🔧 Revisa los errores marcados arriba antes de continuar`, 'red');
  }
  
  // Estadísticas
  const totalDirs = Object.keys(expectedStructure).length;
  const requiredDirs = Object.values(expectedStructure).filter(c => c.required).length;
  
  log(`\n📈 ESTADÍSTICAS:`, 'blue');
  log(`   Directorios verificados: ${totalDirs}`);
  log(`   Directorios requeridos: ${requiredDirs}`);
  log(`   Archivos críticos verificados: 4`);
  
  return overallValid;
}

// Función principal
function validateStructure() {
  log(`🔍 VALIDADOR DE ESTRUCTURA MVC`, 'bold');
  log(`Proyecto: ${path.basename(projectRoot)}`, 'blue');
  log(`Fecha: ${new Date().toLocaleString()}`, 'blue');
  
  const isValid = generateReport();
  
  // Exit code para CI/CD
  process.exit(isValid ? 0 : 1);
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  validateStructure();
}

export { validateStructure, checkDirectory, checkImports };