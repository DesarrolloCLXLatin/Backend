import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import AdminDashboard from './components/Dashboard/AdminDashboard';
import StoreDashboard from './components/Dashboard/StoreDashboard';
import UserDashboard from './components/Dashboard/UserDashboard';
import BossDashboard from './components/Dashboard/BossDashboard.tsx';
import AdministracionDashboard from './components/Dashboard/AdministracionDashboard.tsx';
import RunnerRegistrationForm from './components/Registration/GroupRunnerRegistration/index';
import RunnersList from './components/Runners/RunnersList';
import PaymentManagement from './components/Payments/PaymentManagement';
import InventoryManagement from './components/Inventory/InventoryManagement';
import ReportsManagement from './components/Reports/ReportsManagement';
import EmbeddableForm from './components/Iframe/EmbeddableForm';
import ConcertTicketManagement from './components/Tickets/index.tsx';
import EmbeddableTicketForm from './components/Iframe/EmbeddableTicketForm.tsx';
import IframeTokenAdmin from './components/Iframe/IframeTokenAdmin';
import IframeAnalyticsDashboard from './components/Iframe/IframeAnalyticsDashboard.tsx';
import RBACManagement from './components/RBAC/RBACManagement';
import ExchangeRates from './components/ExchangeRates/ExchangeRates';
import IframeTokenDebugger from './components/Iframe/IframeTokenDebugger.tsx';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: Array<{resource: string, action: string}>;
  requireAll?: boolean; 
  requiredModule?: string;
  fallbackRedirect?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredPermissions,
  requireAll = false,
  requiredModule,
  fallbackRedirect = '/dashboard'
}) => {
  const { user, loading, hasPermission, hasAnyPermission, hasAllPermissions, canAccessModule, getUserModules, getUserRoles } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Si el usuario es admin (tiene system:manage_all), permitir acceso total
  if (hasPermission('system', 'manage_all')) {
    return <>{children}</>;
  }

  let hasModuleAccess = true;
  let hasPermissionAccess = true;
  let accessIssues: string[] = [];

  // Verificar acceso por módulo solo si se especifica
  if (requiredModule) {
    hasModuleAccess = canAccessModule(requiredModule);
    if (!hasModuleAccess) {
      accessIssues.push(`Módulo requerido: ${requiredModule}`);
    }
  }

  // Verificar permisos específicos solo si se especifican
  if (requiredPermissions && requiredPermissions.length > 0) {
    hasPermissionAccess = requireAll 
      ? hasAllPermissions(...requiredPermissions)
      : hasAnyPermission(...requiredPermissions);
    
    if (!hasPermissionAccess) {
      const permissionsList = requiredPermissions
        .map(p => `${p.resource}:${p.action}`)
        .join(', ');
      accessIssues.push(`Permisos requeridos: ${permissionsList}`);
    }
  }

  // El usuario necesita tener acceso tanto al módulo como los permisos
  const hasAccess = hasModuleAccess && hasPermissionAccess;

  if (!hasAccess) {
    const userModules = getUserModules();
    const userRoles = getUserRoles();
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 19c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
            <p className="text-gray-600 mb-4">No tienes los permisos necesarios para acceder a esta página.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Información del Usuario */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Información del Usuario
              </h3>
              <div className="space-y-2 text-sm text-blue-800">
                <div>
                  <span className="font-medium">Email:</span> {user?.email}
                </div>
                <div>
                  <span className="font-medium">Nombre:</span> {user?.full_name || 'No especificado'}
                </div>
                <div>
                  <span className="font-medium">ID:</span> {user?.id}
                </div>
                <div>
                  <span className="font-medium">Roles:</span> 
                  <div className="mt-1">
                    {userRoles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {userRoles.map((role, index) => (
                          <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                            {role}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">Sin roles asignados</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Módulos Disponibles */}
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="font-medium text-green-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Módulos Disponibles ({userModules.length})
              </h3>
              <div className="text-sm text-green-800">
                {userModules.length > 0 ? (
                  <div className="space-y-1">
                    {userModules.map((module, index) => (
                      <div key={index} className="flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        <span className="font-mono text-xs">{module}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <span className="text-gray-500 italic">Sin módulos asignados</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Requisitos Faltantes */}
          {accessIssues.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
              <h3 className="font-medium text-red-900 mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 19c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Requisitos Faltantes
              </h3>
              <ul className="text-sm text-red-800 space-y-2">
                {accessIssues.map((issue, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-red-500 mr-2 font-bold">•</span>
                    <span className="font-mono text-xs bg-red-100 px-2 py-1 rounded">{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Información de Debug */}
          <div className="mb-6 p-3 bg-gray-50 rounded-lg border">
            <h3 className="font-medium text-gray-900 mb-2 text-sm flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Información de Debug
            </h3>
            <div className="text-xs text-gray-600 space-y-1">
              <div><span className="font-medium">URL solicitada:</span> {window.location.pathname}</div>
              <div><span className="font-medium">Módulo requerido:</span> {requiredModule || 'Ninguno'}</div>
              <div><span className="font-medium">Permisos requeridos:</span> {requiredPermissions?.map(p => `${p.resource}:${p.action}`).join(', ') || 'Ninguno'}</div>
              <div><span className="font-medium">Tipo de verificación:</span> {requireAll ? 'Todos los permisos (AND)' : 'Cualquier permiso (OR)'}</div>
              <div><span className="font-medium">Es admin:</span> {hasPermission('system', 'manage_all') ? 'Sí' : 'No'}</div>
            </div>
          </div>
          
          {/* Acciones */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => window.location.href = fallbackRedirect}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                Volver al Dashboard
              </button>
              
              <button 
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Recargar Página
              </button>
            </div>
            
            <div className="text-center">
              <button
                onClick={() => {
                  const debugInfo = {
                    user: {
                      id: user?.id,
                      email: user?.email,
                      full_name: user?.full_name,
                      roles: userRoles,
                      modules: userModules,
                      permissions: user?.permissions
                    },
                    request: {
                      url: window.location.pathname,
                      requiredModule,
                      requiredPermissions,
                      requireAll
                    },
                    accessIssues
                  };
                  navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
                  alert('Información de debug copiada al portapapeles');
                }}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Copiar información de debug
              </button>
            </div>
            
            <p className="text-xs text-gray-500 text-center">
              Si crees que deberías tener acceso, contacta al administrador del sistema con la información de debug.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { user, hasPermission, canAccessModule } = useAuth();

  if (!user) return null;

  // Determinar qué dashboard mostrar basado en permisos Y módulos
  if (hasPermission('dashboard', 'view_admin') || canAccessModule('admin_dashboard')) {
    return <AdminDashboard />;
  } else if (hasPermission('dashboard', 'view_boss') || canAccessModule('boss_dashboard')) {
    return <BossDashboard />;
  } else if (hasPermission('dashboard', 'view_reports') || canAccessModule('reports')) {
    return <AdministracionDashboard />;
  } else if (hasPermission('dashboard', 'view_store') || canAccessModule('store_dashboard')) {
    return <StoreDashboard />;
  } else if (hasPermission('dashboard', 'view_user') || canAccessModule('user_dashboard')) {
    return <UserDashboard />;
  }

  // Fallback por compatibilidad con roles legacy
  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'boss':
      return <BossDashboard />;
    case 'administracion':
      return <AdministracionDashboard />;
    case 'tienda':
      return <StoreDashboard />;
    case 'user':
    case 'usuario':
      return <UserDashboard />;
    default:
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard no disponible</h2>
          <p className="text-gray-600 mb-4">No se encontró un dashboard para tu perfil.</p>
          <p className="text-sm text-gray-500">
            Contacta al administrador para que te asigne los módulos correspondientes.
          </p>
        </div>
      );
  }
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#4ade80',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 4000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
          
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/embed" element={<EmbeddableForm />} />
            <Route path="/embed-tickets" element={<EmbeddableTicketForm />} />
            
            {/* iFrame Public Routes for External Sites */}
            <Route path="/iframe/ticket-purchase" element={<EmbeddableTicketForm />} />
            <Route path="/iframe/runner-registration" element={<EmbeddableForm />} />
            
            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Dashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/register-runner"
              element={
                <ProtectedRoute 
                  requiredPermissions={[
                    { resource: 'runners', action: 'create' },
                    { resource: 'runners', action: 'register_group' },
                    { resource: 'runners', action: 'view_own' }
                  ]}
                  requiredModule="registration_management"
                >
                  <DashboardLayout>
                    <RunnerRegistrationForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/runners"
              element={
                <ProtectedRoute 
                  requiredPermissions={[
                    { resource: 'runners', action: 'read' },
                    { resource: 'runners', action: 'manage' }
                  ]}
                  requiredModule="runners_management"
                >
                  <DashboardLayout>
                    <RunnersList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/payments"
              element={
                <ProtectedRoute 
                  requiredPermissions={[
                    { resource: 'payments', action: 'read' },
                    { resource: 'payments', action: 'manage' },
                    { resource: 'payments', action: 'confirm' }
                  ]}
                  requiredModule="payment_management"
                >
                  <DashboardLayout>
                    <PaymentManagement />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/inventory"
              element={
                <ProtectedRoute 
                  requiredPermissions={[
                    { resource: 'inventory', action: 'manage' },
                    { resource: 'inventory', action: 'update' }
                  ]}
                  requiredModule="inventory_management"
                >
                  <DashboardLayout>
                    <InventoryManagement />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/reports"
              element={
                <ProtectedRoute 
                  requiredPermissions={[
                    { resource: 'dashboard', action: 'view_reports' },
                    { resource: 'dashboard', action: 'view_admin' },
                    { resource: 'dashboard', action: 'view_boss' }
                  ]}
                  requiredModule="reports"
                >
                  <DashboardLayout>
                    <ReportsManagement />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/concert-tickets"
              element={
                <ProtectedRoute 
                  requiredPermissions={[
                    { resource: 'tickets', action: 'manage' },
                    { resource: 'tickets', action: 'sell' },
                    { resource: 'tickets', action: 'read' },
                  ]}
                  requiredModule="ticket_management"
                >
                  <DashboardLayout>
                    <ConcertTicketManagement />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/my-registration"
              element={
                <ProtectedRoute 
                  requiredPermissions={[
                    { resource: 'runners', action: 'view_own' }
                  ]}
                  requiredModule="user_dashboard"
                >
                  <DashboardLayout>
                    <UserDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/iframe-tokens"
              element={
                <ProtectedRoute 
                  requiredPermissions={[
                    { resource: 'tickets', action: 'manage' },
                    { resource: 'tickets', action: 'sell' }
                  ]}
                  requiredModule="iframe_management"
                >
                  <DashboardLayout>
                    <IframeTokenAdmin />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/iframe-analytics"
              element={
                <ProtectedRoute 
                  requiredPermissions={[
                    { resource: 'tickets', action: 'manage' }
                  ]}
                  requiredModule="iframe_analytics"
                >
                  <DashboardLayout>
                    <IframeAnalyticsDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/rbac"
              element={
                <ProtectedRoute 
                  requiredPermissions={[
                    { resource: 'system', action: 'manage_all' },
                    { resource: 'users', action: 'manage' }
                  ]}
                  requireAll={false}
                  requiredModule="rbac_management"
                >
                  <DashboardLayout>
                    <RBACManagement />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/exchange-rates"
              element={
                <ProtectedRoute 
                  requiredPermissions={[
                    { resource: 'payments', action: 'manage' },
                    { resource: 'dashboard', action: 'view_reports' }
                  ]}
                  requireAll={false}
                  requiredModule="exchange_rates"
                >
                  <DashboardLayout>
                    <ExchangeRates />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/iframe-debugger" element={<IframeTokenDebugger />} />
            
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" />} />
            
            {/* 404 Route */}
            <Route 
              path="*" 
              element={
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                  <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.908-4.29-4.29 0-.154.013-.306.04-.456m4.25.456c0-2.382-1.908-4.29-4.29-4.29-2.382 0-4.29 1.908-4.29 4.29m0 0A7.962 7.962 0 004 12H0l3.343-3.657A7.963 7.963 0 0112 0a7.963 7.963 0 018.657 3.343L24 7H20a7.963 7.963 0 01-8 5z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Página no encontrada</h2>
                    <p className="text-gray-600 mb-4">La página que buscas no existe.</p>
                    <button 
                      onClick={() => window.location.href = '/dashboard'}
                      className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      Volver al Dashboard
                    </button>
                  </div>
                </div>
              } 
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;