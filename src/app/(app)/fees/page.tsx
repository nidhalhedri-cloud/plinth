'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/client';
import { Receipt, Plus, Trash2, Loader2 } from 'lucide-react';

type Fee = { id: string; label: string; kind: 'PERCENT' | 'FIXED'; value: number; payer: 'BUYER' | 'SELLER' | 'SPLIT'; taxable: boolean; isSystem: boolean };

export default function FeesPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => api<{ fees: Fee[] }>('/api/fees').then(r => setFees(r.fees)), []);
  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, patch: Partial<Fee>) => {
    setFees(fs => fs.map(f => f.id === id ? { ...f, ...patch } : f)); // optimistic
    await api(`/api/fees/${id}`, { method: 'PATCH', json: patch }).catch(load);
  };
  const remove = async (id: string) => { await api(`/api/fees/${id}`, { method: 'DELETE' }); load(); };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2"><Receipt className="w-6 h-6 text-indigo-400" /><h1 className="text-2xl font-bold text-white">Fees</h1></div>
          <p className="text-slate-400 text-sm mt-1">These flow into every sales offer&apos;s cost breakdown automatically. Editable defaults — not fixed.</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> Add fee</button>
      </div>

      {adding && <FeeForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}

      <div className="card mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 border-b border-slate-800 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Fee</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Amount</th>
              <th className="px-4 py-2.5 font-medium">Paid by</th>
              <th className="px-4 py-2.5 font-medium">Tax</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {!fees.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No fees yet.</td></tr>}
            {fees.map(f => (
              <tr key={f.id} className="hover:bg-slate-800/30">
                <td className="px-4 py-2 text-white">{f.label}{f.isSystem && <span className="text-[10px] text-slate-500 ml-2">default</span>}</td>
                <td className="px-4 py-2">
                  <select value={f.kind} onChange={e => patch(f.id, { kind: e.target.value as Fee['kind'] })} className="bg-transparent text-slate-300 text-xs focus:outline-none">
                    <option value="PERCENT" className="bg-slate-900">Percent</option>
                    <option value="FIXED" className="bg-slate-900">Fixed AED</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input type="number" defaultValue={f.value} onBlur={e => { const v = Number(e.target.value); if (v !== f.value) patch(f.id, { value: v }); }}
                    className="field !py-1 w-24 text-xs" />
                  <span className="text-slate-500 text-xs ml-1">{f.kind === 'PERCENT' ? '%' : 'AED'}</span>
                </td>
                <td className="px-4 py-2">
                  <select value={f.payer} onChange={e => patch(f.id, { payer: e.target.value as Fee['payer'] })} className="bg-transparent text-slate-300 text-xs focus:outline-none">
                    <option value="BUYER" className="bg-slate-900">Buyer</option>
                    <option value="SELLER" className="bg-slate-900">Seller</option>
                    <option value="SPLIT" className="bg-slate-900">Split</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input type="checkbox" checked={f.taxable} onChange={e => patch(f.id, { taxable: e.target.checked })} className="accent-indigo-500" />
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => remove(f.id)} className="p-1.5 text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeeForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ label: '', kind: 'FIXED' as 'PERCENT' | 'FIXED', value: '', payer: 'BUYER' as 'BUYER' | 'SELLER' | 'SPLIT', taxable: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try { await api('/api/fees', { method: 'POST', json: { ...form, value: Number(form.value) } }); onSaved(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="card p-5 mt-4 border-indigo-500/30 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[160px]"><label className="label">Label</label><input className="field" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Booking fee" /></div>
      <div><label className="label">Type</label>
        <select className="field w-28" value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value as 'PERCENT' | 'FIXED' }))}><option value="FIXED">Fixed</option><option value="PERCENT">Percent</option></select>
      </div>
      <div><label className="label">Amount</label><input className="field w-28" type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} /></div>
      <div><label className="label">Paid by</label>
        <select className="field w-28" value={form.payer} onChange={e => setForm(f => ({ ...f, payer: e.target.value as 'BUYER' | 'SELLER' | 'SPLIT' }))}><option value="BUYER">Buyer</option><option value="SELLER">Seller</option><option value="SPLIT">Split</option></select>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-slate-400 pb-2.5"><input type="checkbox" checked={form.taxable} onChange={e => setForm(f => ({ ...f, taxable: e.target.checked }))} className="accent-indigo-500" /> Taxable</label>
      <button className="btn-primary" onClick={save} disabled={busy || !form.label.trim()}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Add</button>
      <button className="btn-ghost" onClick={onClose}>Cancel</button>
      {err && <p className="text-sm text-red-400 w-full">{err}</p>}
    </div>
  );
}
