import { prisma, type TenantClient } from './db';

const dec = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export type CommissionResult = {
  net: number;
  paidToPrice: number;      // collected toward the price (excludes DLD)
  paidPercent: number;      // % of the price the buyer has paid
  threshold: number;        // % required before broker commission is released
  qualified: boolean;       // buyer paid enough → broker may collect
  broker: { rate: number | null; amount: number | null; status: string };
  rm: { rate: number | null; amount: number | null };
};

// Resolve commission for a deal with precedence deal → brokerage/project → company default, then
// compute how much of the price the buyer has paid and whether the broker is qualified to collect.
export async function computeCommission(db: TenantClient, companyId: string, offerId: string): Promise<CommissionResult | null> {
  const offer = await db.offer.findFirst({
    where: { id: offerId },
    select: {
      priceAed: true, commissionRate: true, rmCommissionRate: true, commissionStatus: true,
      brokerage: { select: { commissionRate: true } },
      unit: { select: { project: { select: { brokerCommission: true, rmCommission: true, brokerReleaseThreshold: true } } } },
    },
  });
  if (!offer) return null;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { defaultBrokerCommission: true, defaultRmCommission: true, brokerReleaseThreshold: true },
  });
  const proj = offer.unit?.project;
  const net = Number(offer.priceAed);

  const payments = await db.payment.findMany({ where: { offerId }, select: { kind: true, paidAmount: true } });
  const paidToPrice = payments.filter((p) => p.kind === 'installment').reduce((s, p) => s + Number(p.paidAmount), 0);
  const paidPercent = net > 0 ? (paidToPrice / net) * 100 : 0;

  const brokerRate = dec(offer.commissionRate) ?? dec(offer.brokerage?.commissionRate) ?? dec(proj?.brokerCommission) ?? dec(company?.defaultBrokerCommission);
  const rmRate = dec(offer.rmCommissionRate) ?? dec(proj?.rmCommission) ?? dec(company?.defaultRmCommission);
  const threshold = dec(proj?.brokerReleaseThreshold) ?? dec(company?.brokerReleaseThreshold) ?? 20;
  const qualified = brokerRate != null && paidPercent + 1e-6 >= threshold;

  return {
    net, paidToPrice, paidPercent: Math.round(paidPercent * 10) / 10, threshold,
    qualified,
    broker: { rate: brokerRate, amount: brokerRate != null ? Math.round((net * brokerRate) / 100) : null, status: offer.commissionStatus },
    rm: { rate: rmRate, amount: rmRate != null ? Math.round((net * rmRate) / 100) : null },
  };
}
