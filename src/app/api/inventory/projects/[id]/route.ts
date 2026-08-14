import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

const Patch = z.object({
  name: z.string().min(1).optional(),
  location: z.string().nullable().optional(),
  handoverDate: z.string().nullable().optional(), // ISO date, or null to clear
});

export function PATCH(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    const body = Patch.parse(await req.json());
    const data: { name?: string; location?: string | null; handoverDate?: Date | null } = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.location !== undefined) data.location = body.location?.trim() || null;
    if (body.handoverDate !== undefined) data.handoverDate = body.handoverDate ? new Date(body.handoverDate) : null;
    await db.project.updateMany({ where: { id: params.id }, data });
    return { ok: true };
  });
}
