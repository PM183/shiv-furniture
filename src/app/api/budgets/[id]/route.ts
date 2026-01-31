import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser, isAdmin } from '@/lib/auth';

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
    const budget = await prisma.budget.findUnique({
      where: { id },
      include: {
        analyticalAccount: true,
        revisionHistory: {
          orderBy: { revisedAt: 'desc' },
        },
      },
    });

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    return NextResponse.json({ budget });
  } catch (error) {
    console.error('Error fetching budget:', error);
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 });
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

    // Get current budget for revision history
    const currentBudget = await prisma.budget.findUnique({
      where: { id },
    });

    if (!currentBudget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    // If amount is changing, create revision history
    const currentAmount = currentBudget.revisedAmount || currentBudget.amount;
    const newAmount = body.revisedAmount || body.amount;

    if (newAmount && parseFloat(newAmount.toString()) !== parseFloat(currentAmount.toString())) {
      await prisma.budgetRevision.create({
        data: {
          budgetId: id,
          previousAmount: currentAmount,
          newAmount: newAmount,
          reason: body.revisionReason || 'Budget revision',
          revisedBy: user.name,
        },
      });
    }

    const budget = await prisma.budget.update({
      where: { id },
      data: {
        name: body.name,
        amount: body.amount,
        revisedAmount: body.revisedAmount,
        notes: body.notes,
        isActive: body.isActive,
      },
      include: {
        analyticalAccount: true,
        revisionHistory: {
          orderBy: { revisedAt: 'desc' },
        },
      },
    });

    return NextResponse.json({ budget });
  } catch (error) {
    console.error('Error updating budget:', error);
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
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

    await prisma.budget.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting budget:', error);
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 });
  }
}
