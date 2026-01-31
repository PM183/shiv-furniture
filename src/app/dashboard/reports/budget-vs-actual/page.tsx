'use client';

import { useState, useEffect } from 'react';
import { Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '@/components/ui/States';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface BudgetItem {
  analyticalAccountId: string;
  analyticalAccountCode: string;
  analyticalAccountName: string;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  utilizationPercentage: number;
}

interface Summary {
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  overallUtilization: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function BudgetVsActualPage() {
  const [data, setData] = useState<BudgetItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const years = Array.from({ length: 5 }, (_, i) => {
    const y = new Date().getFullYear() - 2 + i;
    return { value: y.toString(), label: y.toString() };
  });

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/budget-vs-actual?year=${year}`);
      const result = await res.json();
      setData(result.data);
      setSummary(result.summary);
    } catch (error) {
      toast.error('Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [year]);

  const exportToCSV = () => {
    const headers = ['Cost Center', 'Code', 'Budget', 'Actual', 'Variance', 'Utilization %'];
    const rows = data.map(item => [
      item.analyticalAccountName,
      item.analyticalAccountCode,
      item.budgetAmount,
      item.actualAmount,
      item.variance,
      item.utilizationPercentage.toFixed(1),
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-vs-actual-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = {
    labels: data.map(d => d.analyticalAccountCode),
    datasets: [
      {
        label: 'Budget',
        data: data.map(d => d.budgetAmount),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
      {
        label: 'Actual',
        data: data.map(d => d.actualAmount),
        backgroundColor: 'rgba(34, 197, 94, 0.5)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return formatCurrency(value);
          },
        },
      },
    },
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingDown className="w-4 h-4 text-green-600" />;
    if (variance < 0) return <TrendingUp className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getUtilizationColor = (pct: number) => {
    if (pct >= 100) return 'text-red-600 bg-red-100 dark:bg-red-900';
    if (pct >= 80) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900';
    return 'text-green-600 bg-green-100 dark:bg-green-900';
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Budget vs Actual</h1>
          <p className="text-gray-500 dark:text-gray-400">Compare budgeted amounts with actual spending</p>
        </div>
        <button onClick={exportToCSV} className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Year:</label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="input-field w-32"
          >
            {years.map((y) => (
              <option key={y.value} value={y.value}>{y.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card p-4">
                <p className="text-sm text-gray-500">Total Budget</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalBudget)}</p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-500">Total Actual</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalActual)}</p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-500">Variance</p>
                <p className={`text-2xl font-bold ${summary.totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.totalVariance)}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-500">Overall Utilization</p>
                <p className={`text-2xl font-bold ${summary.overallUtilization >= 100 ? 'text-red-600' : 'text-green-600'}`}>
                  {summary.overallUtilization.toFixed(1)}%
                </p>
              </div>
            </div>
          )}

          {/* Chart */}
          {data.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold mb-4">Budget vs Actual by Cost Center</h3>
              <div className="h-80">
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>
          )}

          {/* Table */}
          <div className="card overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Cost Center</th>
                  <th className="text-right">Budget</th>
                  <th className="text-right">Actual</th>
                  <th className="text-right">Variance</th>
                  <th className="text-right">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No budget data for {year}
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.analyticalAccountId}>
                      <td>
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {item.analyticalAccountName}
                          </span>
                          <p className="text-sm text-gray-500">{item.analyticalAccountCode}</p>
                        </div>
                      </td>
                      <td className="text-right font-medium">{formatCurrency(item.budgetAmount)}</td>
                      <td className="text-right font-medium">{formatCurrency(item.actualAmount)}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {getVarianceIcon(item.variance)}
                          <span className={item.variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(Math.abs(item.variance))}
                          </span>
                        </div>
                      </td>
                      <td className="text-right">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${getUtilizationColor(item.utilizationPercentage)}`}>
                          {item.utilizationPercentage.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {data.length > 0 && summary && (
                <tfoot className="bg-gray-50 dark:bg-gray-800 font-bold">
                  <tr>
                    <td>Total</td>
                    <td className="text-right">{formatCurrency(summary.totalBudget)}</td>
                    <td className="text-right">{formatCurrency(summary.totalActual)}</td>
                    <td className="text-right">
                      <span className={summary.totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(summary.totalVariance)}
                      </span>
                    </td>
                    <td className="text-right">{summary.overallUtilization.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
