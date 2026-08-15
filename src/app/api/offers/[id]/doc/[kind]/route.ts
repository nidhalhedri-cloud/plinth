import { currentUser } from '@/lib/auth';
import { prisma, tenantDb } from '@/lib/db';
import { offerHtml, type DocKind } from '@/lib/offer-template';
import { renderPdf } from '@/lib/pdf';
import type { OfferSnapshot } from '@/lib/offer';

export const runtime = 'nodejs';

const KIND: Record<string, DocKind> = { offer: 'OFFER', booking: 'BOOKING', spa: 'SPA' };

// Render a unit document as a PDF. The reservation OFFER is available to any signed-in user; the
// BOOKING form and SPA are ADMIN-only and require the buyer details to have been captured.
export async function GET(_req: Request, { params }: { params: { id: string; kind: string } }) {
  const u = await currentUser();
  if (!u?.companyId) return new Response('Unauthorized', { status: 401 });
  const kind = KIND[params.kind];
  if (!kind) return new Response('Unknown document', { status: 404 });
  if (kind !== 'OFFER' && u.role !== 'COMPANY_ADMIN' && u.role !== 'PLATFORM_ADMIN') return new Response('Admins only', { status: 403 });

  const db = tenantDb(u.companyId);
  const o = await db.offer.findFirst({
    where: { id: params.id },
    select: {
      snapshot: true, bookingSnapshot: true, status: true, rmUserId: true,
      clientName: true, clientEmail: true, clientAddress: true, clientIdType: true, clientIdNumber: true,
      bookingStartDate: true, paymentProofAssetId: true, unit: { select: { unitNumber: true } },
    },
  });
  if (!o) return new Response('Not found', { status: 404 });
  if (kind === 'OFFER' && u.role === 'RM' && o.rmUserId !== u.id) return new Response('Forbidden', { status: 403 });

  if (kind !== 'OFFER' && !o.clientName) return new Response('Book the unit first (buyer details are required)', { status: 400 });

  const snap = ((kind !== 'OFFER' && o.bookingSnapshot) ? o.bookingSnapshot : o.snapshot) as unknown as OfferSnapshot;
  if (!snap) return new Response('Nothing to render', { status: 400 });

  const company = await prisma.company.findUnique({ where: { id: u.companyId }, select: { bookingTerms: true, spaTerms: true } });
  const terms = kind === 'BOOKING' ? company?.bookingTerms : kind === 'SPA' ? company?.spaTerms : null;
  const client = kind === 'OFFER' ? null : {
    name: o.clientName, email: o.clientEmail, address: o.clientAddress, idType: o.clientIdType, idNumber: o.clientIdNumber,
  };

  const html = offerHtml(snap, {
    kind, client, terms,
    bookingStartDate: o.bookingStartDate ? o.bookingStartDate.toISOString() : null,
    paymentProof: !!o.paymentProofAssetId,
    watermark: kind === 'OFFER' && o.status === 'DRAFT' ? 'DRAFT' : undefined,
  });
  const pdf = await renderPdf(html);
  const name = kind === 'OFFER' ? 'offer' : kind === 'BOOKING' ? 'booking-form' : 'spa';
  return new Response(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${name}-${o.unit?.unitNumber || 'unit'}.pdf"` },
  });
}
