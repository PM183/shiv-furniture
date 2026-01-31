import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { sendEmail, generateInviteEmail, generateToken } from '@/lib/email';

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

    if (contact.type === 'VENDOR') {
      return NextResponse.json(
        { error: 'Cannot send portal invite to vendors' },
        { status: 400 }
      );
    }

    if (!contact.email) {
      return NextResponse.json(
        { error: 'Contact does not have an email address' },
        { status: 400 }
      );
    }

    // Check if user already exists for this contact
    if (contact.user) {
      if (contact.user.password) {
        return NextResponse.json(
          { error: 'This customer already has an account' },
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
      const emailHtml = generateInviteEmail(contact.name, inviteLink);

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

    // Create new user with invite token
    const token = generateToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.user.create({
      data: {
        email: contact.email,
        name: contact.name,
        role: 'CUSTOMER',
        contactId: contact.id,
        inviteToken: token,
        inviteExpires: expires,
        password: null,
      },
    });

    // Send invitation email
    const inviteLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/setup-account?token=${token}`;
    const emailHtml = generateInviteEmail(contact.name, inviteLink);

    await sendEmail({
      to: contact.email,
      subject: 'Welcome to Shiv Furniture - Set Up Your Account',
      html: emailHtml,
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}
