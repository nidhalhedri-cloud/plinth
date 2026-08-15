'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/client';
import { FileText, Plus, Search, Loader2, Download, Link2, Check, X, Eye, MessageSquare, Upload, BookMarked } from 'lucide-react';

const money = (n: number) => 'AED ' + Math.round(n).toLocaleString('en-AE');
const STATUS: Record<string, string> = {
  DRAFT: 'text-slate-400 bg-slate-700/40', SENT: 'text-blue-300 bg-blue-500/15', VIEWED: 'text-indigo-300 bg-indigo-500/15',
  RESERVED: 'text-amber-300 bg-amber-500/15', SPA_SIGNED: 'text-purple-300 bg-purple-500/15', SOLD: 'text-emerald-300 bg-emerald-500/15', DROPPED: 'text-red-300 bg-red-500/15',
};
const STATUSES = ['DRAFT', 'SENT', 'VIEWED', 'RESERVED', 'SPA_SIGNED', 'SOLD', 'DROPPED'];

type Offer = { id: string; publicToken: string; status: string; price: number; discount: number; unit: string; project: string; brokerage: string | null; rm: string; booked: boolean; clientName: string | null; viewCount: number; firstViewedAt: string | null; createdAt: string };

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [me, setMe] = useState<{ role: string } | null>(null);
  const [building, setBuilding] = useState(false);
  const [sendFor, setSendFor] = useState<Offer | null>(null);
  const [bookFor, setBookFor] = useState<Offer | null>(null);
  const isAdmin = me?.role === 'COMPANY_ADMIN' || me?.role === 'PLATFORM_ADMIN';
  const load = useCallback(() => api<{ offers: Offer[] }>('/api/offers').then(r => setOffers(r.offers)), []);
  useEffect(() => { load(); api<{ user: { role: string } }>('/api/me').then(r => setMe(r.user)); }, [load]);

  const setStatus = async (id: string, status: string) => {
    setOffers(os => os.map(o => o.id === id ? { ...o, status } : o));
    await api(`/api/offers/${id}`, { method: 'PATCH', json: { status } }).catch(load);
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2"><FileText className="w-6 h-6 text-indigo-400" /><h1 className="text-2xl font-bold text-white">Offers</h1></div>
          <p className="text-slate-400 text-sm mt-1">Generate a branded reservation offer for a unit — auto-filled from inventory, plan &amp; fees.</p>
        </div>
        <button className="btn-primary" onClick={() => setBuilding(true)}><Plus className="w-4 h-4" /> New offer</button>
      </div>

      {building && <OfferBuilder onClose={() => setBuilding(false)} onSaved={() => { setBuilding(false); load(); }} />}
      {sendFor && <SendModal offer={sendFor} onClose={() => setSendFor(null)} onSent={() => { setSendFor(null); load(); }} />}
      {bookFor && <BookModal offer={bookFor} onClose={() => setBookFor(null)} onBooked={() => { setBookFor(null); load(); }} />}

      <div className="card mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 border-b border-slate-800 text-left">
              <tr><th className="px-4 py-2.5">Unit</th><th className="px-4 py-2.5">Project</th><th className="px-4 py-2.5">Price</th><th className="px-4 py-2.5">Opens</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {!offers.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No offers yet. Create one above.</td></tr>}
              {offers.map(o => (
                <tr key={o.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-2.5 text-white font-medium">{o.unit}</td>
                  <td className="px-4 py-2.5 text-slate-400">{o.project}</td>
                  <td className="px-4 py-2.5 text-slate-200">{money(o.price)}</td>
                  <td className="px-4 py-2.5 text-slate-400">{o.viewCount > 0 ? <span className="inline-flex items-center gap-1 text-indigo-300"><Eye className="w-3.5 h-3.5" />{o.viewCount}</span> : '—'}</td>
                  <td className="px-4 py-2.5">
                    <select value={o.status} onChange={e => setStatus(o.id, e.target.value)}
                      className={`rounded-full text-[11px] px-2 py-1 border-0 focus:outline-none cursor-pointer ${STATUS[o.status] || ''}`}>
                      {STATUSES.map(s => <option key={s} value={s} className="bg-slate-900 text-white">{s.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button title="Send offer to WhatsApp group" onClick={() => setSendFor(o)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800"><MessageSquare className="w-4 h-4" /></button>
                      <a href={`/api/offers/${o.id}/doc/offer`} target="_blank" title="Offer PDF" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"><Download className="w-4 h-4" /></a>
                      <button title="Copy public link" onClick={() => navigator.clipboard.writeText(`${location.origin}/offer/${o.publicToken}`)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"><Link2 className="w-4 h-4" /></button>
                      {isAdmin && (o.booked ? (
                        <>
                          <a href={`/api/offers/${o.id}/doc/booking`} target="_blank" title="Booking form PDF" className="px-2 py-1 rounded-lg text-[11px] text-amber-300 hover:bg-slate-800">Booking</a>
                          <a href={`/api/offers/${o.id}/doc/spa`} target="_blank" title="SPA PDF" className="px-2 py-1 rounded-lg text-[11px] text-purple-300 hover:bg-slate-800">SPA</a>
                          <a href={`/collections/${o.id}`} title="Statement of Account" className="px-2 py-1 rounded-lg text-[11px] text-indigo-300 hover:bg-slate-800">SOA</a>
                        </>
                      ) : (
                        <button title="Book this unit (buyer details + payment proof)" onClick={() => setBookFor(o)} className="px-2 py-1 rounded-lg text-[11px] bg-indigo-600/80 hover:bg-indigo-500 text-white">Book</button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SendModal({ offer, onClose, onSent }: { offer: Offer; onClose: () => void; onSent: () => void }) {
  const [brokerages, setBrokerages] = useState<{ id: string; name: string; links: { mine: boolean; groupName: string | null }[] }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api<{ brokerages: typeof brokerages }>('/api/brokerages').then(r => setBrokerages(r.brokerages)); }, []);

  const send = async (brokerageId: string) => {
    setBusy(brokerageId); setErr('');
    try { await api(`/api/offers/${offer.id}/send`, { method: 'POST', json: { brokerageId } }); onSent(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1"><h3 className="font-semibold text-white flex items-center gap-2"><MessageSquare className="w-4 h-4 text-emerald-400" /> Send offer to a broker</h3><button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button></div>
        <p className="text-xs text-slate-500 mb-4">Unit {offer.unit} · sends the PDF into the brokerage&apos;s linked WhatsApp group.</p>
        {err && <p className="text-sm text-red-400 mb-3">{err}</p>}
        <div className="space-y-2 max-h-72 overflow-auto">
          {!brokerages.length && <p className="text-slate-500 text-sm">No brokerages yet — add one in Brokerages.</p>}
          {brokerages.map(b => {
            const link = b.links.find(l => l.mine);
            const ready = !!link?.groupName;
            return (
              <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/50">
                <div><p className="text-sm text-white">{b.name}</p><p className="text-[11px] text-slate-500">{ready ? link!.groupName : 'No group linked'}</p></div>
                <button disabled={!ready || busy === b.id} onClick={() => send(b.id)} className="btn-primary !py-1.5 text-xs disabled:opacity-40">
                  {busy === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BookModal({ offer, onClose, onBooked }: { offer: Offer; onClose: () => void; onBooked: () => void }) {
  const [f, setF] = useState({ clientName: '', clientEmail: '', clientAddress: '', clientIdType: 'id', clientIdNumber: '', bookingStartDate: '' });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(s => ({ ...s, [k]: e.target.value }));

  const submit = async () => {
    if (!f.clientName.trim()) { setErr('Buyer name is required'); return; }
    if (!f.clientIdNumber.trim()) { setErr('Emirates ID / passport number is required'); return; }
    if (!f.bookingStartDate) { setErr('Choose when payments start'); return; }
    if (!file) { setErr('Upload proof of the booking payment'); return; }
    setBusy(true); setErr('');
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      fd.append('paymentProof', file);
      await api(`/api/offers/${offer.id}/book`, { method: 'POST', body: fd });
      onBooked();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1"><h3 className="font-semibold text-white flex items-center gap-2"><BookMarked className="w-4 h-4 text-indigo-400" /> Book unit {offer.unit}</h3><button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button></div>
        <p className="text-xs text-slate-500 mb-4">Buyer details + payment proof. This freezes the booking form and enables the SPA.</p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className="label">Buyer name</label><input className="field" value={f.clientName} onChange={set('clientName')} /></div>
          <div><label className="label">Email</label><input className="field" type="email" value={f.clientEmail} onChange={set('clientEmail')} /></div>
          <div>
            <label className="label">ID type</label>
            <select className="field" value={f.clientIdType} onChange={set('clientIdType')}><option value="id">Emirates ID</option><option value="passport">Passport</option></select>
          </div>
          <div><label className="label">{f.clientIdType === 'passport' ? 'Passport no.' : 'Emirates ID'}</label><input className="field" value={f.clientIdNumber} onChange={set('clientIdNumber')} /></div>
          <div><label className="label">Payments start</label><input className="field" type="date" value={f.bookingStartDate} onChange={set('bookingStartDate')} /></div>
          <div className="sm:col-span-2"><label className="label">Address</label><input className="field" value={f.clientAddress} onChange={set('clientAddress')} /></div>
          <div className="sm:col-span-2">
            <label className="label">Payment proof</label>
            <label className="btn-ghost cursor-pointer inline-flex"><Upload className="w-4 h-4" /> {file ? file.name : 'Upload receipt / screenshot'}
              <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>

        {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
        <div className="flex gap-2 mt-4">
          <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirm booking</button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

type Unit = { id: string; unitNumber: string; project: string | null; priceAed: number; status: string; layoutCode: string };
type SchedRow = { label: string; when: string; date: string | null; percent: number | null; amount: number; kind: string };
type Snapshot = {
  net: number; price: number; discount: number; plan: { name: string | null };
  schedule: SchedRow[]; scheduleTotal: number; feesTotalBuyer: number; grandTotal: number;
  handoverDate: string | null; dld: { amount: number; waived: boolean } | null;
  fit: { monthsToHandover: number | null; warning: string | null };
  layout: { imageDataUri: string | null };
};

function OfferBuilder({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Unit[]>([]);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [planId, setPlanId] = useState('');
  const [discount, setDiscount] = useState('');
  const [dldWaiver, setDldWaiver] = useState(false);
  const [note, setNote] = useState('');
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; publicToken: string } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => { api<{ plans: { id: string; name: string }[] }>('/api/plans').then(r => setPlans(r.plans)); }, []);
  useEffect(() => {
    const t = setTimeout(async () => {
      const sp = new URLSearchParams({ status: 'AVAILABLE' }); if (q.trim()) sp.set('q', q.trim());
      const r = await api<{ units: Unit[] }>(`/api/inventory/units?${sp}`); setResults(r.units.slice(0, 8));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const preview = useCallback(async (u: Unit, d: string, waiver: boolean, pid: string) => {
    const sp = new URLSearchParams({ unitId: u.id });
    if (Number(d) > 0) sp.set('discountAed', d);
    if (waiver) sp.set('dldWaiver', 'true');
    if (pid) sp.set('planId', pid);
    const r = await api<{ snapshot: Snapshot }>(`/api/offers/prepare?${sp}`);
    setSnap(r.snapshot);
  }, []);
  useEffect(() => { if (unit) { const t = setTimeout(() => preview(unit, discount, dldWaiver, planId), 250); return () => clearTimeout(t); } }, [unit, discount, dldWaiver, planId, preview]);

  const save = async (mode: 'draft' | 'sent' | 'reserved') => {
    if (!unit) return;
    setBusy(true); setErr('');
    try {
      const r = await api<{ id: string; publicToken: string }>('/api/offers', {
        method: 'POST',
        json: { unitId: unit.id, planId: planId || null, discountAed: Number(discount) || 0, dldWaiver, note, markSent: mode !== 'draft', markReserved: mode === 'reserved' },
      });
      setDone(r);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  if (done) {
    const link = `${location.origin}/offer/${done.publicToken}`;
    return (
      <div className="card p-5 mt-6 border-emerald-500/30">
        <div className="flex items-center gap-2 text-emerald-300 font-medium"><Check className="w-5 h-5" /> Offer created</div>
        <div className="flex flex-wrap gap-2 mt-4">
          <a href={`/api/offers/${done.id}/pdf`} target="_blank" className="btn-primary"><Download className="w-4 h-4" /> Open PDF</a>
          <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(link)}><Link2 className="w-4 h-4" /> Copy public link</button>
          <button className="btn-ghost" onClick={onSaved}>Done</button>
        </div>
        <p className="text-xs text-slate-500 mt-3 break-all">{link}</p>
      </div>
    );
  }

  return (
    <div className="card p-5 mt-6 border-indigo-500/30">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-white">New offer</h3><button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"><X className="w-4 h-4" /></button></div>

      {!unit ? (
        <div>
          <label className="label">Pick an available unit</label>
          <div className="relative"><Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" /><input className="field pl-9" placeholder="Search unit #" value={q} onChange={e => setQ(e.target.value)} autoFocus /></div>
          <div className="mt-2 divide-y divide-slate-800/60 max-h-64 overflow-auto">
            {results.map(u => (
              <button key={u.id} onClick={() => setUnit(u)} className="w-full flex items-center justify-between px-2 py-2.5 hover:bg-slate-800/40 rounded-lg text-left">
                <span className="text-white text-sm">{u.unitNumber} <span className="text-slate-500">· {u.layoutCode} · {u.project}</span></span>
                <span className="text-slate-300 text-sm">{money(u.priceAed)}</span>
              </button>
            ))}
            {!results.length && <p className="text-slate-500 text-sm px-2 py-3">No available units match.</p>}
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <div className="flex items-center justify-between">
              <div><p className="text-white font-semibold">{unit.unitNumber}</p><p className="text-xs text-slate-500">{unit.layoutCode} · {unit.project}</p></div>
              <button className="text-xs text-indigo-400 hover:text-indigo-300" onClick={() => { setUnit(null); setSnap(null); }}>Change</button>
            </div>
            <div className="mt-3">
              <label className="label">Payment plan</label>
              <select className="field" value={planId} onChange={e => setPlanId(e.target.value)}>
                <option value="">Use the unit&apos;s assigned plan</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="mt-3"><label className="label">Discount (AED)</label><input className="field" type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" /></div>
            <label className="flex items-center gap-2 mt-3 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={dldWaiver} onChange={e => setDldWaiver(e.target.checked)} className="accent-indigo-500" />
              Waive DLD fee (developer absorbs)
              <span className="text-[11px] text-slate-500">· otherwise it&apos;s due with the down payment</span>
            </label>
            <div className="mt-3"><label className="label">Note (optional)</label><textarea className="field" rows={2} value={note} onChange={e => setNote(e.target.value)} /></div>

            {snap?.fit.warning && <p className="text-xs text-amber-400 mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">⚠ {snap.fit.warning}</p>}

            {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
            <div className="flex flex-wrap gap-2 mt-4">
              <button className="btn-primary" disabled={busy} onClick={() => save('sent')}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create &amp; send</button>
              <button className="btn-ghost" disabled={busy} onClick={() => save('draft')}>Save draft</button>
              <button className="btn-ghost" disabled={busy} onClick={() => save('reserved')}>Reserve unit</button>
            </div>
          </div>

          {/* Live preview */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            {!snap ? <p className="text-slate-500 text-sm">Loading preview…</p> : (
              <>
                {snap.layout.imageDataUri && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={snap.layout.imageDataUri} alt="" className="w-full h-32 object-contain bg-white/5 rounded-lg mb-3" />
                )}
                <div className="flex justify-between text-sm"><span className="text-slate-400">List price</span><span className="text-slate-200">{money(snap.price)}</span></div>
                {snap.discount > 0 && <div className="flex justify-between text-sm"><span className="text-slate-400">Discount</span><span className="text-red-300">- {money(snap.discount)}</span></div>}
                <div className="flex justify-between text-base font-bold mt-1"><span className="text-white">Purchase price</span><span className="text-indigo-300">{money(snap.net)}</span></div>

                <p className="text-[11px] text-slate-500 mt-3 mb-1">{snap.plan.name || 'No payment plan'}{snap.handoverDate ? ` · handover ${new Date(snap.handoverDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : ' · no handover date set'}</p>
                <div className="border border-slate-800 rounded-lg divide-y divide-slate-800/70 max-h-52 overflow-auto">
                  {snap.schedule.map((m, i) => (
                    <div key={i} className={`flex items-center justify-between px-2.5 py-1.5 text-xs ${m.kind === 'dld' ? 'text-sky-300' : 'text-slate-300'}`}>
                      <span className="truncate">{m.label}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-500">{m.date || m.when}</span>
                        {m.percent != null && <span className="text-slate-500 w-8 text-right">{m.percent}%</span>}
                        <span className="w-24 text-right">{money(m.amount)}</span>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-800 mt-3 pt-2 flex justify-between text-sm"><span className="text-slate-400">+ buyer fees{snap.dld?.waived ? ' (DLD waived)' : ''}</span><span className="text-slate-300">{money(snap.feesTotalBuyer)}</span></div>
                <div className="flex justify-between text-sm font-semibold"><span className="text-white">Total all-in</span><span className="text-white">{money(snap.grandTotal)}</span></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
