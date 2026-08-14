import { tenantDb } from '@/lib/db';
import { requireCompanyUser } from '@/lib/auth';
import { route } from '@/lib/http';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

export function GET(req: Request) {
  return route(async () => {
    const u = await requireCompanyUser();
    const db = tenantDb(u.companyId);
    const sp = new URL(req.url).searchParams;
    const projectId = sp.get('projectId') || undefined;
    const status = sp.get('status') || undefined;
    const q = sp.get('q')?.trim();
    const page = Math.max(1, parseInt(sp.get('page') || '1'));
    const take = 50;

    const where: Prisma.UnitWhereInput = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status as Prisma.UnitWhereInput['status'];
    if (q) where.unitNumber = { contains: q, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      db.unit.findMany({
        where,
        include: { project: { select: { name: true } }, paymentPlan: { select: { name: true } } },
        orderBy: [{ projectId: 'asc' }, { unitNumber: 'asc' }],
        skip: (page - 1) * take,
        take,
      }),
      db.unit.count({ where }),
    ]);

    return {
      total, page, pageSize: take,
      units: items.map((x) => ({
        id: x.id,
        unitNumber: x.unitNumber,
        layoutCode: x.layoutCode,
        floor: x.floor,
        sizeSqft: x.sizeSqft,
        view: x.view,
        priceAed: Number(x.priceAed),
        handover: x.handover,
        status: x.status,
        project: x.project?.name || null,
        paymentPlan: x.paymentPlan?.name || null,
      })),
    };
  });
}
