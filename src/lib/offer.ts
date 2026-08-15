import { prisma, type TenantClient } from './db';
import { HttpError } from './auth';

export type ScheduleRow = { label: string; when: string; date: string | null; percent: number | null; amount: number; kind: 'price' | 'dld' };

export type OfferSnapshot = {
  generatedAt: string;
  bookingDate: string;
  handoverDate: string | null;
  company: { name: string; brandColor: string; logoDataUri: string | null };
  project: { name: string; location: string | null };
  unit: { unitNumber: string; layoutCode: string; floor: number | null; sizeSqft: number | null; view: string | null; handover: string | null };
  layout: { bedrooms: number | null; bathrooms: number | null; imageDataUri: string | null; imageVersion: number | null };
  price: number;
  discount: number;
  net: number;
  plan: { name: string | null };
  schedule: ScheduleRow[];
  scheduleTotal: number;
  dld: { amount: number; waived: boolean } | null;
  fees: { label: string; detail: string; payer: string; amount: number; waived: boolean }[];
  feesTotalBuyer: number;
  grandTotal: number;
  fit: { monthsToHandover: number | null; squeezed: boolean; warning: string | null };
};

const DAY = 864e5;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const monthsBetween = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() - a.getDate()) / 30;
const fmt = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
const isDld = (label: string) => /dld/i.test(label);

const WHEN: Record<string, string> = {
  ON_BOOKING: 'On booking', ON_OQOOD: 'On Oqood (DLD registration)', CONSTRUCTION_PCT: 'During construction',
  ON_HANDOVER: 'On handover', POST_HANDOVER: 'Post-handover', FIXED_DATE: 'On date',
};

async function assetDataUri(db: TenantClient, imageUrl: string | null): Promise<string | null> {
  if (!imageUrl) return null;
  const id = imageUrl.split('/').pop();
  if (!id) return null;
  const a = await db.asset.findFirst({ where: { id }, select: { mime: true, bytes: true } });
  return a ? `data:${a.mime};base64,${Buffer.from(a.bytes).toString('base64')}` : null;
}

type Milestone = { label: string; percent: number | null; fixedAmount: number | null; trigger: string; triggerValue: string | null };

/**
 * Turn a plan's milestones into DATED payments between the booking date and handover.
 *  • booking milestones sit at/just after booking,
 *  • construction milestones are spread evenly across [booking, handover] — which naturally
 *    COMPRESSES ("squeezes") them when the window is short,
 *  • handover sits on the handover date, post-handover as monthly installments after it.
 * If there is no handover date we can't date them, so dates come back null (labels only).
 */
function schedulePrice(milestones: Milestone[], net: number, booking: Date, handover: Date | null): { rows: ScheduleRow[]; squeezed: boolean } {
  const amountOf = (m: Milestone) => (m.percent !== null ? Math.round((net * m.percent) / 100) : (m.fixedAmount ?? 0));
  const rows: ScheduleRow[] = [];
  let squeezed = false;

  const construction = milestones.filter((m) => m.trigger === 'CONSTRUCTION_PCT');
  const windowMs = handover ? handover.getTime() - booking.getTime() : 0;
  if (handover && windowMs < 120 * DAY && construction.length) squeezed = true; // < ~4 months of build time

  let ci = 0;
  for (const m of milestones) {
    const base = { label: m.label, percent: m.percent, amount: amountOf(m), kind: 'price' as const };
    let date: Date | null = null;
    switch (m.trigger) {
      case 'ON_BOOKING': date = booking; break;
      case 'ON_OQOOD': date = handover ? new Date(Math.min(addDays(booking, 30).getTime(), handover.getTime())) : addDays(booking, 30); break;
      case 'CONSTRUCTION_PCT':
        ci++;
        date = handover && windowMs > 0 ? new Date(booking.getTime() + (windowMs * ci) / (construction.length + 1)) : (handover ?? booking);
        break;
      case 'ON_HANDOVER': date = handover; break;
      case 'POST_HANDOVER': {
        if (!handover) { date = null; break; }
        const months = parseInt((m.triggerValue || '').replace(/\D/g, '')) || 0;
        if (months > 1) {
          // Spread into monthly installments after handover — one dated row each is too long for a
          // page, so summarise: first installment date + count + per-installment amount.
          const per = Math.round(base.amount / months);
          rows.push({ ...base, when: `${months} monthly installments of ${per.toLocaleString('en-AE')}`, date: fmt(addMonths(handover, 1)) + ` →`, });
          continue;
        }
        date = addMonths(handover, 1);
        break;
      }
      case 'FIXED_DATE': { const d = new Date(m.triggerValue || ''); date = isNaN(d.getTime()) ? null : d; break; }
      default: date = booking;
    }
    rows.push({ ...base, when: `${WHEN[m.trigger] || m.trigger}${m.triggerValue && m.trigger !== 'POST_HANDOVER' ? ` · ${m.triggerValue}` : ''}`, date: date ? fmt(date) : null });
  }
  return { rows, squeezed };
}

