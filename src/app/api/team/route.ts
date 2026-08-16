import { tenantDb } from '@/lib/db';
import { requireUser, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';
import { canManageTeam, isAdmin, assignableRoles, subtreeUserIds, STAFF_ROLES, ROLE_LABEL } from '@/lib/hierarchy';
import type { Role, Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// The team roster the current manager can see (their subtree; admins see everyone) — staff only,
// brokers excluded (they live under their agency in the broker portal). Plus the data the invite
// form needs (which roles this manager can create, and who a new hire can report to).
export function GET() {
  return route(async () => {
    const me = await requireUser();
    if (!me.companyId || !canManageTeam(me.role)) throw new HttpError(403, 'You cannot manage a team');
    const db = tenantDb(me.companyId);

    const staffFilter: Prisma.UserWhereInput = { role: { in: STAFF_ROLES } };
    const scope: Prisma.UserWhereInput = isAdmin(me.role) ? {} : { id: { in: await subtreeUserIds(db, me.id) } };

    const users = await db.user.findMany({
      where: { AND: [staffFilter, scope] },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, managerId: true, isActive: true, createdAt: true },
    });
    const nameById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName || ''}`.trim()]));

    const invites = await db.invite.findMany({
      where: { acceptedAt: null, role: { in: STAFF_ROLES } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, role: true, expiresAt: true },
    });

    return {
      me: { role: me.role, id: me.id },
      members: users.map((u) => ({
        id: u.id, email: u.email, name: `${u.firstName} ${u.lastName || ''}`.trim(), role: u.role, roleLabel: ROLE_LABEL[u.role],
        manager: u.managerId ? nameById.get(u.managerId) || null : null, isActive: u.isActive,
      })),
      invites: invites.map((i) => ({ id: i.id, email: i.email, role: i.role, roleLabel: ROLE_LABEL[i.role] })),
      // Invite form data: roles this manager can create, and eligible "reports to" managers.
      assignableRoles: assignableRoles(me.role).map((r) => ({ value: r as Role, label: ROLE_LABEL[r] })),
      managers: [{ id: me.id, name: `${me.firstName} (you)`, role: me.role }, ...users.filter((u) => u.id !== me.id && canManageTeam(u.role)).map((u) => ({ id: u.id, name: nameById.get(u.id)!, role: u.role }))],
    };
  });
}
