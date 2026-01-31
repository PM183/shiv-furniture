import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { parseDecimal } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get counts
    const [
      totalContacts,
      totalProducts,
      totalInvoices,
      totalPurchaseOrders,
      pendingInvoices,
      pendingBills,
    ] = await Promise.all([
      prisma.contact.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.invoice.count(),
      prisma.purchaseOrder.count(),
      prisma.invoice.count({ where: { status: { in: ['POSTED', 'PARTIALLY_PAID'] } } }),
      prisma.vendorBill.count({ where: { status: { in: ['POSTED', 'PARTIALLY_PAID'] } } }),
    ]);

    // Get monthly revenue for current year
    const currentYear = new Date().getFullYear();
    const invoices = await prisma.invoice.findMany({
      where: {
        invoiceDate: {
          gte: new Date(currentYear, 0, 1),
          lte: new Date(currentYear, 11, 31),
        },
        status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] },
      },
      select: {
        invoiceDate: true,
        totalAmount: true,
      },
    });

    const monthlyRevenue = Array(12).fill(0);
    invoices.forEach((inv) => {
      const month = inv.invoiceDate.getMonth();
      monthlyRevenue[month] += parseDecimal(inv.totalAmount);
    });

    // Get recent invoices
    const recentInvoices = await prisma.invoice.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { customer: true },
    });

    // Get receivables total
    const receivables = await prisma.invoice.aggregate({
      where: { status: { in: ['POSTED', 'PARTIALLY_PAID'] } },
      _sum: { totalAmount: true, paidAmount: true },
    });

    const totalReceivables = 
      parseDecimal(receivables._sum.totalAmount) - 
      parseDecimal(receivables._sum.paidAmount);

    // Get payables total
    const payables = await prisma.vendorBill.aggregate({
      where: { status: { in: ['POSTED', 'PARTIALLY_PAID'] } },
      _sum: { totalAmount: true, paidAmount: true },
    });

    const totalPayables = 
      parseDecimal(payables._sum.totalAmount) - 
      parseDecimal(payables._sum.paidAmount);

    return NextResponse.json({
      stats: {
        totalContacts,
        totalProducts,
        totalInvoices,
        totalPurchaseOrders,
        pendingInvoices,
        pendingBills,
        totalReceivables,
        totalPayables,
      },
      monthlyRevenue,
      recentInvoices,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
