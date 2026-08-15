import type { TenantClient } from './db';
import type { OfferSnapshot } from './offer';
import type { PaymentStatus } from '@prisma/client';

export function statusFor(amount: number, paid: number, dueISO: string | Date | null): PaymentStatus {
  if (paid >= amount - 0.5) return 'PAID';
  if (paid > 0) return 'PARTIAL';
  if (dueISO && new Date(dueISO).getTime() < Date.now()) return 'OVERDUE';
  return 'DUE';
}

// Generate the Statement of Account for a booked deal: one Payment per scheduled installment/charge.
// Idempotent — clears any prior payments for the offer (a re-book regenerates them from the frozen
// booking schedule). Buyer installments are flagged to escrow; the DLD line is not.
export async function generatePayments(db: TenantClient, companyId: string, offerId: string, unitId: string, snap: OfferSnapshot) {
  await db.payment.deleteMany({ where: { offerId } });
  const rows = snap.schedule.map((r, i) => ({
    companyId, offerId, unitId, order: i, label: r.label,
    kind: r.kind === 'dld' ? 'dld' : 'installment',
    dueDate: r.dateISO ? new Date(r.dateISO) : null,
    percent: r.percent ?? null,
    amount: r.amount,
    paidAmount: 0,
    toEscrow: r.kind !== 'dld',
    status: statusFor(r.amount, 0, r.dateISO ?? null),
  }));
  if (rows.length) await db.payment.createMany({ data: rows });
}
