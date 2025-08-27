import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, UserPlus, AlertCircle, ArrowLeft, Shield, Store, User, Briefcase, DollarSign } from 'lucide-react';

interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  full_name: string;
  role: string;
}

const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    role: '' 
  });
  
  const [errors, setErrors] = useState<Partial<RegisterFormData>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Verificar si el usuario actual puede crear cuentas
  useEffect(() => {
    // Solo administradores pueden acceder a este formulario
    if (user && !user.permissions?.includes('users:create')) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const validateForm = (): boolean => {
    const newErrors: Partial<RegisterFormData> = {};
    
    // Validar nombre completo
    if (!formData.full_name?.trim()) {
      newErrors.full_name = 'Nombre completo es requerido';
    }
    
    // Validar email
    if (!formData.email) {
      newErrors.email = 'Email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }
    
    // Validar password
    if (!formData.password) {
      newErrors.password = 'Contraseña es requerida';
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }
    
    // Validar confirmPassword
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirmar contraseña es requerido';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }
    
    // Validar que se haya seleccionado un rol
    if (!formData.role) {
      newErrors.role = 'Debes seleccionar un tipo de cuenta';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof RegisterFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpiar error del campo cuando el usuario empieza a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Error al registrar usuario');
      }

      setSuccess(true);
      
      // Esperar 2 segundos antes de redirigir
      setTimeout(() => {
        if (user) {
          navigate('/rbac'); // Si es admin, ir a gestión de usuarios
        } else {
          navigate('/login'); // Si es registro público, ir a login
        }
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Error al registrar usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Todos los roles disponibles en el sistema
  const roleOptions = [
    {
      value: 'usuario',
      label: 'Usuario',
      icon: User,
      description: 'Participante de la carrera',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-500'
    },
    {
      value: 'tienda',
      label: 'Tienda',
      icon: Store,
      description: 'Punto de venta autorizado',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-500'
    },
    {
      value: 'administracion',
      label: 'Administración',
      icon: DollarSign,
      description: 'Gestión de pagos y finanzas',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-500'
    },
    {
      value: 'boss',
      label: 'RRHH',
      icon: Briefcase,
      description: 'Supervisión y reportes ejecutivos',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-500'
    },
    {
      value: 'admin',
      label: 'MASTER',
      icon: Shield,
      description: 'Acceso completo al sistema',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-500'
    }
  ];

  // Filtrar roles según los permisos del usuario actual
  // Permitir rol admin si:
  // 1. El usuario tiene permiso system:manage_all
  // 2. El usuario actual es admin
  // 3. Es un registro público (no hay usuario logueado)
  const availableRoles = !user || user?.role === 'admin' || user?.permissions?.includes('system:manage_all') 
    ? roleOptions 
    : roleOptions.filter(role => role.value !== 'admin');

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-300 to-amber-700 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Registro Exitoso!</h2>
            <p className="text-gray-600 mb-4">
              El usuario ha sido creado correctamente.
              {formData.role !== 'usuario' && (
                <span className="block mt-2 text-sm">
                  Se le ha asignado el rol de <strong>{roleOptions.find(r => r.value === formData.role)?.label}</strong>
                </span>
              )}
            </p>
            <p className="text-sm text-gray-500">Redirigiendo...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-300 to-amber-700 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-black rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <img
              src="/clxrun.png"
              alt="Logo"
              className="mx-auto h-16 w-auto mb-4"
            />
            <h2 className="text-2xl font-bold text-orange-300">
              {user ? 'Crear Usuario' : 'Crear Cuenta'}
            </h2>
            <p className="mt-2 text-sm text-orange-600">
              {user ? 'Registra un nuevo usuario en el sistema' : 'Regístrate para acceder al sistema'}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="space-y-6">
            {/* Full Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-100 mb-1">
                Nombre Completo
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                placeholder="Juan Pérez"
              />
              {errors.full_name && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.full_name}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-100 mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                placeholder="correo@ejemplo.com"
                autoComplete="email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-100 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.password}
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-100 mb-1">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Role Selection - Siempre mostrar para usuario admin o registro público */}
            <div>
              <label className="block text-sm font-medium text-gray-100 mb-3">
                Tipo de Cuenta
              </label>
              <div className="grid grid-cols-1 gap-3">
                {availableRoles.map((option) => {
                  const Icon = option.icon;
                  return (
                    <label
                      key={option.value}
                      className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.role === option.value
                          ? `${option.borderColor} ${option.bgColor}`
                          : 'border-gray-600 hover:border-gray-500 bg-gray-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={option.value}
                        checked={formData.role === option.value}
                        onChange={(e) => handleInputChange('role', e.target.value)}
                        className="sr-only"
                      />
                      <Icon className={`w-5 h-5 mr-3 ${formData.role === option.value ? option.color : 'text-gray-400'}`} />
                      <div className="flex-1">
                        <div className={`font-medium ${formData.role === option.value ? option.color : 'text-orange-400'}`}>
                          {option.label}
                        </div>
                        <div className="text-sm text-gray-400">{option.description}</div>
                      </div>
                      {formData.role === option.value && (
                        <div className="absolute right-4">
                          <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
              {/* Mostrar error si no se seleccionó rol */}
              {errors.role && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.role}
                </p>
              )}
              
              {/* Mensaje de advertencia para registro público */}
              {!user && (
                <p className="mt-2 text-xs text-gray-400">
                  Selecciona el tipo de cuenta según tu rol en el evento. El acceso a funciones específicas será asignado automáticamente.
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.role}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-700 text-white py-3 px-4 rounded-lg font-medium hover:from-orange-700 hover:to-amber-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Registrando...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" />
                  {user ? 'Crear Usuario' : 'Crear Cuenta'}
                </>
              )}
            </button>
          </div>

          {/* Footer */}
          {!user && (
            <div className="mt-8 pt-6 border-t border-gray-700">
              <div className="text-center">
                <p className="text-sm text-orange-300 mb-4">¿Ya tienes una cuenta?</p>
                <button
                  onClick={() => navigate('/login')}
                  className="text-orange-500 hover:text-orange-400 font-medium text-sm flex items-center justify-center w-full transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver al Login
                </button>
              </div>
            </div>
          )}

          {/* Role Notice */}
          {formData.role && formData.role !== 'usuario' && (
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
              <p className="text-xs text-yellow-400 text-center">
                <strong>Nota:</strong> Los permisos específicos del rol <strong>{roleOptions.find(r => r.value === formData.role)?.label}</strong> serán asignados automáticamente por el sistema.
              </p>
            </div>
          )}

          {/* RBAC Info */}
          {user && (
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                Sistema RBAC activo - Los permisos serán asignados según el rol seleccionado
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;