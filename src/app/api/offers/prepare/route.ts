import { tenantDb } from '@/lib/db';
import { requireCompanyUser, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';
import { computeOffer } from '@/lib/offer';

export const runtime = 'nodejs';

// Live preview of an offer for a unit (not saved) — the agent reviews/edits before finalizing.
export function GET(req: Request) {
  return route(async () => {
    const u = await requireCompanyUser();
    const sp = new URL(req.url).searchParams;
    const unitId = sp.get('unitId');
    if (!unitId) throw new HttpError(400, 'unitId is required');

    const discountAed = Number(sp.get('discountAed') || '0') || 0;
    const dldWaiver = sp.get('dldWaiver') === 'true';
    const planId = sp.get('planId') || undefined;
    let bookingDate: Date | undefined;
    const bp = sp.get('bookingDate');
    if (bp) { const d = new Date(bp); if (!isNaN(d.getTime())) bookingDate = d; }

    const db = tenantDb(u.companyId);
    const snapshot = await computeOffer(db, u.companyId, unitId, { discountAed, dldWaiver, planId, bookingDate });
    return { snapshot };
  });
}
