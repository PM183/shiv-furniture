import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { getNextSequence, parseDecimal } from '@/lib/utils';

type PaymentType = 'INCOMING' | 'OUTGOING';

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
  } else if (invoice.status === 'PAID' || invoice.status === 'PARTIALLY_PAID') {
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
  } else if (bill.status === 'PAID' || bill.status === 'PARTIALLY_PAID') {
    status = 'POSTED';
  }

  await prisma.vendorBill.update({
    where: { id: vendorBillId },
    data: { paidAmount: totalPaid, status },
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as PaymentType | null;
    const contactId = searchParams.get('contactId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};
    
    if (type) where.type = type;
    if (contactId) where.contactId = contactId;

    // If customer role, only show their own payments
    if (user.role === 'CUSTOMER' && user.contactId) {
      where.contactId = user.contactId;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          contact: true,
          invoice: true,
          vendorBill: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { paymentDate: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Customers can make payments on their own invoices
    const body = await request.json();

    // Validate customer can only pay their own invoices
    if (user.role === 'CUSTOMER') {
      if (body.type !== 'INCOMING') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (body.invoiceId) {
        const invoice = await prisma.invoice.findUnique({
          where: { id: body.invoiceId },
        });
        if (!invoice || invoice.customerId !== user.contactId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
      }
    }

    const paymentNumber = await getNextSequence('payment');

    const payment = await prisma.payment.create({
      data: {
        paymentNumber,
        type: body.type,
        method: body.method,
        contactId: body.contactId,
        invoiceId: body.invoiceId,
        vendorBillId: body.vendorBillId,
        amount: body.amount,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
        reference: body.reference,
        notes: body.notes,
      },
      include: {
        contact: true,
        invoice: true,
        vendorBill: true,
      },
    });

    // Update invoice or bill status
    if (payment.invoiceId) {
      await updateInvoicePaymentStatus(payment.invoiceId);
    }
    if (payment.vendorBillId) {
      await updateVendorBillPaymentStatus(payment.vendorBillId);
    }

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
