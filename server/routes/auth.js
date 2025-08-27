import express from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { 
  authenticateToken, 
  enrichUserData,
  requirePermission
} from '../middleware/auth.js';

const router = express.Router();
const authController = new AuthController();

// ===== RUTAS USANDO CONTROLADORES =====

// Autenticación
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify', authenticateToken, enrichUserData, authController.verifyToken);
router.get('/profile', authenticateToken, enrichUserData, authController.getProfile);
router.get('/me', authenticateToken, authController.getMe);

// Gestión de usuarios (admin)
router.get('/users', authenticateToken, enrichUserData, requirePermission('users', 'read'), authController.listUsers);
router.get('/users/:userId', authenticateToken, enrichUserData, requirePermission('users', 'read'), authController.getUserDetails);
router.put('/users/:userId', authenticateToken, enrichUserData, requirePermission('users', 'update'), authController.updateUser);
router.delete('/users/:userId', authenticateToken, enrichUserData, requirePermission('users', 'delete'), authController.deleteUser);

export default router;