import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

// Company-wide collections (ADMIN): total contracted / collected / outstanding, plus the overdue and
// upcoming installments across every deal.
export function GET() {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    const all = await db.payment.findMany({
      include: { offer: { select: { id: true, clientName: true, unit: { select: { unitNumber: true, project: { select: { name: true } } } } } } },
    });

    const now = Date.now();
    const soon = now + 60 * 864e5;
    let contracted = 0, collected = 0;
    const overdue: unknown[] = [];
    const upcoming: unknown[] = [];

    for (const p of all) {
      const amount = Number(p.amount), paid = Number(p.paidAmount);
      contracted += amount; collected += paid;
      const outstanding = amount - paid;
      if (outstanding > 0.5 && p.dueDate) {
        const due = new Date(p.dueDate).getTime();
        const row = {
          paymentId: p.id, offerId: p.offerId, label: p.label,
          unit: p.offer.unit?.unitNumber, project: p.offer.unit?.project?.name, client: p.offer.clientName,
          amount, outstanding, dueDate: p.dueDate,
        };
        if (due < now) overdue.push(row);
        else if (due < soon) upcoming.push(row);
      }
    }
    const byDue = (a: { dueDate: Date | null }, b: { dueDate: Date | null }) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime();
    (overdue as { dueDate: Date | null }[]).sort(byDue);
    (upcoming as { dueDate: Date | null }[]).sort(byDue);

    return {
      totals: {
        contracted, collected, outstanding: contracted - collected,
        overdueCount: overdue.length,
        overdueAmount: (overdue as { outstanding: number }[]).reduce((s, r) => s + r.outstanding, 0),
      },
      overdue: overdue.slice(0, 100),
      upcoming: upcoming.slice(0, 100),
    };
  });
}
