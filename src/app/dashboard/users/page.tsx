'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Shield,
  User as UserIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'CUSTOMER';
  isActive: boolean;
  contactId: string | null;
  contact?: {
    id: string;
    name: string;
    code: string;
  } | null;
  createdAt: string;
}

interface Contact {
  id: string;
  code: string;
  name: string;
  type: string;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'CUSTOMER' as 'ADMIN' | 'CUSTOMER',
    contactId: '',
  });

  // Fetch users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  // Fetch contacts for customer linking
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['contacts-customers'],
    queryFn: async () => {
      const res = await fetch('/api/contacts?type=CUSTOMER');
      if (!res.ok) throw new Error('Failed to fetch contacts');
      const data = await res.json();
      return data.contacts || [];
    },
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully');
      handleCloseModal();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully');
      handleCloseModal();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deactivated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'CUSTOMER',
      contactId: '',
    });
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      contactId: user.contactId || '',
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingUser) {
      const updateData: any = {
        email: formData.email,
        name: formData.name,
        role: formData.role,
        contactId: formData.contactId || null,
      };
      if (formData.password) {
        updateData.password = formData.password;
      }
      updateMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      if (!formData.password) {
        toast.error('Password is required for new users');
        return;
      }
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (user: User) => {
    if (confirm(`Are you sure you want to deactivate "${user.name}"?`)) {
      deleteMutation.mutate(user.id);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update user');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`User ${user.isActive ? 'deactivated' : 'activated'} successfully`);
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Manage system users and their access
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        {filteredUsers.length === 0 ? (
          <EmptyState
            title="No users found"
            description="Create a new user to get started"
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Linked Contact</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          user.role === 'ADMIN' 
                            ? 'bg-purple-100 dark:bg-purple-900' 
                            : 'bg-blue-100 dark:bg-blue-900'
                        }`}>
                          {user.role === 'ADMIN' ? (
                            <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          ) : (
                            <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {user.name}
                        </span>
                      </div>
                    </td>
                    <td className="text-gray-600 dark:text-gray-400">{user.email}</td>
                    <td>
                      <span className={`status-badge ${
                        user.role === 'ADMIN'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="text-gray-600 dark:text-gray-400">
                      {user.contact ? `${user.contact.code} - ${user.contact.name}` : '-'}
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={`status-badge cursor-pointer ${
                          user.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        }`}
                      >
                        {user.isActive ? (
                          <span className="flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <UserX className="w-3 h-3" /> Inactive
                          </span>
                        )}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="Deactivate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingUser ? 'Edit User' : 'Add New User'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="form-label">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="form-label">
              Password {editingUser ? '(leave blank to keep current)' : '*'}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="input-field"
              required={!editingUser}
              placeholder={editingUser ? '••••••••' : ''}
            />
          </div>

          <div>
            <label className="form-label">Role *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'CUSTOMER' })}
              className="input-field"
              required
            >
              <option value="CUSTOMER">Customer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          {formData.role === 'CUSTOMER' && (
            <div>
              <label className="form-label">Link to Contact (Optional)</label>
              <select
                value={formData.contactId}
                onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                className="input-field"
              >
                <option value="">-- Select Contact --</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.code} - {contact.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Link this user to a customer contact for portal access
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={handleCloseModal} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingUser
                ? 'Update User'
                : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
