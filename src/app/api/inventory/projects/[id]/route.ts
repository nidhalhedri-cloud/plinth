import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

const Patch = z.object({
  name: z.string().min(1).optional(),
  location: z.string().nullable().optional(),
  handoverDate: z.string().nullable().optional(), // ISO date, or null to clear
  escrowBank: z.string().nullable().optional(),
  escrowAccountNo: z.string().nullable().optional(),
});

export function PATCH(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    const body = Patch.parse(await req.json());
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.location !== undefined) data.location = body.location?.trim() || null;
    if (body.handoverDate !== undefined) data.handoverDate = body.handoverDate ? new Date(body.handoverDate) : null;
    if (body.escrowBank !== undefined) data.escrowBank = body.escrowBank?.trim() || null;
    if (body.escrowAccountNo !== undefined) data.escrowAccountNo = body.escrowAccountNo?.trim() || null;
    await db.project.updateMany({ where: { id: params.id }, data });
    return { ok: true };
  });
}

// Delete a project and everything under it (units, layouts) — admin only.
export function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    await db.project.deleteMany({ where: { id: params.id } });
    return { ok: true };
  });
}
