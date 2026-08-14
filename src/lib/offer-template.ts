import type { OfferSnapshot } from './offer';

const aed = (n: number) => 'AED ' + Math.round(n).toLocaleString('en-AE');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// One branded HTML document used for BOTH the PDF (Puppeteer) and the public web link, so they are
// always identical. Fully self-contained (inline CSS + inline images from the snapshot).
export function offerHtml(s: OfferSnapshot, opts?: { offerId?: string; watermark?: string }): string {
  const brand = s.company.brandColor || '#2563eb';
  const specs: [string, string][] = [
    ['Unit', s.unit.unitNumber],
    ['Type', s.unit.layoutCode],
    ['Bedrooms', s.layout.bedrooms != null ? String(s.layout.bedrooms) : '—'],
    ['Floor', s.unit.floor != null ? String(s.unit.floor) : '—'],
    ['Size', s.unit.sizeSqft ? `${s.unit.sizeSqft} sqft` : '—'],
    ['View', s.unit.view || '—'],
    ['Handover', s.unit.handover || '—'],
  ];

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 820px; margin: 0 auto; background: #fff; }
  .hdr { background: ${brand}; color: #fff; padding: 28px 40px; display: flex; align-items: center; justify-content: space-between; }
  .hdr h1 { font-size: 20px; font-weight: 700; }
  .hdr .co { font-size: 13px; opacity: .9; }
  .hdr img { max-height: 44px; }
  .body { padding: 32px 40px; }
  .title { font-size: 24px; font-weight: 800; }
  .sub { color: #64748b; font-size: 13px; margin-top: 2px; }
  .grid { display: flex; gap: 24px; margin-top: 24px; }
  .plan-img { flex: 0 0 46%; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #f8fafc; display:flex; align-items:center; justify-content:center; min-height: 220px; }
  .plan-img img { width: 100%; height: auto; display: block; }
  .plan-img .none { color: #94a3b8; font-size: 12px; padding: 40px; }
  .specs { flex: 1; }
  .specs table { width: 100%; border-collapse: collapse; }
  .specs td { padding: 8px 0; border-bottom: 1px solid #eef2f7; font-size: 13px; }
  .specs td:first-child { color: #64748b; }
  .specs td:last-child { text-align: right; font-weight: 600; }
  .price-box { margin-top: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
  .price-box .row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
  .price-box .net { font-size: 20px; font-weight: 800; color: ${brand}; border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 8px; }
  h2 { font-size: 14px; font-weight: 700; margin: 28px 0 10px; text-transform: uppercase; letter-spacing: .04em; color: #334155; }
  table.data { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.data th { text-align: left; color: #64748b; font-weight: 600; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; }
  table.data td { padding: 9px 10px; border-bottom: 1px solid #eef2f7; }
  table.data td.num, table.data th.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.data tfoot td { font-weight: 700; border-top: 2px solid #e2e8f0; }
  .foot { padding: 20px 40px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; line-height: 1.5; }
  .wm { position: fixed; top: 45%; left: 0; right: 0; text-align: center; font-size: 72px; color: rgba(15,23,42,.06); font-weight: 800; transform: rotate(-20deg); pointer-events: none; }
</style></head>
<body>${opts?.watermark ? `<div class="wm">${esc(opts.watermark)}</div>` : ''}
<div class="page">
  <div class="hdr">
    <div><div class="co">${esc(s.company.name)}</div><h1>Reservation Offer</h1></div>
    ${s.company.logoDataUri ? `<img src="${s.company.logoDataUri}" alt="">` : ''}
  </div>
  <div class="body">
    <div class="title">${esc(s.project.name)}${s.project.location ? ` <span style="font-weight:400;color:#64748b">· ${esc(s.project.location)}</span>` : ''}</div>
    <div class="sub">Unit ${esc(s.unit.unitNumber)} · ${esc(s.unit.layoutCode)}${s.plan.name ? ` · ${esc(s.plan.name)} payment plan` : ''}</div>

    <div class="grid">
      <div class="plan-img">
        ${s.layout.imageDataUri ? `<img src="${s.layout.imageDataUri}" alt="Floor plan ${esc(s.unit.layoutCode)}">` : `<div class="none">Floor plan for ${esc(s.unit.layoutCode)} not uploaded</div>`}
      </div>
      <div class="specs">
        <table>${specs.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
        <div class="price-box">
          <div class="row"><span>List price</span><span>${aed(s.price)}</span></div>
          ${s.discount > 0 ? `<div class="row"><span>Discount</span><span>- ${aed(s.discount)}</span></div>` : ''}
          <div class="row net"><span>Purchase price</span><span>${aed(s.net)}</span></div>
        </div>
      </div>
    </div>

    <h2>Payment schedule</h2>
    <table class="data">
      <thead><tr><th>Milestone</th><th>When</th><th class="num">%</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${s.schedule.length ? s.schedule.map((m) => `<tr><td>${esc(m.label)}</td><td>${esc(m.when)}</td><td class="num">${m.percent != null ? m.percent + '%' : '—'}</td><td class="num">${aed(m.amount)}</td></tr>`).join('')
          : `<tr><td colspan="4" style="color:#94a3b8">No payment plan assigned to this unit.</td></tr>`}
      </tbody>
      <tfoot><tr><td colspan="3">Total</td><td class="num">${aed(s.net)}</td></tr></tfoot>
    </table>

    <h2>Fees &amp; charges</h2>
    <table class="data">
      <thead><tr><th>Fee</th><th>Basis</th><th>Paid by</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${s.fees.map((f) => `<tr><td>${esc(f.label)}</td><td>${esc(f.detail)}</td><td>${f.payer[0] + f.payer.slice(1).toLowerCase()}</td><td class="num">${aed(f.amount)}</td></tr>`).join('')}
      </tbody>
      <tfoot>
        <tr><td colspan="3">Buyer fees total</td><td class="num">${aed(s.feesTotalBuyer)}</td></tr>
        <tr><td colspan="3">Purchase price + buyer fees</td><td class="num" style="color:${brand}">${aed(s.grandTotal)}</td></tr>
      </tfoot>
    </table>
  </div>
  <div class="foot">
    This reservation offer is indicative and subject to availability and the developer's final approval and Sale &amp; Purchase Agreement.
    Figures are estimates; DLD and administrative fees are set by the Dubai Land Department and may change. Generated ${new Date(s.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.
  </div>
</div>
</body></html>`;
}
