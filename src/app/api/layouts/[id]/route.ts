import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

// Delete a layout (its floor plan) — admin only. Units keep their layout code; the offer just shows
// "floor plan not uploaded" until a new one is added.
export function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    await db.layout.deleteMany({ where: { id: params.id } });
    return { ok: true };
  });
}
