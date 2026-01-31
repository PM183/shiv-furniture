'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Building } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';
import { Input, Textarea, Select } from '@/components/ui/FormFields';

interface AnalyticalAccount {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parent: { code: string; name: string } | null;
  _count: { budgets: number; products: number };
}

export default function AnalyticalAccountsPage() {
  const [accounts, setAccounts] = useState<AnalyticalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AnalyticalAccount | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    parentId: '',
  });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytical-accounts');
      const data = await res.json();
      setAccounts(data.analyticalAccounts);
    } catch (error) {
      toast.error('Failed to fetch cost centers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingAccount 
        ? `/api/analytical-accounts/${editingAccount.id}` 
        : '/api/analytical-accounts';
      const method = editingAccount ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          parentId: formData.parentId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success(editingAccount ? 'Cost center updated' : 'Cost center created');
      setIsModalOpen(false);
      resetForm();
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cost center?')) return;
    
    try {
      const res = await fetch(`/api/analytical-accounts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Cost center deleted');
      fetchAccounts();
    } catch (error) {
      toast.error('Failed to delete cost center');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      parentId: '',
    });
    setEditingAccount(null);
  };

  const openEditModal = (account: AnalyticalAccount) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      description: account.description || '',
      parentId: account.parentId || '',
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cost Centers</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage analytical accounts for budget tracking</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Cost Center
        </button>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <LoadingSpinner />
      ) : accounts.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            title="No cost centers found"
            description="Create cost centers to track budgets and expenses."
            action={
              <button onClick={() => setIsModalOpen(true)} className="btn-primary">
                Add Cost Center
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <div key={account.id} className="card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
                  <Building className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(account)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(account.id)}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <h3 className="font-semibold text-gray-900 dark:text-white">{account.name}</h3>
              <p className="text-sm text-primary-600 font-medium">{account.code}</p>
              {account.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{account.description}</p>
              )}
              
              {account.parent && (
                <p className="text-xs text-gray-400 mt-2">
                  Parent: {account.parent.code} - {account.parent.name}
                </p>
              )}
              
              <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-xs text-gray-500">Budgets</p>
                  <p className="font-semibold">{account._count.budgets}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Products</p>
                  <p className="font-semibold">{account._count.products}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title={editingAccount ? 'Edit Cost Center' : 'Add Cost Center'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Code *"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            placeholder="e.g., PROD"
            required
          />

          <Input
            label="Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Production"
            required
          />

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          <Select
            label="Parent Cost Center"
            value={formData.parentId}
            onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
            options={accounts
              .filter((a) => a.id !== editingAccount?.id)
              .map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {editingAccount ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
