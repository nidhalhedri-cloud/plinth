import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireRole, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

const TRIGGERS = ['ON_BOOKING', 'ON_OQOOD', 'CONSTRUCTION_PCT', 'ON_HANDOVER', 'POST_HANDOVER', 'FIXED_DATE'] as const;
const Update = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  milestones: z.array(z.object({
    label: z.string().min(1),
    percent: z.number().nullable().optional(),
    fixedAmount: z.number().nullable().optional(),
    trigger: z.enum(TRIGGERS),
    triggerValue: z.string().nullable().optional(),
  })).min(1),
});

export function PATCH(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const companyId = admin.companyId!;
    const db = tenantDb(companyId);
    const body = Update.parse(await req.json());

    const plan = await db.paymentPlan.findFirst({ where: { id: params.id }, select: { id: true } });
    if (!plan) throw new HttpError(404, 'Plan not found');

    await db.paymentPlan.updateMany({ where: { id: params.id }, data: { name: body.name.trim(), description: body.description?.trim() || null } });
    // Replace milestones wholesale (simplest correct edit).
    await db.paymentMilestone.deleteMany({ where: { paymentPlanId: params.id } });
    await db.paymentMilestone.createMany({
      data: body.milestones.map((m, i) => ({
        companyId, paymentPlanId: params.id, order: i, label: m.label.trim(),
        percent: m.percent ?? null, fixedAmount: m.fixedAmount ?? null, trigger: m.trigger, triggerValue: m.triggerValue ?? null,
      })),
    });
    return { ok: true };
  });
}

export function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    await db.paymentPlan.deleteMany({ where: { id: params.id } });
    return { ok: true };
  });
}
