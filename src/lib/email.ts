import nodemailer from 'nodemailer';

// For development, we'll use a mock/console logger
// In production, configure with real SMTP settings

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  console.log('📧 Attempting to send email to:', to);
  console.log('SMTP_USER configured:', !!process.env.SMTP_USER);
  console.log('SMTP_PASS configured:', !!process.env.SMTP_PASS);
  
  // If SMTP is not configured, log to console
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('='.repeat(60));
    console.log('📧 EMAIL (Development Mode - No SMTP configured)');
    console.log('='.repeat(60));
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('-'.repeat(60));
    console.log('HTML Content:');
    console.log(html);
    console.log('='.repeat(60));
    return true;
  }

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Shiv Furniture" <noreply@shivfurniture.com>',
      to,
      subject,
      html,
    });
    console.log('✅ Email sent successfully! Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return false;
  }
}

export function generateInviteEmail(name: string, inviteLink: string, type: 'CUSTOMER' | 'VENDOR' | 'BOTH' = 'CUSTOMER'): string {
  const isVendor = type === 'VENDOR';
  const portalType = isVendor ? 'Vendor Portal' : 'Customer Portal';
  const features = isVendor 
    ? `
              <li>View your purchase orders</li>
              <li>Track bill payments</li>
              <li>Download purchase order PDFs</li>
              <li>Manage your account</li>
            `
    : `
              <li>View your invoices and payment history</li>
              <li>Track order status</li>
              <li>Download invoice PDFs</li>
              <li>Make online payments</li>
            `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Shiv Furniture</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7fa;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🏠 Shiv Furniture</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Budget Accounting System</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">Welcome, ${name}! 👋</h2>
            
            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
              You have been invited to join the Shiv Furniture ${portalType}. This portal allows you to:
            </p>
            
            <ul style="color: #4b5563; line-height: 1.8; margin: 0 0 30px 0; padding-left: 20px;">
              ${features}
            </ul>
            
            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0;">
              Click the button below to set up your password and access your account:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Set Up Your Account
              </a>
            </div>
            
            <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 30px 0 0 0;">
              This link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} Shiv Furniture. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
