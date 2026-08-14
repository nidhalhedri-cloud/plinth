'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { UserPlus, Copy, Check, Loader2, Mail } from 'lucide-react';

type Member = { id: string; email: string; firstName: string; lastName: string | null; role: string; isActive: boolean };
type Invite = { id: string; email: string; role: string; expiresAt: string };

export default function TeamPage() {
  const [data, setData] = useState<{ members: Member[]; invites: Invite[] } | null>(null);
  const [err, setErr] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => api<{ members: Member[]; invites: Invite[] }>('/api/team').then(setData).catch(e => setErr((e as Error).message));
  useEffect(() => { load(); }, []);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true); setErr(''); setLastLink(null);
    try {
      const r = await api<{ acceptUrl: string }>('/api/team/invites', { method: 'POST', json: { email, role: 'RM' } });
      setLastLink(r.acceptUrl); setEmail(''); load();
    } catch (e) { setErr((e as Error).message); } finally { setSending(false); }
  };

  const copy = () => { if (lastLink) { navigator.clipboard.writeText(lastLink); setCopied(true); setTimeout(() => setCopied(false), 1500); } };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white">Team</h1>
      <p className="text-slate-400 text-sm mt-1">Invite your relationship managers. They set their own password from the link.</p>

      <form onSubmit={invite} className="card p-5 mt-6 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="label">Invite by email</label>
          <input className="field" type="email" required placeholder="rm@yourcompany.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <button className="btn-primary" disabled={sending}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Send invite
        </button>
      </form>

      {err && <p className="text-sm text-red-400 mt-3">{err}</p>}

      {lastLink && (
        <div className="card p-4 mt-3 bg-indigo-500/5 border-indigo-500/30">
          <p className="text-xs text-slate-400 mb-2">Share this link with them (email delivery lands in a later phase):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-indigo-300 bg-slate-950 rounded-lg px-3 py-2 truncate">{lastLink}</code>
            <button onClick={copy} className="btn-ghost">{copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}</button>
          </div>
        </div>
      )}

      <div className="card mt-6 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 text-sm font-semibold text-white">Members</div>
        {!data ? (
          <div className="p-6 text-slate-500 text-sm">Loading…</div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {data.members.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-medium text-slate-300">
                  {m.firstName?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{m.firstName} {m.lastName || ''}</p>
                  <p className="text-xs text-slate-500 truncate">{m.email}</p>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 capitalize">{m.role.replace('_', ' ').toLowerCase()}</span>
              </div>
            ))}
            {data.invites.map(i => (
              <div key={i.id} className="flex items-center gap-3 px-5 py-3 opacity-70">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center"><Mail className="w-4 h-4 text-slate-500" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-300 truncate">{i.email}</p>
                  <p className="text-xs text-slate-500">Invite pending</p>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">pending</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
