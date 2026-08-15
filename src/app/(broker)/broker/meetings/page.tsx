'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/client';
import { CalendarClock, Loader2, Check } from 'lucide-react';

const fdate = (d: string | null) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const STATUS: Record<string, string> = { requested: 'text-blue-300 bg-blue-500/15', confirmed: 'text-emerald-300 bg-emerald-500/15', done: 'text-slate-400 bg-slate-700/40', declined: 'text-red-300 bg-red-500/15' };
type Meeting = { id: string; subject: string; preferredAt: string | null; note: string | null; status: string; createdAt: string };

export default function BrokerMeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [f, setF] = useState({ subject: '', preferredAt: '', note: '' });
  const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false); const [err, setErr] = useState('');
  const load = useCallback(() => api<{ meetings: Meeting[] }>('/api/broker/meetings').then(r => setMeetings(r.meetings)), []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('/api/broker/meetings', { method: 'POST', json: f }); setF({ subject: '', preferredAt: '', note: '' }); setSaved(true); setTimeout(() => setSaved(false), 1500); load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2"><CalendarClock className="w-6 h-6 text-indigo-400" /> Meetings</h1>
      <p className="text-slate-400 text-sm mt-1">Request a meeting or callback with the developer&apos;s team.</p>

      <form onSubmit={submit} className="card p-5 mt-6 grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2"><label className="label">Subject</label><input className="field" value={f.subject} onChange={e => setF(s => ({ ...s, subject: e.target.value }))} placeholder="Discuss allocation for Marina Gate" /></div>
        <div><label className="label">Preferred time</label><input className="field" type="datetime-local" value={f.preferredAt} onChange={e => setF(s => ({ ...s, preferredAt: e.target.value }))} /></div>
        <div><label className="label">Note</label><input className="field" value={f.note} onChange={e => setF(s => ({ ...s, note: e.target.value }))} /></div>
        {err && <p className="text-sm text-red-400 sm:col-span-2">{err}</p>}
        <div className="sm:col-span-2"><button className="btn-primary" disabled={busy || !f.subject.trim()}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null} Request meeting</button></div>
      </form>

      <div className="card mt-4 divide-y divide-slate-800/60">
        {!meetings.length ? <div className="px-4 py-8 text-center text-slate-500 text-sm">No requests yet.</div> : meetings.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1"><p className="text-sm text-white">{m.subject}</p><p className="text-[11px] text-slate-500">{fdate(m.preferredAt)}{m.note ? ` · ${m.note}` : ''}</p></div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${STATUS[m.status] || ''}`}>{m.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
