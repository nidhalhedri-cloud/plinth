import type { Role } from '@prisma/client';
import type { TenantClient } from './db';

// Org hierarchy: Admin → VP → Sales Director → Team Leader → RM. Each level manages/sees the subtree
// below it. BROKER is external (portal only), not part of the staff tree.
export const ROLE_LEVEL: Record<Role, number> = {
  PLATFORM_ADMIN: 6, COMPANY_ADMIN: 5, VP: 4, SALES_DIRECTOR: 3, TEAM_LEADER: 2, RM: 1, BROKER: 0,
};

export const STAFF_ROLES: Role[] = ['COMPANY_ADMIN', 'VP', 'SALES_DIRECTOR', 'TEAM_LEADER', 'RM'];
export const ROLE_LABEL: Record<Role, string> = {
  PLATFORM_ADMIN: 'Platform Admin', COMPANY_ADMIN: 'Company Admin', VP: 'VP', SALES_DIRECTOR: 'Sales Director', TEAM_LEADER: 'Team Leader', RM: 'Relationship Manager', BROKER: 'Broker',
};

export const isAdmin = (r: Role) => r === 'COMPANY_ADMIN' || r === 'PLATFORM_ADMIN';
export const canManageTeam = (r: Role) => ROLE_LEVEL[r] >= ROLE_LEVEL.TEAM_LEADER; // team leader and up

// Roles a given role may create below itself (never admin, never broker — brokers come via agencies).
export function assignableRoles(inviter: Role): Role[] {
  return STAFF_ROLES.filter((r) => r !== 'COMPANY_ADMIN' && ROLE_LEVEL[r] < ROLE_LEVEL[inviter]);
}

// Every staff user id in a manager's subtree, including the root. Walks the managerId edges.
export async function subtreeUserIds(db: TenantClient, rootId: string): Promise<string[]> {
  const all = await db.user.findMany({ select: { id: true, managerId: true } });
  const children = new Map<string, string[]>();
  for (const u of all) {
    if (!u.managerId) continue;
    const list = children.get(u.managerId) || [];
    list.push(u.id);
    children.set(u.managerId, list);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const c of children.get(id) || []) stack.push(c);
  }
  return out;
}

// The set of rmUserIds whose deals a user may see: admins → everyone; managers → their subtree;
// RM → just themselves. Returns null to mean "no restriction" (admin).
export async function visibleOwnerIds(db: TenantClient, user: { id: string; role: Role }): Promise<string[] | null> {
  if (isAdmin(user.role)) return null;
  return subtreeUserIds(db, user.id);
}
