'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { ClipboardList, Plus, X, Loader2, ArrowRightCircle, Trash2, Search } from 'lucide-react';

const money = (n: number) => 'AED ' + Math.round(n).toLocaleString('en-AE');
const STATUS: Record<string, string> = { SUBMITTED: 'text-blue-300 bg-blue-500/15', ALLOCATED: 'text-amber-300 bg-amber-500/15', CONVERTED: 'text-emerald-300 bg-emerald-500/15', REFUNDED: 'text-slate-400 bg-slate-700/40', CANCELLED: 'text-red-300 bg-red-500/15' };

type Eoi = { id: string; project: string | null; projectId: string | null; clientName: string; clientEmail: string | null; clientPhone: string | null; clientIdNumber: string | null; tokenAmount: number; refundable: boolean; priority: number; status: string; note: string | null };
type Project = { id: string; name: string };

export default function EoiPage() {
  const [eois, setEois] = useState<Eoi[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [adding, setAdding] = useState(false);
  const [convertFor, setConvertFor] = useState<Eoi | null>(null);
  const load = useCallback(() => api<{ eois: Eoi[] }>('/api/eoi').then(r => setEois(r.eois)), []);
  useEffect(() => { load(); api<{ projects: Project[] }>('/api/inventory/projects').then(r => setProjects(r.projects)); }, [load]);

  const setStatus = async (id: string, status: string) => { setEois(es => es.map(e => e.id === id ? { ...e, status } : e)); await api(`/api/eoi/${id}`, { method: 'PATCH', json: { status } }).catch(load); };
  const remove = async (id: string) => { if (confirm('Delete this EOI?')) { await api(`/api/eoi/${id}`, { method: 'DELETE' }); load(); } };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2"><ClipboardList className="w-6 h-6 text-indigo-400" /><h1 className="text-2xl font-bold text-white">Expressions of Interest</h1></div>
          <p className="text-slate-400 text-sm mt-1">The pre-launch funnel: buyers place a token deposit for priority. Allocate a unit to convert an EOI into an offer.</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> New EOI</button>
      </div>

      {adding && <EoiForm projects={projects} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      {convertFor && <ConvertModal eoi={convertFor} onClose={() => setConvertFor(null)} />}

      <div className="card mt-6 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-xs text-slate-500 text-left border-b border-slate-800"><tr><th className="px-4 py-2.5">#</th><th className="px-4 py-2.5">Buyer</th><th className="px-4 py-2.5">Project</th><th className="px-4 py-2.5 text-right">Token</th><th className="px-4 py-2.5">Status</th><th></th></tr></thead>
          <tbody className="divide-y divide-slate-800/60">
            {!eois.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No EOIs yet.</td></tr>}
            {eois.map(e => (
              <tr key={e.id} className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 text-slate-500">{e.priority}</td>
                <td className="px-4 py-2.5"><span className="text-white">{e.clientName}</span><div className="text-[11px] text-slate-500">{[e.clientPhone, e.clientEmail].filter(Boolean).join(' · ')}</div></td>
                <td className="px-4 py-2.5 text-slate-400">{e.project || 'Any'}</td>
                <td className="px-4 py-2.5 text-right text-slate-200">{money(e.tokenAmount)}{!e.refundable && <span className="text-[10px] text-slate-500 ml-1">non-ref</span>}</td>
                <td className="px-4 py-2.5">
                  <select value={e.status} onChange={ev => setStatus(e.id, ev.target.value)} className={`rounded-full text-[11px] px-2 py-1 border-0 focus:outline-none cursor-pointer ${STATUS[e.status] || ''}`}>
                    {['SUBMITTED', 'ALLOCATED', 'CONVERTED', 'REFUNDED', 'CANCELLED'].map(s => <option key={s} value={s} className="bg-slate-900 text-white">{s[0] + s.slice(1).toLowerCase()}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    {e.status !== 'CONVERTED' && <button onClick={() => setConvertFor(e)} title="Allocate a unit → create offer" className="px-2 py-1 rounded-lg text-[11px] bg-indigo-600/80 hover:bg-indigo-500 text-white flex items-center gap-1"><ArrowRightCircle className="w-3.5 h-3.5" /> Allocate</button>}
                    <button onClick={() => remove(e.id)} className="p-1.5 text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

function EoiForm({ projects, onClose, onSaved }: { projects: Project[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ projectId: '', clientName: '', clientEmail: '', clientPhone: '', clientIdNumber: '', tokenAmount: '', refundable: true, note: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try { await api('/api/eoi', { method: 'POST', json: { ...f, projectId: f.projectId || null, tokenAmount: Number(f.tokenAmount) || 0 } }); onSaved(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="card p-5 mt-6 border-indigo-500/30">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-white">New EOI</h3><button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button></div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="label">Buyer name</label><input className="field" value={f.clientName} onChange={e => setF(s => ({ ...s, clientName: e.target.value }))} /></div>
        <div><label className="label">Project (optional)</label><select className="field" value={f.projectId} onChange={e => setF(s => ({ ...s, projectId: e.target.value }))}><option value="">Any</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label className="label">Phone</label><input className="field" value={f.clientPhone} onChange={e => setF(s => ({ ...s, clientPhone: e.target.value }))} /></div>
        <div><label className="label">Email</label><input className="field" value={f.clientEmail} onChange={e => setF(s => ({ ...s, clientEmail: e.target.value }))} /></div>
        <div><label className="label">Emirates ID / Passport</label><input className="field" value={f.clientIdNumber} onChange={e => setF(s => ({ ...s, clientIdNumber: e.target.value }))} /></div>
        <div><label className="label">Token deposit (AED)</label><input className="field" type="number" value={f.tokenAmount} onChange={e => setF(s => ({ ...s, tokenAmount: e.target.value }))} /></div>
      </div>
      <label className="flex items-center gap-2 mt-3 text-sm text-slate-300"><input type="checkbox" checked={f.refundable} onChange={e => setF(s => ({ ...s, refundable: e.target.checked }))} className="accent-indigo-500" /> Refundable</label>
      {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
      <div className="flex gap-2 mt-4"><button className="btn-primary" onClick={save} disabled={busy || !f.clientName.trim()}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save EOI</button><button className="btn-ghost" onClick={onClose}>Cancel</button></div>
    </div>
  );
}

function ConvertModal({ eoi, onClose }: { eoi: Eoi; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [units, setUnits] = useState<{ id: string; unitNumber: string; project: string | null; priceAed: number; layoutCode: string }[]>([]);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    const t = setTimeout(async () => { const sp = new URLSearchParams({ status: 'AVAILABLE' }); if (q.trim()) sp.set('q', q.trim()); const r = await api<{ units: typeof units }>(`/api/inventory/units?${sp}`); setUnits(r.units.slice(0, 8)); }, 200);
    return () => clearTimeout(t);
  }, [q]);
  const convert = async (unitId: string) => {
    setBusy(unitId);
    try { const r = await api<{ offerId: string }>(`/api/eoi/${eoi.id}/convert`, { method: 'POST', json: { unitId } }); router.push(`/offers`); void r; }
    catch { setBusy(''); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1"><h3 className="font-semibold text-white">Allocate a unit to {eoi.clientName}</h3><button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button></div>
        <p className="text-xs text-slate-500 mb-3">Creates a draft offer carrying the buyer&apos;s details.</p>
        <div className="relative"><Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" /><input className="field pl-9" placeholder="Search available unit #" value={q} onChange={e => setQ(e.target.value)} autoFocus /></div>
        <div className="mt-2 divide-y divide-slate-800/60 max-h-64 overflow-auto">
          {units.map(u => (
            <button key={u.id} onClick={() => convert(u.id)} disabled={!!busy} className="w-full flex items-center justify-between px-2 py-2.5 hover:bg-slate-800/40 rounded-lg text-left">
              <span className="text-white text-sm">{u.unitNumber} <span className="text-slate-500">· {u.layoutCode} · {u.project}</span></span>
              {busy === u.id ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <span className="text-slate-300 text-sm">{money(u.priceAed)}</span>}
            </button>
          ))}
          {!units.length && <p className="text-slate-500 text-sm px-2 py-3">No available units.</p>}
        </div>
      </div>
    </div>
  );
}
