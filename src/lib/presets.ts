import type { TenantClient } from './db';

// Common Dubai off-plan payment structures as SEED templates (§3.6) — starting points the Company
// Admin can edit or delete, not fixed system behaviour. Percentages are of the unit price.
type PresetMilestone = { label: string; percent: number; trigger: string; triggerValue?: string };
type Preset = { name: string; description: string; milestones: PresetMilestone[] };

export const PRESET_PLANS: Preset[] = [
  {
    name: '60/40 Standard',
    description: '60% across booking + construction, 40% on handover.',
    milestones: [
      { label: 'Down payment', percent: 20, trigger: 'ON_BOOKING' },
      { label: 'During construction', percent: 40, trigger: 'CONSTRUCTION_PCT', triggerValue: 'linked to build progress' },
      { label: 'On handover', percent: 40, trigger: 'ON_HANDOVER' },
    ],
  },
  {
    name: '80/20',
    description: '80% during construction, 20% on handover.',
    milestones: [
      { label: 'Down payment', percent: 20, trigger: 'ON_BOOKING' },
      { label: 'During construction', percent: 60, trigger: 'CONSTRUCTION_PCT', triggerValue: 'linked to build progress' },
      { label: 'On handover', percent: 20, trigger: 'ON_HANDOVER' },
    ],
  },
  {
    name: '50/50',
    description: '50% during construction, 50% on handover.',
    milestones: [
      { label: 'Down payment', percent: 10, trigger: 'ON_BOOKING' },
      { label: 'During construction', percent: 40, trigger: 'CONSTRUCTION_PCT', triggerValue: 'linked to build progress' },
      { label: 'On handover', percent: 50, trigger: 'ON_HANDOVER' },
    ],
  },
  {
    name: '1% Monthly',
    description: '20% down, then ~1% per month during construction, 20% on handover.',
    milestones: [
      { label: 'Down payment', percent: 20, trigger: 'ON_BOOKING' },
      { label: '1% per month during construction', percent: 60, trigger: 'CONSTRUCTION_PCT', triggerValue: '~1% / month' },
      { label: 'On handover', percent: 20, trigger: 'ON_HANDOVER' },
    ],
  },
  {
    name: 'Post-Handover 40%',
    description: '60% up to handover, 40% deferred over installments after handover.',
    milestones: [
      { label: 'Down payment', percent: 20, trigger: 'ON_BOOKING' },
      { label: 'During construction', percent: 40, trigger: 'CONSTRUCTION_PCT', triggerValue: 'linked to build progress' },
      { label: 'Post-handover installments', percent: 40, trigger: 'POST_HANDOVER', triggerValue: 'over 24 months' },
    ],
  },
];

// Create any preset plans this company doesn't already have (idempotent — matches on name).
export async function ensurePresets(db: TenantClient, companyId: string): Promise<number> {
  const existing = await db.paymentPlan.findMany({ select: { name: true } });
  const have = new Set(existing.map((p) => p.name.toLowerCase()));
  let added = 0;
  for (const preset of PRESET_PLANS) {
    if (have.has(preset.name.toLowerCase())) continue;
    const plan = await db.paymentPlan.create({
      data: { companyId, name: preset.name, description: preset.description, isPreset: true },
    });
    await db.paymentMilestone.createMany({
      data: preset.milestones.map((m, i) => ({
        companyId, paymentPlanId: plan.id, order: i, label: m.label,
        percent: m.percent, trigger: m.trigger as never, triggerValue: m.triggerValue ?? null,
      })),
    });
    added++;
  }
  return added;
}
