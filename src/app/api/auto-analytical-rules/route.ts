import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser, isAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rules = await prisma.autoAnalyticalRule.findMany({
      where: { isActive: true },
      include: {
        analyticalAccount: true,
      },
      orderBy: { priority: 'asc' },
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error('Error fetching auto analytical rules:', error);
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const rule = await prisma.autoAnalyticalRule.create({
      data: {
        name: body.name,
        description: body.description,
        productCategory: body.productCategory,
        productNameContains: body.productNameContains,
        analyticalAccountId: body.analyticalAccountId,
        priority: body.priority || 1,
      },
      include: {
        analyticalAccount: true,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error('Error creating auto analytical rule:', error);
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
  }
}
