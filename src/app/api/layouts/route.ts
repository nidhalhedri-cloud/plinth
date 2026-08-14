import { tenantDb } from '@/lib/db';
import { requireCompanyUser, requireRole, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

const num = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};

// List layouts for a project, merged with the layout codes that appear on units — so the UI can
// show which typologies still have no floor plan.
export function GET(req: Request) {
  return route(async () => {
    const u = await requireCompanyUser();
    const db = tenantDb(u.companyId);
    const projectId = new URL(req.url).searchParams.get('projectId') || '';
    if (!projectId) throw new HttpError(400, 'projectId is required');

    const [layouts, counts] = await Promise.all([
      db.layout.findMany({ where: { projectId }, orderBy: { code: 'asc' } }),
      db.unit.groupBy({ by: ['layoutCode'], where: { projectId }, _count: { _all: true } }),
    ]);

    const countByCode = new Map(counts.map((c) => [c.layoutCode, c._count._all]));
    const byCode = new Map(layouts.map((l) => [l.code, l]));
    const codes = new Set<string>([...Array.from(byCode.keys()), ...Array.from(countByCode.keys())]);

    const rows = Array.from(codes).sort().map((code) => {
      const l = byCode.get(code);
      return {
        code,
        unitCount: countByCode.get(code) || 0,
        id: l?.id || null,
        bedrooms: l?.bedrooms ?? null,
        bathrooms: l?.bathrooms ?? null,
        sizeMin: l?.sizeMin ?? null,
        sizeMax: l?.sizeMax ?? null,
        imageUrl: l?.imageUrl ?? null,
        imageVersion: l?.imageVersion ?? null,
      };
    });
    return { layouts: rows };
  });
}

// Upsert a layout (metadata + optional floor-plan image) on (project, code). Replacing the image
// bumps imageVersion so already-generated offers (which snapshot the version) are untouched.
export function POST(req: Request) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const companyId = admin.companyId!;
    const db = tenantDb(companyId);

    const form = await req.formData();
    const projectId = String(form.get('projectId') || '');
    const code = String(form.get('code') || '').trim();
    if (!projectId || !code) throw new HttpError(400, 'Project and layout code are required');
    if (!(await db.project.findFirst({ where: { id: projectId }, select: { id: true } }))) throw new HttpError(404, 'Project not found');

    const meta = {
      bedrooms: num(form.get('bedrooms')),
      bathrooms: num(form.get('bathrooms')),
      sizeMin: num(form.get('sizeMin')),
      sizeMax: num(form.get('sizeMax')),
    };

    const existing = await db.layout.findFirst({ where: { projectId, code } });
    let imageUrl = existing?.imageUrl ?? null;
    let imageVersion = existing?.imageVersion ?? 1;

    const file = form.get('file');
    if (file instanceof File && file.size > 0) {
      const asset = await db.asset.create({
        data: { companyId, kind: 'layout', mime: file.type || 'application/octet-stream', bytes: Buffer.from(await file.arrayBuffer()), size: file.size },
      });
      imageUrl = `/api/assets/${asset.id}`;
      if (existing?.imageUrl) imageVersion = existing.imageVersion + 1;
    }

    const layout = await db.layout.upsert({
      where: { projectId_code: { projectId, code } },
      create: { companyId, projectId, code, ...meta, imageUrl, imageVersion },
      update: { ...meta, imageUrl, imageVersion },
    });
    return { layout: { id: layout.id, code: layout.code, imageUrl: layout.imageUrl } };
  });
}
