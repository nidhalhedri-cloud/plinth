import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireCompanyUser, requireRole } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

const TRIGGERS = ['ON_BOOKING', 'ON_OQOOD', 'CONSTRUCTION_PCT', 'ON_HANDOVER', 'POST_HANDOVER', 'FIXED_DATE'] as const;

const Milestone = z.object({
  label: z.string().min(1),
  percent: z.number().nullable().optional(),
  fixedAmount: z.number().nullable().optional(),
  trigger: z.enum(TRIGGERS),
  triggerValue: z.string().nullable().optional(),
});
const PlanInput = z.object({
  name: z.string().min(1, 'Plan name is required'),
  description: z.string().optional(),
  milestones: z.array(Milestone).min(1, 'Add at least one milestone'),
});

export function GET() {
  return route(async () => {
    const u = await requireCompanyUser();
    const db = tenantDb(u.companyId);
    const plans = await db.paymentPlan.findMany({
      orderBy: { name: 'asc' },
      include: { milestones: { orderBy: { order: 'asc' } }, _count: { select: { units: true } } },
    });
    return {
      plans: plans.map((p) => ({
        id: p.id, name: p.name, description: p.description, isPreset: p.isPreset, unitCount: p._count.units,
        milestones: p.milestones.map((m) => ({
          id: m.id, order: m.order, label: m.label,
          percent: m.percent === null ? null : Number(m.percent),
          fixedAmount: m.fixedAmount === null ? null : Number(m.fixedAmount),
          trigger: m.trigger, triggerValue: m.triggerValue,
        })),
      })),
    };
  });
}

export function POST(req: Request) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const companyId = admin.companyId!;
    const body = PlanInput.parse(await req.json());
    const db = tenantDb(companyId);
    const plan = await db.paymentPlan.create({ data: { companyId, name: body.name.trim(), description: body.description?.trim() || null } });
    await db.paymentMilestone.createMany({
      data: body.milestones.map((m, i) => ({
        companyId, paymentPlanId: plan.id, order: i, label: m.label.trim(),
        percent: m.percent ?? null, fixedAmount: m.fixedAmount ?? null, trigger: m.trigger, triggerValue: m.triggerValue ?? null,
      })),
    });
    return { id: plan.id };
  });
}
