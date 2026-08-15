'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { ChevronLeft, Download, Loader2, Check, X, Building2 } from 'lucide-react';

const money = (n: number) => 'AED ' + Math.round(n).toLocaleString('en-AE');
const fdate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const STATUS: Record<string, string> = { PAID: 'text-emerald-300 bg-emerald-500/15', OVERDUE: 'text-red-300 bg-red-500/15', PARTIAL: 'text-amber-300 bg-amber-500/15', DUE: 'text-slate-400 bg-slate-700/40' };

type Pay = { id: string; label: string; kind: string; dueDate: string | null; percent: number | null; amount: number; paidAmount: number; outstanding: number; toEscrow: boolean; status: string };
type Soa = {
  offer: { id: string; unit: string; project: string; client: string | null; clientId: string | null; price: number; status: string };
  escrow: { bank: string | null; accountNo: string | null };
  payments: Pay[];
  totals: { contracted: number; collected: number; outstanding: number; overdueCount: number; overdueAmount: number };
  commission: { rate: number | null; amount: number | null; status: string; brokerage: string | null; qualified: boolean; paidPercent: number; threshold: number | null; rmRate: number | null; rmAmount: number | null };
  deal: { oqoodStatus: string; oqoodRef: string | null; oqoodDate: string | null; handoverStatus: string; titleDeedRef: string | null };
};

