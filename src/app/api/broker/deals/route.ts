import { tenantDb } from '@/lib/db';
import { requireBroker } from '@/lib/auth';
import { route } from '@/lib/http';
import { computeCommission } from '@/lib/commission';

export const runtime = 'nodejs';

// The broker's OWN clients (deals routed through their agency): buyer, unit, % paid, and whether
// their commission is qualified to collect. Commission shown here is the BROKER's own.
export function GET() {
  return route(async () => {
    const b = await requireBroker();
    const db = tenantDb(b.companyId);
    const offers = await db.offer.findMany({
      where: { brokerageId: b.brokerageId, clientName: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, clientName: true, priceAed: true, status: true, unit: { select: { unitNumber: true, project: { select: { name: true } } } } },
    });

    const deals = [];
    for (const o of offers) {
      const comm = await computeCommission(db, b.companyId, o.id);
      const payments = await db.payment.findMany({ where: { offerId: o.id }, select: { label: true, dueDate: true, amount: true, paidAmount: true } });
      const next = payments
        .filter((p) => Number(p.paidAmount) < Number(p.amount) - 0.5 && p.dueDate)
        .sort((x, y) => new Date(x.dueDate!).getTime() - new Date(y.dueDate!).getTime())[0];
      deals.push({
        id: o.id, client: o.clientName, unit: o.unit?.unitNumber, project: o.unit?.project?.name,
        price: Number(o.priceAed), status: o.status,
        paidPercent: comm?.paidPercent ?? 0, threshold: comm?.threshold ?? null,
        qualified: comm?.qualified ?? false,
        commission: comm?.broker.amount ?? null, commissionRate: comm?.broker.rate ?? null, commissionStatus: comm?.broker.status ?? null,
        nextDue: next ? { label: next.label, dueDate: next.dueDate, amount: Number(next.amount) - Number(next.paidAmount) } : null,
      });
    }
    return { deals };
  });
}
