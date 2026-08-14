import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireCompanyUser, requireRole } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

export function GET() {
  return route(async () => {
    const u = await requireCompanyUser();
    const db = tenantDb(u.companyId);
    const projects = await db.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { units: true } } },
    });
    return { projects };
  });
}

const Create = z.object({ name: z.string().min(1, 'Project name is required'), location: z.string().optional() });

export function POST(req: Request) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const companyId = admin.companyId!;
    const body = Create.parse(await req.json());
    const db = tenantDb(companyId);
    const project = await db.project.create({
      data: { companyId, name: body.name.trim(), location: body.location?.trim() || null },
    });
    return { project };
  });
}
