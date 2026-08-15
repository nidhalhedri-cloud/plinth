import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireCompanyUser } from '@/lib/auth';
import { route } from '@/lib/http';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// Admins see every brokerage; RMs see the ones they're linked to (which includes ones they created).
export function GET() {
  return route(async () => {
    const u = await requireCompanyUser();
    const db = tenantDb(u.companyId);
    const where: Prisma.BrokerageWhereInput = u.role === 'RM' ? { links: { some: { rmUserId: u.id } } } : {};
    const brokerages = await db.brokerage.findMany({
      where, orderBy: { name: 'asc' },
      include: { links: { include: { rm: { select: { id: true, firstName: true, lastName: true } } } } },
    });
    return {
      brokerages: brokerages.map((b) => ({
        id: b.id, name: b.name, reraNumber: b.reraNumber, contactPerson: b.contactPerson, phone: b.phone,
        links: b.links.map((l) => ({
          rmUserId: l.rmUserId, rmName: `${l.rm.firstName} ${l.rm.lastName || ''}`.trim(),
          groupJid: l.whatsappGroupJid, groupName: l.whatsappGroupName, mine: l.rmUserId === u.id,
        })),
      })),
    };
  });
}

const Create = z.object({
  name: z.string().min(1, 'Brokerage name is required'),
  reraNumber: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  commissionRate: z.number().nonnegative().nullable().optional(),
  agreementRegistered: z.boolean().optional(),
});

export function POST(req: Request) {
  return route(async () => {
    const u = await requireCompanyUser();
    const companyId = u.companyId;
    const db = tenantDb(companyId);
    const b = Create.parse(await req.json());
    const brokerage = await db.brokerage.create({
      data: { companyId, name: b.name.trim(), reraNumber: b.reraNumber?.trim() || null, contactPerson: b.contactPerson?.trim() || null, phone: b.phone?.trim() || null, commissionRate: b.commissionRate ?? null, agreementRegistered: b.agreementRegistered ?? false },
    });
    // The creator (an RM) is auto-linked so it shows on their list; they add the group next.
    if (u.role === 'RM') await db.brokerageLink.create({ data: { companyId, brokerageId: brokerage.id, rmUserId: u.id } });
    return { id: brokerage.id };
  });
}
