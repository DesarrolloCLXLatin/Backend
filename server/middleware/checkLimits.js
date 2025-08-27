// server/middleware/checkLimits.js
export const checkResourceLimit = (resource, limitType) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const currentUsage = await getCurrentUsage(userId, resource, limitType);
      
      const { data: allowed } = await req.supabase
        .rpc('check_resource_limit', {
          p_user_id: userId,
          p_resource: resource,
          p_limit_type: limitType,
          p_current_usage: currentUsage
        });

      if (!allowed) {
        return res.status(429).json({
          success: false,
          message: 'Límite excedido',
          limit: limitType,
          current: currentUsage
        });
      }

      next();
    } catch (error) {
      console.error('Error checking limit:', error);
      res.status(500).json({
        success: false,
        message: 'Error al verificar límites'
      });
    }
  };
};