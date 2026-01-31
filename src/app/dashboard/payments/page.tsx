'use client';

import { useState, useEffect } from 'react';
import { Plus, Eye, Trash2, CreditCard, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';
import { Input, Select, Textarea } from '@/components/ui/FormFields';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { useSearchParams } from 'next/navigation';

interface Payment {
  id: string;
  paymentNumber: string;
  type: 'INBOUND' | 'OUTBOUND';
  contactId: string;
  contact: { name: string };
  invoiceId: string | null;
  invoice: { invoiceNumber: string; total: string } | null;
  vendorBillId: string | null;
  vendorBill: { billNumber: string; total: string } | null;
  paymentDate: string;
  amount: string;
  method: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

interface Contact {
  id: string;
  name: string;
  type: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  total: string;
  paidAmount: string;
  status: string;
}

interface VendorBill {
  id: string;
  billNumber: string;
  vendorId: string;
  total: string;
  paidAmount: string;
  status: string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  INBOUND: { label: 'Received', color: 'green' },
  OUTBOUND: { label: 'Sent', color: 'red' },
};

const METHOD_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'OTHER', label: 'Other' },
];

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

export default function PaymentsPage() {
  const searchParams = useSearchParams();
  const urlType = searchParams.get('type');
  const urlInvoiceId = searchParams.get('invoiceId');
  const urlBillId = searchParams.get('billId');
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [vendors, setVendors] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);

  const [formData, setFormData] = useState({
    type: 'INBOUND' as 'INBOUND' | 'OUTBOUND',
    contactId: '',
    invoiceId: '',
    vendorBillId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    amount: '',
    method: 'BANK_TRANSFER',
    reference: '',
    notes: '',
  });

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '10' });
      if (typeFilter) params.append('type', typeFilter);
      
      const res = await fetch(`/api/payments?${params}`);
      const data = await res.json();
      setPayments(data.payments);
      setTotal(data.pagination.total);
    } catch (error) {
      toast.error('Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const [customersRes, vendorsRes, invoicesRes, billsRes] = await Promise.all([
        fetch('/api/contacts?type=customer'),
        fetch('/api/contacts?type=vendor'),
        fetch('/api/invoices?status=SENT,PARTIALLY_PAID'),
        fetch('/api/vendor-bills?status=POSTED,PARTIALLY_PAID'),
      ]);
      
      const customersData = await customersRes.json();
      const vendorsData = await vendorsRes.json();
      const invoicesData = await invoicesRes.json();
      const billsData = await billsRes.json();
      
      setCustomers(customersData.contacts);
      setVendors(vendorsData.contacts);
      setInvoices(invoicesData.invoices || []);
      setVendorBills(billsData.bills || []);
    } catch (error) {
      console.error('Failed to fetch dropdown data');
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page, typeFilter]);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  // Handle URL params for quick payment creation
  useEffect(() => {
    if (urlType || urlInvoiceId || urlBillId) {
      const newFormData = { ...formData };
      
      if (urlType === 'inbound') {
        newFormData.type = 'INBOUND';
      } else if (urlType === 'outbound') {
        newFormData.type = 'OUTBOUND';
      }
      
      if (urlInvoiceId) {
        newFormData.invoiceId = urlInvoiceId;
        const invoice = invoices.find(i => i.id === urlInvoiceId);
        if (invoice) {
          newFormData.contactId = invoice.customerId;
          newFormData.amount = (parseFloat(invoice.total) - parseFloat(invoice.paidAmount)).toString();
        }
      }
      
      if (urlBillId) {
        newFormData.vendorBillId = urlBillId;
        const bill = vendorBills.find(b => b.id === urlBillId);
        if (bill) {
          newFormData.contactId = bill.vendorId;
          newFormData.amount = (parseFloat(bill.total) - parseFloat(bill.paidAmount)).toString();
        }
      }
      
      setFormData(newFormData);
      setIsModalOpen(true);
    }
  }, [urlType, urlInvoiceId, urlBillId, invoices, vendorBills]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          contactId: formData.contactId,
          invoiceId: formData.type === 'INBOUND' ? formData.invoiceId || null : null,
          vendorBillId: formData.type === 'OUTBOUND' ? formData.vendorBillId || null : null,
          paymentDate: formData.paymentDate,
          amount: parseFloat(formData.amount),
          method: formData.method,
          reference: formData.reference || null,
          notes: formData.notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success('Payment recorded');
      setIsModalOpen(false);
      resetForm();
      fetchPayments();
      fetchDropdownData(); // Refresh invoices/bills to update paid amounts
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment?')) return;
    
    try {
      const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Payment deleted');
      fetchPayments();
      fetchDropdownData();
    } catch (error) {
      toast.error('Failed to delete payment');
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'INBOUND',
      contactId: '',
      invoiceId: '',
      vendorBillId: '',
      paymentDate: new Date().toISOString().split('T')[0],
      amount: '',
      method: 'BANK_TRANSFER',
      reference: '',
      notes: '',
    });
  };

  const contacts = formData.type === 'INBOUND' ? customers : vendors;
  
  const filteredInvoices = invoices.filter(
    i => !formData.contactId || i.customerId === formData.contactId
  );
  
  const filteredBills = vendorBills.filter(
    b => !formData.contactId || b.vendorId === formData.contactId
  );

  const handleTypeChange = (type: 'INBOUND' | 'OUTBOUND') => {
    setFormData({
      ...formData,
      type,
      contactId: '',
      invoiceId: '',
      vendorBillId: '',
    });
  };

  const handleDocumentChange = (docId: string) => {
    if (formData.type === 'INBOUND') {
      const invoice = invoices.find(i => i.id === docId);
      setFormData({
        ...formData,
        invoiceId: docId,
        contactId: invoice?.customerId || formData.contactId,
        amount: invoice ? (parseFloat(invoice.total) - parseFloat(invoice.paidAmount)).toString() : '',
      });
    } else {
      const bill = vendorBills.find(b => b.id === docId);
      setFormData({
        ...formData,
        vendorBillId: docId,
        contactId: bill?.vendorId || formData.contactId,
        amount: bill ? (parseFloat(bill.total) - parseFloat(bill.paidAmount)).toString() : '',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="text-gray-500 dark:text-gray-400">Track inbound and outbound payments</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Record Payment
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type:</label>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="input-field w-40"
          >
            <option value="">All</option>
            <option value="INBOUND">Received (Inbound)</option>
            <option value="OUTBOUND">Sent (Outbound)</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      {loading ? (
        <LoadingSpinner />
      ) : payments.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            title="No payments"
            description="Record your first payment to track transactions."
            action={
              <button onClick={() => setIsModalOpen(true)} className="btn-primary">
                Record Payment
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
                  <th>Payment #</th>
                  <th>Type</th>
                  <th>Contact</th>
                  <th>Document</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-medium text-gray-900 dark:text-white">{payment.paymentNumber}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {payment.type === 'INBOUND' ? (
                          <ArrowDownLeft className="w-4 h-4 text-green-600" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-red-600" />
                        )}
                        <StatusBadge status={payment.type} config={TYPE_CONFIG} />
                      </div>
                    </td>
                    <td>{payment.contact.name}</td>
                    <td>
                      {payment.invoice?.invoiceNumber || payment.vendorBill?.billNumber || '-'}
                    </td>
                    <td>{formatDate(payment.paymentDate)}</td>
                    <td>
                      <span className="text-sm">
                        {METHOD_OPTIONS.find(m => m.value === payment.method)?.label}
                      </span>
                    </td>
                    <td className={`font-semibold ${payment.type === 'INBOUND' ? 'text-green-600' : 'text-red-600'}`}>
                      {payment.type === 'INBOUND' ? '+' : '-'}{formatCurrency(payment.amount)}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setViewingPayment(payment); setIsViewModalOpen(true); }}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(payment.id)}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600"
                          title="Delete"
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
          
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(total / 10)}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title="Record Payment"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment Type Tabs */}
          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <button
              type="button"
              onClick={() => handleTypeChange('INBOUND')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                formData.type === 'INBOUND'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              Receive Payment
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('OUTBOUND')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                formData.type === 'OUTBOUND'
                  ? 'bg-red-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Send Payment
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label={formData.type === 'INBOUND' ? 'Customer *' : 'Vendor *'}
              value={formData.contactId}
              onChange={(e) => setFormData({ ...formData, contactId: e.target.value, invoiceId: '', vendorBillId: '' })}
              options={contacts.map((c) => ({ value: c.id, label: c.name }))}
              required
            />
            
            {formData.type === 'INBOUND' ? (
              <Select
                label="Invoice"
                value={formData.invoiceId}
                onChange={(e) => handleDocumentChange(e.target.value)}
                options={[
                  { value: '', label: 'No linked invoice' },
                  ...filteredInvoices.map((i) => ({ 
                    value: i.id, 
                    label: `${i.invoiceNumber} - ${formatCurrency(parseFloat(i.total) - parseFloat(i.paidAmount))} due` 
                  }))
                ]}
              />
            ) : (
              <Select
                label="Vendor Bill"
                value={formData.vendorBillId}
                onChange={(e) => handleDocumentChange(e.target.value)}
                options={[
                  { value: '', label: 'No linked bill' },
                  ...filteredBills.map((b) => ({ 
                    value: b.id, 
                    label: `${b.billNumber} - ${formatCurrency(parseFloat(b.total) - parseFloat(b.paidAmount))} due` 
                  }))
                ]}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Payment Date *"
              type="date"
              value={formData.paymentDate}
              onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              required
            />
            <Input
              label="Amount *"
              type="number"
              step="0.01"
              min="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Payment Method *"
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value })}
              options={METHOD_OPTIONS}
              required
            />
            <Input
              label="Reference"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="Transaction ID, Cheque #, etc."
            />
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
              Record Payment
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Payment ${viewingPayment?.paymentNumber}`}
      >
        {viewingPayment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <div className="flex items-center gap-2 mt-1">
                  {viewingPayment.type === 'INBOUND' ? (
                    <ArrowDownLeft className="w-4 h-4 text-green-600" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-red-600" />
                  )}
                  <StatusBadge status={viewingPayment.type} config={TYPE_CONFIG} />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Amount</p>
                <p className={`text-2xl font-bold ${viewingPayment.type === 'INBOUND' ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(viewingPayment.amount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{viewingPayment.type === 'INBOUND' ? 'Customer' : 'Vendor'}</p>
                <p className="font-medium">{viewingPayment.contact.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment Date</p>
                <p className="font-medium">{formatDate(viewingPayment.paymentDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Method</p>
                <p className="font-medium">{METHOD_OPTIONS.find(m => m.value === viewingPayment.method)?.label}</p>
              </div>
              {viewingPayment.reference && (
                <div>
                  <p className="text-sm text-gray-500">Reference</p>
                  <p className="font-medium">{viewingPayment.reference}</p>
                </div>
              )}
              {viewingPayment.invoice && (
                <div>
                  <p className="text-sm text-gray-500">Invoice</p>
                  <p className="font-medium">{viewingPayment.invoice.invoiceNumber}</p>
                </div>
              )}
              {viewingPayment.vendorBill && (
                <div>
                  <p className="text-sm text-gray-500">Vendor Bill</p>
                  <p className="font-medium">{viewingPayment.vendorBill.billNumber}</p>
                </div>
              )}
            </div>

            {viewingPayment.notes && (
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500">Notes</p>
                <p className="text-sm">{viewingPayment.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
