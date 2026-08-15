import { tenantDb } from '@/lib/db';
import { requireBroker } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

// Read-only available inventory for the broker to sell (value-add).
export function GET(req: Request) {
  return route(async () => {
    const b = await requireBroker();
    const db = tenantDb(b.companyId);
    const q = new URL(req.url).searchParams.get('q')?.trim();
    const units = await db.unit.findMany({
      where: { status: 'AVAILABLE', ...(q ? { unitNumber: { contains: q, mode: 'insensitive' } } : {}) },
      orderBy: [{ projectId: 'asc' }, { unitNumber: 'asc' }],
      take: 100,
      select: { id: true, unitNumber: true, layoutCode: true, floor: true, sizeSqft: true, view: true, priceAed: true, handover: true, project: { select: { name: true } } },
    });
    return { units: units.map((u) => ({ id: u.id, unitNumber: u.unitNumber, layoutCode: u.layoutCode, floor: u.floor, sizeSqft: u.sizeSqft, view: u.view, price: Number(u.priceAed), handover: u.handover, project: u.project?.name })) };
  });
}
