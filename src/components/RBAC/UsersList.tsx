import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Users,
  UserCheck, 
  Search, 
  Edit, 
  Shield, 
  RefreshCw, 
  Mail, 
  Calendar, 
  Trash2, 
  Eye, 
  MoreVertical, 
  AlertTriangle, 
  Package,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Download,
  Filter,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

// Se asume que estos componentes modales existen y funcionan como antes
import UserDetailsModal from './UserDetailsModal';
import EditUserModal from './EditUserModal';

// --- Interfaces y Tipos ---
interface Role {
  id: string;
  name: string;
  display_name?: string;
}

interface UserData {
  id: string;
  email: string;
  full_name: string;
  roles: Role[];
  created_at: string;
  updated_at: string;
  last_login?: string;
  status?: 'active' | 'inactive' | 'suspended';
  modules_count?: number; // Contador de módulos asignados
}

interface UsersListProps {
  onSelectUser: (userId: string) => void;
  onSelectUserForModules?: (userId: string) => void;
  refreshTrigger?: number; // Nuevo prop para forzar refresh
}

// --- Hooks Personalizados ---
const useDebounce = (value: string, delay: number): string => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

const useClickOutside = (ref: React.RefObject<HTMLElement>, callback: () => void) => {
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                callback();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [ref, callback]);
};

// --- Componente de Filtros ---
interface FiltersProps {
  selectedRole: string;
  onRoleChange: (role: string) => void;
  availableRoles: string[];
}

