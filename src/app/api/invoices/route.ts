import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { getNextSequence, parseDecimal } from '@/lib/utils';
import { applyAutoAnalyticalToLines } from '@/lib/auto-analytical';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};
    
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    // If customer role, only show their own invoices
    if (user.role === 'CUSTOMER' && user.contactId) {
      where.customerId = user.contactId;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: true,
          salesOrder: true,
          lines: {
            include: {
              product: true,
              analyticalAccount: true,
            },
          },
          payments: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const invoiceNumber = await getNextSequence('invoice');

    const linesWithAnalytical = await applyAutoAnalyticalToLines(body.lines);

    let subtotal = 0;
    let taxAmount = 0;

    const lines = linesWithAnalytical.map((line: any) => {
      const lineSubtotal = parseDecimal(line.quantity) * parseDecimal(line.unitPrice);
      const lineTax = lineSubtotal * (parseDecimal(line.taxRate) / 100);
      const lineTotal = lineSubtotal + lineTax;

      subtotal += lineSubtotal;
      taxAmount += lineTax;

      return {
        productId: line.productId,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        taxAmount: lineTax,
        lineTotal: lineTotal,
        analyticalAccountId: line.analyticalAccountId,
      };
    });

    const totalAmount = subtotal + taxAmount;

    // Calculate due date based on customer payment terms
    let dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (!dueDate) {
      const customer = await prisma.contact.findUnique({
        where: { id: body.customerId },
        select: { paymentTerms: true },
      });
      const paymentDays = customer?.paymentTerms || 30;
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + paymentDays);
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId: body.customerId,
        salesOrderId: body.salesOrderId,
        invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : new Date(),
        dueDate,
        status: body.status || 'DRAFT',
        subtotal,
        taxAmount,
        totalAmount,
        notes: body.notes,
        lines: {
          create: lines,
        },
      },
      include: {
        customer: true,
        salesOrder: true,
        lines: {
          include: {
            product: true,
            analyticalAccount: true,
          },
        },
      },
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
