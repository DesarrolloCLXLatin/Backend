// utils/emailQueue.js
import Bull from 'bull';
import { sendRunnerConfirmationEmail } from './emailService.js';

const emailQueue = new Bull('email-notifications', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  }
});

// Procesador de la cola
emailQueue.process('confirmation-email', async (job) => {
  const { groupId, maxRetries = 3 } = job.data;
  
  try {
    // Obtener datos FRESCOS de la BD
    const { data: group, error: groupError } = await supabase
      .from('registration_groups')
      .select('*, runners(*)')
      .eq('id', groupId)
      .single();
    
    if (groupError || !group) {
      throw new Error(`Grupo ${groupId} no encontrado`);
    }
    
    // Verificar que el pago esté confirmado
    if (group.payment_status !== 'confirmado') {
      throw new Error(`Grupo ${groupId} no está confirmado`);
    }
    
    // Preparar datos de pago completos
    const paymentData = {
      payment_method: group.payment_method,
      payment_reference: group.payment_reference,
      payment_confirmed_at: group.payment_confirmed_at,
      exchange_rate: group.exchange_rate || process.env.DEFAULT_EXCHANGE_RATE,
      amount_usd: group.amount_usd,
      amount_bs: group.amount_bs,
      transaction_id: group.transaction_id
    };
    
    // Enviar email con datos actualizados
    const result = await sendRunnerConfirmationEmail(
      group,
      group.runners,
      paymentData
    );
    
    // Registrar éxito
    await supabase
      .from('email_logs')
      .insert({
        type: 'runner_confirmation',
        group_id: groupId,
        recipient: group.registrant_email,
        status: 'sent',
        message_id: result.messageId,
        sent_at: new Date().toISOString(),
        attempt_number: job.attemptsMade + 1
      });
    
    return result;
    
  } catch (error) {
    console.error(`Error enviando email para grupo ${groupId}:`, error);
    
    // Registrar fallo
    await supabase
      .from('email_logs')
      .insert({
        type: 'runner_confirmation',
        group_id: groupId,
        status: 'failed',
        error: error.message,
        attempt_number: job.attemptsMade + 1,
        failed_at: new Date().toISOString()
      });
    
    // Relanzar error para que Bull maneje reintentos
    throw error;
  }
});

// Función para agregar a la cola
export const queueConfirmationEmail = async (groupId, delay = 2000) => {
  return await emailQueue.add(
    'confirmation-email',
    { groupId },
    {
      delay, // Esperar 2 segundos antes de procesar
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000 // Empezar con 5 segundos entre reintentos
      },
      removeOnComplete: true,
      removeOnFail: false
    }
  );
};