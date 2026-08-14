import { endSession } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

export function POST() {
  return route(async () => {
    endSession();
    return { ok: true };
  });
}
