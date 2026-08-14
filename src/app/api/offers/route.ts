import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireCompanyUser } from '@/lib/auth';
import { route, token } from '@/lib/http';
import { computeOffer } from '@/lib/offer';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// List offers = the deal pipeline. Admins see all; RMs see their own (per the visibility decision).
export function GET() {
  return route(async () => {
    const u = await requireCompanyUser();
    const db = tenantDb(u.companyId);
    const where: Prisma.OfferWhereInput = u.role === 'RM' ? { rmUserId: u.id } : {};
    const offers = await db.offer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        unit: { select: { unitNumber: true, project: { select: { name: true } } } },
        brokerage: { select: { name: true } },
        rm: { select: { firstName: true, lastName: true } },
      },
    });
    return {
      offers: offers.map((o) => ({
        id: o.id, publicToken: o.publicToken, status: o.status,
        price: Number(o.priceAed), discount: o.discountAed ? Number(o.discountAed) : 0,
        unit: o.unit?.unitNumber, project: o.unit?.project?.name,
        brokerage: o.brokerage?.name || null,
        rm: `${o.rm.firstName} ${o.rm.lastName || ''}`.trim(),
        viewCount: o.viewCount, firstViewedAt: o.firstViewedAt, createdAt: o.createdAt,
      })),
    };
  });
}

const Create = z.object({
  unitId: z.string().min(1),
  brokerageId: z.string().nullable().optional(),
  discountAed: z.number().nonnegative().optional(),
  note: z.string().optional(),
  markSent: z.boolean().optional(),
  markReserved: z.boolean().optional(),
});

export function POST(req: Request) {
  return route(async () => {
    const u = await requireCompanyUser();
    const companyId = u.companyId;
    const db = tenantDb(companyId);
    const body = Create.parse(await req.json());

    const snapshot = await computeOffer(db, companyId, body.unitId, { discountAed: body.discountAed });
    const status = body.markReserved ? 'RESERVED' : body.markSent ? 'SENT' : 'DRAFT';
    const now = new Date();

    const offer = await db.offer.create({
      data: {
        companyId, unitId: body.unitId, brokerageId: body.brokerageId || null, rmUserId: u.id,
        publicToken: token(20), status,
        priceAed: snapshot.net, discountAed: body.discountAed || null, note: body.note?.trim() || null,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        sentAt: status === 'DRAFT' ? null : now,
        reservedAt: body.markReserved ? now : null,
      },
    });

    // Reserving from the offer flips the unit to Reserved.
    if (body.markReserved) await db.unit.updateMany({ where: { id: body.unitId }, data: { status: 'RESERVED' } });

    return { id: offer.id, publicToken: offer.publicToken, status: offer.status };
  });
}
