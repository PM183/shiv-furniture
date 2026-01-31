import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser, isAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const analyticalAccountId = searchParams.get('analyticalAccountId');
    const year = searchParams.get('year');

    const where: any = { isActive: true };
    
    if (analyticalAccountId) {
      where.analyticalAccountId = analyticalAccountId;
    }

    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      where.periodStart = { gte: startDate };
      where.periodEnd = { lte: endDate };
    }

    const budgets = await prisma.budget.findMany({
      where,
      include: {
        analyticalAccount: true,
        revisionHistory: {
          orderBy: { revisedAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { periodStart: 'desc' },
    });

    return NextResponse.json({ budgets });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Check for duplicate budget for same cost center and period
    const existing = await prisma.budget.findFirst({
      where: {
        analyticalAccountId: body.analyticalAccountId,
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Budget already exists for this cost center and period' },
        { status: 400 }
      );
    }

    const budget = await prisma.budget.create({
      data: {
        name: body.name,
        analyticalAccountId: body.analyticalAccountId,
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        amount: body.amount,
        notes: body.notes,
      },
      include: {
        analyticalAccount: true,
      },
    });

    return NextResponse.json({ budget }, { status: 201 });
  } catch (error) {
    console.error('Error creating budget:', error);
    return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 });
  }
}
