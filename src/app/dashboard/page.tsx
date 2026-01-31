'use client';

import { useEffect, useState } from 'react';
import { 
  Users, 
  Package, 
  FileText, 
  ShoppingCart, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DashboardStats {
  totalContacts: number;
  totalProducts: number;
  totalInvoices: number;
  totalPurchaseOrders: number;
  pendingInvoices: number;
  pendingBills: number;
  totalReceivables: number;
  totalPayables: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  status: string;
  customer: { name: string };
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [budgetData, setBudgetData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashboardRes, budgetRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/reports/budget-vs-actual'),
        ]);

        const dashboardData = await dashboardRes.json();
        const budgetReport = await budgetRes.json();

        setStats(dashboardData.stats);
        setMonthlyRevenue(dashboardData.monthlyRevenue);
        setRecentInvoices(dashboardData.recentInvoices);
        setBudgetData(budgetReport.report);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const revenueChartData = {
    labels: months,
    datasets: [
      {
        label: 'Revenue',
        data: monthlyRevenue,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const budgetChartData = budgetData ? {
    labels: budgetData.items.map((item: any) => item.analyticalAccountCode),
    datasets: [
      {
        data: budgetData.items.map((item: any) => item.budgetAmount),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
        ],
      },
    ],
  } : null;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">Welcome back! Here&apos;s your business overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Contacts</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalContacts || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Products</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalProducts || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Receivables</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats?.totalReceivables || 0)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">{stats?.pendingInvoices || 0} pending invoices</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Payables</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(stats?.totalPayables || 0)}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">{stats?.pendingBills || 0} pending bills</p>
        </div>
      </div>

      {/* Budget Overview */}
      {budgetData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="stat-card lg:col-span-2">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Budget Overview</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Total Budget</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(budgetData.totalBudget)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Total Actual</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(budgetData.totalActual)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Utilization</p>
                <p className="text-xl font-bold text-green-600">{budgetData.overallUtilization}%</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-primary-600 h-3 rounded-full transition-all"
                style={{ width: `${Math.min(budgetData.overallUtilization, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="stat-card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Budget by Cost Center</h3>
            {budgetChartData && (
              <div className="h-48">
                <Doughnut 
                  data={budgetChartData} 
                  options={{ 
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } }
                  }} 
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Monthly Revenue</h3>
          <div className="h-64 chart-container">
            <Line
              data={revenueChartData}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value) => formatCurrency(value as number),
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Invoices</h3>
          <div className="space-y-4">
            {recentInvoices.length > 0 ? (
              recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{invoice.invoiceNumber}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{invoice.customer.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(parseFloat(invoice.totalAmount))}
                    </p>
                    <span className={`status-badge ${
                      invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                      invoice.status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {invoice.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No recent invoices</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
