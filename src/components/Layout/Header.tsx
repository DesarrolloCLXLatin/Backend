import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, LogOut, Shield, Store, UserCheck, Users, Briefcase, DollarSign } from 'lucide-react';

const Header: React.FC = () => {
  const { user, logout, getUserRoles } = useAuth();

  // Obtener el rol principal (para compatibilidad) o el primer rol del array
  const getPrimaryRole = () => {
    if (!user) return '';
    
    // Si tiene roles RBAC, usar el primero
    if (user.roles && user.roles.length > 0) {
      return user.roles[0].name;
    }
    
    // Fallback al campo legacy
    return user.role;
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'boss':
        return <Briefcase className="w-4 h-4" />;
      case 'administracion':
        return <DollarSign className="w-4 h-4" />;
      case 'tienda':
      case 'store':
        return <Store className="w-4 h-4" />;
      case 'user':
      case 'usuario':
        return <UserCheck className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'boss':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'administracion':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'tienda':
      case 'store':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'user':
      case 'usuario':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getRoleDisplayName = (role: string) => {
    const roleNames: Record<string, string> = {
      'admin': 'MASTER',
      'boss': 'RRHH',
      'administracion': 'Administración',
      'tienda': 'Tienda',
      'store': 'Tienda',
      'user': 'Usuario',
      'usuario': 'Usuario'
    };
    return roleNames[role] || role;
  };

  const userRoles = getUserRoles();
  const primaryRole = getPrimaryRole();

  return (
    <header className="bg-black shadow-md rounded-b-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-end h-20">
          
          {/* Logo centrado con posicionamiento absoluto */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <img
              src="/clxrun.png"
              alt='Logo'
              className="h-16 w-auto"
            />
          </div>
          
          {/* Información del usuario */}
          {user && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-orange-400" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-100">
                      {user.name || user.email}
                    </span>
                    {user.name && (
                      <span className="text-xs text-gray-400">
                        {user.email}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Mostrar roles */}
                <div className="flex items-center space-x-2">
                  {userRoles.length > 1 ? (
                    // Si tiene múltiples roles, mostrarlos en un dropdown o lista
                    <div className="relative group">
                      <button className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 border ${getRoleColor(primaryRole)}`}>
                        {getRoleIcon(primaryRole)}
                        <span>{getRoleDisplayName(primaryRole)}</span>
                        {userRoles.length > 1 && (
                          <span className="ml-1 text-[10px]">+{userRoles.length - 1}</span>
                        )}
                      </button>
                      
                      {/* Dropdown de roles */}
                      <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <div className="py-1">
                          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                            Roles asignados
                          </div>
                          {userRoles.map((role, index) => (
                            <div
                              key={index}
                              className="px-3 py-2 flex items-center space-x-2 hover:bg-gray-50"
                            >
                              {getRoleIcon(role)}
                              <span className="text-sm text-gray-700">
                                {getRoleDisplayName(role)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Si tiene un solo rol, mostrar badge simple
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 border ${getRoleColor(primaryRole)}`}>
                      {getRoleIcon(primaryRole)}
                      <span>{getRoleDisplayName(primaryRole)}</span>
                    </span>
                  )}
                </div>
              </div>
              
              {/* Botón de cerrar sesión */}
              <button
                onClick={logout}
                className="flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium bg-orange-600 bg-opacity-20 hover:bg-opacity-30 transition-all duration-200 group"
              >
                <LogOut className="w-4 h-4 text-orange-400 group-hover:text-orange-300" />
                <span className='text-orange-400 group-hover:text-orange-300'>Salir</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;