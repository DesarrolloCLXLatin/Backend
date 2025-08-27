// server/routes/dashboard.js
import express from 'express';
import { authenticateToken, requirePermission, requireAnyPermission, enrichUserData } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard statistics (admin, boss, administracion can view different levels)
router.get('/stats', authenticateToken, requireAnyPermission(
  { resource: 'dashboard', action: 'view_admin' },
  { resource: 'dashboard', action: 'view_boss' },
  { resource: 'dashboard', action: 'view_reports' }
), async (req, res) => {
  try {
    // Get total runners and by payment status
    const { data: runners, count: totalRunners } = await req.supabase
      .from('runners')
      .select('payment_status, payment_method, shirt_size, gender', { count: 'exact' });

    // Count by status
    const statusCounts = {
      pendiente: 0,
      confirmado: 0,
      rechazado: 0,
      procesando: 0
    };

    // Count by payment method
    const methodCounts = {
      tienda: 0,
      zelle: 0,
      transferencia_nacional: 0,
      transferencia_internacional: 0,
      paypal: 0,
      pago_movil_p2c: 0
    };

    // Count by gender
    const genderCounts = {
      M: 0,
      F: 0
    };

    runners?.forEach(runner => {
      if (runner.payment_status in statusCounts) {
        statusCounts[runner.payment_status]++;
      }
      if (runner.payment_method in methodCounts) {
        methodCounts[runner.payment_method]++;
      }
      if (runner.gender in genderCounts) {
        genderCounts[runner.gender]++;
      }
    });

    // Get revenue statistics from gateway config
    const { data: priceConfig } = await req.supabase
      .from('gateway_config')
      .select('config_value')
      .eq('config_key', 'race_price_usd')
      .single();
    
    const PRICE_USD = parseFloat(priceConfig?.config_value || '55.00');
    const totalRevenueUSD = statusCounts.confirmado * PRICE_USD;

    // Get current exchange rate
    const { data: currentRate } = await req.supabase
      .from('exchange_rates')
      .select('rate, date')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    const totalRevenueBs = currentRate ? totalRevenueUSD * currentRate.rate : 0;

    // Get inventory status by gender using the view
    const { data: inventoryStatus } = await req.supabase
      .from('inventory_status_by_gender')
      .select('*')
      .order('gender')
      .order('shirt_size');

    const inventoryByGender = {
      M: inventoryStatus?.filter(item => item.gender === 'M') || [],
      F: inventoryStatus?.filter(item => item.gender === 'F') || []
    };

    const totalStock = inventoryStatus?.reduce((sum, item) => sum + item.stock, 0) || 0;
    const totalReserved = inventoryStatus?.reduce((sum, item) => sum + item.reserved, 0) || 0;
    const totalAvailable = inventoryStatus?.reduce((sum, item) => sum + item.available, 0) || 0;

    // Get payment transactions statistics
    const { data: transactions } = await req.supabase
      .from('payment_transactions')
      .select('status, amount_usd, amount_bs')
      .in('status', ['approved', 'pending', 'rejected']);

    const transactionStats = {
      total: transactions?.length || 0,
      approved: transactions?.filter(t => t.status === 'approved').length || 0,
      pending: transactions?.filter(t => t.status === 'pending').length || 0,
      rejected: transactions?.filter(t => t.status === 'rejected').length || 0,
      totalUSD: transactions?.filter(t => t.status === 'approved')
        .reduce((sum, t) => sum + parseFloat(t.amount_usd || 0), 0) || 0,
      totalBs: transactions?.filter(t => t.status === 'approved')
        .reduce((sum, t) => sum + parseFloat(t.amount_bs || 0), 0) || 0
    };

    // Get groups statistics
    const { data: groups, count: totalGroups } = await req.supabase
      .from('registration_groups')
      .select('payment_status, total_runners, reserved_until', { count: 'exact' });

    const groupStats = {
      total: totalGroups || 0,
      confirmed: groups?.filter(g => g.payment_status === 'confirmado').length || 0,
      pending: groups?.filter(g => g.payment_status === 'pendiente').length || 0,
      withReservation: groups?.filter(g => g.reserved_until && new Date(g.reserved_until) > new Date()).length || 0
    };

    // Get today's statistics
    const today = new Date().toISOString().split('T')[0];
    const { data: todayStats } = await req.supabase
      .from('daily_statistics')
      .select('*')
      .eq('date', today)
      .single();

    // Get last 7 days statistics for trend
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: weekStats } = await req.supabase
      .from('daily_statistics')
      .select('*')
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Runner numbers availability
    const { data: runnerNumberInfo } = await req.supabase
      .from('runner_numbers')
      .select('current_number, max_number')
      .single();

    const availableNumbers = runnerNumberInfo ? 
      (runnerNumberInfo.max_number - runnerNumberInfo.current_number) : 0;

    // Response structure
    res.json({
      // Main dashboard stats
      totalRunners: totalRunners || 0,
      confirmedPayments: statusCounts.confirmado,
      pendingPayments: statusCounts.pendiente,
      rejectedPayments: statusCounts.rechazado,
      totalRevenue: totalRevenueUSD,
      availableStock: totalAvailable,
      
      // Detailed stats
      stats: {
        // Totals
        totalRunners: totalRunners || 0,
        totalGroups: totalGroups || 0,
        availableRunnerNumbers: availableNumbers,
        
        // Payment status
        paymentStats: statusCounts,
        
        // Revenue
        totalRevenueUSD,
        totalRevenueBs,
        exchangeRate: currentRate?.rate || 0,
        exchangeRateDate: currentRate?.date,
        pricePerRunner: PRICE_USD,
        
        // Inventory
        totalStock,
        totalReserved,
        availableStock: totalAvailable,
        inventoryByGender,
        inventory: inventoryStatus || [],
        
        // Payment methods
        paymentMethods: methodCounts,
        
        // Gender distribution
        genderDistribution: genderCounts,
        
        // Groups
        groupStats,
        
        // Transactions
        transactionStats,
        
        // Today's stats
        todayRegistrations: todayStats?.total_registrations || 0,
        todayConfirmed: todayStats?.confirmed_registrations || 0,
        todayP2C: todayStats?.p2c_registrations || 0,
        todayStore: todayStats?.store_registrations || 0,
        
        // Weekly trend
        weeklyTrend: weekStats || []
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get user dashboard - accessible by all authenticated users
router.get('/user', authenticateToken, requirePermission('dashboard', 'view_user'), async (req, res) => {
  try {
    // Get user's groups with runners
    const { data: groups, error } = await req.supabase
      .from('runner_group_summary')
      .select('*')
      .eq('registrant_email', req.user.email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching groups:', error);
      return res.status(500).json({ message: 'Error obteniendo tus registros' });
    }

    // Extract all runners from groups
    const allRunners = [];
    groups?.forEach(group => {
      if (group.runners_detail) {
        group.runners_detail.forEach(runner => {
          allRunners.push({
            ...runner,
            group_code: group.group_code,
            group_id: group.group_id,
            payment_status: group.payment_status,
            payment_method: group.payment_method,
            reserved_until: group.reserved_until
          });
        });
      }
    });

    // Calculate summary
    const summary = {
      totalGroups: groups?.length || 0,
      totalRunners: allRunners.length,
      confirmed: groups?.filter(g => g.payment_status === 'confirmado').length || 0,
      pending: groups?.filter(g => g.payment_status === 'pendiente').length || 0,
      processing: groups?.filter(g => g.payment_status === 'procesando').length || 0,
      withReservation: groups?.filter(g => g.reserved_until && new Date(g.reserved_until) > new Date()).length || 0
    };

    res.json({ 
      groups: groups || [],
      runners: allRunners,
      summary 
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get store dashboard stats - for tienda role
router.get('/store', authenticateToken, requirePermission('dashboard', 'view_store'), async (req, res) => {
  try {
    // Get groups registered by this store user
    const { data: groups, count } = await req.supabase
      .from('runner_group_summary')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Filter groups where any runner was registered by this store
    const storeGroups = [];
    for (const group of groups || []) {
      const { data: hasStoreRunner } = await req.supabase
        .from('runners')
        .select('id')
        .eq('group_id', group.group_id)
        .eq('registered_by', req.user.id)
        .limit(1)
        .single();

      if (hasStoreRunner) {
        storeGroups.push(group);
      }
    }

    // Count by payment status
    const statusCounts = {
      pendiente: 0,
      confirmado: 0,
      rechazado: 0,
      procesando: 0
    };

    let totalStoreRunners = 0;
    storeGroups.forEach(group => {
      if (group.payment_status in statusCounts) {
        statusCounts[group.payment_status]++;
      }
      totalStoreRunners += group.total_runners;
    });

    // Calculate revenue for this store
    const { data: priceConfig } = await req.supabase
      .from('gateway_config')
      .select('config_value')
      .eq('config_key', 'race_price_usd')
      .single();
    
    const PRICE_USD = parseFloat(priceConfig?.config_value || '55.00');
    const storeRevenue = statusCounts.confirmado * PRICE_USD;

    // Get today's registrations
    const today = new Date().toISOString().split('T')[0];
    const todayRegistrations = storeGroups.filter(g => 
      g.created_at.startsWith(today)
    ).length;

    // Get this week's registrations
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekRegistrations = storeGroups.filter(g => 
      new Date(g.created_at) >= weekStart
    ).length;

    // Get inventory status for display
    const { data: inventoryStatus } = await req.supabase
      .from('inventory_status_by_gender')
      .select('*')
      .order('gender')
      .order('shirt_size');

    res.json({
      totalGroups: storeGroups.length,
      totalRunners: totalStoreRunners,
      confirmedPayments: statusCounts.confirmado,
      pendingPayments: statusCounts.pendiente,
      rejectedPayments: statusCounts.rechazado,
      processingPayments: statusCounts.procesando,
      
      // Revenue
      storeRevenueUSD: storeRevenue,
      pricePerRunner: PRICE_USD,
      
      // Time-based stats
      todayRegistrations,
      weekRegistrations,
      
      // Inventory status
      inventory: inventoryStatus || [],
      
      // Recent registrations (últimos 10 grupos)
      recentGroups: storeGroups.slice(0, 10).map(g => ({
        group_id: g.group_id,
        group_code: g.group_code,
        total_runners: g.total_runners,
        runner_names: g.runner_names,
        payment_status: g.payment_status,
        payment_method: g.payment_method,
        created_at: g.created_at,
        reserved_until: g.reserved_until
      }))
    });

  } catch (error) {
    console.error('Store dashboard error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get quick stats (for header/widgets) - different permissions based on role
router.get('/quick-stats', authenticateToken, enrichUserData, async (req, res) => {
  try {
    let stats = {};
    const userPermissions = req.user.permissions || [];

    // Check what level of stats the user can see
    if (userPermissions.includes('dashboard:view_admin') || userPermissions.includes('dashboard:view_boss')) {
      // Admin and Boss see global stats
      const { count: totalRunners } = await req.supabase
        .from('runners')
        .select('*', { count: 'exact', head: true });

      const { count: pendingGroups } = await req.supabase
        .from('registration_groups')
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'pendiente');

      const { data: lowStock } = await req.supabase
        .from('inventory_status_by_gender')
        .select('shirt_size, gender, available')
        .lt('available', 5);

      // Active reservations
      const { count: activeReservations } = await req.supabase
        .from('registration_groups')
        .select('*', { count: 'exact', head: true })
        .not('reserved_until', 'is', null)
        .gt('reserved_until', new Date().toISOString());

      stats = {
        totalRunners: totalRunners || 0,
        pendingGroups: pendingGroups || 0,
        activeReservations: activeReservations || 0,
        lowStockItems: lowStock?.length || 0,
        lowStockDetails: lowStock?.map(item => ({
          size: item.shirt_size,
          gender: item.gender,
          available: item.available
        })) || []
      };

    } else if (userPermissions.includes('dashboard:view_store')) {
      // Tienda sees their stats
      const { data: storeRunners } = await req.supabase
        .from('runners')
        .select('group_id')
        .eq('registered_by', req.user.id);

      const uniqueGroups = [...new Set(storeRunners?.map(r => r.group_id) || [])];

      const { data: storeGroups } = await req.supabase
        .from('registration_groups')
        .select('payment_status')
        .in('id', uniqueGroups);

      const pendingCount = storeGroups?.filter(g => g.payment_status === 'pendiente').length || 0;

      stats = {
        totalGroups: uniqueGroups.length,
        totalRunners: storeRunners?.length || 0,
        pendingPayments: pendingCount
      };

    } else if (userPermissions.includes('dashboard:view_reports')) {
      // Administracion sees payment-focused stats
      const { count: pendingPayments } = await req.supabase
        .from('registration_groups')
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'pendiente');

      const { count: processingPayments } = await req.supabase
        .from('registration_groups')
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'procesando');

      const { data: todayTransactions } = await req.supabase
        .from('payment_transactions')
        .select('status')
        .gte('created_at', new Date().toISOString().split('T')[0]);

      stats = {
        pendingPayments: pendingPayments || 0,
        processingPayments: processingPayments || 0,
        todayTransactions: todayTransactions?.length || 0,
        todayApproved: todayTransactions?.filter(t => t.status === 'approved').length || 0
      };

    } else {
      // Regular user sees their stats
      const { data: userGroups } = await req.supabase
        .from('registration_groups')
        .select('id, payment_status, total_runners')
        .eq('registrant_email', req.user.email);

      const totalRunners = userGroups?.reduce((sum, g) => sum + g.total_runners, 0) || 0;
      const pendingGroups = userGroups?.filter(g => g.payment_status === 'pendiente').length || 0;

      stats = {
        myGroups: userGroups?.length || 0,
        myRunners: totalRunners,
        pendingPayments: pendingGroups
      };
    }

    res.json(stats);

  } catch (error) {
    console.error('Quick stats error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get charts data - admin, boss, and administracion can view
router.get('/charts', authenticateToken, requireAnyPermission(
  { resource: 'dashboard', action: 'view_admin' },
  { resource: 'dashboard', action: 'view_boss' },
  { resource: 'dashboard', action: 'view_reports' }
), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Get daily statistics for the chart
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const { data: dailyStats } = await req.supabase
      .from('daily_statistics')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Get payment methods distribution
    const { data: confirmedRunners } = await req.supabase
      .from('runners')
      .select('payment_method')
      .eq('payment_status', 'confirmado');

    const methodCount = {};
    confirmedRunners?.forEach(runner => {
      methodCount[runner.payment_method] = (methodCount[runner.payment_method] || 0) + 1;
    });

    // Get size distribution by gender for confirmed runners
    const { data: sizeDistribution } = await req.supabase
      .from('runners')
      .select('shirt_size, gender')
      .eq('payment_status', 'confirmado');

    const sizeByGender = {
      M: {},
      F: {}
    };

    sizeDistribution?.forEach(runner => {
      if (runner.gender in sizeByGender) {
        sizeByGender[runner.gender][runner.shirt_size] = 
          (sizeByGender[runner.gender][runner.shirt_size] || 0) + 1;
      }
    });

    // Age distribution
    const { data: ageData } = await req.supabase
      .from('runners_with_age')
      .select('age')
      .eq('payment_status', 'confirmado');

    const ageRanges = {
      '16-20': 0,
      '21-30': 0,
      '31-40': 0,
      '41-50': 0,
      '51-60': 0,
      '60+': 0
    };

    ageData?.forEach(runner => {
      const age = runner.age;
      if (age >= 16 && age <= 20) ageRanges['16-20']++;
      else if (age <= 30) ageRanges['21-30']++;
      else if (age <= 40) ageRanges['31-40']++;
      else if (age <= 50) ageRanges['41-50']++;
      else if (age <= 60) ageRanges['51-60']++;
      else ageRanges['60+']++;
    });

    res.json({
      dailyRegistrations: dailyStats || [],
      paymentMethods: methodCount,
      sizeDistributionByGender: sizeByGender,
      ageDistribution: ageRanges,
      chartData: {
        daily: dailyStats?.map(stat => ({
          date: stat.date,
          registrations: stat.total_registrations,
          confirmed: stat.confirmed_registrations,
          pending: stat.pending_registrations
        })) || []
      }
    });

  } catch (error) {
    console.error('Charts data error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get group details - check ownership or appropriate permissions
router.get('/groups/:groupId', authenticateToken, enrichUserData, async (req, res) => {
  try {
    const { groupId } = req.params;

    // Get group details
    const { data: group, error } = await req.supabase
      .from('runner_group_summary')
      .select('*')
      .eq('group_id', groupId)
      .single();

    if (error || !group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Check permissions - admin/boss/administracion can see all, others need to be owner
    const hasViewAllPermission = req.user.permissions.some(p => 
      ['runners:manage', 'runners:read', 'payments:read', 'payments:manage'].includes(p)
    );

    if (!hasViewAllPermission && group.registrant_email !== req.user.email) {
      // Check if tienda registered any runner in this group
      if (req.user.permissions.includes('runners:register_group')) {
        const { data: storeRunner } = await req.supabase
          .from('runners')
          .select('id')
          .eq('group_id', groupId)
          .eq('registered_by', req.user.id)
          .limit(1)
          .single();
        
        if (!storeRunner) {
          return res.status(403).json({ message: 'No tienes permisos para ver este grupo' });
        }
      } else {
        return res.status(403).json({ message: 'No tienes permisos para ver este grupo' });
      }
    }

    // Get payment transaction if exists
    const { data: transaction } = await req.supabase
      .from('payment_transactions')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    res.json({
      group,
      transaction: transaction || null
    });

  } catch (error) {
    console.error('Group details error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

export default router;