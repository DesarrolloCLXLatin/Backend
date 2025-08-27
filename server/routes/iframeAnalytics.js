// server/routes/payments/iframeAnalytics.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Obtener analytics generales
router.get('/analytics', authenticateToken, requireRole(['admin', 'seller']), async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    // Calcular fechas según el período
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    // Stats generales
    const { data: transactions } = await supabaseAdmin
      .from('ticket_payment_transactions')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('control_number', 'is', null); // Solo transacciones de iframe

    const stats = {
      totalTransactions: transactions?.length || 0,
      totalRevenue: transactions?.reduce((sum, t) => sum + t.amount_usd, 0) || 0,
      conversionRate: 0,
      avgTicketsPerTransaction: 0
    };

    if (transactions && transactions.length > 0) {
      const completed = transactions.filter(t => t.status === 'approved').length;
      stats.conversionRate = completed / transactions.length;
      stats.avgTicketsPerTransaction = 
        transactions.reduce((sum, t) => sum + (t.ticket_ids?.length || 0), 0) / transactions.length;
    }

    // Ventas diarias
    const { data: dailySales } = await supabaseAdmin
      .rpc('get_iframe_daily_sales', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      });

    // Ventas por dominio
    const { data: domainSales } = await supabaseAdmin
      .rpc('get_iframe_sales_by_domain', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      });

    // Transacciones por hora del día
    const { data: hourlySales } = await supabaseAdmin
      .rpc('get_iframe_hourly_pattern', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      });

    // Top bancos
    const { data: bankStats } = await supabaseAdmin
      .rpc('get_iframe_bank_stats', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      });

    res.json({
      stats,
      charts: {
        daily: dailySales || [],
        byDomain: domainSales || [],
        hourly: hourlySales || [],
        byBank: bankStats || []
      }
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      message: 'Error al obtener analytics' 
    });
  }
});

// Obtener métricas de rendimiento de tokens
router.get('/token-performance', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { data: tokenMetrics } = await supabaseAdmin
      .from('iframe_tokens')
      .select(`
        *,
        usage_count:iframe_token_usage(count),
        transactions:ticket_payment_transactions!inner(
          amount_usd,
          status,
          ticket_ids
        )
      `)
      .eq('user_id', req.user.id);

    const performance = tokenMetrics?.map(token => {
      const transactions = token.transactions || [];
      const completed = transactions.filter(t => t.status === 'approved');
      
      return {
        tokenId: token.id,
        origin: token.origin,
        createdAt: token.created_at,
        expiresAt: token.expires_at,
        isActive: token.is_active,
        metrics: {
          totalRequests: token.usage_count?.[0]?.count || 0,
          totalTransactions: transactions.length,
          completedTransactions: completed.length,
          revenue: completed.reduce((sum, t) => sum + t.amount_usd, 0),
          ticketsSold: completed.reduce((sum, t) => sum + (t.ticket_ids?.length || 0), 0),
          conversionRate: transactions.length > 0 ? completed.length / transactions.length : 0
        }
      };
    });

    res.json(performance || []);

  } catch (error) {
    console.error('Token performance error:', error);
    res.status(500).json({ 
      message: 'Error al obtener métricas de tokens' 
    });
  }
});

// Obtener eventos de error
router.get('/error-logs', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const { data: errors } = await supabaseAdmin
      .from('iframe_token_usage')
      .select(`
        *,
        token:iframe_tokens(token, origin)
      `)
      .not('metadata->error', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    res.json(errors || []);

  } catch (error) {
    console.error('Error logs fetch error:', error);
    res.status(500).json({ 
      message: 'Error al obtener logs de error' 
    });
  }
});

// Webhook para notificaciones de eventos
router.post('/webhook/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { event, data } = req.body;

    // Verificar que el token existe y está activo
    const { data: token } = await supabaseAdmin
      .from('iframe_tokens')
      .select('*')
      .eq('id', tokenId)
      .eq('is_active', true)
      .single();

    if (!token) {
      return res.status(404).json({ message: 'Token no encontrado' });
    }

    // Registrar evento
    await supabaseAdmin
      .from('iframe_webhook_events')
      .insert({
        token_id: tokenId,
        event_type: event,
        event_data: data,
        ip_address: req.ip
      });

    // Procesar según el tipo de evento
    switch (event) {
      case 'page_loaded':
        // Incrementar contador de vistas
        break;
      
      case 'form_abandoned':
        // Registrar abandono de formulario
        break;
      
      case 'payment_initiated':
        // Registrar inicio de pago
        break;
      
      case 'error_occurred':
        // Registrar error
        await supabaseAdmin
          .from('iframe_error_logs')
          .insert({
            token_id: tokenId,
            error_message: data.message,
            error_stack: data.stack,
            user_agent: req.headers['user-agent']
          });
        break;
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ 
      message: 'Error al procesar webhook' 
    });
  }
});

// Exportar reporte de analytics
router.get('/export', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { period = '30d', format = 'csv' } = req.query;
    
    // Obtener datos para exportar
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const { data: transactions } = await supabaseAdmin
      .from('ticket_payment_transactions')
      .select(`
        *,
        tickets:concert_tickets!inner(
          ticket_number,
          buyer_name,
          buyer_email
        )
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('control_number', 'is', null)
      .order('created_at', { ascending: false });

    if (format === 'csv') {
      // Generar CSV
      const csv = generateCSV(transactions);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=iframe-analytics-${period}.csv`);
      res.send(csv);
    } else {
      // JSON
      res.json(transactions);
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      message: 'Error al exportar datos' 
    });
  }
});

// Función auxiliar para generar CSV
function generateCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = [
    'ID Transacción',
    'Fecha',
    'Estado',
    'Monto USD',
    'Monto Bs',
    'Tickets',
    'Referencia',
    'Banco Cliente',
    'Teléfono Cliente'
  ];
  
  const rows = data.map(t => [
    t.id,
    new Date(t.created_at).toLocaleString('es-VE'),
    t.status,
    t.amount_usd,
    t.amount_bs,
    t.ticket_ids?.length || 0,
    t.reference || '',
    t.client_bank_code,
    t.client_phone
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csvContent;
}