import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        inviteToken: token,
        inviteExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation link' },
        { status: 400 }
      );
    }

    if (user.password) {
      return NextResponse.json(
        { error: 'This account has already been set up. Please login.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Error verifying invite:', error);
    return NextResponse.json(
      { error: 'Failed to verify invitation' },
      { status: 500 }
    );
  }
}
