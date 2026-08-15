import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

export function DELETE(_req: Request, { params }: { params: { id: string; assetId: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    await db.asset.deleteMany({ where: { id: params.assetId, clientId: params.id } });
    return { ok: true };
  });
}
