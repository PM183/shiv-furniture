'use client';

import { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, FileText, Check, X, CreditCard, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';
import { Input, Select, Textarea } from '@/components/ui/FormFields';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';

interface InvoiceLine {
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

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer: { name: string; email: string };
  salesOrderId: string | null;
  salesOrder?: { orderNumber: string } | null;
  invoiceDate: string;
  dueDate: string;
  status: string;
  notes: string | null;
  subtotal: string;
  taxAmount: string;
  total: string;
  paidAmount: string;
  lines: InvoiceLine[];
}

interface Contact {
  id: string;
  name: string;
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  salePrice: string;
  analyticalAccountId: string | null;
}

interface AnalyticalAccount {
  id: string;
  code: string;
  name: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'gray' },
  SENT: { label: 'Sent', color: 'blue' },
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

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [analyticalAccounts, setAnalyticalAccounts] = useState<AnalyticalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  const [formData, setFormData] = useState({
    customerId: '',
    salesOrderId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    lines: [{ productId: '', description: '', quantity: 1, unitPrice: '', analyticalAccountId: '' }],
  });

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '10' });
      if (statusFilter) params.append('status', statusFilter);
      
      const res = await fetch(`/api/invoices?${params}`);
      const data = await res.json();
      setInvoices(data.invoices);
      setTotal(data.pagination.total);
    } catch (error) {
      toast.error('Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const [customersRes, productsRes, analyticalRes, soRes] = await Promise.all([
        fetch('/api/contacts?type=customer'),
        fetch('/api/products'),
        fetch('/api/analytical-accounts'),
        fetch('/api/sales-orders?status=CONFIRMED'),
      ]);
      
      const customersData = await customersRes.json();
      const productsData = await productsRes.json();
      const analyticalData = await analyticalRes.json();
      const soData = await soRes.json();
      
      setCustomers(customersData.contacts);
      setProducts(productsData.products);
      setAnalyticalAccounts(analyticalData.analyticalAccounts);
      setSalesOrders(soData.orders || []);
    } catch (error) {
      console.error('Failed to fetch dropdown data');
    }
  };

  useEffect(() => {
    fetchInvoices();
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
      const url = editingInvoice 
        ? `/api/invoices/${editingInvoice.id}` 
        : '/api/invoices';
      const method = editingInvoice ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: formData.customerId,
          salesOrderId: formData.salesOrderId || null,
          invoiceDate: formData.invoiceDate,
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

      toast.success(editingInvoice ? 'Invoice updated' : 'Invoice created');
      setIsModalOpen(false);
      resetForm();
      fetchInvoices();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');
      toast.success('Status updated');
      fetchInvoices();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Invoice deleted');
      fetchInvoices();
    } catch (error) {
      toast.error('Failed to delete invoice');
    }
  };

  const resetForm = () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    
    setFormData({
      customerId: '',
      salesOrderId: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      notes: '',
      lines: [{ productId: '', description: '', quantity: 1, unitPrice: '', analyticalAccountId: '' }],
    });
    setEditingInvoice(null);
  };

  const openEditModal = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      customerId: invoice.customerId,
      salesOrderId: invoice.salesOrderId || '',
      invoiceDate: invoice.invoiceDate.split('T')[0],
      dueDate: invoice.dueDate.split('T')[0],
      notes: invoice.notes || '',
      lines: invoice.lines.map(l => ({
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
        newLines[index].unitPrice = product.salePrice;
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

  const filteredSalesOrders = salesOrders.filter(
    so => !formData.customerId || so.customerId === formData.customerId
  );

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage customer invoices</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Invoice
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
            <option value="SENT">Sent</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      {loading ? (
        <LoadingSpinner />
      ) : invoices.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            title="No invoices"
            description="Create your first invoice to start billing customers."
            action={
              <button onClick={() => setIsModalOpen(true)} className="btn-primary">
                New Invoice
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
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{invoice.invoiceNumber}</span>
                        {invoice.salesOrder && (
                          <p className="text-xs text-gray-500">SO: {invoice.salesOrder.orderNumber}</p>
                        )}
                      </div>
                    </td>
                    <td>{invoice.customer.name}</td>
                    <td>{formatDate(invoice.invoiceDate)}</td>
                    <td>{formatDate(invoice.dueDate)}</td>
                    <td className="font-semibold">{formatCurrency(invoice.total)}</td>
                    <td>{formatCurrency(invoice.paidAmount)}</td>
                    <td>
                      <StatusBadge status={invoice.status} config={STATUS_CONFIG} />
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setViewingInvoice(invoice); setIsViewModalOpen(true); }}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {invoice.status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => openEditModal(invoice)}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(invoice.id, 'SENT')}
                              className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900 rounded text-green-600"
                              title="Send Invoice"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {(invoice.status === 'SENT' || invoice.status === 'PARTIALLY_PAID') && (
                          <a
                            href={`/dashboard/payments?type=inbound&invoiceId=${invoice.id}`}
                            className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900 rounded text-blue-600"
                            title="Record Payment"
                          >
                            <CreditCard className="w-4 h-4" />
                          </a>
                        )}
                        {invoice.status !== 'DRAFT' && (
                          <button
                            onClick={() => window.open(`/api/invoices/${invoice.id}/pdf`, '_blank')}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        {invoice.status === 'DRAFT' && (
                          <button
                            onClick={() => handleDelete(invoice.id)}
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
        title={editingInvoice ? 'Edit Invoice' : 'New Invoice'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Customer *"
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value, salesOrderId: '' })}
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
              required
            />
            <Select
              label="Link to Sales Order"
              value={formData.salesOrderId}
              onChange={(e) => setFormData({ ...formData, salesOrderId: e.target.value })}
              options={[
                { value: '', label: 'None' },
                ...filteredSalesOrders.map((so) => ({ value: so.id, label: so.orderNumber }))
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Invoice Date *"
              type="date"
              value={formData.invoiceDate}
              onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
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
              {editingInvoice ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Invoice ${viewingInvoice?.invoiceNumber}`}
        size="lg"
      >
        {viewingInvoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Customer</p>
                <p className="font-medium">{viewingInvoice.customer.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <StatusBadge status={viewingInvoice.status} config={STATUS_CONFIG} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Invoice Date</p>
                <p className="font-medium">{formatDate(viewingInvoice.invoiceDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Due Date</p>
                <p className="font-medium">{formatDate(viewingInvoice.dueDate)}</p>
              </div>
              {viewingInvoice.salesOrder && (
                <div>
                  <p className="text-sm text-gray-500">Sales Order</p>
                  <p className="font-medium">{viewingInvoice.salesOrder.orderNumber}</p>
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
                  {viewingInvoice.lines.map((line, idx) => (
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
                    <td className="p-2 text-right">{formatCurrency(viewingInvoice.total)}</td>
                    <td></td>
                  </tr>
                  <tr className="text-green-600">
                    <td colSpan={3} className="p-2 text-right">Paid:</td>
                    <td className="p-2 text-right">{formatCurrency(viewingInvoice.paidAmount)}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="p-2 text-right">Balance:</td>
                    <td className="p-2 text-right">{formatCurrency(parseFloat(viewingInvoice.total) - parseFloat(viewingInvoice.paidAmount))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {viewingInvoice.notes && (
              <div>
                <p className="text-sm text-gray-500">Notes</p>
                <p className="text-sm">{viewingInvoice.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
