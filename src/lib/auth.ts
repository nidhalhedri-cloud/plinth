import 'server-only';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './db';
import type { Role } from '@prisma/client';

const COOKIE = 'dev_session';
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-only-change-me');

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  role: Role;
  companyId: string | null;
  brokerageId: string | null;
};

export function hashPassword(pw: string) { return bcrypt.hash(pw, 12); }
export function verifyPassword(pw: string, hash: string) { return bcrypt.compare(pw, hash); }

async function sign(payload: { uid: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function startSession(userId: string) {
  const token = await sign({ uid: userId });
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function endSession() {
  cookies().set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/** Current signed-in user (from the session cookie), or null. Reads through the base client. */
export async function currentUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  let uid: string;
  try {
    const { payload } = await jwtVerify(token, secret);
    uid = payload.uid as string;
  } catch {
    return null;
  }
  const u = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, email: true, firstName: true, role: true, companyId: true, brokerageId: true, isActive: true },
  });
  if (!u || !u.isActive) return null;
  return { id: u.id, email: u.email, firstName: u.firstName, role: u.role, companyId: u.companyId, brokerageId: u.brokerageId };
}

/** Throwing guards for route handlers. */
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, 'Not signed in');
  return u;
}

/** Requires an authenticated user who belongs to a company (i.e. not a bare platform admin). */
export async function requireCompanyUser(): Promise<SessionUser & { companyId: string }> {
  const u = await requireUser();
  if (!u.companyId) throw new HttpError(403, 'No company context');
  return u as SessionUser & { companyId: string };
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw new HttpError(403, 'Insufficient permissions');
  return u;
}

// A broker-portal user (external agency), scoped to their brokerage + the developer company.
export async function requireBroker(): Promise<SessionUser & { brokerageId: string; companyId: string }> {
  const u = await requireUser();
  if (u.role !== 'BROKER' || !u.brokerageId || !u.companyId) throw new HttpError(403, 'Broker access only');
  return u as SessionUser & { brokerageId: string; companyId: string };
}
