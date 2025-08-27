export const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.IFRAME_ALLOWED_ORIGINS?.split(',') || [];
    
    // Permitir requests sin origin (ej: Postman, aplicaciones móviles)
    if (!origin) {
      return callback(null, true);
    }
    
    // Verificar si el origen está en la lista permitida
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Iframe-Token'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};