// scripts/testEndpoints.js
// Script para probar endpoints críticos después de la refactorización

import axios from 'axios';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:30500';

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

// Endpoints críticos a probar
const criticalEndpoints = [
  {
    name: 'Health Check',
    method: 'GET',
    url: '/api/health',
    expectedStatus: 200,
    critical: true
  },
  {
    name: 'Payment Methods',
    method: 'GET',
    url: '/api/tickets/payment-methods',
    expectedStatus: 200,
    critical: true
  },
  {
    name: 'Ticket Inventory',
    method: 'GET',
    url: '/api/tickets/inventory',
    expectedStatus: 200,
    critical: true
  },
  {
    name: 'Exchange Rate',
    method: 'GET',
    url: '/api/exchange-rates/current',
    expectedStatus: 200,
    critical: true
  },
  {
    name: 'Banks List',
    method: 'GET',
    url: '/api/payment-gateway/banks',
    expectedStatus: 200,
    critical: false
  },
  {
    name: 'Inventory Status',
    method: 'GET',
    url: '/api/inventory/public',
    expectedStatus: 200,
    critical: true
  }
];

// Endpoints que requieren autenticación
const authEndpoints = [
  {
    name: 'User Profile',
    method: 'GET',
    url: '/api/auth/me',
    expectedStatus: 200,
    requiresAuth: true
  },
  {
    name: 'Dashboard Stats',
    method: 'GET',
    url: '/api/dashboard/quick-stats',
    expectedStatus: 200,
    requiresAuth: true
  },
  {
    name: 'Tickets List',
    method: 'GET',
    url: '/api/tickets',
    expectedStatus: 200,
    requiresAuth: true
  }
];

async function testEndpoint(endpoint, authToken = null) {
  try {
    const config = {
      method: endpoint.method,
      url: `${BASE_URL}${endpoint.url}`,
      timeout: 10000,
      validateStatus: () => true // No lanzar error por status codes
    };

    if (authToken) {
      config.headers = {
        'Authorization': `Bearer ${authToken}`
      };
    }

    const response = await axios(config);
    
    const isSuccess = response.status === endpoint.expectedStatus;
    const statusColor = isSuccess ? 'green' : 'red';
    const icon = isSuccess ? '✅' : '❌';
    
    log(`  ${icon} ${endpoint.name}: ${response.status}`, statusColor);
    
    if (!isSuccess) {
      log(`    Expected: ${endpoint.expectedStatus}, Got: ${response.status}`, 'red');
      if (response.data && response.data.message) {
        log(`    Message: ${response.data.message}`, 'yellow');
      }
    }
    
    return {
      name: endpoint.name,
      success: isSuccess,
      status: response.status,
      expectedStatus: endpoint.expectedStatus,
      critical: endpoint.critical,
      responseTime: response.headers['x-response-time'] || 'N/A'
    };
    
  } catch (error) {
    log(`  ❌ ${endpoint.name}: ERROR - ${error.message}`, 'red');
    
    return {
      name: endpoint.name,
      success: false,
      error: error.message,
      critical: endpoint.critical
    };
  }
}

async function getAuthToken() {
  try {
    log(`🔐 Obteniendo token de autenticación...`, 'blue');
    
    const loginData = {
      email: process.env.TEST_USER_EMAIL || 'admin@test.com',
      password: process.env.TEST_USER_PASSWORD || 'admin123456'
    };
    
    const response = await axios.post(`${BASE_URL}/api/auth/login`, loginData);
    
    if (response.status === 200 && response.data.token) {
      log(`  ✅ Token obtenido exitosamente`, 'green');
      return response.data.token;
    } else {
      log(`  ⚠️  No se pudo obtener token - tests auth se omitirán`, 'yellow');
      return null;
    }
  } catch (error) {
    log(`  ⚠️  Error obteniendo token: ${error.message}`, 'yellow');
    return null;
  }
}

async function runTests() {
  log(`🧪 PROBADOR DE ENDPOINTS CRÍTICOS`, 'bold');
  log(`URL Base: ${BASE_URL}`, 'blue');
  log(`Fecha: ${new Date().toLocaleString()}`, 'blue');
  
  const results = [];
  
  // Probar endpoints públicos
  log(`\n📡 Probando endpoints públicos...`, 'blue');
  for (const endpoint of criticalEndpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
  }
  
  // Obtener token y probar endpoints autenticados
  const authToken = await getAuthToken();
  
  if (authToken) {
    log(`\n🔒 Probando endpoints autenticados...`, 'blue');
    for (const endpoint of authEndpoints) {
      const result = await testEndpoint(endpoint, authToken);
      results.push(result);
    }
  }
  
  // Generar reporte
  log(`\n📊 REPORTE DE RESULTADOS`, 'bold');
  log(`=====================================`, 'bold');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const criticalFailed = results.filter(r => !r.success && r.critical).length;
  
  log(`✅ Exitosos: ${successful}`, 'green');
  log(`❌ Fallidos: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`🚨 Críticos fallidos: ${criticalFailed}`, criticalFailed > 0 ? 'red' : 'green');
  
  // Mostrar detalles de fallos críticos
  if (criticalFailed > 0) {
    log(`\n🚨 FALLOS CRÍTICOS:`, 'red');
    results
      .filter(r => !r.success && r.critical)
      .forEach(result => {
        log(`  ❌ ${result.name}: ${result.error || `Status ${result.status}`}`, 'red');
      });
  }
  
  // Mostrar fallos no críticos
  const nonCriticalFailed = results.filter(r => !r.success && !r.critical);
  if (nonCriticalFailed.length > 0) {
    log(`\n⚠️  FALLOS NO CRÍTICOS:`, 'yellow');
    nonCriticalFailed.forEach(result => {
      log(`  ⚠️  ${result.name}: ${result.error || `Status ${result.status}`}`, 'yellow');
    });
  }
  
  // Resultado final
  log(`\n📋 RESULTADO FINAL:`, 'bold');
  if (criticalFailed === 0) {
    log(`✅ TODOS LOS ENDPOINTS CRÍTICOS FUNCIONAN`, 'green');
    log(`🚀 La refactorización no rompió funcionalidad crítica`, 'green');
  } else {
    log(`❌ HAY ENDPOINTS CRÍTICOS FALLANDO`, 'red');
    log(`🔧 Revisa la configuración antes de continuar`, 'red');
  }
  
  // Estadísticas de rendimiento
  const responseTimes = results
    .filter(r => r.responseTime && r.responseTime !== 'N/A')
    .map(r => parseFloat(r.responseTime));
  
  if (responseTimes.length > 0) {
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    log(`\n⚡ Tiempo promedio de respuesta: ${avgResponseTime.toFixed(2)}ms`, 'blue');
  }
  
  return criticalFailed === 0;
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`💥 Error ejecutando tests: ${error.message}`, 'red');
      process.exit(1);
    });
}

export { runTests };