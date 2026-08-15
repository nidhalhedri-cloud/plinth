import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireRole, HttpError } from '@/lib/auth';
import { route, token } from '@/lib/http';
import { computeOffer } from '@/lib/offer';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

const Convert = z.object({ unitId: z.string().min(1) });

// Allocate a unit to an EOI: creates a DRAFT offer for that unit (carrying the EOI's buyer name),
// and marks the EOI converted. The offer then flows through the normal booking pipeline.
export function POST(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const companyId = admin.companyId!;
    const db = tenantDb(companyId);
    const { unitId } = Convert.parse(await req.json());

    const eoi = await db.eoi.findFirst({ where: { id: params.id } });
    if (!eoi) throw new HttpError(404, 'EOI not found');

    const snapshot = await computeOffer(db, companyId, unitId, {});
    const offer = await db.offer.create({
      data: {
        companyId, unitId, rmUserId: admin.id, publicToken: token(20), status: 'DRAFT',
        priceAed: snapshot.net, note: `From EOI: ${eoi.clientName}`,
        clientName: eoi.clientName, clientEmail: eoi.clientEmail, clientIdNumber: eoi.clientIdNumber,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    await db.eoi.updateMany({ where: { id: params.id }, data: { status: 'CONVERTED' } });
    return { offerId: offer.id };
  });
}
