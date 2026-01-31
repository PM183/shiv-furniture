import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { sendEmail, generateInviteEmail, generateToken } from '@/lib/email';
import { UserRole } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contactId } = body;

    if (!contactId) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    // Get the contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { user: true },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    if (!contact.email) {
      return NextResponse.json(
        { error: 'Contact does not have an email address' },
        { status: 400 }
      );
    }

    // Determine role based on contact type
    const role = (contact.type === 'VENDOR' ? 'VENDOR' : 'CUSTOMER') as UserRole;

    // Check if user already exists for this contact
    if (contact.user) {
      if (contact.user.password) {
        return NextResponse.json(
          { error: 'This contact already has an account set up' },
          { status: 400 }
        );
      }
      // User exists but hasn't set password - resend invite
      const token = generateToken();
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await prisma.user.update({
        where: { id: contact.user.id },
        data: {
          inviteToken: token,
          inviteExpires: expires,
        },
      });

      const inviteLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/setup-account?token=${token}`;
      const emailHtml = generateInviteEmail(contact.name, inviteLink, contact.type);

      await sendEmail({
        to: contact.email,
        subject: 'Welcome to Shiv Furniture - Set Up Your Account',
        html: emailHtml,
      });

      return NextResponse.json({
        success: true,
        message: 'Invitation resent successfully',
      });
    }

    // Check if a user with this email already exists (not linked to this contact)
    const existingUserWithEmail = await prisma.user.findUnique({
      where: { email: contact.email },
    });

    if (existingUserWithEmail) {
      // Link this contact to existing user and resend invite
      const token = generateToken();
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await prisma.user.update({
        where: { id: existingUserWithEmail.id },
        data: {
          contactId: contact.id,
          inviteToken: token,
          inviteExpires: expires,
          role: role,
        },
      });

      const inviteLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/setup-account?token=${token}`;
      const emailHtml = generateInviteEmail(contact.name, inviteLink, contact.type);

      await sendEmail({
        to: contact.email,
        subject: 'Welcome to Shiv Furniture - Set Up Your Account',
        html: emailHtml,
      });

      return NextResponse.json({
        success: true,
        message: 'Invitation sent successfully (linked to existing user)',
      });
    }

    // Create new user with invite token
    const token = generateToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.user.create({
      data: {
        email: contact.email,
        name: contact.name,
        role: role,
        contactId: contact.id,
        inviteToken: token,
        inviteExpires: expires,
        password: null,
      },
    });

    // Send invitation email
    const inviteLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/setup-account?token=${token}`;
    const emailHtml = generateInviteEmail(contact.name, inviteLink, contact.type);

    const emailSent = await sendEmail({
      to: contact.email,
      subject: 'Welcome to Shiv Furniture - Set Up Your Account',
      html: emailHtml,
    });

    if (!emailSent) {
      return NextResponse.json({
        success: false,
        message: 'User created but email failed to send. Check server logs.',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    return NextResponse.json(
      { error: 'Failed to send invitation: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
