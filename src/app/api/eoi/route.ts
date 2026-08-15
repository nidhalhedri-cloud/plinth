import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

// Expressions of Interest — the pre-booking launch funnel (admin-managed sales ops).
export function GET() {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    const rows = await db.eoi.findMany({
      orderBy: [{ status: 'asc' }, { priority: 'asc' }, { createdAt: 'asc' }],
      include: { project: { select: { name: true } } },
    });
    return {
      eois: rows.map((e) => ({
        id: e.id, project: e.project?.name || null, projectId: e.projectId,
        clientName: e.clientName, clientEmail: e.clientEmail, clientPhone: e.clientPhone, clientIdNumber: e.clientIdNumber,
        tokenAmount: Number(e.tokenAmount), refundable: e.refundable, priority: e.priority, status: e.status, note: e.note, createdAt: e.createdAt,
      })),
    };
  });
}

const Create = z.object({
  projectId: z.string().nullable().optional(),
  clientName: z.string().min(1, 'Buyer name is required'),
  clientEmail: z.string().optional(),
  clientPhone: z.string().optional(),
  clientIdNumber: z.string().optional(),
  tokenAmount: z.number().nonnegative().optional(),
  refundable: z.boolean().optional(),
  note: z.string().optional(),
});

export function POST(req: Request) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const companyId = admin.companyId!;
    const db = tenantDb(companyId);
    const b = Create.parse(await req.json());
    // Submission order = allocation priority.
    const count = await db.eoi.count({ where: b.projectId ? { projectId: b.projectId } : {} });
    const eoi = await db.eoi.create({
      data: {
        companyId, projectId: b.projectId || null,
        clientName: b.clientName.trim(), clientEmail: b.clientEmail?.trim() || null, clientPhone: b.clientPhone?.trim() || null, clientIdNumber: b.clientIdNumber?.trim() || null,
        tokenAmount: b.tokenAmount ?? 0, refundable: b.refundable ?? true, priority: count + 1, note: b.note?.trim() || null,
      },
    });
    return { id: eoi.id };
  });
}