const FiltersSection: React.FC<FiltersProps> = ({ selectedRole, onRoleChange, availableRoles }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
      >
        <Filter className="w-4 h-4 mr-2" />
        Filtros
        {selectedRole && (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            1
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
          <div className="p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                Filtrar por Rol
              </label>
              <select
                value={selectedRole}
                onChange={(e) => onRoleChange(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-orange-500 focus:border-orange-500 rounded-md"
              >
                <option value="">Todos los roles</option>
                {availableRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            
            {selectedRole && (
              <button
                onClick={() => {
                  onRoleChange('');
                  setIsOpen(false);
                }}
                className="w-full text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center py-2 border-t"
              >
                <X className="w-4 h-4 mr-1" />
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Componente de Avatar ---
const UserAvatar: React.FC<{ user: UserData }> = ({ user }) => {
  const getInitials = (name: string, email: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (email: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500'
    ];
    const index = email.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-medium ${getAvatarColor(user.email)}`}>
      {getInitials(user.full_name, user.email)}
    </div>
  );
};

// --- Componente de Fila de Tabla ---
interface UserTableRowProps {
  user: UserData;
  onSelectUser: (userId: string) => void;
  onSelectUserForModules?: (userId: string) => void;
  onViewDetails: (user: UserData) => void;
  onEdit: (user: UserData) => void;
  onDelete: (userId: string) => void;
}

const UserTableRow: React.FC<UserTableRowProps> = ({ 
  user, 
  onSelectUser, 
  onSelectUserForModules,
  onViewDetails, 
  onEdit, 
  onDelete 
}) => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useClickOutside(dropdownRef, () => setDropdownOpen(false));

  // Handler para módulos con validación
  const handleModulesClick = () => {
    if (onSelectUserForModules) {
      onSelectUserForModules(user.id);
    } else {
      toast.error('La gestión de módulos no está disponible');
    }
  };

  const getRoleColor = (roleName: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800 border-red-200',
      boss: 'bg-purple-100 text-purple-800 border-purple-200',
      administracion: 'bg-blue-100 text-blue-800 border-blue-200',
      tienda: 'bg-green-100 text-green-800 border-green-200',
      default: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[roleName.toLowerCase()] || colors.default;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    
    return date.toLocaleDateString('es-VE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <UserAvatar user={user} />
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {user.full_name || 'Sin nombre'}
            </div>
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {user.email}
            </div>
          </div>
        </div>
      </td>
      
      <td className="px-6 py-4">
        <div className="flex flex-wrap gap-1.5">
          {user.roles.length > 0 ? (
            user.roles.map(role => (
              <span 
                key={role.id} 
                className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${getRoleColor(role.name)}`}
              >
                <Shield className="w-3 h-3 mr-1" />
                {role.display_name || role.name}
              </span>
            ))
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Sin rol asignado
            </span>
          )}
        </div>
      </td>
      
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-900">
            {user.modules_count || 0} módulos
          </span>
          {user.modules_count === 0 && (
            <span className="text-xs text-yellow-600">(Sin asignar)</span>
          )}
        </div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{formatDate(user.created_at)}</div>
        <div className="text-xs text-gray-500">Registrado</div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-2">
          {/* Botón de Roles */}
          <button
            onClick={() => onSelectUser(user.id)}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-orange-700 bg-orange-100 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all duration-150"
            title="Gestionar roles del usuario"
          >
            <Shield className="w-3.5 h-3.5 mr-1" />
            Roles
          </button>
          
          {/* Botón de Módulos */}
          <button 
            onClick={handleModulesClick}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all duration-150 relative"
            title="Gestionar módulos del usuario"
          >
            <Package className="w-3.5 h-3.5 mr-1" />
            Módulos
            {user.modules_count && user.modules_count > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-orange-600 rounded-full">
                {user.modules_count}
              </span>
            )}
          </button>
          
          {/* Menú desplegable */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setDropdownOpen(!isDropdownOpen)} 
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              aria-label="Más opciones"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10 border border-gray-200 py-1">
                <button 
                  onClick={() => { onViewDetails(user); setDropdownOpen(false); }} 
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Eye className="w-4 h-4 mr-3 text-gray-400" />
                  Ver Detalles
                </button>
                <button 
                  onClick={() => { onEdit(user); setDropdownOpen(false); }} 
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Edit className="w-4 h-4 mr-3 text-gray-400" />
                  Editar Usuario
                </button>
                <button 
                  onClick={() => { 
                    handleModulesClick();
                    setDropdownOpen(false); 
                  }} 
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Package className="w-4 h-4 mr-3 text-gray-400" />
                  Gestionar Módulos
                  {user.modules_count && user.modules_count > 0 && (
                    <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                      {user.modules_count}
                    </span>
                  )}
                </button>
                <hr className="my-1" />
                <button 
                  onClick={() => { 
                    if (window.confirm(`¿Estás seguro de eliminar al usuario ${user.email}?`)) {
                      onDelete(user.id); 
                    }
                    setDropdownOpen(false); 
                  }} 
                  className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-3" />
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
};

// --- Componente de Paginación ---
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  currentItems: number;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  currentItems
}) => {
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-3 bg-white border-t">
      <div className="text-sm text-gray-700">
        Mostrando <span className="font-medium">{currentItems}</span> de{' '}
        <span className="font-medium">{totalItems}</span> usuarios
      </div>
      
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="flex items-center space-x-1">
          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className="px-3 py-1 text-gray-400">...</span>
              ) : (
                <button
                  onClick={() => onPageChange(page as number)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    currentPage === page
                      ? 'bg-orange-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Página siguiente"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// --- Componente Principal ---
const UsersList: React.FC<UsersListProps> = ({ 
  onSelectUser, 
  onSelectUserForModules, 
  refreshTrigger = 0 
}) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isDetailsModalOpen, setDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const itemsPerPage = 10;
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchUsers = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/auth/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('No se pudo obtener la lista de usuarios.');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
      toast.error(err instanceof Error ? err.message : 'Error al cargar usuarios.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchUsers();
    }
  }, [refreshTrigger, fetchUsers]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchUsers();
  };

  const handleDeleteUser = useCallback(async (userId: string) => {
    const promise = fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).then(response => {
        if (!response.ok) return response.json().then(err => Promise.reject(err));
        return response.json();
    });

    toast.promise(promise, {
        loading: 'Eliminando usuario...',
        success: () => {
            fetchUsers();
            return 'Usuario eliminado correctamente.';
        },
        error: (err) => err.message || 'No se pudo eliminar el usuario.'
    });
  }, [fetchUsers]);

  const availableRoles = useMemo(() => {
    const rolesSet = new Set<string>();
    users.forEach(user => {
      user.roles.forEach(role => {
        rolesSet.add(role.display_name || role.name);
      });
    });
    return Array.from(rolesSet).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    let filtered = users;
    
    // Filtro por búsqueda
    if (debouncedSearchTerm) {
      const lowercasedTerm = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(lowercasedTerm) ||
        user.full_name?.toLowerCase().includes(lowercasedTerm) ||
        user.roles.some(role => role.name.toLowerCase().includes(lowercasedTerm))
      );
    }
    
    // Filtro por rol
    if (selectedRole) {
      filtered = filtered.filter(user =>
        user.roles.some(role => (role.display_name || role.name) === selectedRole)
      );
    }
    
    return filtered;
  }, [users, debouncedSearchTerm, selectedRole]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedRole]);

  // Handlers para Modales
  const handleViewDetails = (user: UserData) => { 
    setSelectedUser(user); 
    setDetailsModalOpen(true); 
  };
  
  const handleEdit = (user: UserData) => { 
    setSelectedUser(user); 
    setEditModalOpen(true); 
  };
  
  const handleCloseModals = () => { 
    setDetailsModalOpen(false); 
    setEditModalOpen(false); 
    setSelectedUser(null); 
  };
  
  const handleEditSuccess = () => { 
    handleCloseModals(); 
    fetchUsers(); 
  };

  const handleExport = () => {
    // Implementación de exportación
    toast.success('Función de exportación en desarrollo');
  };

  const handleAddUser = () => {
    // Implementación para agregar usuario
    toast.success('Función para agregar usuario en desarrollo');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        <p className="text-gray-500">Cargando usuarios...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-600 mb-4" />
          <h3 className="text-lg font-medium text-red-900 mb-2">Error al cargar datos</h3>
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <button 
            onClick={fetchUsers} 
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Gestión de Usuarios
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Administra usuarios, roles y permisos del sistema
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </button>
          
          <button
            onClick={handleAddUser}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Nuevo Usuario
          </button>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o rol..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <FiltersSection
            selectedRole={selectedRole}
            onRoleChange={setSelectedRole}
            availableRoles={availableRoles}
          />
          
          <button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className={`p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            title="Actualizar lista"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Usuarios</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
            <Users className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Usuarios Activos</p>
              <p className="text-2xl font-bold text-green-600">{filteredUsers.length}</p>
            </div>
            <UserCheck className="w-8 h-8 text-green-400" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sin Rol Asignado</p>
              <p className="text-2xl font-bold text-yellow-600">
                {users.filter(u => u.roles.length === 0).length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
      </div>
      
      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Roles
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Módulos
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha de Registro
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedUsers.length > 0 ? (
                paginatedUsers.map(user => (
                  <UserTableRow
                    key={user.id}
                    user={user}
                    onSelectUser={onSelectUser}
                    onSelectUserForModules={onSelectUserForModules}
                    onViewDetails={handleViewDetails}
                    onEdit={handleEdit}
                    onDelete={handleDeleteUser}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <Users className="w-12 h-12 text-gray-300 mb-4" />
                      <p className="text-gray-500 text-sm">
                        {searchTerm || selectedRole 
                          ? 'No se encontraron usuarios con los filtros aplicados.' 
                          : 'No hay usuarios registrados en el sistema.'}
                      </p>
                      {(searchTerm || selectedRole) && (
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setSelectedRole('');
                          }}
                          className="mt-4 text-sm text-orange-600 hover:text-orange-700 font-medium"
                        >
                          Limpiar filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredUsers.length}
            itemsPerPage={itemsPerPage}
            currentItems={paginatedUsers.length}
          />
        )}
      </div>

      {/* Modals */}
      {isDetailsModalOpen && selectedUser && (
        <UserDetailsModal user={selectedUser} onClose={handleCloseModals} />
      )}
      {isEditModalOpen && selectedUser && (
        <EditUserModal 
          user={selectedUser} 
          onClose={handleCloseModals} 
          onSuccess={handleEditSuccess} 
        />
      )}
    </div>
  );
};

export default UsersList;