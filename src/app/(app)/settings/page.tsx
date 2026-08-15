'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { Settings, Upload, Check, Loader2 } from 'lucide-react';

type Company = { name: string; logoUrl: string | null; brandColor: string; primaryContactName: string | null; primaryContactEmail: string | null; bookingTerms: string | null; spaTerms: string | null };

export default function SettingsPage() {
  const [c, setC] = useState<Company | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api<{ company: Company }>('/api/company').then(r => setC(r.company));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!c) return;
    setBusy(true); setErr('');
    try {
      await api('/api/company', { method: 'PATCH', json: { name: c.name, brandColor: c.brandColor, primaryContactName: c.primaryContactName || '', primaryContactEmail: c.primaryContactEmail || '', bookingTerms: c.bookingTerms || '', spaTerms: c.spaTerms || '' } });
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const uploadLogo = async (file: File) => {
    setBusy(true); setErr('');
    try { const fd = new FormData(); fd.append('file', file); await api('/api/company/logo', { method: 'POST', body: fd }); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  if (!c) return <p className="text-slate-500 text-sm">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2"><Settings className="w-6 h-6 text-indigo-400" /><h1 className="text-2xl font-bold text-white">Company settings</h1></div>
      <p className="text-slate-400 text-sm mt-1">Your branding appears on every generated sales offer.</p>

      <div className="card p-6 mt-6 space-y-4">
        <div>
          <label className="label">Company name</label>
          <input className="field" value={c.name} onChange={e => setC({ ...c, name: e.target.value })} />
        </div>

        <div>
          <label className="label">Logo</label>
          <div className="flex items-center gap-4">
            <div className="w-24 h-16 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
              {c.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logoUrl} alt="logo" className="max-w-full max-h-full object-contain" />
              ) : <span className="text-xs text-slate-600">No logo</span>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
            <button className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy}><Upload className="w-4 h-4" /> Upload logo</button>
          </div>
        </div>

        <div>
          <label className="label">Brand colour</label>
          <div className="flex items-center gap-3">
            <input type="color" value={c.brandColor} onChange={e => setC({ ...c, brandColor: e.target.value })} className="w-12 h-10 rounded-lg bg-transparent border border-slate-700 cursor-pointer" />
            <input className="field w-32" value={c.brandColor} onChange={e => setC({ ...c, brandColor: e.target.value })} />
            <span className="text-xs text-slate-500">Used for the offer header &amp; totals.</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Primary contact</label><input className="field" value={c.primaryContactName || ''} onChange={e => setC({ ...c, primaryContactName: e.target.value })} /></div>
          <div><label className="label">Contact email</label><input className="field" value={c.primaryContactEmail || ''} onChange={e => setC({ ...c, primaryContactEmail: e.target.value })} /></div>
        </div>

        <div>
          <label className="label">Booking form — terms &amp; conditions</label>
          <textarea className="field" rows={4} value={c.bookingTerms || ''} onChange={e => setC({ ...c, bookingTerms: e.target.value })} placeholder="Shown on every generated Booking Form." />
        </div>
        <div>
          <label className="label">SPA — terms &amp; conditions</label>
          <textarea className="field" rows={4} value={c.spaTerms || ''} onChange={e => setC({ ...c, spaTerms: e.target.value })} placeholder="Shown on every generated SPA document." />
        </div>

        {err && <p className="text-sm text-red-400">{err}</p>}
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null} {saved ? 'Saved' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
