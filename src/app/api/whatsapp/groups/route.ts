import { requireCompanyUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { listGroups } from '@/lib/whatsapp';

export const runtime = 'nodejs';

// The RM's WhatsApp groups (to link one to a brokerage).
export function GET() {
  return route(async () => {
    const u = await requireCompanyUser();
    const groups = await listGroups(u.id);
    return { groups };
  });
}
