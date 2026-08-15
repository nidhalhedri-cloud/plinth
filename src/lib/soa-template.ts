const aed = (n: number) => 'AED ' + Math.round(n).toLocaleString('en-AE');
const esc = (s: string) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const fdate = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export type SoaRow = { label: string; dueDate: string | Date | null; percent: number | null; amount: number; paidAmount: number; outstanding: number; status: string };

export function soaHtml(p: {
  company: { name: string; brandColor: string; logoDataUri: string | null };
  unit: string; project: string; client: string | null; clientId: string | null;
  escrow: { bank: string | null; accountNo: string | null };
  rows: SoaRow[];
  totals: { contracted: number; collected: number; outstanding: number };
}): string {
  const brand = p.company.brandColor || '#2563eb';
  const badge = (s: string) => {
    const c = s === 'PAID' ? '#16a34a' : s === 'OVERDUE' ? '#dc2626' : s === 'PARTIAL' ? '#d97706' : '#64748b';
    return `<span style="color:${c};font-weight:600;font-size:11px">${s[0] + s.slice(1).toLowerCase()}</span>`;
  };
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:820px;margin:0 auto}
  .hdr{background:${brand};color:#fff;padding:26px 40px;display:flex;justify-content:space-between;align-items:center}
  .hdr h1{font-size:20px} .hdr .co{font-size:13px;opacity:.9} .hdr img{max-height:42px}
  .body{padding:28px 40px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:12px;margin-bottom:18px}
  .meta b{color:#64748b;font-weight:600}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;color:#64748b;font-size:10px;text-transform:uppercase;padding:8px 8px;border-bottom:2px solid #e2e8f0}
  td{padding:8px;border-bottom:1px solid #eef2f7}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  tfoot td{font-weight:700;border-top:2px solid #e2e8f0}
  .totbox{display:flex;gap:14px;margin:18px 0}
  .totbox div{flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}
  .totbox b{display:block;font-size:10px;color:#64748b;text-transform:uppercase} .totbox span{font-size:18px;font-weight:800}
  .foot{padding:16px 40px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px}
  </style></head><body><div class="page">
  <div class="hdr"><div><div class="co">${esc(p.company.name)}</div><h1>Statement of Account</h1></div>${p.company.logoDataUri ? `<img src="${p.company.logoDataUri}">` : ''}</div>
  <div class="body">
    <div class="meta">
      <div><b>Project</b> ${esc(p.project)}</div><div><b>Unit</b> ${esc(p.unit)}</div>
      <div><b>Buyer</b> ${esc(p.client || '—')}</div><div><b>ID / Passport</b> ${esc(p.clientId || '—')}</div>
      <div><b>Escrow account</b> ${esc(p.escrow.bank || '—')}${p.escrow.accountNo ? ` · ${esc(p.escrow.accountNo)}` : ''}</div>
      <div><b>Statement date</b> ${fdate(new Date())}</div>
    </div>
    <div class="totbox">
      <div><b>Contract value</b><span>${aed(p.totals.contracted)}</span></div>
      <div><b>Collected</b><span style="color:#16a34a">${aed(p.totals.collected)}</span></div>
      <div><b>Outstanding</b><span style="color:${brand}">${aed(p.totals.outstanding)}</span></div>
    </div>
    <table>
      <thead><tr><th>Milestone</th><th>Due</th><th class="num">%</th><th class="num">Amount</th><th class="num">Paid</th><th class="num">Outstanding</th><th>Status</th></tr></thead>
      <tbody>
        ${p.rows.map((r) => `<tr><td>${esc(r.label)}</td><td>${fdate(r.dueDate)}</td><td class="num">${r.percent != null ? r.percent + '%' : '—'}</td><td class="num">${aed(r.amount)}</td><td class="num">${aed(r.paidAmount)}</td><td class="num">${aed(r.outstanding)}</td><td>${badge(r.status)}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="3">Total</td><td class="num">${aed(p.totals.contracted)}</td><td class="num">${aed(p.totals.collected)}</td><td class="num">${aed(p.totals.outstanding)}</td><td></td></tr></tfoot>
    </table>
  </div>
  <div class="foot">All buyer installments are payable to the project escrow account. Figures per the executed SPA; DLD/admin fees may change. Generated ${fdate(new Date())}.</div>
  </div></body></html>`;
}
