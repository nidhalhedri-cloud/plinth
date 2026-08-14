import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireCompanyUser, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

const Link = z.object({ groupJid: z.string().min(1), groupName: z.string().optional() });

// Link the current RM (and their chosen WhatsApp group) to this brokerage.
export function POST(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const u = await requireCompanyUser();
    const companyId = u.companyId;
    const db = tenantDb(companyId);
    const body = Link.parse(await req.json());

    const brokerage = await db.brokerage.findFirst({ where: { id: params.id }, select: { id: true } });
    if (!brokerage) throw new HttpError(404, 'Brokerage not found');

    await db.brokerageLink.upsert({
      where: { brokerageId_rmUserId: { brokerageId: params.id, rmUserId: u.id } },
      create: { companyId, brokerageId: params.id, rmUserId: u.id, whatsappGroupJid: body.groupJid, whatsappGroupName: body.groupName || null },
      update: { whatsappGroupJid: body.groupJid, whatsappGroupName: body.groupName || null },
    });
    return { ok: true };
  });
}
