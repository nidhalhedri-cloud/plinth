import { requireCompanyUser } from '@/lib/auth';
import { route } from '@/lib/http';
import { connect } from '@/lib/whatsapp';

export const runtime = 'nodejs';

// Start (or resume) the RM's WhatsApp link. Returns a QR to scan while connecting.
export function POST() {
  return route(async () => {
    const u = await requireCompanyUser();
    return connect(u.id, u.companyId);
  });
}
