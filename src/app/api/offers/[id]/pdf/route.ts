import { currentUser } from '@/lib/auth';
import { tenantDb } from '@/lib/db';
import { offerHtml } from '@/lib/offer-template';
import { renderPdf } from '@/lib/pdf';
import type { OfferSnapshot } from '@/lib/offer';

export const runtime = 'nodejs';

// Render the offer's stored snapshot to a branded PDF on demand.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await currentUser();
  if (!u?.companyId) return new Response('Unauthorized', { status: 401 });
  const db = tenantDb(u.companyId);
  const o = await db.offer.findFirst({ where: { id: params.id }, select: { snapshot: true, rmUserId: true, status: true, unit: { select: { unitNumber: true } } } });
  if (!o) return new Response('Not found', { status: 404 });
  if (u.role === 'RM' && o.rmUserId !== u.id) return new Response('Forbidden', { status: 403 });

  const snapshot = o.snapshot as unknown as OfferSnapshot;
  const html = offerHtml(snapshot, { watermark: o.status === 'DRAFT' ? 'DRAFT' : undefined });
  const pdf = await renderPdf(html);
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="offer-${o.unit?.unitNumber || 'unit'}.pdf"`,
    },
  });
}
