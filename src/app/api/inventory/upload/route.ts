import { tenantDb } from '@/lib/db';
import { requireRole, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';
import { parseInventory, normalizeStatus } from '@/lib/excel';
import type { UnitStatus } from '@prisma/client';

export const runtime = 'nodejs';

type RowError = { row: number; message: string };

// Validate the whole sheet first; commit NOTHING if any row is invalid (atomic import). Re-uploads
// match on (project, unit number) and update in place — never duplicating a unit.
export function POST(req: Request) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const companyId = admin.companyId!;
    const db = tenantDb(companyId);

    const form = await req.formData();
    const projectId = String(form.get('projectId') || '');
    const file = form.get('file');
    if (!projectId) throw new HttpError(400, 'Choose a project first');
    if (!(file instanceof File)) throw new HttpError(400, 'No file uploaded');

    const project = await db.project.findFirst({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new HttpError(404, 'Project not found');

    const rows = parseInventory(Buffer.from(await file.arrayBuffer()));
    if (!rows.length) throw new HttpError(400, 'No unit rows found in the sheet');

    const plans = await db.paymentPlan.findMany({ select: { id: true, name: true } });
    const planByName = new Map(plans.map((p) => [p.name.toLowerCase(), p.id]));

    const errors: RowError[] = [];
    const valid: {
      unitNumber: string; layoutCode: string; floor: number | null; sizeSqft: number | null;
      view: string | null; priceAed: number; paymentPlanId: string | null; handover: string | null; status: UnitStatus;
    }[] = [];
    const seen = new Set<string>();

    for (const r of rows) {
      if (!r.unitNumber) { errors.push({ row: r.row, message: 'Unit number is required' }); continue; }
      if (seen.has(r.unitNumber.toLowerCase())) { errors.push({ row: r.row, message: `Duplicate unit number "${r.unitNumber}" in this file` }); continue; }
      seen.add(r.unitNumber.toLowerCase());
      if (!r.layoutCode) { errors.push({ row: r.row, message: 'Layout code is required' }); continue; }
      if (r.priceAed === null || r.priceAed <= 0) { errors.push({ row: r.row, message: 'Price (AED) must be a positive number' }); continue; }

      const st = normalizeStatus(r.status);
      if (st === 'INVALID') { errors.push({ row: r.row, message: `Status "${r.status}" must be Available, Reserved, Sold or Blocked` }); continue; }

      let paymentPlanId: string | null = null;
      if (r.paymentPlanName) {
        const id = planByName.get(r.paymentPlanName.toLowerCase());
        if (!id) { errors.push({ row: r.row, message: `Payment plan "${r.paymentPlanName}" does not exist — create it first` }); continue; }
        paymentPlanId = id;
      }

      valid.push({
        unitNumber: r.unitNumber, layoutCode: r.layoutCode, floor: r.floor, sizeSqft: r.sizeSqft,
        view: r.view, priceAed: r.priceAed, paymentPlanId, handover: r.handover,
        status: (st || 'AVAILABLE') as UnitStatus,
      });
    }

    if (errors.length) return { status: 'invalid' as const, errors, rows: rows.length };

    // Which unit numbers already exist in this project → created vs updated counts.
    const existing = await db.unit.findMany({ where: { projectId }, select: { unitNumber: true } });
    const existingSet = new Set(existing.map((e) => e.unitNumber));

    await db.$transaction(
      valid.map((v) =>
        db.unit.upsert({
          where: { projectId_unitNumber: { projectId, unitNumber: v.unitNumber } },
          create: { companyId, projectId, ...v },
          update: { layoutCode: v.layoutCode, floor: v.floor, sizeSqft: v.sizeSqft, view: v.view, priceAed: v.priceAed, paymentPlanId: v.paymentPlanId, handover: v.handover, status: v.status },
        }),
      ),
    );

    const created = valid.filter((v) => !existingSet.has(v.unitNumber)).length;
    return { status: 'ok' as const, created, updated: valid.length - created };
  });
}
