import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

const Patch = z.object({
  label: z.string().min(1).optional(),
  kind: z.enum(['PERCENT', 'FIXED']).optional(),
  value: z.number().nonnegative().optional(),
  payer: z.enum(['BUYER', 'SELLER', 'SPLIT']).optional(),
  taxable: z.boolean().optional(),
});

export function PATCH(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    const body = Patch.parse(await req.json());
    await db.feeSetting.updateMany({ where: { id: params.id }, data: body });
    return { ok: true };
  });
}

export function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    await db.feeSetting.deleteMany({ where: { id: params.id } });
    return { ok: true };
  });
}
