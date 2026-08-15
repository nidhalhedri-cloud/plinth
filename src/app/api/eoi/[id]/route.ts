import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

const Patch = z.object({ status: z.enum(['SUBMITTED', 'ALLOCATED', 'CONVERTED', 'REFUNDED', 'CANCELLED']) });

export function PATCH(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    const b = Patch.parse(await req.json());
    await db.eoi.updateMany({ where: { id: params.id }, data: { status: b.status } });
    return { ok: true };
  });
}

export function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    await db.eoi.deleteMany({ where: { id: params.id } });
    return { ok: true };
  });
}
