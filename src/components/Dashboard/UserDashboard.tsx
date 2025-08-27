import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  User, 
  Mail, 
  Phone, 
  Shirt, 
  CreditCard, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Users,
  Hash,
  Timer,
  AlertTriangle,
  UserCheck,
  MapPin,
  Trophy
} from 'lucide-react';

interface RunnerDetail {
  id: string;
  full_name: string;
  identification_type: string;
  identification: string;
  birth_date: string;
  gender: 'M' | 'F';
  email: string;
  phone: string;
  shirt_size: string;
  runner_number?: string;
  profile_photo_url?: string;
}

interface GroupData {
  group_id: string;
  group_code: string;
  registrant_email: string;
  registrant_phone: string;
  total_runners: number;
  payment_status: string;
  payment_method: string;
  payment_reference?: string;
  created_at: string;
  reserved_until?: string;
  runners_detail: RunnerDetail[];
}

interface UserDashboardData {
  groups: GroupData[];
  runners: Array<RunnerDetail & {
    group_code: string;
    group_id: string;
    payment_status: string;
    payment_method: string;
    reserved_until?: string;
  }>;
  summary: {
    totalGroups: number;
    totalRunners: number;
    confirmed: number;
    pending: number;
    processing: number;
    withReservation: number;
  };
}