export async function computeOffer(
  db: TenantClient,
  companyId: string,
  unitId: string,
  opts?: { discountAed?: number; dldWaiver?: boolean; bookingDate?: Date; handoverDate?: Date | null; planId?: string },
): Promise<OfferSnapshot> {
  const unit = await db.unit.findFirst({
    where: { id: unitId },
    include: { project: true, paymentPlan: { include: { milestones: { orderBy: { order: 'asc' } } } } },
  });
  if (!unit) throw new HttpError(404, 'Unit not found');

  // The agent may pick a plan for the offer, overriding the unit's default assignment.
  let chosenPlan = unit.paymentPlan;
  if (opts?.planId) {
    const p = await db.paymentPlan.findFirst({ where: { id: opts.planId }, include: { milestones: { orderBy: { order: 'asc' } } } });
    if (p) chosenPlan = p;
  }

  const [layout, fees, company] = await Promise.all([
    db.layout.findFirst({ where: { projectId: unit.projectId, code: unit.layoutCode } }),
    db.feeSetting.findMany({ where: { projectId: null }, orderBy: { sortOrder: 'asc' } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true, brandColor: true, logoUrl: true } }),
  ]);

  const price = Number(unit.priceAed);
  const discount = Math.max(0, Math.min(price, opts?.discountAed || 0));
  const net = price - discount;

  const booking = opts?.bookingDate || new Date();
  const handover = opts?.handoverDate !== undefined ? opts.handoverDate : (unit.project.handoverDate ? new Date(unit.project.handoverDate) : null);

  const milestones = (chosenPlan?.milestones || []).map((m) => ({
    label: m.label, percent: m.percent === null ? null : Number(m.percent), fixedAmount: m.fixedAmount === null ? null : Number(m.fixedAmount), trigger: m.trigger, triggerValue: m.triggerValue,
  }));
  const { rows: priceRows, squeezed } = schedulePrice(milestones, net, booking, handover);

  // Fees. The DLD fee (4%) is, by default, paid WITH the down payment → it becomes a dated line in
  // the schedule at the booking date. A DLD waiver zeroes it (developer absorbs). Other fees stay in
  // the fee table.
  const dldWaiver = !!opts?.dldWaiver;
  let dld: { amount: number; waived: boolean } | null = null;
  const feeLines: OfferSnapshot['fees'] = [];
  for (const f of fees) {
    const isPct = f.kind === 'PERCENT';
    const amount = isPct ? Math.round((net * Number(f.value)) / 100) : Number(f.value);
    if (isDld(f.label) && isPct) {
      dld = { amount: dldWaiver ? 0 : amount, waived: dldWaiver };
      feeLines.push({ label: f.label, detail: dldWaiver ? 'Waived by developer' : 'Due with down payment', payer: f.payer, amount: dldWaiver ? 0 : amount, waived: dldWaiver });
      continue;
    }
    feeLines.push({ label: f.label, detail: isPct ? `${Number(f.value)}% of price${f.taxable ? ' (incl. VAT)' : ''}` : `Fixed${f.taxable ? ' (incl. VAT)' : ''}`, payer: f.payer, amount, waived: false });
  }

  const schedule: ScheduleRow[] = [...priceRows];
  if (dld && !dld.waived) {
    schedule.push({ label: `${fees.find((f) => isDld(f.label))?.label || 'DLD registration'} (4%)`, when: 'With down payment', date: fmt(booking), percent: null, amount: dld.amount, kind: 'dld' });
  }
  const scheduleTotal = schedule.reduce((s, r) => s + r.amount, 0);

  const feesTotalBuyer = feeLines.filter((f) => f.payer !== 'SELLER' && !f.waived).reduce((s, f) => s + f.amount, 0);

  const [imageDataUri, logoDataUri] = await Promise.all([
    assetDataUri(db, layout?.imageUrl ?? null),
    assetDataUri(db, company?.logoUrl ?? null),
  ]);

  const monthsToHandover = handover ? Math.round(monthsBetween(booking, handover) * 10) / 10 : null;
  let warning: string | null = null;
  if (!handover) warning = 'Set a handover date on the project to schedule real payment dates.';
  else if (monthsToHandover !== null && monthsToHandover <= 0) warning = 'Handover date is in the past — treated as a ready unit (payments fall due now).';
  else if (squeezed) warning = `Only ~${monthsToHandover} months to handover — the construction payments have been compressed to fit.`;

  return {
    generatedAt: new Date().toISOString(),
    bookingDate: booking.toISOString(),
    handoverDate: handover ? handover.toISOString() : null,
    company: { name: company?.name || 'Developer', brandColor: company?.brandColor || '#2563eb', logoDataUri },
    project: { name: unit.project.name, location: unit.project.location },
    unit: { unitNumber: unit.unitNumber, layoutCode: unit.layoutCode, floor: unit.floor, sizeSqft: unit.sizeSqft, view: unit.view, handover: unit.handover },
    layout: { bedrooms: layout?.bedrooms ?? null, bathrooms: layout?.bathrooms ?? null, imageDataUri, imageVersion: layout?.imageVersion ?? null },
    price, discount, net,
    plan: { name: chosenPlan?.name ?? null },
    schedule, scheduleTotal,
    dld,
    fees: feeLines,
    feesTotalBuyer,
    grandTotal: net + feesTotalBuyer,
    fit: { monthsToHandover, squeezed, warning },
  };
}

