// server/utils/cleanupOldFiles.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const cleanupOldPaymentProofs = async (supabase) => {
  try {
    const uploadDir = path.join(__dirname, '../../uploads/payment-proofs');
    
    // Obtener grupos rechazados o confirmados hace más de 30 días
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: oldGroups } = await supabase
      .from('registration_groups')
      .select('payment_proof_url')
      .in('payment_status', ['confirmado', 'rechazado'])
      .lt('updated_at', thirtyDaysAgo.toISOString())
      .not('payment_proof_url', 'is', null);
    
    if (!oldGroups || oldGroups.length === 0) {
      console.log('No hay archivos antiguos para limpiar');
      return;
    }
    
    let deletedCount = 0;
    
    for (const group of oldGroups) {
      if (group.payment_proof_url) {
        // Extraer nombre del archivo de la URL
        const filename = path.basename(group.payment_proof_url);
        const filePath = path.join(uploadDir, filename);
        
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`Archivo eliminado: ${filename}`);
          }
        } catch (error) {
          console.error(`Error al eliminar archivo ${filename}:`, error);
        }
      }
    }
    
    console.log(`Limpieza completada. ${deletedCount} archivos eliminados.`);
    
  } catch (error) {
    console.error('Error en limpieza de archivos:', error);
  }
};

// Función para programar limpieza automática (opcional)
export const scheduleCleanup = (supabase) => {
  // Ejecutar limpieza cada 24 horas
  setInterval(() => {
    cleanupOldPaymentProofs(supabase);
  }, 24 * 60 * 60 * 1000);
  
  // Ejecutar limpieza inicial
  cleanupOldPaymentProofs(supabase);
};