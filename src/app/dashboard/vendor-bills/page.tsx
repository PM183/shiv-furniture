'use client';

import { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, Receipt, Check, X, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';
import { Input, Select, Textarea } from '@/components/ui/FormFields';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';

interface VendorBillLine {
  id?: string;
  productId: string;
  product?: { name: string };
  description: string;
  quantity: number;
  unitPrice: string;
  total: string;
  analyticalAccountId: string | null;
  analyticalAccount?: { code: string; name: string } | null;
}

interface VendorBill {
  id: string;
  billNumber: string;
  vendorId: string;
  vendor: { name: string };
  purchaseOrderId: string | null;
  purchaseOrder?: { orderNumber: string } | null;
  billDate: string;
  dueDate: string;
  status: string;
  notes: string | null;
  subtotal: string;
  taxAmount: string;
  total: string;
  paidAmount: string;
  lines: VendorBillLine[];
}

interface Contact {
  id: string;
  name: string;
}

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  vendorId: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  purchasePrice: string;
  analyticalAccountId: string | null;
}

interface AnalyticalAccount {
  id: string;
  code: string;
  name: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'gray' },
  POSTED: { label: 'Posted', color: 'blue' },
  PARTIALLY_PAID: { label: 'Partially Paid', color: 'yellow' },
  PAID: { label: 'Paid', color: 'green' },
  CANCELLED: { label: 'Cancelled', color: 'red' },
};

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

