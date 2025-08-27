import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, LogIn, AlertCircle, Shield, Mail, Lock, Sparkles } from 'lucide-react';

const schema = yup.object().shape({
  email: yup.string().email('Email inválido').required('Email es requerido'),
  password: yup.string().required('Contraseña es requerida').min(6, 'Mínimo 6 caracteres')
});

const LoginForm: React.FC = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm({
    resolver: yupResolver(schema)
  });

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
    } catch (error: any) {
      if (error.message?.includes('credenciales')) {
        setError('email', { message: 'Credenciales inválidas' });
        setError('password', { message: 'Credenciales inválidas' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-black">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-[#F08772] rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-[#E67F47] rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-[#F2D3BD] rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>

      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }}
          >
            <Sparkles className="w-4 h-4 text-[#E67F47] opacity-30" />
          </div>
        ))}
      </div>

      <div className="max-w-md w-full relative z-10">
        <div className="bg-black/40 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-[#F08772]/20 relative overflow-hidden group">
          {/* Glow effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#F08772]/0 via-[#E67F47]/20 to-[#F08772]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl"></div>
          
          <div className="relative z-10">
            <div className="text-center mb-8 animate-fadeInDown">
              <div className="relative inline-block mb-4">
                <img
                  src="/clxrun.png"
                  alt='Logo'
                  className="h-16 w-auto animate-pulse-slow"
                />
                <div className="absolute inset-0 bg-[#E67F47] blur-xl opacity-50 animate-pulse-slow"></div>
              </div>
              
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Shield className="w-5 h-5 text-[#F08772] animate-bounce-slow" />
                <h2 className="text-xl font-bold text-white bg-gradient-to-r from-[#F08772] to-[#E67F47] bg-clip-text text-transparent">
                  Sistema de Gestión
                </h2>
              </div>
              <p className="text-sm text-[#F2D3BD]/70 animate-fadeIn animation-delay-200">
                Ingresa tus credenciales para continuar
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="animate-fadeInUp animation-delay-300">
                <label className="block text-sm font-medium text-[#F08772] mb-2 flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  Correo Electrónico
                </label>
                <div className="relative group">
                  <input
                    {...register('email')}
                    type="email"
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full px-4 py-3 pl-12 bg-black/50 border border-[#F08772]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E67F47] focus:border-transparent transition-all duration-300 text-white placeholder-[#F2D3BD]/50 group-hover:border-[#F08772]/50"
                    placeholder="Email"
                    autoComplete="email"
                  />
                  <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${
                    focusedField === 'email' ? 'text-[#E67F47]' : 'text-[#F2D3BD]/50'
                  }`} />
                  {focusedField === 'email' && (
                    <div className="absolute inset-0 bg-[#E67F47]/10 rounded-xl pointer-events-none animate-pulse-once"></div>
                  )}
                </div>
                {errors.email && (
                  <p className="mt-2 text-sm text-[#F08772] flex items-center animate-shake">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="animate-fadeInUp animation-delay-400">
                <label className="block text-sm font-medium text-[#F08772] mb-2 flex items-center">
                  <Lock className="w-4 h-4 mr-2" />
                  Contraseña
                </label>
                <div className="relative group">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full px-4 py-3 pl-12 pr-12 bg-black/50 border border-[#F08772]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E67F47] focus:border-transparent transition-all duration-300 text-white placeholder-[#F2D3BD]/50 group-hover:border-[#F08772]/50"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${
                    focusedField === 'password' ? 'text-[#E67F47]' : 'text-[#F2D3BD]/50'
                  }`} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#F2D3BD]/50 hover:text-[#E67F47] transition-colors duration-300"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                  {focusedField === 'password' && (
                    <div className="absolute inset-0 bg-[#E67F47]/10 rounded-xl pointer-events-none animate-pulse-once"></div>
                  )}
                </div>
                {errors.password && (
                  <p className="mt-2 text-sm text-[#F08772] flex items-center animate-shake">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full relative overflow-hidden bg-gradient-to-r from-[#F08772] to-[#E67F47] text-white py-3 px-4 rounded-xl font-bold hover:shadow-lg hover:shadow-[#E67F47]/50 focus:outline-none focus:ring-2 focus:ring-[#E67F47] focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center transform hover:scale-[1.02] active:scale-[0.98] animate-fadeInUp animation-delay-500 group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#E67F47] to-[#F08772] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="relative z-10 flex items-center">
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Iniciando sesión...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5 mr-2 group-hover:animate-bounce-once" />
                      Iniciar Sesión
                    </>
                  )}
                </span>
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-[#F08772]/20 animate-fadeIn animation-delay-600">
              <div className="text-center">
                <p className="text-sm text-[#F2D3BD]/70 mb-4">¿No tienes cuenta?</p>
                <button 
                  onClick={() => navigate('/')}
                  className="text-[#F08772] hover:text-[#E67F47] font-medium text-sm transition-all duration-300 hover:underline underline-offset-4 decoration-2 decoration-[#E67F47]/50"
                >
                  Contacta al administrador para obtener acceso
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center animate-fadeIn animation-delay-700">
          <p className="text-xs text-[#F2D3BD]/40">
            <strong className="text-[#F08772]/60">CLX Group</strong> © {new Date().getFullYear()}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          10%, 30%, 50%, 70%, 90% {
            transform: translateX(-2px);
          }
          20%, 40%, 60%, 80% {
            transform: translateX(2px);
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.5;
          }
          50% {
            opacity: 0.8;
          }
        }
        
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        
        @keyframes bounce-once {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        
        @keyframes pulse-once {
          0% {
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
        }
        
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
        }
        
        .animate-fadeInDown {
          animation: fadeInDown 0.6s ease-out forwards;
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
        
        .animate-bounce-once {
          animation: bounce-once 0.5s ease-in-out;
        }
        
        .animate-pulse-once {
          animation: pulse-once 0.6s ease-out;
        }
        
        .animation-delay-200 {
          animation-delay: 0.2s;
        }
        
        .animation-delay-300 {
          animation-delay: 0.3s;
        }
        
        .animation-delay-400 {
          animation-delay: 0.4s;
        }
        
        .animation-delay-500 {
          animation-delay: 0.5s;
        }
        
        .animation-delay-600 {
          animation-delay: 0.6s;
        }
        
        .animation-delay-700 {
          animation-delay: 0.7s;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default LoginForm;