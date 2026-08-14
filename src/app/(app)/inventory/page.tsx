'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/client';
import {
  Boxes, Download, Upload, Loader2, Search, AlertTriangle, CheckCircle2, FolderPlus,
} from 'lucide-react';

type Project = { id: string; name: string; location: string | null; handoverDate: string | null; _count: { units: number } };
type Unit = {
  id: string; unitNumber: string; layoutCode: string; floor: number | null; sizeSqft: number | null;
  view: string | null; priceAed: number; handover: string | null; status: string; project: string | null; paymentPlan: string | null;
};
type UploadResult =
  | { status: 'ok'; created: number; updated: number }
  | { status: 'invalid'; errors: { row: number; message: string }[]; rows: number };

const STATUS: Record<string, string> = {
  AVAILABLE: 'text-emerald-300 bg-emerald-500/15',
  RESERVED: 'text-amber-300 bg-amber-500/15',
  SOLD: 'text-slate-400 bg-slate-700/40',
  BLOCKED: 'text-red-300 bg-red-500/15',
};
const money = (n: number) => 'AED ' + n.toLocaleString('en-AE');

export default function InventoryPage() {
  const [me, setMe] = useState<{ role: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [newProject, setNewProject] = useState('');
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = me?.role === 'COMPANY_ADMIN' || me?.role === 'PLATFORM_ADMIN';

  const loadProjects = useCallback(() => api<{ projects: Project[] }>('/api/inventory/projects').then(r => setProjects(r.projects)), []);

  const loadUnits = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (projectId) sp.set('projectId', projectId);
      if (statusFilter) sp.set('status', statusFilter);
      if (q.trim()) sp.set('q', q.trim());
      const r = await api<{ units: Unit[]; total: number }>(`/api/inventory/units?${sp}`);
      setUnits(r.units); setTotal(r.total);
    } finally { setLoading(false); }
  }, [projectId, statusFilter, q]);

  useEffect(() => { api<{ user: { role: string } }>('/api/me').then(r => setMe(r.user)); loadProjects(); }, [loadProjects]);
  useEffect(() => { const t = setTimeout(loadUnits, 200); return () => clearTimeout(t); }, [loadUnits]);

  const selProject = projects.find(p => p.id === projectId);
  const setHandover = async (v: string) => {
    if (!projectId) return;
    await api(`/api/inventory/projects/${projectId}`, { method: 'PATCH', json: { handoverDate: v || null } });
    loadProjects();
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true); setErr('');
    try {
      const r = await api<{ project: Project }>('/api/inventory/projects', { method: 'POST', json: { name: newProject } });
      setNewProject(''); await loadProjects(); setProjectId(r.project.id);
    } catch (e) { setErr((e as Error).message); } finally { setCreating(false); }
  };

  const upload = async (file: File) => {
    if (!projectId) { setErr('Pick a project to upload into first'); return; }
    setUploading(true); setResult(null); setErr('');
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('projectId', projectId);
      const r = await api<UploadResult>('/api/inventory/upload', { method: 'POST', body: fd, headers: {} });
      setResult(r);
      if (r.status === 'ok') { await loadProjects(); await loadUnits(); }
    } catch (e) { setErr((e as Error).message); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const setStatus = async (id: string, status: string) => {
    setUnits(us => us.map(u => u.id === id ? { ...u, status } : u)); // optimistic
    try { await api(`/api/inventory/units/${id}`, { method: 'PATCH', json: { status } }); await loadProjects(); }
    catch { loadUnits(); }
  };

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-2">
        <Boxes className="w-6 h-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-white">Inventory</h1>
      </div>
      <p className="text-slate-400 text-sm mt-1">Upload your units per project. Re-upload anytime to update prices &amp; status.</p>

      {/* Project bar */}
      <div className="card p-4 mt-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label className="label">Project</label>
          <select className="field" value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p._count.units})</option>)}
          </select>
        </div>

        {isAdmin && projectId && (
          <div>
            <label className="label">Handover date {!selProject?.handoverDate && <span className="text-amber-400">· set for dated plans</span>}</label>
            <input type="date" className="field" value={selProject?.handoverDate ? selProject.handoverDate.slice(0, 10) : ''} onChange={e => setHandover(e.target.value)} />
          </div>
        )}

        {isAdmin && (
          <form onSubmit={createProject} className="flex items-end gap-2">
            <div>
              <label className="label">New project</label>
              <input className="field w-44" placeholder="Marina Gate 1" value={newProject} onChange={e => setNewProject(e.target.value)} />
            </div>
            <button className="btn-ghost" disabled={creating || !newProject.trim()}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
            </button>
          </form>
        )}

        <div className="flex-1" />

        <a href="/api/inventory/template" className="btn-ghost"><Download className="w-4 h-4" /> Template</a>
        {isAdmin && (
          <>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            <button className="btn-primary" disabled={uploading} onClick={() => fileRef.current?.click()} title={!projectId ? 'Pick a project first' : ''}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload Excel
            </button>
          </>
        )}
      </div>

      {err && <p className="text-sm text-red-400 mt-3">{err}</p>}

      {/* Upload result */}
      {result?.status === 'ok' && (
        <div className="card p-4 mt-3 border-emerald-500/30 bg-emerald-500/5 flex items-center gap-2 text-sm text-emerald-300">
          <CheckCircle2 className="w-4 h-4" /> Imported — {result.created} added, {result.updated} updated.
        </div>
      )}
      {result?.status === 'invalid' && (
        <div className="card p-4 mt-3 border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 text-sm text-red-300 font-medium"><AlertTriangle className="w-4 h-4" /> Nothing was imported — fix these {result.errors.length} row(s):</div>
          <ul className="mt-2 space-y-1 text-xs text-red-200/90 max-h-48 overflow-auto">
            {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
          </ul>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mt-6">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="field pl-9 w-56" placeholder="Search unit #" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {['', 'AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            {s === '' ? 'All' : s[0] + s.slice(1).toLowerCase()}
          </button>
        ))}
        <span className="text-xs text-slate-500 ml-auto">{total} unit{total === 1 ? '' : 's'}</span>
      </div>

      {/* Table */}
      <div className="card mt-3 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 border-b border-slate-800">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 font-medium">Layout</th>
                <th className="px-4 py-2.5 font-medium">Floor</th>
                <th className="px-4 py-2.5 font-medium">Size</th>
                <th className="px-4 py-2.5 font-medium">Price</th>
                <th className="px-4 py-2.5 font-medium">Project</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && !units.length ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Loading…</td></tr>
              ) : !units.length ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No units yet. {isAdmin ? 'Download the template, fill it in, and upload.' : ''}</td></tr>
              ) : units.map(u => (
                <tr key={u.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-2.5 text-white font-medium">{u.unitNumber}</td>
                  <td className="px-4 py-2.5 text-slate-300">{u.layoutCode}</td>
                  <td className="px-4 py-2.5 text-slate-400">{u.floor ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-400">{u.sizeSqft ? `${u.sizeSqft} sqft` : '—'}</td>
                  <td className="px-4 py-2.5 text-slate-200">{money(u.priceAed)}</td>
                  <td className="px-4 py-2.5 text-slate-400">{u.project || '—'}</td>
                  <td className="px-4 py-2.5">
                    {isAdmin ? (
                      <select value={u.status} onChange={e => setStatus(u.id, e.target.value)}
                        className={`rounded-full text-[11px] px-2 py-1 border-0 focus:outline-none cursor-pointer ${STATUS[u.status] || ''}`}>
                        {['AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED'].map(s => <option key={s} value={s} className="bg-slate-900 text-white">{s[0] + s.slice(1).toLowerCase()}</option>)}
                      </select>
                    ) : (
                      <span className={`text-[11px] px-2 py-1 rounded-full ${STATUS[u.status] || ''}`}>{u.status[0] + u.status.slice(1).toLowerCase()}</span>
                    )}
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
