// server/routes/upload.js
import express from 'express';
import { uploadPaymentProof, handleUploadError } from '../middleware/upload.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Upload payment proof
router.post('/payment-proof', (req, res, next) => {
  console.log('📤 Upload request received');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
}, uploadPaymentProof, handleUploadError, async (req, res) => {
  try {
    console.log('📁 Processing file upload');
    console.log('File received:', req.file ? 'Yes' : 'No');
    
    if (!req.file) {
      console.error('❌ No file in request');
      return res.status(400).json({
        success: false,
        message: 'No se recibió ningún archivo'
      });
    }

    // Construir URL relativa para acceso público
    const fileUrl = `/uploads/payment-proofs/${req.file.filename}`;

    res.json({
      success: true,
      message: 'Archivo subido exitosamente',
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });

  } catch (error) {
    // Si hay error, eliminar el archivo si existe
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error al eliminar archivo:', unlinkError);
      }
    }
    
    console.error('Error uploading payment proof:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir el archivo'
    });
  }
});

// Delete payment proof (optional, for cleanup)
router.delete('/payment-proof/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validar que el filename sea seguro (prevenir path traversal)
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        success: false,
        message: 'Nombre de archivo inválido'
      });
    }
    
    const filePath = path.join(__dirname, '../../uploads/payment-proofs', filename);
    
    // Verificar si el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Archivo no encontrado'
      });
    }
    
    // Eliminar el archivo
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      message: 'Archivo eliminado exitosamente'
    });
    
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el archivo'
    });
  }
});

export default router;