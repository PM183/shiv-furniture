import prisma from './prisma';
import { parseDecimal, calculatePercentage } from './utils';

export interface BudgetVsActualItem {
  analyticalAccountId: string;
  analyticalAccountCode: string;
  analyticalAccountName: string;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  utilizationPercentage: number;
  remainingBalance: number;
}

export interface BudgetSummary {
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  overallUtilization: number;
  items: BudgetVsActualItem[];
}

export async function getBudgetVsActual(
  periodStart: Date,
  periodEnd: Date,
  analyticalAccountId?: string
): Promise<BudgetSummary> {
  // Get budgets for the period
  const budgets = await prisma.budget.findMany({
    where: {
      isActive: true,
      periodStart: { lte: periodEnd },
      periodEnd: { gte: periodStart },
      ...(analyticalAccountId ? { analyticalAccountId } : {}),
    },
    include: {
      analyticalAccount: true,
    },
  });

  // Get actuals from posted vendor bills
  const vendorBillActuals = await prisma.vendorBillLine.groupBy({
    by: ['analyticalAccountId'],
    where: {
      analyticalAccountId: { not: null },
      vendorBill: {
        status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] },
        billDate: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      ...(analyticalAccountId ? { analyticalAccountId } : {}),
    },
    _sum: {
      lineTotal: true,
    },
  });

  // Get actuals from posted invoices (revenue side - negative for costs)
  const invoiceActuals = await prisma.invoiceLine.groupBy({
    by: ['analyticalAccountId'],
    where: {
      analyticalAccountId: { not: null },
      invoice: {
        status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] },
        invoiceDate: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      ...(analyticalAccountId ? { analyticalAccountId } : {}),
    },
    _sum: {
      lineTotal: true,
    },
  });

  // Combine vendor bill actuals
  const actualsMap = new Map<string, number>();
  
  for (const item of vendorBillActuals) {
    if (item.analyticalAccountId) {
      const current = actualsMap.get(item.analyticalAccountId) || 0;
      actualsMap.set(item.analyticalAccountId, current + parseDecimal(item._sum.lineTotal));
    }
  }

  // Build the result items
  const items: BudgetVsActualItem[] = budgets.map((budget: any) => {
    const budgetAmount = budget.revisedAmount 
      ? parseDecimal(budget.revisedAmount) 
      : parseDecimal(budget.amount);
    const actualAmount = actualsMap.get(budget.analyticalAccountId) || 0;
    const variance = budgetAmount - actualAmount;
    const utilizationPercentage = calculatePercentage(actualAmount, budgetAmount);
    const remainingBalance = Math.max(0, variance);

    return {
      analyticalAccountId: budget.analyticalAccountId,
      analyticalAccountCode: budget.analyticalAccount.code,
      analyticalAccountName: budget.analyticalAccount.name,
      budgetAmount,
      actualAmount,
      variance,
      utilizationPercentage,
      remainingBalance,
    };
  });

  // Calculate totals
  const totalBudget = items.reduce((sum, item) => sum + item.budgetAmount, 0);
  const totalActual = items.reduce((sum, item) => sum + item.actualAmount, 0);
  const totalVariance = totalBudget - totalActual;
  const overallUtilization = calculatePercentage(totalActual, totalBudget);

  return {
    totalBudget,
    totalActual,
    totalVariance,
    overallUtilization,
    items,
  };
}

export async function getCostCenterPerformance(
  periodStart: Date,
  periodEnd: Date
): Promise<{
  costCenters: Array<{
    id: string;
    code: string;
    name: string;
    expenses: number;
    revenue: number;
    netContribution: number;
  }>;
}> {
  const analyticalAccounts = await prisma.analyticalAccount.findMany({
    where: { isActive: true },
  });

  const results = await Promise.all(
    analyticalAccounts.map(async (account: any) => {
      // Get expenses from vendor bills
      const expenses = await prisma.vendorBillLine.aggregate({
        where: {
          analyticalAccountId: account.id,
          vendorBill: {
            status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] },
            billDate: { gte: periodStart, lte: periodEnd },
          },
        },
        _sum: { lineTotal: true },
      });

      // Get revenue from invoices
      const revenue = await prisma.invoiceLine.aggregate({
        where: {
          analyticalAccountId: account.id,
          invoice: {
            status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] },
            invoiceDate: { gte: periodStart, lte: periodEnd },
          },
        },
        _sum: { lineTotal: true },
      });

      const expenseAmount = parseDecimal(expenses._sum.lineTotal);
      const revenueAmount = parseDecimal(revenue._sum.lineTotal);

      return {
        id: account.id,
        code: account.code,
        name: account.name,
        expenses: expenseAmount,
        revenue: revenueAmount,
        netContribution: revenueAmount - expenseAmount,
      };
    })
  );

  return { costCenters: results };
}