/**
 * When the assigned plan doesn't fit the time to handover, suggest a better-fitting company plan.
 * Heuristic: a construction-heavy plan needs build time; if there's little/none, prefer the plan
 * with the least "during construction" weight (front/back-loaded).
 */
export async function suggestPlan(
  db: TenantClient, currentPlanName: string | null, monthsToHandover: number | null,
): Promise<{ name: string; reason: string } | null> {
  if (monthsToHandover === null || monthsToHandover > 6) return null; // plenty of runway — no need
  const plans = await db.paymentPlan.findMany({ include: { milestones: true } });
  const constructionShare = (p: { milestones: { trigger: string; percent: unknown }[] }) =>
    p.milestones.filter((m) => m.trigger === 'CONSTRUCTION_PCT').reduce((s, m) => s + Number(m.percent || 0), 0);

  const ranked = plans.map((p) => ({ name: p.name, share: constructionShare(p) })).sort((a, b) => a.share - b.share);
  const best = ranked[0];
  if (!best || best.name === currentPlanName) return null;
  const currentShare = ranked.find((r) => r.name === currentPlanName)?.share ?? 100;
  if (currentShare - best.share < 20) return null; // not meaningfully better
  return { name: best.name, reason: `Only ~${monthsToHandover} months to handover — "${best.name}" front-loads less into construction and fits the window better.` };
}
