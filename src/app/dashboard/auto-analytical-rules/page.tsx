'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Settings, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';
import { Input, Select, Checkbox } from '@/components/ui/FormFields';

interface AutoAnalyticalRule {
  id: string;
  name: string;
  productCategory: string | null;
  productNameContains: string | null;
  contactId: string | null;
  contact: { name: string } | null;
  analyticalAccountId: string;
  analyticalAccount: { code: string; name: string };
  priority: number;
  isActive: boolean;
}

interface AnalyticalAccount {
  id: string;
  code: string;
  name: string;
}

interface Contact {
  id: string;
  name: string;
  type: string;
}

const PRODUCT_CATEGORIES = [
  { value: '', label: 'Any Category' },
  { value: 'RAW_MATERIAL', label: 'Raw Material' },
  { value: 'FINISHED_GOOD', label: 'Finished Good' },
  { value: 'SERVICE', label: 'Service' },
];

export default function AutoAnalyticalRulesPage() {
  const [rules, setRules] = useState<AutoAnalyticalRule[]>([]);
  const [analyticalAccounts, setAnalyticalAccounts] = useState<AnalyticalAccount[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoAnalyticalRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    productCategory: '',
    productNameContains: '',
    contactId: '',
    analyticalAccountId: '',
    priority: '10',
    isActive: true,
  });

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auto-analytical-rules');
      const data = await res.json();
      setRules(data.rules);
    } catch (error) {
      toast.error('Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalyticalAccounts = async () => {
    try {
      const res = await fetch('/api/analytical-accounts');
      const data = await res.json();
      setAnalyticalAccounts(data.analyticalAccounts);
    } catch (error) {
      console.error('Failed to fetch cost centers');
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts?type=vendor');
      const data = await res.json();
      setContacts(data.contacts);
    } catch (error) {
      console.error('Failed to fetch contacts');
    }
  };

  useEffect(() => {
    fetchRules();
    fetchAnalyticalAccounts();
    fetchContacts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingRule 
        ? `/api/auto-analytical-rules/${editingRule.id}` 
        : '/api/auto-analytical-rules';
      const method = editingRule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          productCategory: formData.productCategory || null,
          productNameContains: formData.productNameContains || null,
          contactId: formData.contactId || null,
          analyticalAccountId: formData.analyticalAccountId,
          priority: parseInt(formData.priority),
          isActive: formData.isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success(editingRule ? 'Rule updated' : 'Rule created');
      setIsModalOpen(false);
      resetForm();
      fetchRules();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      const res = await fetch(`/api/auto-analytical-rules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Rule deleted');
      fetchRules();
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  const toggleActive = async (rule: AutoAnalyticalRule) => {
    try {
      const res = await fetch(`/api/auto-analytical-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rule,
          isActive: !rule.isActive,
        }),
      });

      if (!res.ok) throw new Error('Failed to update');
      toast.success(`Rule ${rule.isActive ? 'disabled' : 'enabled'}`);
      fetchRules();
    } catch (error) {
      toast.error('Failed to update rule');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      productCategory: '',
      productNameContains: '',
      contactId: '',
      analyticalAccountId: '',
      priority: '10',
      isActive: true,
    });
    setEditingRule(null);
  };

  const openEditModal = (rule: AutoAnalyticalRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      productCategory: rule.productCategory || '',
      productNameContains: rule.productNameContains || '',
      contactId: rule.contactId || '',
      analyticalAccountId: rule.analyticalAccountId,
      priority: rule.priority.toString(),
      isActive: rule.isActive,
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Auto Analytical Rules</h1>
          <p className="text-gray-500 dark:text-gray-400">Configure automatic cost center assignment rules</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-800 dark:text-blue-200">How Auto Analytical Rules Work</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Rules are evaluated by priority (lower number = higher priority). When adding line items to transactions, 
              the system automatically assigns the cost center based on matching rules. Rules can match by product category, 
              product name pattern, or vendor.
            </p>
          </div>
        </div>
      </div>

      {/* Rules Table */}
      {loading ? (
        <LoadingSpinner />
      ) : rules.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            title="No rules configured"
            description="Create auto-analytical rules to automatically assign cost centers to transactions."
            action={
              <button onClick={() => setIsModalOpen(true)} className="btn-primary">
                Add Rule
              </button>
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Name</th>
                <th>Conditions</th>
                <th>Assign To</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full font-semibold text-sm">
                      {rule.priority}
                    </span>
                  </td>
                  <td className="font-medium text-gray-900 dark:text-white">{rule.name}</td>
                  <td>
                    <div className="space-y-1 text-sm">
                      {rule.productCategory && (
                        <span className="inline-block bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 rounded mr-2">
                          Category: {PRODUCT_CATEGORIES.find(c => c.value === rule.productCategory)?.label}
                        </span>
                      )}
                      {rule.productNameContains && (
                        <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded mr-2">
                          Name contains: {rule.productNameContains}
                        </span>
                      )}
                      {rule.contact && (
                        <span className="inline-block bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-2 py-1 rounded">
                          Vendor: {rule.contact.name}
                        </span>
                      )}
                      {!rule.productCategory && !rule.productNameContains && !rule.contact && (
                        <span className="text-gray-400">No conditions (matches all)</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="inline-block bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded text-sm font-medium">
                      {rule.analyticalAccount.code} - {rule.analyticalAccount.name}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => toggleActive(rule)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        rule.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(rule)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600"
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

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title={editingRule ? 'Edit Rule' : 'Add Rule'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Rule Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Raw Materials to Production"
            required
          />

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Conditions (Match any):</h4>
            
            <Select
              label="Product Category"
              value={formData.productCategory}
              onChange={(e) => setFormData({ ...formData, productCategory: e.target.value })}
              options={PRODUCT_CATEGORIES}
            />

            <Input
              label="Product Name Contains"
              value={formData.productNameContains}
              onChange={(e) => setFormData({ ...formData, productNameContains: e.target.value })}
              placeholder="e.g., Wood, Metal"
            />

            <Select
              label="Vendor"
              value={formData.contactId}
              onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
              options={[
                { value: '', label: 'Any Vendor' },
                ...contacts.map((c) => ({ value: c.id, label: c.name }))
              ]}
            />
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Assignment:</h4>
            
            <Select
              label="Assign to Cost Center *"
              value={formData.analyticalAccountId}
              onChange={(e) => setFormData({ ...formData, analyticalAccountId: e.target.value })}
              options={analyticalAccounts.map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Priority"
              type="number"
              min="1"
              max="100"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              hint="Lower number = higher priority"
            />
            
            <div className="flex items-center pt-6">
              <Checkbox
                label="Active"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
            </div>
          </div>

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
              {editingRule ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
