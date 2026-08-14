import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { route } from '@/lib/http';
import { ensurePresets } from '@/lib/presets';

export const runtime = 'nodejs';

// Load the standard Dubai payment structures as editable templates. Idempotent (skips ones you have).
export function POST() {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    const added = await ensurePresets(db, admin.companyId!);
    return { added };
  });
}
