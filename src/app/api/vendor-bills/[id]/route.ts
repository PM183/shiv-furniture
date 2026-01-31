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
    const bill = await prisma.vendorBill.findUnique({
      where: { id },
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
    });

    if (!bill) {
      return NextResponse.json({ error: 'Vendor bill not found' }, { status: 404 });
    }

    return NextResponse.json({ bill });
  } catch (error) {
    console.error('Error fetching vendor bill:', error);
    return NextResponse.json({ error: 'Failed to fetch vendor bill' }, { status: 500 });
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

    // Check if bill is already posted with payments
    const existingBill = await prisma.vendorBill.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (existingBill?.payments && existingBill.payments.length > 0 && body.lines) {
      return NextResponse.json(
        { error: 'Cannot modify bill lines after payments have been made' },
        { status: 400 }
      );
    }

    // If lines are being updated
    if (body.lines) {
      await prisma.vendorBillLine.deleteMany({
        where: { vendorBillId: id },
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
          vendorBillId: id,
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

      await prisma.vendorBillLine.createMany({
        data: lines,
      });

      const bill = await prisma.vendorBill.update({
        where: { id },
        data: {
          vendorId: body.vendorId,
          billDate: body.billDate ? new Date(body.billDate) : undefined,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
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
          payments: true,
        },
      });

      return NextResponse.json({ bill });
    }

    // Simple update
    const bill = await prisma.vendorBill.update({
      where: { id },
      data: {
        status: body.status,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
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
        payments: true,
      },
    });

    return NextResponse.json({ bill });
  } catch (error) {
    console.error('Error updating vendor bill:', error);
    return NextResponse.json({ error: 'Failed to update vendor bill' }, { status: 500 });
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

    // Check if there are payments
    const payments = await prisma.payment.count({
      where: { vendorBillId: id },
    });

    if (payments > 0) {
      return NextResponse.json(
        { error: 'Cannot delete bill with payments' },
        { status: 400 }
      );
    }

    await prisma.vendorBill.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting vendor bill:', error);
    return NextResponse.json({ error: 'Failed to delete vendor bill' }, { status: 500 });
  }
}
