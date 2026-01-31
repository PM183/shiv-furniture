import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { parseDecimal } from '@/lib/utils';

interface PaymentRecord {
  amount: any;
}

async function updateInvoicePaymentStatus(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });

  if (!invoice) return;

  const totalPaid = invoice.payments.reduce(
    (sum: number, p: PaymentRecord) => sum + parseDecimal(p.amount),
    0
  );
  const totalAmount = parseDecimal(invoice.totalAmount);

  let status = invoice.status;
  if (totalPaid >= totalAmount) {
    status = 'PAID';
  } else if (totalPaid > 0) {
    status = 'PARTIALLY_PAID';
  } else {
    status = 'POSTED';
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount: totalPaid, status },
  });
}

async function updateVendorBillPaymentStatus(vendorBillId: string) {
  const bill = await prisma.vendorBill.findUnique({
    where: { id: vendorBillId },
    include: { payments: true },
  });

  if (!bill) return;

  const totalPaid = bill.payments.reduce(
    (sum: number, p: PaymentRecord) => sum + parseDecimal(p.amount),
    0
  );
  const totalAmount = parseDecimal(bill.totalAmount);

  let status = bill.status;
  if (totalPaid >= totalAmount) {
    status = 'PAID';
  } else if (totalPaid > 0) {
    status = 'PARTIALLY_PAID';
  } else {
    status = 'POSTED';
  }

  await prisma.vendorBill.update({
    where: { id: vendorBillId },
    data: { paidAmount: totalPaid, status },
  });
}

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
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        contact: true,
        invoice: {
          include: { customer: true },
        },
        vendorBill: {
          include: { vendor: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Check customer access
    if (user.role === 'CUSTOMER' && user.contactId !== payment.contactId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ payment });
  } catch (error) {
    console.error('Error fetching payment:', error);
    return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 });
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
    
    const payment = await prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const invoiceId = payment.invoiceId;
    const vendorBillId = payment.vendorBillId;

    await prisma.payment.delete({
      where: { id },
    });

    // Update related document status
    if (invoiceId) {
      await updateInvoicePaymentStatus(invoiceId);
    }
    if (vendorBillId) {
      await updateVendorBillPaymentStatus(vendorBillId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
