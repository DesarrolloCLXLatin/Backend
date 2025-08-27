// debugRoutes.js - Coloca este archivo en la raíz de tu proyecto
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Buscando el problema de path-to-regexp...\n');
console.log('📁 Directorio actual:', __dirname);

// Buscar archivos .js en el directorio del servidor
function findJsFiles(dir) {
  const files = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        files.push(...findJsFiles(fullPath));
      } else if (item.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error leyendo directorio ${dir}:`, error.message);
  }
  
  return files;
}

// Buscar archivos JS en el proyecto
const serverDir = path.join(__dirname, 'server');
const jsFiles = findJsFiles(serverDir);

console.log(`\n📄 Encontrados ${jsFiles.length} archivos JS\n`);

// Patrones problemáticos para buscar
const problemPatterns = [
  // Rutas con : sin parámetro
  /router\.(get|post|put|delete|patch|use)\s*\(\s*['"`]([^'"`]*:)\s*['"`]/g,
  /router\.(get|post|put|delete|patch|use)\s*\(\s*['"`]([^'"`]*:\s+[^'"`]*)/g,
  /router\.(get|post|put|delete|patch|use)\s*\(\s*['"`]([^'"`]*::+[^'"`]*)/g,
  /app\.(get|post|put|delete|patch|use)\s*\(\s*['"`]([^'"`]*:)\s*['"`]/g,
  /app\.(get|post|put|delete|patch|use)\s*\(\s*['"`]([^'"`]*:\s+[^'"`]*)/g,
  /app\.(get|post|put|delete|patch|use)\s*\(\s*['"`]([^'"`]*::+[^'"`]*)/g,
];

let problemFound = false;

jsFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const problems = [];
    
    lines.forEach((line, index) => {
      // Buscar cada patrón problemático
      problemPatterns.forEach(pattern => {
        pattern.lastIndex = 0; // Reset regex
        const match = pattern.exec(line);
        if (match) {
          const route = match[2];
          // Verificar si realmente es un problema
          if (route.endsWith(':') || route.includes('::') || route.includes(': ')) {
            problems.push({
              line: index + 1,
              content: line.trim(),
              route: route
            });
          }
        }
      });
      
      // Buscar también definiciones de rutas sin regex
      if (line.includes('router.') || line.includes('app.')) {
        // Buscar patrones específicos problemáticos
        if (line.match(/['"`][^'"`]*:\s*['"`]/) || 
            line.match(/['"`][^'"`]*:['"`]/) ||
            line.match(/['"`][^'"`]*::/) ||
            line.match(/:\s*,/) ||
            line.match(/:\s*\)/) ) {
          
          // Verificar si no es un caso válido como ':id'
          if (!line.match(/:[a-zA-Z_][a-zA-Z0-9_]*['"`,\s\)]/)) {
            problems.push({
              line: index + 1,
              content: line.trim(),
              route: 'Posible : sin parámetro'
            });
          }
        }
      }
    });
    
    if (problems.length > 0) {
      console.log(`\n❌ PROBLEMA ENCONTRADO en ${path.relative(__dirname, file)}`);
      problems.forEach(p => {
        console.log(`   Línea ${p.line}: ${p.route}`);
        console.log(`   Código: ${p.content}`);
      });
      problemFound = true;
    }
  } catch (error) {
    // Ignorar errores de lectura
  }
});

if (!problemFound) {
  console.log('\n✅ No se encontraron problemas obvios en las definiciones de rutas.\n');
  
  // Buscar el archivo específico que está causando el problema
  console.log('🔍 Buscando en archivos de configuración...\n');
  
  // Verificar package.json por si hay rutas en scripts
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log('📦 Scripts en package.json:');
    Object.entries(packageJson.scripts || {}).forEach(([name, script]) => {
      if (script.includes(':')) {
        console.log(`   ${name}: ${script}`);
      }
    });
  } catch (e) {
    console.log('   No se pudo leer package.json');
  }
}

console.log('\n💡 SOLUCIÓN RÁPIDA:');
console.log('1. El error ocurre al inicializar el servidor, justo después de "Inicializando cliente Supabase..."');
console.log('2. Comenta temporalmente TODAS las importaciones de rutas en server/index.js:');
console.log('\n   // import authRoutes from "./routes/auth.js";');
console.log('   // import runnerRoutes from "./routes/runners.js";');
console.log('   // etc...');
console.log('\n3. Y también comenta donde se usan:');
console.log('\n   // app.use("/api/auth", authRoutes);');
console.log('   // app.use("/api/runners", runnerRoutes);');
console.log('   // etc...');
console.log('\n4. Inicia el servidor. Si funciona, descomenta una por una hasta encontrar la problemática.');
console.log('\n5. También verifica si tienes algún middleware o configuración con rutas antes de las importaciones.');

// Buscar específicamente en index.js
const indexPath = path.join(__dirname, 'server', 'index.js');
if (fs.existsSync(indexPath)) {
  console.log('\n📄 Analizando server/index.js específicamente...\n');
  
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  const indexLines = indexContent.split('\n');
  
  indexLines.forEach((line, index) => {
    if (line.includes('app.use(') && line.includes(':')) {
      console.log(`   Línea ${index + 1}: ${line.trim()}`);
    }
  });
}