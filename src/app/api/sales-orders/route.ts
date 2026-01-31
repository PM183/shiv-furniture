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

    // If customer role, only show their own orders
    if (user.role === 'CUSTOMER' && user.contactId) {
      where.customerId = user.contactId;
    }

    const [orders, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        include: {
          customer: true,
          lines: {
            include: {
              product: true,
              analyticalAccount: true,
            },
          },
          invoices: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.salesOrder.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    return NextResponse.json({ error: 'Failed to fetch sales orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const orderNumber = await getNextSequence('sales_order');

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

    const order = await prisma.salesOrder.create({
      data: {
        orderNumber,
        customerId: body.customerId,
        orderDate: body.orderDate ? new Date(body.orderDate) : new Date(),
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
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
        lines: {
          include: {
            product: true,
            analyticalAccount: true,
          },
        },
      },
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error('Error creating sales order:', error);
    return NextResponse.json({ error: 'Failed to create sales order' }, { status: 500 });
  }
}
