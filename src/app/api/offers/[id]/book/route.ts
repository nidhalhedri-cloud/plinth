import { tenantDb } from '@/lib/db';
import { requireRole, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';
import { computeOffer, type OfferSnapshot } from '@/lib/offer';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// Book a unit against an offer (ADMIN only): capture the buyer's details, the payment-proof upload,
// and the date payments start — then freeze a booking schedule anchored to that start date and mark
// the unit reserved.
export function POST(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const companyId = admin.companyId!;
    const db = tenantDb(companyId);

    const form = await req.formData();
    const clientName = String(form.get('clientName') || '').trim();
    const clientEmail = String(form.get('clientEmail') || '').trim() || null;
    const clientAddress = String(form.get('clientAddress') || '').trim() || null;
    const clientIdType = String(form.get('clientIdType') || 'id');
    const clientIdNumber = String(form.get('clientIdNumber') || '').trim();
    const startStr = String(form.get('bookingStartDate') || '');
    const file = form.get('paymentProof');

    if (!clientName) throw new HttpError(400, 'Buyer name is required');
    if (!clientIdNumber) throw new HttpError(400, 'Buyer Emirates ID / passport number is required');
    const bookingStart = new Date(startStr);
    if (isNaN(bookingStart.getTime())) throw new HttpError(400, 'Choose the date payments start');
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, 'Upload proof of the booking payment');

    const offer = await db.offer.findFirst({ where: { id: params.id }, select: { id: true, unitId: true, discountAed: true, snapshot: true } });
    if (!offer) throw new HttpError(404, 'Offer not found');

    // Reuse the offer's commercial terms (discount, plan, DLD waiver) but re-anchor to the start date.
    const orig = offer.snapshot as unknown as OfferSnapshot | null;
    const dldWaiver = orig?.dld?.waived ?? false;
    const discountAed = offer.discountAed ? Number(offer.discountAed) : 0;
    let planId: string | undefined;
    if (orig?.plan.name) planId = (await db.paymentPlan.findFirst({ where: { name: orig.plan.name }, select: { id: true } }))?.id;

    const bookingSnapshot = await computeOffer(db, companyId, offer.unitId, { discountAed, dldWaiver, planId, bookingDate: bookingStart });

    const proof = await db.asset.create({
      data: { companyId, kind: 'payment_proof', mime: file.type || 'application/octet-stream', bytes: Buffer.from(await file.arrayBuffer()), size: file.size },
    });

    await db.offer.updateMany({
      where: { id: offer.id },
      data: {
        clientName, clientEmail, clientAddress,
        clientIdType: clientIdType === 'passport' ? 'passport' : 'id',
        clientIdNumber,
        bookingStartDate: bookingStart,
        paymentProofAssetId: proof.id,
        bookingSnapshot: bookingSnapshot as unknown as Prisma.InputJsonValue,
        status: 'RESERVED', reservedAt: new Date(),
      },
    });
    await db.unit.updateMany({ where: { id: offer.unitId }, data: { status: 'RESERVED' } });

    return { ok: true };
  });
}
