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
    const vendorId = searchParams.get('vendorId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};
    
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;

    const [bills, total] = await Promise.all([
      prisma.vendorBill.findMany({
        where,
        include: {
          vendor: true,
          purchaseOrder: true,
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
      prisma.vendorBill.count({ where }),
    ]);

    return NextResponse.json({
      bills,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching vendor bills:', error);
    return NextResponse.json({ error: 'Failed to fetch vendor bills' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const billNumber = await getNextSequence('vendor_bill');

    // Apply auto analytical rules
    const linesWithAnalytical = await applyAutoAnalyticalToLines(body.lines);

    // Calculate totals
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

    // Calculate due date based on vendor payment terms
    let dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (!dueDate) {
      const vendor = await prisma.contact.findUnique({
        where: { id: body.vendorId },
        select: { paymentTerms: true },
      });
      const paymentDays = vendor?.paymentTerms || 30;
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + paymentDays);
    }

    const bill = await prisma.vendorBill.create({
      data: {
        billNumber,
        vendorId: body.vendorId,
        purchaseOrderId: body.purchaseOrderId,
        billDate: body.billDate ? new Date(body.billDate) : new Date(),
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
        vendor: true,
        purchaseOrder: true,
        lines: {
          include: {
            product: true,
            analyticalAccount: true,
          },
        },
      },
    });

    return NextResponse.json({ bill }, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor bill:', error);
    return NextResponse.json({ error: 'Failed to create vendor bill' }, { status: 500 });
  }
}
