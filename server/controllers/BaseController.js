// server/controllers/BaseController.js
// Controlador base con funcionalidades comunes

export class BaseController {
  constructor() {
    this.handleAsync = this.handleAsync.bind(this);
  }

  /**
   * Wrapper para manejar errores async de forma consistente
   */
  handleAsync(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Respuesta de éxito estándar
   */
  success(res, data, message = 'Operación exitosa', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Respuesta de error estándar
   */
  error(res, message = 'Error interno del servidor', statusCode = 500, details = null) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };

    if (details && process.env.NODE_ENV === 'development') {
      response.details = details;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Respuesta de validación fallida
   */
  validationError(res, errors, message = 'Datos de entrada inválidos') {
    return res.status(400).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Respuesta de recurso no encontrado
   */
  notFound(res, resource = 'Recurso') {
    return res.status(404).json({
      success: false,
      message: `${resource} no encontrado`,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Respuesta de acceso denegado
   */
  forbidden(res, message = 'No tienes permisos para realizar esta acción') {
    return res.status(403).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Respuesta de no autorizado
   */
  unauthorized(res, message = 'Autenticación requerida') {
    return res.status(401).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Extraer parámetros de paginación
   */
  getPaginationParams(req) {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Máximo 100
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Formatear respuesta paginada
   */
  paginatedResponse(res, data, total, page, limit, message = 'Datos obtenidos exitosamente') {
    return res.json({
      success: true,
      message,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Validar campos requeridos
   */
  validateRequired(data, requiredFields) {
    const missing = requiredFields.filter(field => {
      const value = data[field];
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
    }

    return true;
  }

  /**
   * Sanitizar datos de entrada
   */
  sanitizeInput(data, allowedFields) {
    const sanitized = {};
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        sanitized[field] = data[field];
      }
    });

    return sanitized;
  }

  /**
   * Manejar errores de Supabase
   */
  handleSupabaseError(error, defaultMessage = 'Error de base de datos') {
    console.error('Supabase error:', error);
    
    // Mapear errores comunes de Supabase
    const errorMappings = {
      '23505': 'Ya existe un registro con estos datos',
      '23503': 'Referencia inválida a otro registro',
      '42P01': 'Tabla o vista no encontrada',
      'PGRST116': 'Registro no encontrado'
    };

    const mappedMessage = errorMappings[error.code] || defaultMessage;
    
    const enhancedError = new Error(mappedMessage);
    enhancedError.code = error.code;
    enhancedError.details = error.details;
    enhancedError.hint = error.hint;
    
    return enhancedError;
  }

  /**
   * Extraer información del usuario autenticado
   */
  getCurrentUser(req) {
    return {
      id: req.user?.id,
      email: req.user?.email,
      role: req.user?.role,
      permissions: req.user?.permissions || [],
      isAdmin: req.user?.role === 'admin' || req.user?.permissions?.includes('system:manage_all')
    };
  }

  /**
   * Verificar permisos específicos
   */
  hasPermission(req, resource, action) {
    const user = this.getCurrentUser(req);
    
    if (user.isAdmin) return true;
    
    const requiredPermission = `${resource}:${action}`;
    return user.permissions.includes(requiredPermission) ||
           user.permissions.includes(`${resource}:manage`) ||
           user.permissions.includes(`${resource}:*`);
  }

  /**
   * Middleware para logging de requests
   */
  logRequest(req, res, next) {
    const start = Date.now();
    const { method, url, ip } = req;
    const userAgent = req.get('User-Agent');
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      
      console.log(`${method} ${url} - ${statusCode} - ${duration}ms - ${ip} - ${userAgent}`);
    });
    
    next();
  }
}

export default BaseController;