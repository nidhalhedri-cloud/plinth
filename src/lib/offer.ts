import { prisma, type TenantClient } from './db';
import { HttpError } from './auth';

export type OfferSnapshot = {
  generatedAt: string;
  company: { name: string; brandColor: string; logoDataUri: string | null };
  project: { name: string; location: string | null };
  unit: { unitNumber: string; layoutCode: string; floor: number | null; sizeSqft: number | null; view: string | null; handover: string | null };
  layout: { bedrooms: number | null; bathrooms: number | null; imageDataUri: string | null; imageVersion: number | null };
  price: number;
  discount: number;
  net: number;
  plan: { name: string | null };
  schedule: { label: string; when: string; percent: number | null; amount: number }[];
  fees: { label: string; detail: string; payer: string; amount: number }[];
  feesTotalBuyer: number;
  grandTotal: number;
};

const WHEN: Record<string, string> = {
  ON_BOOKING: 'On booking', ON_OQOOD: 'On Oqood (DLD registration)', CONSTRUCTION_PCT: 'During construction',
  ON_HANDOVER: 'On handover', POST_HANDOVER: 'Post-handover', FIXED_DATE: 'On date',
};

async function assetDataUri(db: TenantClient, imageUrl: string | null): Promise<string | null> {
  if (!imageUrl) return null;
  const id = imageUrl.split('/').pop();
  if (!id) return null;
  const a = await db.asset.findFirst({ where: { id }, select: { mime: true, bytes: true } });
  if (!a) return null;
  return `data:${a.mime};base64,${Buffer.from(a.bytes).toString('base64')}`;
}

// Assemble everything an offer needs for a specific unit: matching layout (image inlined so the
// snapshot is self-contained and immune to later layout changes), the payment schedule with real
// AED amounts, and the fee breakdown. Pure read — the caller decides whether to persist it.
export async function computeOffer(
  db: TenantClient,
  companyId: string,
  unitId: string,
  opts?: { discountAed?: number },
): Promise<OfferSnapshot> {
  const unit = await db.unit.findFirst({
    where: { id: unitId },
    include: { project: true, paymentPlan: { include: { milestones: { orderBy: { order: 'asc' } } } } },
  });
  if (!unit) throw new HttpError(404, 'Unit not found');

  const [layout, fees, company] = await Promise.all([
    db.layout.findFirst({ where: { projectId: unit.projectId, code: unit.layoutCode } }),
    db.feeSetting.findMany({ where: { projectId: null }, orderBy: { sortOrder: 'asc' } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true, brandColor: true, logoUrl: true } }),
  ]);

  const price = Number(unit.priceAed);
  const discount = Math.max(0, Math.min(price, opts?.discountAed || 0));
  const net = price - discount;

  const schedule = (unit.paymentPlan?.milestones || []).map((m) => {
    const percent = m.percent === null ? null : Number(m.percent);
    const amount = percent !== null ? Math.round((net * percent) / 100) : (m.fixedAmount === null ? 0 : Number(m.fixedAmount));
    return { label: m.label, when: `${WHEN[m.trigger] || m.trigger}${m.triggerValue ? ` · ${m.triggerValue}` : ''}`, percent, amount };
  });

  const feeLines = fees.map((f) => {
    const isPct = f.kind === 'PERCENT';
    const amount = isPct ? Math.round((net * Number(f.value)) / 100) : Number(f.value);
    return {
      label: f.label,
      detail: isPct ? `${Number(f.value)}% of price${f.taxable ? ' (incl. VAT)' : ''}` : `Fixed${f.taxable ? ' (incl. VAT)' : ''}`,
      payer: f.payer,
      amount,
    };
  });
  const feesTotalBuyer = feeLines.filter((f) => f.payer !== 'SELLER').reduce((s, f) => s + f.amount, 0);

  const [imageDataUri, logoDataUri] = await Promise.all([
    assetDataUri(db, layout?.imageUrl ?? null),
    assetDataUri(db, company?.logoUrl ?? null),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    company: { name: company?.name || 'Developer', brandColor: company?.brandColor || '#2563eb', logoDataUri },
    project: { name: unit.project.name, location: unit.project.location },
    unit: { unitNumber: unit.unitNumber, layoutCode: unit.layoutCode, floor: unit.floor, sizeSqft: unit.sizeSqft, view: unit.view, handover: unit.handover },
    layout: { bedrooms: layout?.bedrooms ?? null, bathrooms: layout?.bathrooms ?? null, imageDataUri, imageVersion: layout?.imageVersion ?? null },
    price, discount, net,
    plan: { name: unit.paymentPlan?.name ?? null },
    schedule,
    fees: feeLines,
    feesTotalBuyer,
    grandTotal: net + feesTotalBuyer,
  };
}