const UserDashboard: React.FC = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<UserDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserDashboard();
  }, []);

  const fetchUserDashboard = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No se encontró token de autenticación');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/dashboard/user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        } else {
          const errorData = await response.json();
          setError(errorData.message || 'Error al cargar tus datos');
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      setDashboardData(data);
      
    } catch (error) {
      console.error('Error fetching user dashboard:', error);
      setError('Error de conexión. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmado':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rechazado':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'procesando':
        return <AlertCircle className="w-5 h-5 text-blue-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rechazado':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'procesando':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'Pago Confirmado';
      case 'rechazado':
        return 'Pago Rechazado';
      case 'procesando':
        return 'Pago en Proceso';
      default:
        return 'Pago Pendiente';
    }
  };

  const getPaymentMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
      'tienda': 'Tienda',
      'zelle': 'Zelle',
      'transferencia_nacional': 'Transferencia Nacional',
      'transferencia_internacional': 'Transferencia Internacional',
      'paypal': 'PayPal',
      'pago_movil_p2c': 'Pago Móvil P2C'
    };
    return labels[method] || method;
  };

  const getTimeUntilReservationExpires = (reservedUntil: string): string => {
    const now = new Date();
    const expiry = new Date(reservedUntil);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expirada';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} día${days > 1 ? 's' : ''}`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        <p className="mt-4 text-gray-600">Cargando tu información...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-medium text-red-800">Error</h3>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchUserDashboard();
            }}
            className="mt-4 w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mi Dashboard</h1>
        <div className="text-sm text-gray-500">
          Bienvenido, {user?.email}
        </div>
      </div>

      {!dashboardData || dashboardData.groups.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No tienes inscripciones registradas
          </h3>
          <p className="text-gray-600 mb-6">
            Para participar en la carrera, debes completar tu registro.
          </p>
          <button 
            onClick={() => window.location.href = '/register-runner'}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
          >
            Registrarme Ahora
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Mis Grupos</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardData.summary.totalGroups}</p>
                </div>
                <Users className="w-8 h-8 text-orange-600 opacity-80" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Corredores</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardData.summary.totalRunners}</p>
                </div>
                <UserCheck className="w-8 h-8 text-blue-600 opacity-80" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Confirmados</p>
                  <p className="text-2xl font-bold text-green-600">{dashboardData.summary.confirmed}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600 opacity-80" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pendientes</p>
                  <p className="text-2xl font-bold text-yellow-600">{dashboardData.summary.pending}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-600 opacity-80" />
              </div>
            </div>
          </div>

          {/* Groups List */}
          {dashboardData.groups.map((group) => (
            <div key={group.group_id} className="bg-white rounded-lg shadow-sm border">
              {/* Group Header */}
              <div className={`px-6 py-4 border-b ${getPaymentStatusColor(group.payment_status)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getPaymentStatusIcon(group.payment_status)}
                    <div>
                      <h3 className="font-semibold text-lg flex items-center">
                        Grupo {group.group_code}
                        <span className="ml-2 text-sm font-normal">
                          ({group.total_runners} {group.total_runners === 1 ? 'corredor' : 'corredores'})
                        </span>
                      </h3>
                      <p className="text-sm mt-1">
                        {getPaymentStatusText(group.payment_status)} - {getPaymentMethodLabel(group.payment_method)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      Registrado el {new Date(group.created_at).toLocaleDateString()}
                    </p>
                    {group.reserved_until && new Date(group.reserved_until) > new Date() && (
                      <div className="mt-1 flex items-center text-sm text-orange-600">
                        <Timer className="w-4 h-4 mr-1" />
                        Reserva expira en: {getTimeUntilReservationExpires(group.reserved_until)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Alert for Pending */}
              {group.payment_status === 'pendiente' && group.reserved_until && (
                <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-100">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium">Pago pendiente de confirmación</p>
                      <p>Tu reserva de inventario expira el {new Date(group.reserved_until).toLocaleString()}. 
                          Asegúrate de completar el pago antes de esta fecha.</p>
                      {group.payment_reference && (
                        <p className="mt-1">Referencia de pago: <span className="font-medium">{group.payment_reference}</span></p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Runners List */}
              <div className="p-6">
                <h4 className="text-sm font-medium text-gray-700 mb-4">Corredores en este grupo:</h4>
                <div className="space-y-4">
                  {group.runners_detail.map((runner, index) => (
                    <div key={runner.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        {runner.profile_photo_url ? (
                          <img
                            src={runner.profile_photo_url}
                            alt={runner.full_name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="w-6 h-6 text-gray-500" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">
                              {index + 1}. {runner.full_name}
                            </h5>
                            <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                              <div className="flex items-center">
                                <Mail className="w-4 h-4 mr-1 text-gray-400" />
                                {runner.email}
                              </div>
                              <div className="flex items-center">
                                <Phone className="w-4 h-4 mr-1 text-gray-400" />
                                {runner.phone}
                              </div>
                              <div className="flex items-center">
                                <User className="w-4 h-4 mr-1 text-gray-400" />
                                {runner.identification_type}-{runner.identification}
                              </div>
                              <div className="flex items-center">
                                <Shirt className="w-4 h-4 mr-1 text-gray-400" />
                                Talla {runner.shirt_size} - {runner.gender === 'M' ? 'Masculino' : 'Femenino'}
                              </div>
                            </div>
                          </div>
                          
                          {runner.runner_number && (
                            <div className="ml-4 text-center">
                              <div className="bg-orange-100 text-orange-800 px-3 py-2 rounded-lg">
                                <Hash className="w-4 h-4 mx-auto mb-1" />
                                <p className="text-lg font-bold">{runner.runner_number}</p>
                                <p className="text-xs">Número</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group Actions */}
              {group.payment_status === 'confirmado' && (
                <div className="px-6 py-4 bg-green-50 border-t border-green-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-green-800">
                      <Trophy className="w-5 h-5 mr-2" />
                      <span className="text-sm font-medium">
                        ¡Inscripción confirmada! Los números de corredor han sido asignados.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Race Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-orange-900 mb-2 flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                Información de la Carrera
              </h3>
              <ul className="space-y-2 text-sm text-orange-800">
                <li>• Fecha: Por confirmar</li>
                <li>• Hora de inicio: Por confirmar</li>
                <li>• Lugar de salida: Por confirmar</li>
                <li>• Distancia: 10K</li>
                <li>• Categorías: General, por edad y género</li>
              </ul>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-900 mb-2 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                Qué hacer el día de la carrera
              </h3>
              <ul className="space-y-2 text-sm text-green-800">
                <li>• Llega al menos 1 hora antes del inicio</li>
                <li>• Trae tu cédula de identidad</li>
                <li>• Recoge tu kit de corredor en el área designada</li>
                <li>• Participa en el calentamiento grupal</li>
                <li>• Hidrátate adecuadamente antes y durante la carrera</li>
              </ul>
            </div>
          </div>

          {/* Payment Instructions */}
          {dashboardData.summary.pending > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Instrucciones de Pago
              </h3>
              <p className="text-sm text-blue-800 mb-3">
                Si tu pago está pendiente, asegúrate de completarlo antes de que expire tu reserva.
              </p>
              <div className="space-y-2 text-sm text-blue-700">
                <p><strong>Zelle:</strong> Envía el pago y el código de tu grupo al correo registrado</p>
                <p><strong>Transferencia:</strong> Incluye el código del grupo en la descripción</p>
                <p><strong>PayPal:</strong> Usa el enlace de pago proporcionado en tu correo</p>
                <p><strong>Pago Móvil P2C:</strong> Completa el pago a través de la plataforma</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserDashboard;