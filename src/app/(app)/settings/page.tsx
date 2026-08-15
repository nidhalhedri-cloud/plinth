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

      <EmailReminders />
    </div>
  );
}

function EmailReminders() {
  type C = { smtpHost: string | null; smtpPort: number | null; smtpUser: string | null; fromEmail: string | null; fromName: string | null; remindersEnabled: boolean; reminderDaysBefore: number };
  const [c, setC] = useState<C | null>(null);
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [run, setRun] = useState<string | null>(null);
  const load = () => api<{ company: C }>('/api/company').then(r => setC(r.company));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!c) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { smtpHost: c.smtpHost || '', smtpPort: c.smtpPort ?? null, smtpUser: c.smtpUser || '', fromEmail: c.fromEmail || '', fromName: c.fromName || '', remindersEnabled: c.remindersEnabled, reminderDaysBefore: c.reminderDaysBefore };
      if (pass) body.smtpPass = pass;
      await api('/api/company', { method: 'PATCH', json: body });
      setPass(''); setSaved(true); setTimeout(() => setSaved(false), 1500);
    } finally { setBusy(false); }
  };
  const sendNow = async () => {
    setRun('running');
    try { const r = await api<{ candidates: number; sent: number; emailConfigured: boolean; noEmail: number }>('/api/reminders/run', { method: 'POST' });
      setRun(r.emailConfigured ? `Sent ${r.sent} reminder(s)${r.noEmail ? `, ${r.noEmail} buyer(s) have no email` : ''}.` : `${r.candidates} reminder(s) are due — add SMTP settings above to actually send them.`);
    } catch (e) { setRun((e as Error).message); }
  };

  if (!c) return null;
  return (
    <div className="card p-6 mt-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white">Automated payment reminders</h2>
        <p className="text-xs text-slate-400 mt-0.5">Emails buyers about due/overdue installments (paid ones are skipped). Sent from your own mailbox.</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={c.remindersEnabled} onChange={e => setC({ ...c, remindersEnabled: e.target.checked })} className="accent-indigo-500" />
        Send reminders automatically
        <span className="text-xs text-slate-500 ml-2">starting</span>
        <input type="number" className="field !w-16 !py-1" value={c.reminderDaysBefore} onChange={e => setC({ ...c, reminderDaysBefore: Number(e.target.value) })} />
        <span className="text-xs text-slate-500">days before due</span>
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="label">SMTP host</label><input className="field" value={c.smtpHost || ''} onChange={e => setC({ ...c, smtpHost: e.target.value })} placeholder="smtp.gmail.com" /></div>
        <div><label className="label">Port</label><input className="field" type="number" value={c.smtpPort ?? ''} onChange={e => setC({ ...c, smtpPort: e.target.value ? Number(e.target.value) : null })} placeholder="587" /></div>
        <div><label className="label">SMTP username</label><input className="field" value={c.smtpUser || ''} onChange={e => setC({ ...c, smtpUser: e.target.value })} /></div>
        <div><label className="label">SMTP password</label><input className="field" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder={c.smtpUser ? '•••••• (unchanged)' : ''} /></div>
        <div><label className="label">From email</label><input className="field" value={c.fromEmail || ''} onChange={e => setC({ ...c, fromEmail: e.target.value })} placeholder="sales@yourcompany.com" /></div>
        <div><label className="label">From name</label><input className="field" value={c.fromName || ''} onChange={e => setC({ ...c, fromName: e.target.value })} /></div>
      </div>
      {run && <p className="text-sm text-slate-300">{run === 'running' ? 'Running…' : run}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null} {saved ? 'Saved' : 'Save'}</button>
        <button className="btn-ghost" onClick={sendNow}>Send reminders now</button>
      </div>
    </div>
  );
}
