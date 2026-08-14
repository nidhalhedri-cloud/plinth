import { z } from 'zod';
import { prisma, tenantDb } from '@/lib/db';
import { requireRole, HttpError } from '@/lib/auth';
import { route, token } from '@/lib/http';

export const runtime = 'nodejs';

const Invite = z.object({
  email: z.string().email('Enter a valid email'),
  role: z.enum(['RM', 'COMPANY_ADMIN']).default('RM'),
});

// Company Admin invites a teammate. Returns an accept link to share (email delivery is Phase 8).
export function POST(req: Request) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const companyId = admin.companyId!;
    const body = Invite.parse(await req.json());
    const email = body.email.toLowerCase();

    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new HttpError(409, 'Someone with that email already has an account');
    }

    const db = tenantDb(companyId);
    // Replace any still-pending invite for this email in this company.
    await db.invite.deleteMany({ where: { email, acceptedAt: null } });

    const invite = await db.invite.create({
      // companyId is required by the type; the tenant extension also forces it to the session's
      // company at runtime, so a wrong value here could never write into another tenant.
      data: {
        companyId,
        email,
        role: body.role,
        token: token(24),
        invitedById: admin.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const base = process.env.APP_URL || 'http://localhost:3000';
    return { id: invite.id, email: invite.email, acceptUrl: `${base}/accept/${invite.token}` };
  });
}
