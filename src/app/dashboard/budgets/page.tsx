'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Wallet, History } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';
import { Input, Textarea, Select } from '@/components/ui/FormFields';

interface Budget {
  id: string;
  name: string;
  analyticalAccountId: string;
  analyticalAccount: { code: string; name: string };
  periodStart: string;
  periodEnd: string;
  amount: string;
  revisedAmount: string | null;
  notes: string | null;
  revisionHistory: Array<{
    previousAmount: string;
    newAmount: string;
    reason: string | null;
    revisedBy: string;
    revisedAt: string;
  }>;
}

interface AnalyticalAccount {
  id: string;
  code: string;
  name: string;
}

const formatCurrency = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [analyticalAccounts, setAnalyticalAccounts] = useState<AnalyticalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    analyticalAccountId: '',
    periodStart: '',
    periodEnd: '',
    amount: '',
    revisedAmount: '',
    revisionReason: '',
    notes: '',
  });

  const years = Array.from({ length: 5 }, (_, i) => {
    const year = new Date().getFullYear() - 2 + i;
    return { value: year.toString(), label: year.toString() };
  });

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/budgets?year=${yearFilter}`);
      const data = await res.json();
      setBudgets(data.budgets);
    } catch (error) {
      toast.error('Failed to fetch budgets');
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

  useEffect(() => {
    fetchBudgets();
    fetchAnalyticalAccounts();
  }, [yearFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingBudget 
        ? `/api/budgets/${editingBudget.id}` 
        : '/api/budgets';
      const method = editingBudget ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          analyticalAccountId: formData.analyticalAccountId,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          amount: parseFloat(formData.amount),
          revisedAmount: formData.revisedAmount ? parseFloat(formData.revisedAmount) : null,
          revisionReason: formData.revisionReason,
          notes: formData.notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success(editingBudget ? 'Budget updated' : 'Budget created');
      setIsModalOpen(false);
      resetForm();
      fetchBudgets();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this budget?')) return;
    
    try {
      const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Budget deleted');
      fetchBudgets();
    } catch (error) {
      toast.error('Failed to delete budget');
    }
  };

  const resetForm = () => {
    const year = parseInt(yearFilter);
    setFormData({
      name: '',
      analyticalAccountId: '',
      periodStart: `${year}-01-01`,
      periodEnd: `${year}-12-31`,
      amount: '',
      revisedAmount: '',
      revisionReason: '',
      notes: '',
    });
    setEditingBudget(null);
  };

  const openEditModal = (budget: Budget) => {
    setEditingBudget(budget);
    setFormData({
      name: budget.name,
      analyticalAccountId: budget.analyticalAccountId,
      periodStart: budget.periodStart.split('T')[0],
      periodEnd: budget.periodEnd.split('T')[0],
      amount: budget.amount,
      revisedAmount: budget.revisedAmount || '',
      revisionReason: '',
      notes: budget.notes || '',
    });
    setIsModalOpen(true);
  };

  const showRevisionHistory = (budget: Budget) => {
    setSelectedBudget(budget);
    setIsHistoryModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Budgets</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage budgets by cost center and period</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Budget
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Year:</label>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="input-field w-32"
          >
            {years.map((y) => (
              <option key={y.value} value={y.value}>{y.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Budget Cards */}
      {loading ? (
        <LoadingSpinner />
      ) : budgets.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            title="No budgets found"
            description={`Create budgets for ${yearFilter} to track expenses.`}
            action={
              <button onClick={() => setIsModalOpen(true)} className="btn-primary">
                Add Budget
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map((budget) => {
            const effectiveAmount = budget.revisedAmount || budget.amount;
            return (
              <div key={budget.id} className="card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    {budget.revisionHistory.length > 0 && (
                      <button
                        onClick={() => showRevisionHistory(budget)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title="View revision history"
                      >
                        <History className="w-4 h-4 text-blue-600" />
                      </button>
                    )}
                    <button
                      onClick={() => openEditModal(budget)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-gray-900 dark:text-white">{budget.name}</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {budget.analyticalAccount.code} - {budget.analyticalAccount.name}
                </p>

                <div className="text-3xl font-bold text-green-600 mb-2">
                  {formatCurrency(effectiveAmount)}
                </div>

                {budget.revisedAmount && (
                  <p className="text-sm text-gray-500">
                    Original: <span className="line-through">{formatCurrency(budget.amount)}</span>
                  </p>
                )}

                <div className="text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p>Period: {formatDate(budget.periodStart)} - {formatDate(budget.periodEnd)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title={editingBudget ? 'Edit Budget' : 'Add Budget'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Budget Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={`e.g., Production Budget ${yearFilter}`}
            required
          />

          <Select
            label="Cost Center *"
            value={formData.analyticalAccountId}
            onChange={(e) => setFormData({ ...formData, analyticalAccountId: e.target.value })}
            options={analyticalAccounts.map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Period Start *"
              type="date"
              value={formData.periodStart}
              onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
              required
            />
            <Input
              label="Period End *"
              type="date"
              value={formData.periodEnd}
              onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Budget Amount *"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
            {editingBudget && (
              <Input
                label="Revised Amount"
                type="number"
                step="0.01"
                value={formData.revisedAmount}
                onChange={(e) => setFormData({ ...formData, revisedAmount: e.target.value })}
              />
            )}
          </div>

          {editingBudget && formData.revisedAmount && (
            <Input
              label="Revision Reason"
              value={formData.revisionReason}
              onChange={(e) => setFormData({ ...formData, revisionReason: e.target.value })}
              placeholder="Reason for budget revision"
            />
          )}

          <Textarea
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
              {editingBudget ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Revision History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Budget Revision History"
      >
        {selectedBudget && (
          <div className="space-y-4">
            <p className="text-gray-500">{selectedBudget.name}</p>
            
            <div className="space-y-3">
              {selectedBudget.revisionHistory.map((revision, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">
                      {formatDate(revision.revisedAt)}
                    </span>
                    <span className="text-sm text-gray-500">
                      By: {revision.revisedBy}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="line-through text-gray-400">
                      {formatCurrency(revision.previousAmount)}
                    </span>
                    <span>→</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(revision.newAmount)}
                    </span>
                  </div>
                  {revision.reason && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      Reason: {revision.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
