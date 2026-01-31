import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// GET /api/portal/invoices - Get invoices for current customer
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the contact linked to this user
    const contact = await prisma.contact.findFirst({
      where: {
        email: user.email,
        type: 'CUSTOMER',
      },
    });

    if (!contact) {
      return NextResponse.json({ invoices: [] });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: any = {
      customerId: contact.id,
      status: { not: 'DRAFT' }, // Don't show draft invoices to customers
    };

    if (status) {
      where.status = status;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        lines: {
          select: {
            description: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
        },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('Portal invoices error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}
