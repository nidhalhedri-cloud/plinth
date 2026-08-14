import { tenantDb } from '@/lib/db';
import { requireCompanyUser, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';
import { computeOffer, suggestPlan } from '@/lib/offer';

export const runtime = 'nodejs';

// Live preview of an offer for a unit (not saved) — the RM reviews/edits before finalizing.
export function GET(req: Request) {
  return route(async () => {
    const u = await requireCompanyUser();
    const sp = new URL(req.url).searchParams;
    const unitId = sp.get('unitId');
    if (!unitId) throw new HttpError(400, 'unitId is required');

    const discountAed = Number(sp.get('discountAed') || '0') || 0;
    const dldWaiver = sp.get('dldWaiver') === 'true';
    let handoverDate: Date | undefined;
    const hp = sp.get('handoverDate');
    if (hp) { const d = new Date(hp); if (!isNaN(d.getTime())) handoverDate = d; }

    const db = tenantDb(u.companyId);
    const snapshot = await computeOffer(db, u.companyId, unitId, { discountAed, dldWaiver, handoverDate });
    const suggestion = await suggestPlan(db, snapshot.plan.name, snapshot.fit.monthsToHandover);
    return { snapshot, suggestion };
  });
}
