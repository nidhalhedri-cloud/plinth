import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { route } from '@/lib/http';
import { UNIT_STATUSES } from '@/lib/excel';
import type { UnitStatus } from '@prisma/client';

export const runtime = 'nodejs';

const Patch = z.object({ status: z.enum([...UNIT_STATUSES] as [string, ...string[]]) });

export function PATCH(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    const body = Patch.parse(await req.json());
    // updateMany keeps the companyId filter (single-row by id) and never touches another tenant.
    await db.unit.updateMany({ where: { id: params.id }, data: { status: body.status as UnitStatus } });
    return { ok: true };
  });
}
