import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { parseDecimal } from '@/lib/utils';
import { applyAutoAnalyticalToLines } from '@/lib/auto-analytical';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const order = await prisma.salesOrder.findUnique({
      where: { id },
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
    });

    if (!order) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });
    }

    // Check customer access
    if (user.role === 'CUSTOMER' && user.contactId !== order.customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Error fetching sales order:', error);
    return NextResponse.json({ error: 'Failed to fetch sales order' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    if (body.lines) {
      await prisma.salesOrderLine.deleteMany({
        where: { salesOrderId: id },
      });

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
          salesOrderId: id,
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

      await prisma.salesOrderLine.createMany({
        data: lines,
      });

      const order = await prisma.salesOrder.update({
        where: { id },
        data: {
          customerId: body.customerId,
          orderDate: body.orderDate ? new Date(body.orderDate) : undefined,
          expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined,
          status: body.status,
          subtotal,
          taxAmount,
          totalAmount,
          notes: body.notes,
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

      return NextResponse.json({ order });
    }

    const order = await prisma.salesOrder.update({
      where: { id },
      data: {
        status: body.status,
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined,
        notes: body.notes,
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

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Error updating sales order:', error);
    return NextResponse.json({ error: 'Failed to update sales order' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const linkedInvoices = await prisma.invoice.count({
      where: { salesOrderId: id },
    });

    if (linkedInvoices > 0) {
      return NextResponse.json(
        { error: 'Cannot delete sales order with linked invoices' },
        { status: 400 }
      );
    }

    await prisma.salesOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sales order:', error);
    return NextResponse.json({ error: 'Failed to delete sales order' }, { status: 500 });
  }
}