export default function SoaPage({ params }: { params: { offerId: string } }) {
  const id = params.offerId;
  const [d, setD] = useState<Soa | null>(null);
  const [payFor, setPayFor] = useState<Pay | null>(null);
  const load = useCallback(() => api<Soa>(`/api/offers/${id}/soa`).then(setD), [id]);
  useEffect(() => { load(); }, [load]);

  const patchDeal = async (body: Record<string, unknown>) => { await api(`/api/offers/${id}/soa`, { method: 'PATCH', json: body }); load(); };

  if (!d) return <p className="text-slate-500 text-sm">Loading…</p>;

  return (
    <div className="max-w-4xl">
      <Link href="/collections" className="text-xs text-slate-500 hover:text-white flex items-center gap-1 mb-3"><ChevronLeft className="w-3.5 h-3.5" /> Collections</Link>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Unit {d.offer.unit}</h1>
          <p className="text-slate-400 text-sm flex items-center gap-1.5 mt-0.5"><Building2 className="w-4 h-4" /> {d.offer.project} · {d.offer.client || 'No buyer'}{d.offer.clientId ? ` · ${d.offer.clientId}` : ''}</p>
        </div>
        <a href={`/api/offers/${id}/soa/pdf`} target="_blank" className="btn-ghost"><Download className="w-4 h-4" /> Statement PDF</a>
      </div>

      {d.escrow.bank && <p className="text-xs text-slate-500 mt-2">Escrow: {d.escrow.bank}{d.escrow.accountNo ? ` · ${d.escrow.accountNo}` : ''}</p>}

      <div className="grid grid-cols-3 gap-3 mt-5">
        <div className="card p-4"><p className="text-[11px] text-slate-500 uppercase">Contract</p><p className="text-xl font-bold text-white">{money(d.totals.contracted)}</p></div>
        <div className="card p-4"><p className="text-[11px] text-slate-500 uppercase">Collected</p><p className="text-xl font-bold text-emerald-300">{money(d.totals.collected)}</p></div>
        <div className="card p-4"><p className="text-[11px] text-slate-500 uppercase">Outstanding</p><p className="text-xl font-bold text-indigo-300">{money(d.totals.outstanding)}</p></div>
      </div>

      {/* Statement */}
      <div className="card mt-4 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-xs text-slate-500 text-left border-b border-slate-800"><tr><th className="px-4 py-2.5">Milestone</th><th className="px-4 py-2.5">Due</th><th className="px-4 py-2.5 text-right">Amount</th><th className="px-4 py-2.5 text-right">Paid</th><th className="px-4 py-2.5 text-right">Outstanding</th><th className="px-4 py-2.5">Status</th><th></th></tr></thead>
          <tbody className="divide-y divide-slate-800/60">
            {d.payments.map(p => (
              <tr key={p.id} className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 text-white">{p.label}{p.toEscrow && <span className="text-[10px] text-slate-500 ml-1">escrow</span>}</td>
                <td className="px-4 py-2.5 text-slate-400">{fdate(p.dueDate)}</td>
                <td className="px-4 py-2.5 text-right text-slate-200">{money(p.amount)}</td>
                <td className="px-4 py-2.5 text-right text-slate-400">{money(p.paidAmount)}</td>
                <td className="px-4 py-2.5 text-right text-slate-200">{money(p.outstanding)}</td>
                <td className="px-4 py-2.5"><span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS[p.status] || ''}`}>{p.status[0] + p.status.slice(1).toLowerCase()}</span></td>
                <td className="px-4 py-2.5 text-right">{p.status !== 'PAID' && <button onClick={() => setPayFor(p)} className="text-[11px] px-2 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white">Record</button>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {/* Deal status */}
      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-white">Commission</p>
            {d.commission.rate != null && (d.commission.qualified
              ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">Broker qualified</span>
              : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">{d.commission.paidPercent}% / {d.commission.threshold}%</span>)}
          </div>
          <p className="text-[11px] text-slate-500">Broker {d.commission.brokerage ? `· ${d.commission.brokerage}` : ''}</p>
          <p className="text-lg font-bold text-white">{d.commission.amount != null ? money(d.commission.amount) : '—'} {d.commission.rate != null && <span className="text-xs text-slate-500">({d.commission.rate}%)</span>}</p>
          {d.commission.rmAmount != null && <p className="text-[11px] text-slate-400 mt-1">RM: {money(d.commission.rmAmount)} ({d.commission.rmRate}%)</p>}
          <select className="field !py-1.5 text-xs mt-2" value={d.commission.status} onChange={e => patchDeal({ commissionStatus: e.target.value })}>
            {['accrued', 'invoiced', 'paid'].map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div className="card p-4">
          <p className="text-sm font-semibold text-white mb-2">Oqood / DLD registration</p>
          <select className="field !py-1.5 text-xs mb-2" value={d.deal.oqoodStatus} onChange={e => patchDeal({ oqoodStatus: e.target.value })}>
            <option value="pending">Pending</option><option value="registered">Registered (Oqood)</option><option value="title_deed">Title deed issued</option>
          </select>
          <input className="field !py-1.5 text-xs" placeholder="Oqood / reference no." defaultValue={d.deal.oqoodRef || ''} onBlur={e => e.target.value !== (d.deal.oqoodRef || '') && patchDeal({ oqoodRef: e.target.value })} />
        </div>
        <div className="card p-4">
          <p className="text-sm font-semibold text-white mb-2">Handover</p>
          <select className="field !py-1.5 text-xs mb-2" value={d.deal.handoverStatus} onChange={e => patchDeal({ handoverStatus: e.target.value })}>
            <option value="not_started">Not started</option><option value="completion_notice">Completion notice</option><option value="snagging">Snagging</option><option value="noc">NOC issued</option><option value="title_deed">Title deed</option>
          </select>
          <input className="field !py-1.5 text-xs" placeholder="Title deed no." defaultValue={d.deal.titleDeedRef || ''} onBlur={e => e.target.value !== (d.deal.titleDeedRef || '') && patchDeal({ titleDeedRef: e.target.value })} />
        </div>
      </div>

      {payFor && <RecordModal pay={payFor} onClose={() => setPayFor(null)} onSaved={() => { setPayFor(null); load(); }} />}
    </div>
  );
}

function RecordModal({ pay, onClose, onSaved }: { pay: Pay; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(String(pay.outstanding));
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('bank transfer');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try { await api(`/api/payments/${pay.id}/receipt`, { method: 'POST', json: { amount: Number(amount), paidAt, method, reference } }); onSaved(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1"><h3 className="font-semibold text-white">Record payment</h3><button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button></div>
        <p className="text-xs text-slate-500 mb-4">{pay.label} · outstanding {money(pay.outstanding)}</p>
        <div className="space-y-3">
          <div><label className="label">Amount (AED)</label><input className="field" type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Date</label><input className="field" type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} /></div>
            <div><label className="label">Method</label>
              <select className="field" value={method} onChange={e => setMethod(e.target.value)}><option>bank transfer</option><option>cheque</option><option>card</option><option>cash</option></select>
            </div>
          </div>
          <div><label className="label">Reference</label><input className="field" value={reference} onChange={e => setReference(e.target.value)} placeholder="Escrow deposit ref" /></div>
        </div>
        {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
        <div className="flex gap-2 mt-4">
          <button className="btn-primary" onClick={save} disabled={busy || !(Number(amount) > 0)}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Record</button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
