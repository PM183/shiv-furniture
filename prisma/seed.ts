import { PrismaClient, UserRole, ContactType, ProductCategory, OrderStatus, BillStatus, InvoiceStatus, PaymentType, PaymentMethod } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create sequences
  await prisma.sequence.createMany({
    data: [
      { name: 'purchase_order', prefix: 'PO', nextNumber: 1001, padding: 5 },
      { name: 'vendor_bill', prefix: 'BILL', nextNumber: 1001, padding: 5 },
      { name: 'sales_order', prefix: 'SO', nextNumber: 1001, padding: 5 },
      { name: 'invoice', prefix: 'INV', nextNumber: 1001, padding: 5 },
      { name: 'payment', prefix: 'PAY', nextNumber: 1001, padding: 5 },
      { name: 'contact', prefix: 'C', nextNumber: 1001, padding: 5 },
      { name: 'product', prefix: 'P', nextNumber: 1001, padding: 5 },
    ],
    skipDuplicates: true,
  });

  // Create analytical accounts (cost centers)
  const analyticalAccounts = await Promise.all([
    prisma.analyticalAccount.create({
      data: {
        code: 'PROD',
        name: 'Production',
        description: 'Production department cost center',
      },
    }),
    prisma.analyticalAccount.create({
      data: {
        code: 'SALES',
        name: 'Sales & Marketing',
        description: 'Sales and marketing cost center',
      },
    }),
    prisma.analyticalAccount.create({
      data: {
        code: 'ADMIN',
        name: 'Administration',
        description: 'General administration cost center',
      },
    }),
    prisma.analyticalAccount.create({
      data: {
        code: 'WAREHOUSE',
        name: 'Warehouse',
        description: 'Warehouse and logistics cost center',
      },
    }),
    prisma.analyticalAccount.create({
      data: {
        code: 'RND',
        name: 'Research & Development',
        description: 'R&D cost center',
      },
    }),
  ]);

  const [production, sales, admin, warehouse, rnd] = analyticalAccounts;

  // Create auto analytical rules
  await prisma.autoAnalyticalRule.createMany({
    data: [
      {
        name: 'Raw Materials to Production',
        description: 'Automatically assign raw materials to Production cost center',
        productCategory: ProductCategory.RAW_MATERIAL,
        analyticalAccountId: production.id,
        priority: 1,
      },
      {
        name: 'Finished Goods to Sales',
        description: 'Automatically assign finished goods to Sales cost center',
        productCategory: ProductCategory.FINISHED_GOODS,
        analyticalAccountId: sales.id,
        priority: 2,
      },
      {
        name: 'Consumables to Administration',
        description: 'Automatically assign consumables to Admin cost center',
        productCategory: ProductCategory.CONSUMABLES,
        analyticalAccountId: admin.id,
        priority: 3,
      },
    ],
    skipDuplicates: true,
  });

  // Create budgets for current year
  const currentYear = new Date().getFullYear();
  const periodStart = new Date(currentYear, 0, 1); // Jan 1
  const periodEnd = new Date(currentYear, 11, 31); // Dec 31

  await Promise.all([
    prisma.budget.create({
      data: {
        name: `Production Budget ${currentYear}`,
        analyticalAccountId: production.id,
        periodStart,
        periodEnd,
        amount: 5000000, // 50 Lakhs
      },
    }),
    prisma.budget.create({
      data: {
        name: `Sales Budget ${currentYear}`,
        analyticalAccountId: sales.id,
        periodStart,
        periodEnd,
        amount: 2000000, // 20 Lakhs
      },
    }),
    prisma.budget.create({
      data: {
        name: `Admin Budget ${currentYear}`,
        analyticalAccountId: admin.id,
        periodStart,
        periodEnd,
        amount: 1000000, // 10 Lakhs
      },
    }),
    prisma.budget.create({
      data: {
        name: `Warehouse Budget ${currentYear}`,
        analyticalAccountId: warehouse.id,
        periodStart,
        periodEnd,
        amount: 1500000, // 15 Lakhs
      },
    }),
    prisma.budget.create({
      data: {
        name: `R&D Budget ${currentYear}`,
        analyticalAccountId: rnd.id,
        periodStart,
        periodEnd,
        amount: 800000, // 8 Lakhs
      },
    }),
  ]);

  // Create contacts (vendors and customers)
  const vendor1 = await prisma.contact.create({
    data: {
      code: 'V-00001',
      name: 'Timber Supplies Ltd.',
      type: ContactType.VENDOR,
      email: 'supplies@timber.com',
      phone: '9876543210',
      address: '123 Industrial Area',
      city: 'Delhi',
      state: 'Delhi',
      gstin: '07AAAAA0000A1Z5',
      paymentTerms: 30,
    },
  });

  const vendor2 = await prisma.contact.create({
    data: {
      code: 'V-00002',
      name: 'Hardware World',
      type: ContactType.VENDOR,
      email: 'info@hardwareworld.com',
      phone: '9876543211',
      address: '456 Market Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      gstin: '27BBBBB0000B1Z5',
      paymentTerms: 15,
    },
  });

  const customer1 = await prisma.contact.create({
    data: {
      code: 'C-00001',
      name: 'Luxury Homes Pvt. Ltd.',
      type: ContactType.CUSTOMER,
      email: 'purchase@luxuryhomes.com',
      phone: '9876543220',
      address: '789 Business Park',
      city: 'Bangalore',
      state: 'Karnataka',
      gstin: '29CCCCC0000C1Z5',
      creditLimit: 1000000,
      paymentTerms: 45,
    },
  });

  const customer2 = await prisma.contact.create({
    data: {
      code: 'C-00002',
      name: 'Interior Design Studio',
      type: ContactType.CUSTOMER,
      email: 'orders@interiordesign.com',
      phone: '9876543221',
      address: '321 Design District',
      city: 'Chennai',
      state: 'Tamil Nadu',
      gstin: '33DDDDD0000D1Z5',
      creditLimit: 500000,
      paymentTerms: 30,
    },
  });

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        code: 'RM-001',
        name: 'Teak Wood (per cubic ft)',
        category: ProductCategory.RAW_MATERIAL,
        unit: 'CFT',
        purchasePrice: 2500,
        salePrice: 3000,
        taxRate: 18,
        hsnCode: '4403',
        analyticalAccountId: production.id,
      },
    }),
    prisma.product.create({
      data: {
        code: 'RM-002',
        name: 'Plywood Sheet (8x4)',
        category: ProductCategory.RAW_MATERIAL,
        unit: 'PCS',
        purchasePrice: 1200,
        salePrice: 1500,
        taxRate: 18,
        hsnCode: '4412',
        analyticalAccountId: production.id,
      },
    }),
    prisma.product.create({
      data: {
        code: 'FG-001',
        name: 'Executive Office Desk',
        category: ProductCategory.FINISHED_GOODS,
        unit: 'PCS',
        purchasePrice: 15000,
        salePrice: 25000,
        taxRate: 18,
        hsnCode: '9403',
        analyticalAccountId: sales.id,
      },
    }),
    prisma.product.create({
      data: {
        code: 'FG-002',
        name: 'Premium Sofa Set (3+2)',
        category: ProductCategory.FINISHED_GOODS,
        unit: 'SET',
        purchasePrice: 35000,
        salePrice: 55000,
        taxRate: 18,
        hsnCode: '9401',
        analyticalAccountId: sales.id,
      },
    }),
    prisma.product.create({
      data: {
        code: 'FG-003',
        name: 'Dining Table with 6 Chairs',
        category: ProductCategory.FINISHED_GOODS,
        unit: 'SET',
        purchasePrice: 25000,
        salePrice: 42000,
        taxRate: 18,
        hsnCode: '9403',
        analyticalAccountId: sales.id,
      },
    }),
    prisma.product.create({
      data: {
        code: 'CON-001',
        name: 'Wood Polish (Litre)',
        category: ProductCategory.CONSUMABLES,
        unit: 'LTR',
        purchasePrice: 250,
        salePrice: 350,
        taxRate: 18,
        hsnCode: '3208',
        analyticalAccountId: admin.id,
      },
    }),
  ]);

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: {
      email: 'admin@shivfurniture.com',
      password: adminPassword,
      name: 'System Administrator',
      role: UserRole.ADMIN,
    },
  });

  // Create customer user linked to contact
  const customerPassword = await bcrypt.hash('customer123', 10);
  await prisma.user.create({
    data: {
      email: 'customer@example.com',
      password: customerPassword,
      name: 'Luxury Homes',
      role: UserRole.CUSTOMER,
      contactId: customer1.id,
    },
  });

  // Create sample purchase order
  const poSubtotal = 25000;
  const poTax = poSubtotal * 0.18;
  const poTotal = poSubtotal + poTax;

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-01001',
      vendorId: vendor1.id,
      orderDate: new Date(),
      expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: OrderStatus.CONFIRMED,
      subtotal: poSubtotal,
      taxAmount: poTax,
      totalAmount: poTotal,
      lines: {
        create: [
          {
            productId: products[0].id,
            quantity: 10,
            unitPrice: 2500,
            taxRate: 18,
            taxAmount: 4500,
            lineTotal: 29500,
            analyticalAccountId: production.id,
          },
        ],
      },
    },
  });

  // Create sample vendor bill
  const billSubtotal = 25000;
  const billTax = billSubtotal * 0.18;
  const billTotal = billSubtotal + billTax;

  const vendorBill = await prisma.vendorBill.create({
    data: {
      billNumber: 'BILL-01001',
      vendorId: vendor1.id,
      purchaseOrderId: purchaseOrder.id,
      billDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: BillStatus.POSTED,
      subtotal: billSubtotal,
      taxAmount: billTax,
      totalAmount: billTotal,
      lines: {
        create: [
          {
            productId: products[0].id,
            quantity: 10,
            unitPrice: 2500,
            taxRate: 18,
            taxAmount: 4500,
            lineTotal: 29500,
            analyticalAccountId: production.id,
          },
        ],
      },
    },
  });

  // Create sample sales order
  const soSubtotal = 97000;
  const soTax = soSubtotal * 0.18;
  const soTotal = soSubtotal + soTax;

  const salesOrder = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-01001',
      customerId: customer1.id,
      orderDate: new Date(),
      expectedDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: OrderStatus.CONFIRMED,
      subtotal: soSubtotal,
      taxAmount: soTax,
      totalAmount: soTotal,
      lines: {
        create: [
          {
            productId: products[2].id,
            quantity: 2,
            unitPrice: 25000,
            taxRate: 18,
            taxAmount: 9000,
            lineTotal: 59000,
            analyticalAccountId: sales.id,
          },
          {
            productId: products[4].id,
            quantity: 1,
            unitPrice: 42000,
            taxRate: 18,
            taxAmount: 7560,
            lineTotal: 49560,
            analyticalAccountId: sales.id,
          },
        ],
      },
    },
  });

  // Create sample invoice
  const invSubtotal = 97000;
  const invTax = invSubtotal * 0.18;
  const invTotal = invSubtotal + invTax;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-01001',
      customerId: customer1.id,
      salesOrderId: salesOrder.id,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      status: InvoiceStatus.POSTED,
      subtotal: invSubtotal,
      taxAmount: invTax,
      totalAmount: invTotal,
      lines: {
        create: [
          {
            productId: products[2].id,
            quantity: 2,
            unitPrice: 25000,
            taxRate: 18,
            taxAmount: 9000,
            lineTotal: 59000,
            analyticalAccountId: sales.id,
          },
          {
            productId: products[4].id,
            quantity: 1,
            unitPrice: 42000,
            taxRate: 18,
            taxAmount: 7560,
            lineTotal: 49560,
            analyticalAccountId: sales.id,
          },
        ],
      },
    },
  });

  // Create sample payment
  await prisma.payment.create({
    data: {
      paymentNumber: 'PAY-01001',
      type: PaymentType.INCOMING,
      method: PaymentMethod.BANK_TRANSFER,
      contactId: customer1.id,
      invoiceId: invoice.id,
      amount: 50000,
      paymentDate: new Date(),
      reference: 'NEFT-REF-123456',
    },
  });

  // Update invoice paid amount
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      paidAmount: 50000,
      status: InvoiceStatus.PARTIALLY_PAID,
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log('\nDefault credentials:');
  console.log('Admin: admin@shivfurniture.com / admin123');
  console.log('Customer: customer@example.com / customer123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
