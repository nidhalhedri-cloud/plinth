import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireCompanyUser, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';
import { offerHtml } from '@/lib/offer-template';
import { renderPdf } from '@/lib/pdf';
import { sendPdfToGroup } from '@/lib/whatsapp';
import type { OfferSnapshot } from '@/lib/offer';

export const runtime = 'nodejs';

const Send = z.object({ brokerageId: z.string().min(1), caption: z.string().optional() });

// Render the offer PDF and send it into the brokerage's linked WhatsApp group (this RM's link).
export function POST(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const u = await requireCompanyUser();
    const db = tenantDb(u.companyId);
    const body = Send.parse(await req.json());

    const offer = await db.offer.findFirst({
      where: { id: params.id },
      select: { id: true, rmUserId: true, snapshot: true, status: true, unit: { select: { unitNumber: true } } },
    });
    if (!offer) throw new HttpError(404, 'Offer not found');
    if (u.role === 'RM' && offer.rmUserId !== u.id) throw new HttpError(403, 'Not your offer');

    const link = await db.brokerageLink.findFirst({ where: { brokerageId: body.brokerageId, rmUserId: u.id }, select: { whatsappGroupJid: true } });
    if (!link?.whatsappGroupJid) throw new HttpError(400, 'Link a WhatsApp group to this brokerage first');

    const pdf = await renderPdf(offerHtml(offer.snapshot as unknown as OfferSnapshot));
    const caption = body.caption?.trim() || `Reservation offer — Unit ${offer.unit?.unitNumber || ''}`.trim();
    await sendPdfToGroup(u.id, u.companyId, link.whatsappGroupJid, pdf, `offer-${offer.unit?.unitNumber || 'unit'}.pdf`, caption, { brokerageId: body.brokerageId, offerId: offer.id });

    await db.offer.updateMany({
      where: { id: offer.id },
      data: { brokerageId: body.brokerageId, sentAt: new Date(), status: offer.status === 'DRAFT' ? 'SENT' : undefined },
    });
    return { ok: true };
  });
}
