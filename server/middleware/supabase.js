// server/middleware/supabase.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Verificar variables de entorno
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables de entorno de Supabase no configuradas');
  console.error('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  throw new Error('Configuración de Supabase incompleta');
}

// Crear cliente único de Supabase (singleton)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware para inyectar supabase en req
export const supabaseMiddleware = (req, res, next) => {
  req.supabase = supabase;
  req.supabaseAdmin = supabase; // Para compatibilidad con código existente
  next();
};

// Exportar la instancia de supabase para uso directo
export default supabase;