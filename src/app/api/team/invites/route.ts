import { z } from 'zod';
import { prisma, tenantDb } from '@/lib/db';
import { requireUser, HttpError } from '@/lib/auth';
import { route, token } from '@/lib/http';
import { canManageTeam, assignableRoles, subtreeUserIds, ROLE_LEVEL } from '@/lib/hierarchy';
import type { Role } from '@prisma/client';

export const runtime = 'nodejs';

const Invite = z.object({
  email: z.string().email('Enter a valid email'),
  role: z.enum(['VP', 'SALES_DIRECTOR', 'TEAM_LEADER', 'RM']),
  managerId: z.string().optional(), // who they report to (default: the inviter)
});

// A manager (team leader and up) invites a teammate at a role BELOW their own, reporting to
// themselves or someone in their subtree. Returns an accept link to share.
export function POST(req: Request) {
  return route(async () => {
    const me = await requireUser();
    if (!me.companyId || !canManageTeam(me.role)) throw new HttpError(403, 'You cannot manage a team');
    const companyId = me.companyId;
    const body = Invite.parse(await req.json());
    const email = body.email.toLowerCase();

    // The role must be strictly below the inviter's level.
    if (!assignableRoles(me.role).includes(body.role as Role)) throw new HttpError(403, `You can't create a ${body.role}`);

    const db = tenantDb(companyId);

    // Manager must be the inviter or someone in the inviter's subtree, and above the new role.
    const subtree = await subtreeUserIds(db, me.id);
    let managerId = me.id;
    if (body.managerId) {
      if (!subtree.includes(body.managerId)) throw new HttpError(403, 'That manager is not in your team');
      const mgr = await db.user.findFirst({ where: { id: body.managerId }, select: { role: true } });
      if (!mgr || ROLE_LEVEL[mgr.role] <= ROLE_LEVEL[body.role as Role]) throw new HttpError(400, 'Manager must be senior to the new role');
      managerId = body.managerId;
    }

    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new HttpError(409, 'Someone with that email already has an account');
    await db.invite.deleteMany({ where: { email, acceptedAt: null } });

    const invite = await db.invite.create({
      data: { companyId, email, role: body.role as Role, managerId, token: token(24), invitedById: me.id, expiresAt: new Date(Date.now() + 7 * 864e5) },
    });
    const base = process.env.APP_URL || 'http://localhost:3010';
    return { id: invite.id, email: invite.email, acceptUrl: `${base}/accept/${invite.token}` };
  });
}
