import { z } from 'zod';
import { prisma, tenantDb } from '@/lib/db';
import { requireRole, HttpError } from '@/lib/auth';
import { route, token } from '@/lib/http';

export const runtime = 'nodejs';

// List the broker-portal users of an agency.
export function GET(_req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    const users = await db.user.findMany({ where: { brokerageId: params.id, role: 'BROKER' }, select: { id: true, email: true, firstName: true, lastName: true, isActive: true } });
    const invites = await db.invite.findMany({ where: { brokerageId: params.id, acceptedAt: null }, select: { id: true, email: true } });
    return { users, invites };
  });
}

const Invite = z.object({ email: z.string().email('Enter a valid email') });

// Invite a broker to this agency's portal (admin). Returns an accept link to share.
export function POST(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const companyId = admin.companyId!;
    const db = tenantDb(companyId);
    const body = Invite.parse(await req.json());
    const email = body.email.toLowerCase();

    if (!(await db.brokerage.findFirst({ where: { id: params.id }, select: { id: true } }))) throw new HttpError(404, 'Brokerage not found');
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new HttpError(409, 'Someone with that email already has an account');

    await db.invite.deleteMany({ where: { email, acceptedAt: null } });
    const invite = await db.invite.create({
      data: { companyId, email, role: 'BROKER', brokerageId: params.id, token: token(24), invitedById: admin.id, expiresAt: new Date(Date.now() + 14 * 864e5) },
    });
    const base = process.env.APP_URL || 'http://localhost:3010';
    return { email, acceptUrl: `${base}/accept/${invite.token}` };
  });
}
