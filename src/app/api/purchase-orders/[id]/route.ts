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
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        lines: {
          include: {
            product: true,
            analyticalAccount: true,
          },
        },
        vendorBills: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase order' }, { status: 500 });
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

    // If lines are being updated
    if (body.lines) {
      // Delete existing lines
      await prisma.purchaseOrderLine.deleteMany({
        where: { purchaseOrderId: id },
      });

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
          purchaseOrderId: id,
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

      // Create new lines
      await prisma.purchaseOrderLine.createMany({
        data: lines,
      });

      // Update order
      const order = await prisma.purchaseOrder.update({
        where: { id },
        data: {
          vendorId: body.vendorId,
          orderDate: body.orderDate ? new Date(body.orderDate) : undefined,
          expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined,
          status: body.status,
          subtotal,
          taxAmount,
          totalAmount,
          notes: body.notes,
        },
        include: {
          vendor: true,
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

    // Simple update without lines
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: body.status,
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined,
        notes: body.notes,
      },
      include: {
        vendor: true,
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
    console.error('Error updating purchase order:', error);
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 });
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

    // Check if there are linked bills
    const linkedBills = await prisma.vendorBill.count({
      where: { purchaseOrderId: id },
    });

    if (linkedBills > 0) {
      return NextResponse.json(
        { error: 'Cannot delete purchase order with linked bills' },
        { status: 400 }
      );
    }

    await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    return NextResponse.json({ error: 'Failed to delete purchase order' }, { status: 500 });
  }
}
