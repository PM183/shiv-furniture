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
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        salesOrder: true,
        lines: {
          include: {
            product: true,
            analyticalAccount: true,
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check customer access
    if (user.role === 'CUSTOMER' && user.contactId !== invoice.customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
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

    // Check if invoice has payments
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (existingInvoice?.payments && existingInvoice.payments.length > 0 && body.lines) {
      return NextResponse.json(
        { error: 'Cannot modify invoice lines after payments have been made' },
        { status: 400 }
      );
    }

    if (body.lines) {
      await prisma.invoiceLine.deleteMany({
        where: { invoiceId: id },
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
          invoiceId: id,
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

      await prisma.invoiceLine.createMany({
        data: lines,
      });

      const invoice = await prisma.invoice.update({
        where: { id },
        data: {
          customerId: body.customerId,
          invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : undefined,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
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
          payments: true,
        },
      });

      return NextResponse.json({ invoice });
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: body.status,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
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
        payments: true,
      },
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
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

    const payments = await prisma.payment.count({
      where: { invoiceId: id },
    });

    if (payments > 0) {
      return NextResponse.json(
        { error: 'Cannot delete invoice with payments' },
        { status: 400 }
      );
    }

    await prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}
