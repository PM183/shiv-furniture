import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET /api/invoices/[id]/pdf - Generate invoice PDF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Generate HTML for the invoice
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333; }
    .invoice { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #2563eb; }
    .company h1 { font-size: 28px; color: #2563eb; margin-bottom: 5px; }
    .company p { color: #666; font-size: 12px; }
    .invoice-info { text-align: right; }
    .invoice-info h2 { font-size: 24px; color: #333; }
    .invoice-info p { color: #666; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .address-block h3 { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 10px; }
    .address-block p { color: #333; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .items-table th { background: #f8fafc; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
    .items-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
    .items-table .text-right { text-align: right; }
    .totals { margin-left: auto; width: 300px; }
    .totals tr td { padding: 8px 12px; }
    .totals .total-row { font-weight: bold; font-size: 16px; border-top: 2px solid #333; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #666; font-size: 12px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .status-paid { background: #dcfce7; color: #166534; }
    .status-sent { background: #dbeafe; color: #1e40af; }
    .status-partial { background: #fef3c7; color: #92400e; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .invoice { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="company">
        <h1>Shiv Furniture</h1>
        <p>Quality Furniture Since 1995</p>
        <p>123 Furniture Lane, Mumbai - 400001</p>
        <p>GSTIN: 27AADCS1234F1ZY</p>
      </div>
      <div class="invoice-info">
        <h2>INVOICE</h2>
        <p><strong>${invoice.invoiceNumber}</strong></p>
        <p>Date: ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        <p>Due: ${new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        <p style="margin-top: 10px;">
          <span class="status ${invoice.status === 'PAID' ? 'status-paid' : invoice.status === 'PARTIALLY_PAID' ? 'status-partial' : 'status-sent'}">
            ${invoice.status === 'PAID' ? 'PAID' : invoice.status === 'PARTIALLY_PAID' ? 'PARTIALLY PAID' : 'PENDING'}
          </span>
        </p>
      </div>
    </div>

    <div class="addresses">
      <div class="address-block">
        <h3>Bill To</h3>
        <p><strong>${invoice.customer.name}</strong></p>
        ${invoice.customer.address ? `<p>${invoice.customer.address}</p>` : ''}
        ${invoice.customer.email ? `<p>${invoice.customer.email}</p>` : ''}
        ${invoice.customer.phone ? `<p>${invoice.customer.phone}</p>` : ''}
        ${invoice.customer.gstin ? `<p>GSTIN: ${invoice.customer.gstin}</p>` : ''}
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 40%;">Description</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.lines.map(line => `
          <tr>
            <td>${line.description}</td>
            <td class="text-right">${line.quantity}</td>
            <td class="text-right">₹${parseFloat(line.unitPrice.toString()).toLocaleString('en-IN')}</td>
            <td class="text-right">₹${parseFloat(line.total.toString()).toLocaleString('en-IN')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <table class="totals">
      <tr>
        <td>Subtotal:</td>
        <td class="text-right">₹${parseFloat(invoice.subtotal.toString()).toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td>Tax:</td>
        <td class="text-right">₹${parseFloat(invoice.taxAmount.toString()).toLocaleString('en-IN')}</td>
      </tr>
      <tr class="total-row">
        <td>Total:</td>
        <td class="text-right">₹${parseFloat(invoice.total.toString()).toLocaleString('en-IN')}</td>
      </tr>
      ${parseFloat(invoice.paidAmount.toString()) > 0 ? `
        <tr>
          <td>Paid:</td>
          <td class="text-right" style="color: #166534;">₹${parseFloat(invoice.paidAmount.toString()).toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td><strong>Balance Due:</strong></td>
          <td class="text-right"><strong>₹${(parseFloat(invoice.total.toString()) - parseFloat(invoice.paidAmount.toString())).toLocaleString('en-IN')}</strong></td>
        </tr>
      ` : ''}
    </table>

    ${invoice.notes ? `
      <div style="margin-top: 30px; padding: 15px; background: #f8fafc; border-radius: 8px;">
        <p><strong>Notes:</strong></p>
        <p>${invoice.notes}</p>
      </div>
    ` : ''}

    <div class="footer">
      <p>Thank you for your business!</p>
      <p>For queries, contact us at accounts@shivfurniture.com</p>
    </div>
  </div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Invoice PDF error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
