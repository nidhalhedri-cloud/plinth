import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireBroker } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

export function GET() {
  return route(async () => {
    const b = await requireBroker();
    const db = tenantDb(b.companyId);
    const meetings = await db.meeting.findMany({ where: { brokerageId: b.brokerageId }, orderBy: { createdAt: 'desc' }, select: { id: true, subject: true, preferredAt: true, note: true, status: true, createdAt: true } });
    return { meetings };
  });
}

const Create = z.object({ subject: z.string().min(1, 'Subject is required'), preferredAt: z.string().optional(), note: z.string().optional() });

// Broker requests a meeting / callback with the developer.
export function POST(req: Request) {
  return route(async () => {
    const b = await requireBroker();
    const db = tenantDb(b.companyId);
    const body = Create.parse(await req.json());
    await db.meeting.create({ data: { companyId: b.companyId, brokerageId: b.brokerageId, requestedById: b.id, subject: body.subject.trim(), preferredAt: body.preferredAt ? new Date(body.preferredAt) : null, note: body.note?.trim() || null } });
    return { ok: true };
  });
}
