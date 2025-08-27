// server/services/paymentProcessorService.js
import paymentGateway from './paymentServices.js';

class PaymentProcessorService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Procesar pago según el método y rol
   */
  async processPayment(paymentData, userRole, userId) {
    const { payment_method, group_id, reference, amount } = paymentData;

    // Obtener configuración del método
    const { data: methodConfig } = await this.supabase
      .from('payment_methods_configuration')
      .select('*')
      .eq('role_name', userRole)
      .eq('payment_method', payment_method)
      .eq('is_active', true)
      .single();

    if (!methodConfig) {
      throw new Error('Método de pago no permitido para este usuario');
    }

    // Procesar según el tipo de método
    switch (payment_method) {
      case 'obsequio_exonerado':
        return this.processGiftPayment(group_id, userId);
      
      case 'pago_movil_p2c':
        return this.processP2CPayment(paymentData);
      
      case 'tarjeta_debito':
      case 'tarjeta_credito':
      case 'efectivo_bs':
      case 'efectivo_usd':
        return this.processStorePayment(paymentData, userId);
      
      default:
        if (methodConfig.auto_confirm) {
          return this.processAutoConfirmPayment(paymentData, userId);
        } else {
          return this.processPendingPayment(paymentData);
        }
    }
  }

  /**
   * Procesar obsequio exonerado (RRHH)
   */
  async processGiftPayment(groupId, userId) {
    try {
      // Generar referencia especial
      const giftReference = `GIFT-${Date.now()}`;

      // Actualizar grupo
      const { error: updateError } = await this.supabase
        .from('registration_groups')
        .update({
          payment_status: 'confirmado',
          payment_reference: giftReference,
          payment_confirmed_at: new Date().toISOString(),
          payment_confirmed_by: userId,
          payment_date: new Date().toISOString()
        })
        .eq('id', groupId);

      if (updateError) throw updateError;

      // Actualizar corredores
      await this.supabase
        .from('runners')
        .update({
          payment_status: 'confirmado',
          payment_confirmed_at: new Date().toISOString()
        })
        .eq('group_id', groupId);

      // Crear transacción
      await this.supabase
        .from('payment_transactions')
        .insert({
          group_id: groupId,
          payment_method: 'obsequio_exonerado',
          amount_usd: 0,
          amount_bs: 0,
          status: 'approved',
          reference: giftReference,
          metadata: {
            is_gift: true,
            authorized_by: userId,
            reason: 'Empleado RRHH'
          }
        });

      return {
        success: true,
        payment_status: 'confirmado',
        reference: giftReference,
        message: 'Obsequio registrado exitosamente'
      };

    } catch (error) {
      console.error('Error processing gift payment:', error);
      throw error;
    }
  }

  /**
   * Procesar pago en tienda
   */
  async processStorePayment(paymentData, userId) {
    try {
      const { group_id, payment_method, reference, amount_usd } = paymentData;

      // Obtener tasa de cambio si es necesario
      let exchangeRate = null;
      let amountBs = null;

      if (['efectivo_bs', 'tarjeta_debito', 'tarjeta_credito'].includes(payment_method)) {
        const { data: rate } = await this.supabase
          .from('exchange_rates')
          .select('rate')
          .order('date', { ascending: false })
          .limit(1)
          .single();

        exchangeRate = rate?.rate || 0;
        amountBs = amount_usd * exchangeRate;
      }

      // Confirmar pago inmediatamente
      await this.supabase
        .from('registration_groups')
        .update({
          payment_status: 'confirmado',
          payment_reference: reference,
          payment_confirmed_at: new Date().toISOString(),
          payment_confirmed_by: userId,
          payment_date: new Date().toISOString()
        })
        .eq('id', group_id);

      // Actualizar corredores
      await this.supabase
        .from('runners')
        .update({
          payment_status: 'confirmado',
          payment_confirmed_at: new Date().toISOString()
        })
        .eq('group_id', group_id);

      // Crear transacción
      await this.supabase
        .from('payment_transactions')
        .insert({
          group_id: group_id,
          payment_method: payment_method,
          amount_usd: amount_usd,
          amount_bs: amountBs,
          exchange_rate: exchangeRate,
          status: 'approved',
          reference: reference,
          metadata: {
            store_user: userId,
            store_confirmation: true
          }
        });

      return {
        success: true,
        payment_status: 'confirmado',
        reference: reference,
        message: 'Pago confirmado en tienda'
      };

    } catch (error) {
      console.error('Error processing store payment:', error);
      throw error;
    }
  }

  /**
   * Procesar pago P2C (se mantiene la lógica existente)
   */
  async processP2CPayment(paymentData) {
    // Esta lógica ya existe en paymentGateway.js
    // Se puede reutilizar o refactorizar según necesidad
    return {
      success: true,
      requiresGateway: true,
      gatewayType: 'p2c'
    };
  }

  /**
   * Procesar pago con confirmación automática
   */
  async processAutoConfirmPayment(paymentData, userId) {
    try {
      const { group_id, payment_method, reference, amount_usd } = paymentData;

      // Similar a processStorePayment pero para otros métodos auto-confirmables
      await this.supabase
        .from('registration_groups')
        .update({
          payment_status: 'confirmado',
          payment_reference: reference,
          payment_confirmed_at: new Date().toISOString(),
          payment_confirmed_by: userId,
          payment_date: new Date().toISOString()
        })
        .eq('id', group_id);

      return {
        success: true,
        payment_status: 'confirmado',
        reference: reference
      };

    } catch (error) {
      console.error('Error processing auto-confirm payment:', error);
      throw error;
    }
  }

  /**
   * Procesar pago pendiente de aprobación
   */
  async processPendingPayment(paymentData) {
    try {
      const { group_id, payment_method, reference, payment_proof_url } = paymentData;

      // Mantener en estado pendiente
      await this.supabase
        .from('registration_groups')
        .update({
          payment_status: 'pendiente',
          payment_reference: reference,
          payment_proof_url: payment_proof_url,
          reserved_until: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() // 72 horas
        })
        .eq('id', group_id);

      return {
        success: true,
        payment_status: 'pendiente',
        reference: reference,
        message: 'Pago registrado, pendiente de verificación'
      };

    } catch (error) {
      console.error('Error processing pending payment:', error);
      throw error;
    }
  }
}

export default PaymentProcessorService;