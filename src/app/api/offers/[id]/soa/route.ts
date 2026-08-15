import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireRole, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';
import { statusFor } from '@/lib/payments';
import { computeCommission } from '@/lib/commission';

export const runtime = 'nodejs';

// Statement of Account for a deal (ADMIN): the dated installments, what's paid / due / overdue, the
// escrow account, commission, and registration/handover status.
export function GET(_req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    const o = await db.offer.findFirst({
      where: { id: params.id },
      select: {
        id: true, clientName: true, clientEmail: true, clientIdType: true, clientIdNumber: true,
        priceAed: true, discountAed: true, status: true,
        commissionRate: true, commissionStatus: true, oqoodStatus: true, oqoodRef: true, oqoodDate: true, handoverStatus: true, titleDeedRef: true,
        unit: { select: { unitNumber: true, project: { select: { name: true, escrowBank: true, escrowAccountNo: true } } } },
        brokerage: { select: { name: true, commissionRate: true } },
      },
    });
    if (!o) throw new HttpError(404, 'Deal not found');

    const payments = await db.payment.findMany({ where: { offerId: params.id }, orderBy: { order: 'asc' } });
    const rows = payments.map((p) => {
      const amount = Number(p.amount), paid = Number(p.paidAmount);
      return {
        id: p.id, label: p.label, kind: p.kind, dueDate: p.dueDate,
        percent: p.percent != null ? Number(p.percent) : null,
        amount, paidAmount: paid, outstanding: Math.max(0, amount - paid),
        paidAt: p.paidAt, method: p.method, reference: p.reference, toEscrow: p.toEscrow,
        status: statusFor(amount, paid, p.dueDate),
      };
    });
    const contracted = rows.reduce((s, r) => s + r.amount, 0);
    const collected = rows.reduce((s, r) => s + r.paidAmount, 0);
    const overdue = rows.filter((r) => r.status === 'OVERDUE');
    const nextDue = rows.filter((r) => r.status !== 'PAID' && r.dueDate).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0] || null;

    const comm = await computeCommission(db, admin.companyId!, params.id);

    return {
      offer: { id: o.id, unit: o.unit?.unitNumber, project: o.unit?.project?.name, client: o.clientName, clientId: o.clientIdNumber, price: Number(o.priceAed), status: o.status },
      escrow: { bank: o.unit?.project?.escrowBank || null, accountNo: o.unit?.project?.escrowAccountNo || null },
      payments: rows,
      totals: { contracted, collected, outstanding: contracted - collected, overdueCount: overdue.length, overdueAmount: overdue.reduce((s, r) => s + r.outstanding, 0), nextDue },
      commission: {
        rate: comm?.broker.rate ?? null, amount: comm?.broker.amount ?? null, status: comm?.broker.status ?? o.commissionStatus, brokerage: o.brokerage?.name || null,
        qualified: comm?.qualified ?? false, paidPercent: comm?.paidPercent ?? 0, threshold: comm?.threshold ?? null,
        rmRate: comm?.rm.rate ?? null, rmAmount: comm?.rm.amount ?? null,
      },
      deal: { oqoodStatus: o.oqoodStatus, oqoodRef: o.oqoodRef, oqoodDate: o.oqoodDate, handoverStatus: o.handoverStatus, titleDeedRef: o.titleDeedRef },
    };
  });
}

const Deal = z.object({
  commissionRate: z.number().nonnegative().nullable().optional(),
  commissionStatus: z.enum(['accrued', 'invoiced', 'paid']).optional(),
  oqoodStatus: z.enum(['pending', 'registered', 'title_deed']).optional(),
  oqoodRef: z.string().optional(),
  oqoodDate: z.string().nullable().optional(),
  handoverStatus: z.enum(['not_started', 'completion_notice', 'snagging', 'noc', 'title_deed']).optional(),
  titleDeedRef: z.string().optional(),
});

// Update the deal's commission / Oqood-registration / handover status.
export function PATCH(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    const b = Deal.parse(await req.json());
    const data: Record<string, unknown> = {};
    for (const k of ['commissionStatus', 'oqoodStatus', 'oqoodRef', 'handoverStatus', 'titleDeedRef'] as const) if (b[k] !== undefined) data[k] = b[k];
    if (b.commissionRate !== undefined) data.commissionRate = b.commissionRate;
    if (b.oqoodDate !== undefined) data.oqoodDate = b.oqoodDate ? new Date(b.oqoodDate) : null;
    await db.offer.updateMany({ where: { id: params.id }, data });
    return { ok: true };
  });
}
