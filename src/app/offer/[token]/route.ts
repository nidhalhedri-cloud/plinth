import { prisma } from '@/lib/db';
import { offerHtml } from '@/lib/offer-template';
import type { OfferSnapshot } from '@/lib/offer';

export const runtime = 'nodejs';

// PUBLIC, open, trackable offer link. No auth — the token is the credential. Each view is counted
// and the first open flips a SENT offer to VIEWED, so the RM sees when the broker looked.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const o = await prisma.offer.findUnique({
    where: { publicToken: params.token },
    select: { id: true, snapshot: true, status: true, firstViewedAt: true },
  });
  if (!o || !o.snapshot) return new Response('Offer not found', { status: 404 });

  await prisma.offer.update({
    where: { id: o.id },
    data: {
      viewCount: { increment: 1 },
      firstViewedAt: o.firstViewedAt ?? new Date(),
      status: o.status === 'SENT' ? 'VIEWED' : undefined,
    },
  }).catch(() => {});

  const html = offerHtml(o.snapshot as unknown as OfferSnapshot);
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
