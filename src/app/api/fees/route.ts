import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireCompanyUser, requireRole } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

const FeeInput = z.object({
  label: z.string().min(1, 'Label is required'),
  kind: z.enum(['PERCENT', 'FIXED']),
  value: z.number().nonnegative(),
  payer: z.enum(['BUYER', 'SELLER', 'SPLIT']).default('BUYER'),
  taxable: z.boolean().default(false),
});

export function GET() {
  return route(async () => {
    const u = await requireCompanyUser();
    const db = tenantDb(u.companyId);
    const fees = await db.feeSetting.findMany({ where: { projectId: null }, orderBy: { sortOrder: 'asc' } });
    return {
      fees: fees.map((f) => ({
        id: f.id, label: f.label, kind: f.kind, value: Number(f.value),
        payer: f.payer, taxable: f.taxable, isSystem: f.isSystem, sortOrder: f.sortOrder,
      })),
    };
  });
}

export function POST(req: Request) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const companyId = admin.companyId!;
    const body = FeeInput.parse(await req.json());
    const db = tenantDb(companyId);
    const count = await db.feeSetting.count({ where: { projectId: null } });
    const fee = await db.feeSetting.create({
      data: { companyId, label: body.label.trim(), kind: body.kind, value: body.value, payer: body.payer, taxable: body.taxable, sortOrder: count + 1 },
    });
    return { id: fee.id };
  });
}
