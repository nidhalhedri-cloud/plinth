import { tenantDb } from '@/lib/db';
import { requireCompanyUser } from '@/lib/auth';
import { route } from '@/lib/http';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// Dashboard stats. Inventory is company-wide; offers/pipeline are scoped to the RM for RMs, whole
// company for admins.
export function GET() {
  return route(async () => {
    const u = await requireCompanyUser();
    const db = tenantDb(u.companyId);
    const offerWhere: Prisma.OfferWhereInput = u.role === 'RM' ? { rmUserId: u.id } : {};

    const now = Date.now();
    const weekAgo = new Date(now - 7 * 864e5);
    const monthAgo = new Date(now - 30 * 864e5);

    const [unitsByStatus, offersByStatus, brokerages, offersWeek, offersMonth, topRaw] = await Promise.all([
      db.unit.groupBy({ by: ['status'], _count: { _all: true } }),
      db.offer.groupBy({ by: ['status'], where: offerWhere, _count: { _all: true } }),
      db.brokerage.count(),
      db.offer.count({ where: { ...offerWhere, createdAt: { gte: weekAgo } } }),
      db.offer.count({ where: { ...offerWhere, createdAt: { gte: monthAgo } } }),
      db.offer.groupBy({
        by: ['brokerageId'],
        where: { ...offerWhere, brokerageId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { brokerageId: 'desc' } },
        take: 5,
      }),
    ]);

    const topIds = topRaw.map((t) => t.brokerageId!).filter(Boolean);
    const names = topIds.length ? await db.brokerage.findMany({ where: { id: { in: topIds } }, select: { id: true, name: true } }) : [];
    const nameById = new Map(names.map((n) => [n.id, n.name]));

    const asMap = (rows: { status: string; _count: { _all: number } }[]) =>
      rows.reduce((a, r) => { a[r.status] = r._count._all; return a; }, {} as Record<string, number>);

    const units = asMap(unitsByStatus);
    const offers = asMap(offersByStatus);
    const totalUnits = Object.values(units).reduce((a, b) => a + b, 0);
    const totalOffers = Object.values(offers).reduce((a, b) => a + b, 0);

    return {
      totals: { units: totalUnits, available: units.AVAILABLE || 0, reserved: units.RESERVED || 0, sold: units.SOLD || 0, brokerages, offers: totalOffers },
      unitsByStatus: units,
      offersByStatus: offers,
      offersWeek, offersMonth,
      topBrokerages: topRaw.map((t) => ({ name: nameById.get(t.brokerageId!) || 'Unknown', count: t._count._all })),
    };
  });
}
