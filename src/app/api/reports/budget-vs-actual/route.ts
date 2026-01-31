import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getBudgetVsActual } from '@/lib/budget-calculations';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const analyticalAccountId = searchParams.get('analyticalAccountId');

    // Default to current year if not specified
    const currentYear = new Date().getFullYear();
    const periodStart = startDate 
      ? new Date(startDate) 
      : new Date(currentYear, 0, 1);
    const periodEnd = endDate 
      ? new Date(endDate) 
      : new Date(currentYear, 11, 31);

    const report = await getBudgetVsActual(
      periodStart, 
      periodEnd, 
      analyticalAccountId || undefined
    );

    return NextResponse.json({
      report,
      filters: {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        analyticalAccountId,
      },
    });
  } catch (error) {
    console.error('Error generating budget vs actual report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
