'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/client';
import { Layers, Upload, Loader2, ImageIcon, Check, Trash2 } from 'lucide-react';

type Project = { id: string; name: string; _count: { units: number } };
type LayoutRow = {
  code: string; unitCount: number; id: string | null;
  bedrooms: number | null; bathrooms: number | null; sizeMin: number | null; sizeMax: number | null;
  imageUrl: string | null; imageVersion: number | null;
};

export default function LayoutsPage() {
  const [me, setMe] = useState<{ role: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [rows, setRows] = useState<LayoutRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCode, setNewCode] = useState('');
  const isAdmin = me?.role === 'COMPANY_ADMIN' || me?.role === 'PLATFORM_ADMIN';

  const loadLayouts = useCallback(async () => {
    if (!projectId) { setRows([]); return; }
    setLoading(true);
    try { const r = await api<{ layouts: LayoutRow[] }>(`/api/layouts?projectId=${projectId}`); setRows(r.layouts); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => {
    api<{ user: { role: string } }>('/api/me').then(r => setMe(r.user));
    api<{ projects: Project[] }>('/api/inventory/projects').then(r => { setProjects(r.projects); if (r.projects[0]) setProjectId(r.projects[0].id); });
  }, []);
  useEffect(() => { loadLayouts(); }, [loadLayouts]);

  const addCode = async () => {
    const code = newCode.trim(); if (!code || !projectId) return;
    const fd = new FormData(); fd.append('projectId', projectId); fd.append('code', code);
    await api('/api/layouts', { method: 'POST', body: fd }); setNewCode(''); loadLayouts();
  };

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-2">
        <Layers className="w-6 h-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-white">Layouts</h1>
      </div>
      <p className="text-slate-400 text-sm mt-1">One floor plan per typology code. Offers auto-pull the matching plan for each unit.</p>

      <div className="card p-4 mt-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label className="label">Project</label>
          <select className="field" value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">Select a project…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p._count.units})</option>)}
          </select>
        </div>
        {isAdmin && projectId && (
          <div className="flex items-end gap-2">
            <div><label className="label">Add a layout code</label><input className="field w-40" placeholder="2BR-B" value={newCode} onChange={e => setNewCode(e.target.value)} /></div>
            <button className="btn-ghost" onClick={addCode} disabled={!newCode.trim()}>Add</button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm mt-6">Loading…</p>
      ) : !projectId ? (
        <p className="text-slate-500 text-sm mt-6">Pick a project to manage its layouts.</p>
      ) : !rows.length ? (
        <p className="text-slate-500 text-sm mt-6">No layout codes yet — they appear here once you upload units, or add one above.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {rows.map(l => <LayoutCard key={l.code} projectId={projectId} row={l} isAdmin={isAdmin} onSaved={loadLayouts} />)}
        </div>
      )}
    </div>
  );
}

function LayoutCard({ projectId, row, isAdmin, onSaved }: { projectId: string; row: LayoutRow; isAdmin: boolean; onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [meta, setMeta] = useState({
    bedrooms: row.bedrooms?.toString() ?? '', bathrooms: row.bathrooms?.toString() ?? '',
    sizeMin: row.sizeMin?.toString() ?? '', sizeMax: row.sizeMax?.toString() ?? '',
  });

  const post = async (withFile?: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('projectId', projectId); fd.append('code', row.code);
      Object.entries(meta).forEach(([k, v]) => v && fd.append(k, v));
      if (withFile) fd.append('file', withFile);
      await api('/api/layouts', { method: 'POST', body: fd });
      setSaved(true); setTimeout(() => setSaved(false), 1500); onSaved();
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <div className="card overflow-hidden">
      <div className="aspect-[4/3] bg-slate-950 flex items-center justify-center relative">
        {row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt={row.code} className="w-full h-full object-contain" />
        ) : (
          <div className="text-slate-600 flex flex-col items-center gap-1"><ImageIcon className="w-8 h-8" /><span className="text-xs">No floor plan</span></div>
        )}
        {isAdmin && (
          <>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) post(f); }} />
            <button onClick={() => fileRef.current?.click()} disabled={busy}
              className="absolute bottom-2 right-2 btn-ghost !py-1.5 !px-2.5 text-xs">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {row.imageUrl ? 'Replace' : 'Upload'}
            </button>
          </>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white">{row.code}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{row.unitCount} unit{row.unitCount === 1 ? '' : 's'}</span>
            {isAdmin && row.id && (
              <button title="Delete layout" onClick={async () => { if (confirm('Delete this layout & its floor plan?')) { await api(`/api/layouts/${row.id}`, { method: 'DELETE' }); onSaved(); } }}
                className="p-1 rounded text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            )}
          </div>
        </div>
        {isAdmin ? (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {([['bedrooms', 'Beds'], ['bathrooms', 'Baths'], ['sizeMin', 'Size min'], ['sizeMax', 'Size max']] as const).map(([k, lbl]) => (
              <div key={k}>
                <label className="label">{lbl}</label>
                <input className="field !py-1.5 text-xs" value={meta[k]} onChange={e => setMeta(m => ({ ...m, [k]: e.target.value }))} />
              </div>
            ))}
            <button onClick={() => post()} disabled={busy} className="btn-ghost col-span-2 !py-1.5 text-xs mt-1">
              {saved ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Saved</> : 'Save details'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400 mt-2">
            {row.bedrooms ?? '?'} bed · {row.bathrooms ?? '?'} bath{row.sizeMin ? ` · ${row.sizeMin}${row.sizeMax ? `–${row.sizeMax}` : ''} sqft` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
