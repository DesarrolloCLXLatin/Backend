// server/middleware/upload.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Crear directorio de uploads si no existe
const uploadDir = path.join(__dirname, '../../uploads/payment-proofs');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Directorio de uploads creado:', uploadDir);
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generar nombre único: groupCode_timestamp_originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = `payment_${uniqueSuffix}${ext}`;
    cb(null, name);
  }
});

// Filtro de archivos
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se aceptan JPG, PNG y PDF.'), false);
  }
};

// Configurar multer
export const uploadPaymentProof = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
}).single('payment_proof'); // IMPORTANTE: debe coincidir con el nombre del campo en el FormData

// Middleware para manejar errores de multer
export const handleUploadError = (err, req, res, next) => {
  console.error('❌ Upload error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'El archivo es demasiado grande. Tamaño máximo: 5MB'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Error de Multer: ${err.message}`,
      code: err.code
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Error al subir el archivo'
    });
  }
  next();
};