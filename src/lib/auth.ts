import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import prisma from './prisma';
import bcrypt from 'bcryptjs';
import { User, UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  contactId?: string | null;
}

export interface Session {
  user: AuthUser;
  expires: string;
}

const SESSION_COOKIE = 'shiv_furniture_session';
const SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Encode session data to base64 (simple approach - in production use JWT)
function encodeSession(session: Session): string {
  return Buffer.from(JSON.stringify(session)).toString('base64');
}

// Decode session data from base64
function decodeSession(encoded: string): Session | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    return JSON.parse(decoded) as Session;
  } catch {
    return null;
  }
}

export async function createSession(user: User): Promise<string> {
  const expires = new Date(Date.now() + SESSION_EXPIRY).toISOString();
  
  const session: Session = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      contactId: user.contactId,
    },
    expires,
  };
  
  // Return encoded session data instead of session ID
  return encodeSession(session);
}

export function getSession(encodedSession: string): Session | null {
  const session = decodeSession(encodedSession);
  if (!session) return null;
  
  if (new Date(session.expires) < new Date()) {
    return null;
  }
  
  return session;
}

export function deleteSession(sessionId: string): void {
  // No-op for cookie-based sessions - cookie will be cleared separately
}

export async function getCurrentUser(request?: NextRequest): Promise<AuthUser | null> {
  let sessionData: string | undefined;
  
  if (request) {
    sessionData = request.cookies.get(SESSION_COOKIE)?.value;
  } else {
    const cookieStore = await cookies();
    sessionData = cookieStore.get(SESSION_COOKIE)?.value;
  }
  
  if (!sessionData) return null;
  
  const session = getSession(sessionData);
  return session?.user || null;
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { email },
  });
  
  if (!user || !user.isActive) return null;
  
  // Check if user has a password set
  if (!user.password) return null;
  
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) return null;
  
  return user;
}

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'ADMIN';
}

export function isCustomer(user: AuthUser | null): boolean {
  return user?.role === 'CUSTOMER';
}
