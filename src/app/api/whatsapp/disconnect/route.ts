import { requireCompanyUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { disconnect } from '@/lib/whatsapp';

export const runtime = 'nodejs';

export function POST() {
  return route(async () => {
    const u = await requireCompanyUser();
    await disconnect(u.id);
    return { status: 'disconnected' };
  });
}
