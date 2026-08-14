import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireCompanyUser, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';
import type { OfferSnapshot } from '@/lib/offer';

export const runtime = 'nodejs';

export function GET(_req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const u = await requireCompanyUser();
    const db = tenantDb(u.companyId);
    const o = await db.offer.findFirst({
      where: { id: params.id },
      include: { unit: { select: { unitNumber: true, id: true } }, brokerage: { select: { name: true, id: true } } },
    });
    if (!o) throw new HttpError(404, 'Offer not found');
    if (u.role === 'RM' && o.rmUserId !== u.id) throw new HttpError(403, 'Not your offer');
    return {
      offer: {
        id: o.id, status: o.status, publicToken: o.publicToken, note: o.note,
        price: Number(o.priceAed), discount: o.discountAed ? Number(o.discountAed) : 0,
        unitId: o.unitId, unit: o.unit?.unitNumber, brokerage: o.brokerage?.name || null,
        viewCount: o.viewCount, firstViewedAt: o.firstViewedAt, sentAt: o.sentAt, reservedAt: o.reservedAt, createdAt: o.createdAt,
        snapshot: o.snapshot as unknown as OfferSnapshot,
      },
    };
  });
}

const STATUSES = ['DRAFT', 'SENT', 'VIEWED', 'RESERVED', 'SPA_SIGNED', 'SOLD', 'DROPPED'] as const;
const Patch = z.object({ status: z.enum(STATUSES) });

export function PATCH(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const u = await requireCompanyUser();
    const db = tenantDb(u.companyId);
    const body = Patch.parse(await req.json());

    const o = await db.offer.findFirst({ where: { id: params.id }, select: { id: true, rmUserId: true, unitId: true } });
    if (!o) throw new HttpError(404, 'Offer not found');
    if (u.role === 'RM' && o.rmUserId !== u.id) throw new HttpError(403, 'Not your offer');

    const now = new Date();
    await db.offer.updateMany({
      where: { id: params.id },
      data: { status: body.status, reservedAt: body.status === 'RESERVED' ? now : undefined },
    });

    // Keep the unit's status in step with terminal offer states.
    if (body.status === 'RESERVED') await db.unit.updateMany({ where: { id: o.unitId }, data: { status: 'RESERVED' } });
    if (body.status === 'SOLD') await db.unit.updateMany({ where: { id: o.unitId }, data: { status: 'SOLD' } });
    if (body.status === 'DROPPED') await db.unit.updateMany({ where: { id: o.unitId, status: 'RESERVED' }, data: { status: 'AVAILABLE' } });

    return { ok: true };
  });
}
