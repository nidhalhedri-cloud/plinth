'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/client';
import { Wallet, Plus, Sparkles, Trash2, Pencil, X, Loader2, GripVertical } from 'lucide-react';

const TRIGGERS = [
  ['ON_BOOKING', 'On booking'], ['ON_OQOOD', 'On Oqood (DLD reg.)'], ['CONSTRUCTION_PCT', 'During construction'],
  ['ON_HANDOVER', 'On handover'], ['POST_HANDOVER', 'Post-handover'], ['FIXED_DATE', 'Fixed date'],
] as const;
const trigLabel = (t: string) => TRIGGERS.find(x => x[0] === t)?.[1] || t;

type Milestone = { label: string; percent: number | null; fixedAmount: number | null; trigger: string; triggerValue: string | null };
type Plan = { id: string; name: string; description: string | null; isPreset: boolean; unitCount: number; milestones: (Milestone & { id: string; order: number })[] };

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);
  const [loadingPresets, setLoadingPresets] = useState(false);

  const load = useCallback(() => api<{ plans: Plan[] }>('/api/plans').then(r => setPlans(r.plans)), []);
  useEffect(() => { load(); }, [load]);

  const loadPresets = async () => {
    setLoadingPresets(true);
    try { const r = await api<{ added: number }>('/api/plans/presets', { method: 'POST' }); await load(); alert(r.added ? `${r.added} preset plan(s) added.` : 'All presets are already loaded.'); }
    finally { setLoadingPresets(false); }
  };
  const remove = async (id: string) => { if (confirm('Delete this plan?')) { await api(`/api/plans/${id}`, { method: 'DELETE' }); load(); } };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2"><Wallet className="w-6 h-6 text-indigo-400" /><h1 className="text-2xl font-bold text-white">Payment plans</h1></div>
          <p className="text-slate-400 text-sm mt-1">Reusable templates. Assign one to units in the Excel upload; offers calculate the AED amounts.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={loadPresets} disabled={loadingPresets}>
            {loadingPresets ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Load Dubai presets
          </button>
          <button className="btn-primary" onClick={() => setEditing('new')}><Plus className="w-4 h-4" /> New plan</button>
        </div>
      </div>

      {editing && <PlanEditor plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}

      <div className="space-y-3 mt-6">
        {!plans.length && <p className="text-slate-500 text-sm">No plans yet. Load the Dubai presets or create your own.</p>}
        {plans.map(p => (
          <div key={p.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white">{p.name}</h3>
                  {p.isPreset && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300">preset</span>}
                  <span className="text-xs text-slate-500">· {p.unitCount} unit{p.unitCount === 1 ? '' : 's'}</span>
                </div>
                {p.description && <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(p)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(p.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="mt-3 divide-y divide-slate-800/60">
              {p.milestones.map(m => (
                <div key={m.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-slate-300">{m.label}</span>
                  <span className="text-slate-400 flex items-center gap-3">
                    <span className="text-xs">{trigLabel(m.trigger)}{m.triggerValue ? ` · ${m.triggerValue}` : ''}</span>
                    <span className="text-white font-medium w-16 text-right">{m.percent != null ? `${m.percent}%` : m.fixedAmount != null ? `AED ${m.fixedAmount.toLocaleString()}` : '—'}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type Row = { label: string; mode: 'percent' | 'fixed'; value: string; trigger: string; triggerValue: string };

function PlanEditor({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(plan?.name || '');
  const [description, setDescription] = useState(plan?.description || '');
  const [rows, setRows] = useState<Row[]>(
    plan?.milestones.map(m => ({ label: m.label, mode: m.fixedAmount != null ? 'fixed' : 'percent', value: String(m.fixedAmount ?? m.percent ?? ''), trigger: m.trigger, triggerValue: m.triggerValue || '' }))
      || [{ label: 'Down payment', mode: 'percent', value: '20', trigger: 'ON_BOOKING', triggerValue: '' }],
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const setRow = (i: number, patch: Partial<Row>) => setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));
  const pctSum = rows.filter(r => r.mode === 'percent').reduce((s, r) => s + (parseFloat(r.value) || 0), 0);

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const milestones = rows.map(r => ({
        label: r.label.trim(),
        percent: r.mode === 'percent' ? Number(r.value) : null,
        fixedAmount: r.mode === 'fixed' ? Number(r.value) : null,
        trigger: r.trigger,
        triggerValue: r.triggerValue.trim() || null,
      }));
      const body = { name, description, milestones };
      if (plan) await api(`/api/plans/${plan.id}`, { method: 'PATCH', json: body });
      else await api('/api/plans', { method: 'POST', json: body });
      onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="card p-5 mt-6 border-indigo-500/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">{plan ? 'Edit plan' : 'New plan'}</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="label">Name</label><input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="60/40 Standard" /></div>
        <div><label className="label">Description</label><input className="field" value={description} onChange={e => setDescription(e.target.value)} /></div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="label !mb-0">Milestones</label>
          <span className={`text-xs ${Math.abs(pctSum - 100) < 0.01 ? 'text-emerald-400' : 'text-amber-400'}`}>% total: {pctSum}</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-slate-600 shrink-0" />
            <input className="field flex-1" placeholder="Label" value={r.label} onChange={e => setRow(i, { label: e.target.value })} />
            <select className="field w-40" value={r.trigger} onChange={e => setRow(i, { trigger: e.target.value })}>
              {TRIGGERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className="field w-24" value={r.mode} onChange={e => setRow(i, { mode: e.target.value as Row['mode'] })}>
              <option value="percent">%</option><option value="fixed">AED</option>
            </select>
            <input className="field w-24" type="number" value={r.value} onChange={e => setRow(i, { value: e.target.value })} />
            <button onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} className="p-2 text-slate-500 hover:text-red-400 shrink-0"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        <button onClick={() => setRows(rs => [...rs, { label: '', mode: 'percent', value: '', trigger: 'ON_HANDOVER', triggerValue: '' }])}
          className="btn-ghost !py-1.5 text-xs"><Plus className="w-3.5 h-3.5" /> Add milestone</button>
      </div>

      {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
      <div className="flex gap-2 mt-4">
        <button className="btn-primary" onClick={save} disabled={busy || !name.trim()}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save plan</button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
