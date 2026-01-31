'use client';

import { useState, useEffect } from 'react';
import { Eye, CreditCard, ArrowDownLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';

interface Payment {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  amount: string;
  method: string;
  reference: string | null;
  invoice: { invoiceNumber: string } | null;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  UPI: 'UPI',
  CREDIT_CARD: 'Credit Card',
  OTHER: 'Other',
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

export default function PortalPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/payments');
      const data = await res.json();
      setPayments(data.payments || []);
    } catch (error) {
      toast.error('Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Payments</h1>
        <p className="text-gray-500 dark:text-gray-400">View your payment history</p>
      </div>

      {/* Summary Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
            <CreditCard className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Payments Made</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
          </div>
        </div>
      </div>

      {/* Payments List */}
      {loading ? (
        <LoadingSpinner />
      ) : payments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700">
          <EmptyState
            title="No payments found"
            description="You haven't made any payments yet."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                    <ArrowDownLeft className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {payment.paymentNumber}
                    </h3>
                    <div className="text-sm text-gray-500 space-x-4">
                      <span>{formatDate(payment.paymentDate)}</span>
                      <span>{METHOD_LABELS[payment.method]}</span>
                      {payment.invoice && (
                        <span>• Invoice: {payment.invoice.invoiceNumber}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(payment.amount)}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setViewingPayment(payment)}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                    title="View Details"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Payment Modal */}
      <Modal
        isOpen={!!viewingPayment}
        onClose={() => setViewingPayment(null)}
        title={`Payment ${viewingPayment?.paymentNumber}`}
      >
        {viewingPayment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Payment Date</p>
                <p className="font-medium">{formatDate(viewingPayment.paymentDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Amount</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(viewingPayment.amount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment Method</p>
                <p className="font-medium">{METHOD_LABELS[viewingPayment.method]}</p>
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
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
