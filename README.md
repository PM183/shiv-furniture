# Shiv Furniture - Budget Accounting System

A comprehensive ERP-style budget accounting system built with Next.js, PostgreSQL, and Prisma.

## Features

- **Master Data Management**: Contacts, Products, Analytical Accounts, Budgets, Auto Analytical Models
- **Transaction Processing**: Purchase Orders, Vendor Bills, Sales Orders, Customer Invoices
- **Budget vs Actual Tracking**: Real-time budget utilization and performance metrics
- **Payment & Reconciliation**: Automatic invoice status updates
- **Customer Portal**: Self-service invoice viewing and payments
- **Reports & Dashboard**: Visual analytics with charts and filters

## Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Charts**: Chart.js with react-chartjs-2
- **Auth**: Role-based authentication (Admin, Customer Portal User)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository and navigate to the project directory

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```
Edit `.env` with your PostgreSQL connection string.

4. Generate Prisma client and push schema:
```bash
npm run db:generate
npm run db:push
```

5. Seed the database with sample data:
```bash
npm run db:seed
```

6. Start the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

### Default Login Credentials

- **Admin**: admin@shivfurniture.com / admin123
- **Customer**: customer@example.com / customer123

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Admin dashboard pages
│   ├── (portal)/          # Customer portal pages
│   └── api/               # API routes
├── components/            # Reusable React components
├── lib/                   # Utility functions and configurations
├── hooks/                 # Custom React hooks
├── store/                 # Zustand state management
└── types/                 # TypeScript type definitions
```

## Database Schema

The system uses the following main tables:
- users, contacts, products
- analytical_accounts, budgets
- auto_analytical_rules
- purchase_orders, vendor_bills
- sales_orders, invoices
- payments

## API Endpoints

### Master Data
- `GET/POST /api/contacts` - Manage contacts
- `GET/POST /api/products` - Manage products
- `GET/POST /api/analytical-accounts` - Manage cost centers
- `GET/POST /api/budgets` - Manage budgets

### Transactions
- `GET/POST /api/purchase-orders` - Purchase orders
- `GET/POST /api/vendor-bills` - Vendor bills
- `GET/POST /api/sales-orders` - Sales orders
- `GET/POST /api/invoices` - Customer invoices

### Reports
- `GET /api/reports/budget-vs-actual` - Budget utilization report
- `GET /api/reports/cost-center-performance` - Cost center analysis

## License

MIT
