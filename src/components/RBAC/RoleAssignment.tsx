import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, User, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface UserData {
  id: string;
  email: string;
  full_name: string;
  roles: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

interface Role {
  id: string;
  name: string;
  description?: string;
}

interface RoleAssignmentProps {
  selectedUserId: string | null;
  onUserChange: (userId: string) => void;
}

const RoleAssignment: React.FC<RoleAssignmentProps> = ({ selectedUserId, onUserChange }) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      const user = users.find(u => u.id === selectedUserId);
      setSelectedUser(user || null);
    }
  }, [selectedUserId, users]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/auth/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Error al cargar usuarios');

      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar usuarios');
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/rbac/roles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Error al cargar roles');

      const data = await response.json();
      setAvailableRoles(data.roles || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar roles');
    }
  };

  const handleAssignRole = async (roleId: string) => {
    if (!selectedUser) return;

    setAssigning(true);
    try {
      const response = await fetch(`/api/rbac/users/${selectedUser.id}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ roleId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al asignar rol');
      }

      toast.success('Rol asignado correctamente');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Error al asignar el rol');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!selectedUser) return;

    if (!confirm('¿Estás seguro de remover este rol del usuario?')) return;

    setAssigning(true);
    try {
      const response = await fetch(`/api/rbac/users/${selectedUser.id}/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al remover rol');
      }

      toast.success('Rol removido correctamente');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Error al remover el rol');
    } finally {
      setAssigning(false);
    }
  };

  const unassignedRoles = availableRoles.filter(
    role => !selectedUser?.roles.some(userRole => userRole.id === role.id)
  );

  return (
    <div className="space-y-6">
      {/* User Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Seleccionar Usuario
        </label>
        <select
          value={selectedUserId || ''}
          onChange={(e) => onUserChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">-- Seleccionar usuario --</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name || user.email} ({user.email})
            </option>
          ))}
        </select>
      </div>

      {selectedUser && (
        <>
          {/* User Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-gray-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedUser.full_name || 'Sin nombre'}
                </h3>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>
            </div>
          </div>

          {/* Current Roles */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-3">
              Roles Actuales ({selectedUser.roles.length})
            </h3>
            {selectedUser.roles.length > 0 ? (
              <div className="space-y-2">
                {selectedUser.roles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center">
                      <Shield className="w-5 h-5 text-orange-600 mr-3" />
                      <div>
                        <p className="font-medium text-gray-900">{role.name}</p>
                        {role.description && (
                          <p className="text-sm text-gray-500">{role.description}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveRole(role.id)}
                      disabled={assigning}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                Este usuario no tiene roles asignados
              </p>
            )}
          </div>

          {/* Available Roles */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-3">
              Roles Disponibles ({unassignedRoles.length})
            </h3>
            {unassignedRoles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {unassignedRoles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-orange-300 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{role.name}</p>
                      {role.description && (
                        <p className="text-sm text-gray-500">{role.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleAssignRole(role.id)}
                      disabled={assigning}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No hay más roles disponibles para asignar
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RoleAssignment;