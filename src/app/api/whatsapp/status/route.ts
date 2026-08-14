import { requireCompanyUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { status } from '@/lib/whatsapp';

export const runtime = 'nodejs';

export function GET() {
  return route(async () => {
    const u = await requireCompanyUser();
    return status(u.id);
  });
}
