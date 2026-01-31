import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
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
        { error: 'This account has already been set up' },
        { status: 400 }
      );
    }

    // Hash password and update user
    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        inviteToken: null,
        inviteExpires: null,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Password set successfully',
    });
  } catch (error) {
    console.error('Error setting password:', error);
    return NextResponse.json(
      { error: 'Failed to set password' },
      { status: 500 }
    );
  }
}