export default function VendorBillsPage() {
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [vendors, setVendors] = useState<Contact[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [analyticalAccounts, setAnalyticalAccounts] = useState<AnalyticalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<VendorBill | null>(null);
  const [viewingBill, setViewingBill] = useState<VendorBill | null>(null);

  const [formData, setFormData] = useState({
    vendorId: '',
    purchaseOrderId: '',
    billDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    lines: [{ productId: '', description: '', quantity: 1, unitPrice: '', analyticalAccountId: '' }],
  });

  const fetchBills = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '10' });
      if (statusFilter) params.append('status', statusFilter);
      
      const res = await fetch(`/api/vendor-bills?${params}`);
      const data = await res.json();
      setBills(data.bills);
      setTotal(data.pagination.total);
    } catch (error) {
      toast.error('Failed to fetch vendor bills');
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const [vendorsRes, productsRes, analyticalRes, poRes] = await Promise.all([
        fetch('/api/contacts?type=vendor'),
        fetch('/api/products'),
        fetch('/api/analytical-accounts'),
        fetch('/api/purchase-orders?status=CONFIRMED'),
      ]);
      
      const vendorsData = await vendorsRes.json();
      const productsData = await productsRes.json();
      const analyticalData = await analyticalRes.json();
      const poData = await poRes.json();
      
      setVendors(vendorsData.contacts);
      setProducts(productsData.products);
      setAnalyticalAccounts(analyticalData.analyticalAccounts);
      setPurchaseOrders(poData.orders || []);
    } catch (error) {
      console.error('Failed to fetch dropdown data');
    }
  };

  useEffect(() => {
    fetchBills();
  }, [page, statusFilter]);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validLines = formData.lines.filter(l => l.productId && l.quantity && l.unitPrice);
    if (validLines.length === 0) {
      toast.error('Add at least one line item');
      return;
    }

    try {
      const url = editingBill 
        ? `/api/vendor-bills/${editingBill.id}` 
        : '/api/vendor-bills';
      const method = editingBill ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: formData.vendorId,
          purchaseOrderId: formData.purchaseOrderId || null,
          billDate: formData.billDate,
          dueDate: formData.dueDate,
          notes: formData.notes || null,
          lines: validLines.map(l => ({
            productId: l.productId,
            description: l.description,
            quantity: parseFloat(l.quantity.toString()),
            unitPrice: parseFloat(l.unitPrice),
            analyticalAccountId: l.analyticalAccountId || null,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success(editingBill ? 'Vendor bill updated' : 'Vendor bill created');
      setIsModalOpen(false);
      resetForm();
      fetchBills();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleStatusChange = async (billId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/vendor-bills/${billId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');
      toast.success('Status updated');
      fetchBills();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vendor bill?')) return;
    
    try {
      const res = await fetch(`/api/vendor-bills/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Vendor bill deleted');
      fetchBills();
    } catch (error) {
      toast.error('Failed to delete vendor bill');
    }
  };

  const resetForm = () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    
    setFormData({
      vendorId: '',
      purchaseOrderId: '',
      billDate: new Date().toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      notes: '',
      lines: [{ productId: '', description: '', quantity: 1, unitPrice: '', analyticalAccountId: '' }],
    });
    setEditingBill(null);
  };

  const openEditModal = (bill: VendorBill) => {
    setEditingBill(bill);
    setFormData({
      vendorId: bill.vendorId,
      purchaseOrderId: bill.purchaseOrderId || '',
      billDate: bill.billDate.split('T')[0],
      dueDate: bill.dueDate.split('T')[0],
      notes: bill.notes || '',
      lines: bill.lines.map(l => ({
        productId: l.productId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        analyticalAccountId: l.analyticalAccountId || '',
      })),
    });
    setIsModalOpen(true);
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { productId: '', description: '', quantity: 1, unitPrice: '', analyticalAccountId: '' }],
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length === 1) return;
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index),
    });
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    if (field === 'productId' && value) {
      const product = products.find(p => p.id === value);
      if (product) {
        newLines[index].description = product.name;
        newLines[index].unitPrice = product.purchasePrice;
        newLines[index].analyticalAccountId = product.analyticalAccountId || '';
      }
    }
    
    setFormData({ ...formData, lines: newLines });
  };

  const calculateTotal = () => {
    return formData.lines.reduce((sum, line) => {
      const qty = parseFloat(line.quantity.toString()) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      return sum + (qty * price);
    }, 0);
  };

  const filteredPurchaseOrders = purchaseOrders.filter(
    po => !formData.vendorId || po.vendorId === formData.vendorId
  );

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendor Bills</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage bills from vendors</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Vendor Bill
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input-field w-40"
          >
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Bills Table */}
      {loading ? (
        <LoadingSpinner />
      ) : bills.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            title="No vendor bills"
            description="Create your first vendor bill to track expenses."
            action={
              <button onClick={() => setIsModalOpen(true)} className="btn-primary">
                New Vendor Bill
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Vendor</th>
                  <th>Bill Date</th>
                  <th>Due Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id}>
                    <td>
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{bill.billNumber}</span>
                        {bill.purchaseOrder && (
                          <p className="text-xs text-gray-500">PO: {bill.purchaseOrder.orderNumber}</p>
                        )}
                      </div>
                    </td>
                    <td>{bill.vendor.name}</td>
                    <td>{formatDate(bill.billDate)}</td>
                    <td>{formatDate(bill.dueDate)}</td>
                    <td className="font-semibold">{formatCurrency(bill.total)}</td>
                    <td>{formatCurrency(bill.paidAmount)}</td>
                    <td>
                      <StatusBadge status={bill.status} config={STATUS_CONFIG} />
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setViewingBill(bill); setIsViewModalOpen(true); }}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {bill.status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => openEditModal(bill)}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(bill.id, 'POSTED')}
                              className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900 rounded text-green-600"
                              title="Post Bill"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {(bill.status === 'POSTED' || bill.status === 'PARTIALLY_PAID') && (
                          <a
                            href={`/dashboard/payments?type=outbound&billId=${bill.id}`}
                            className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900 rounded text-blue-600"
                            title="Record Payment"
                          >
                            <CreditCard className="w-4 h-4" />
                          </a>
                        )}
                        {bill.status === 'DRAFT' && (
                          <button
                            onClick={() => handleDelete(bill.id)}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(total / 10)}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title={editingBill ? 'Edit Vendor Bill' : 'New Vendor Bill'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Vendor *"
              value={formData.vendorId}
              onChange={(e) => setFormData({ ...formData, vendorId: e.target.value, purchaseOrderId: '' })}
              options={vendors.map((v) => ({ value: v.id, label: v.name }))}
              required
            />
            <Select
              label="Link to Purchase Order"
              value={formData.purchaseOrderId}
              onChange={(e) => setFormData({ ...formData, purchaseOrderId: e.target.value })}
              options={[
                { value: '', label: 'None' },
                ...filteredPurchaseOrders.map((po) => ({ value: po.id, label: po.orderNumber }))
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Bill Date *"
              type="date"
              value={formData.billDate}
              onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
              required
            />
            <Input
              label="Due Date *"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              required
            />
          </div>

          {/* Line Items */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Line Items</h4>
              <button type="button" onClick={addLine} className="btn-secondary text-sm py-1">
                <Plus className="w-4 h-4 inline mr-1" />
                Add Line
              </button>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {formData.lines.map((line, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="col-span-3">
                    <select
                      value={line.productId}
                      onChange={(e) => updateLine(index, 'productId', e.target.value)}
                      className="input-field text-sm"
                      required
                    >
                      <option value="">Select Product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                      className="input-field text-sm"
                      placeholder="Qty"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(index, 'unitPrice', e.target.value)}
                      className="input-field text-sm"
                      placeholder="Price"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <span className="block py-2 text-sm font-medium">
                      {formatCurrency((parseFloat(line.quantity.toString()) || 0) * (parseFloat(line.unitPrice) || 0))}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <select
                      value={line.analyticalAccountId}
                      onChange={(e) => updateLine(index, 'analyticalAccountId', e.target.value)}
                      className="input-field text-sm"
                    >
                      <option value="">Cost Center</option>
                      {analyticalAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600"
                      disabled={formData.lines.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-4 text-lg font-bold">
              Total: {formatCurrency(calculateTotal())}
            </div>
          </div>

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
              {editingBill ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Vendor Bill ${viewingBill?.billNumber}`}
        size="lg"
      >
        {viewingBill && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Vendor</p>
                <p className="font-medium">{viewingBill.vendor.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <StatusBadge status={viewingBill.status} config={STATUS_CONFIG} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Bill Date</p>
                <p className="font-medium">{formatDate(viewingBill.billDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Due Date</p>
                <p className="font-medium">{formatDate(viewingBill.dueDate)}</p>
              </div>
              {viewingBill.purchaseOrder && (
                <div>
                  <p className="text-sm text-gray-500">Purchase Order</p>
                  <p className="font-medium">{viewingBill.purchaseOrder.orderNumber}</p>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Line Items</h4>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="text-left p-2">Product</th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-right p-2">Unit Price</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-left p-2">Cost Center</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingBill.lines.map((line, idx) => (
                    <tr key={idx} className="border-b dark:border-gray-700">
                      <td className="p-2">{line.description}</td>
                      <td className="p-2 text-right">{line.quantity}</td>
                      <td className="p-2 text-right">{formatCurrency(line.unitPrice)}</td>
                      <td className="p-2 text-right">{formatCurrency(line.total)}</td>
                      <td className="p-2">{line.analyticalAccount ? `${line.analyticalAccount.code}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="font-bold">
                  <tr>
                    <td colSpan={3} className="p-2 text-right">Total:</td>
                    <td className="p-2 text-right">{formatCurrency(viewingBill.total)}</td>
                    <td></td>
                  </tr>
                  <tr className="text-green-600">
                    <td colSpan={3} className="p-2 text-right">Paid:</td>
                    <td className="p-2 text-right">{formatCurrency(viewingBill.paidAmount)}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="p-2 text-right">Balance:</td>
                    <td className="p-2 text-right">{formatCurrency(parseFloat(viewingBill.total) - parseFloat(viewingBill.paidAmount))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {viewingBill.notes && (
              <div>
                <p className="text-sm text-gray-500">Notes</p>
                <p className="text-sm">{viewingBill.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
