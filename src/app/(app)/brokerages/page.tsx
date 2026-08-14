'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/client';
import { Building2, Plus, MessageSquare, RefreshCw, LogOut, CheckCircle2, Link2 } from 'lucide-react';

type Link = { rmUserId: string; rmName: string; groupJid: string | null; groupName: string | null; mine: boolean };
type Brokerage = { id: string; name: string; reraNumber: string | null; contactPerson: string | null; phone: string | null; links: Link[] };
type Group = { id: string; subject: string };

export default function BrokeragesPage() {
  const [brokerages, setBrokerages] = useState<Brokerage[]>([]);
  const [waStatus, setWaStatus] = useState('disconnected');
  const [qr, setQr] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', reraNumber: '', contactPerson: '', phone: '' });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => api<{ brokerages: Brokerage[] }>('/api/brokerages').then(r => setBrokerages(r.brokerages)), []);
  useEffect(() => { load(); }, [load]);

  const pollStatus = useCallback(async () => {
    const r = await api<{ status: string; qr: string | null }>('/api/whatsapp/status');
    setWaStatus(r.status); setQr(r.qr);
    if (r.status === 'connected') { if (pollRef.current) clearInterval(pollRef.current); api<{ groups: Group[] }>('/api/whatsapp/groups').then(r => setGroups(r.groups)).catch(() => {}); }
  }, []);
  useEffect(() => { pollStatus(); }, [pollStatus]);

  const connect = async () => {
    const r = await api<{ status: string; qr: string | null }>('/api/whatsapp/connect', { method: 'POST' });
    setWaStatus(r.status); setQr(r.qr);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(pollStatus, 2500);
  };
  const disconnect = async () => { await api('/api/whatsapp/disconnect', { method: 'POST' }); setWaStatus('disconnected'); setQr(null); setGroups([]); };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await api('/api/brokerages', { method: 'POST', json: form });
    setForm({ name: '', reraNumber: '', contactPerson: '', phone: '' }); setAdding(false); load();
  };
  const linkGroup = async (brokerageId: string, groupJid: string) => {
    const g = groups.find(x => x.id === groupJid);
    await api(`/api/brokerages/${brokerageId}/link`, { method: 'POST', json: { groupJid, groupName: g?.subject } });
    load();
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2"><Building2 className="w-6 h-6 text-indigo-400" /><h1 className="text-2xl font-bold text-white">Brokerages</h1></div>
      <p className="text-slate-400 text-sm mt-1">Register the agencies you work with and link each one to its WhatsApp group.</p>

      {/* WhatsApp link */}
      <div className="card p-5 mt-6">
        <div className="flex items-center gap-2 mb-1"><MessageSquare className="w-4 h-4 text-emerald-400" /><h2 className="text-sm font-semibold text-white">Your WhatsApp</h2></div>
        {waStatus === 'connected' ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Linked · {groups.length} groups available</p>
            <button onClick={disconnect} className="btn-ghost !py-1.5 text-xs"><LogOut className="w-3.5 h-3.5" /> Disconnect</button>
          </div>
        ) : qr ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="WhatsApp QR" className="w-40 h-40 bg-white p-2 rounded-lg" />
            <div className="text-sm text-slate-400">
              <p className="text-slate-300 font-medium mb-1">Scan to link:</p>
              <p>WhatsApp → Settings → Linked Devices → Link a Device.</p>
              <button onClick={connect} className="btn-ghost !py-1.5 text-xs mt-3"><RefreshCw className="w-3.5 h-3.5" /> Refresh code</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Link your WhatsApp to send offers into brokers&apos; groups from your own number.</p>
            <button onClick={connect} className="btn-primary !py-2"><MessageSquare className="w-4 h-4" /> Connect WhatsApp</button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-8 mb-3">
        <h2 className="text-sm font-semibold text-white">Agencies</h2>
        <button className="btn-ghost !py-1.5 text-xs" onClick={() => setAdding(v => !v)}><Plus className="w-3.5 h-3.5" /> Add brokerage</button>
      </div>

      {adding && (
        <form onSubmit={create} className="card p-4 mb-3 grid sm:grid-cols-4 gap-2 items-end">
          <div className="sm:col-span-2"><label className="label">Name</label><input className="field" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">RERA no.</label><input className="field" value={form.reraNumber} onChange={e => setForm(f => ({ ...f, reraNumber: e.target.value }))} /></div>
          <div><label className="label">Phone</label><input className="field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div className="sm:col-span-3"><label className="label">Contact person</label><input className="field" value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} /></div>
          <button className="btn-primary">Save</button>
        </form>
      )}

      <div className="space-y-3">
        {!brokerages.length && <p className="text-slate-500 text-sm">No brokerages yet.</p>}
        {brokerages.map(b => {
          const myLink = b.links.find(l => l.mine);
          return (
            <div key={b.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-semibold">{b.name}</p>
                  <p className="text-xs text-slate-500">{[b.reraNumber && `RERA ${b.reraNumber}`, b.contactPerson, b.phone].filter(Boolean).join(' · ') || 'No details'}</p>
                </div>
                {myLink?.groupName && <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center gap-1"><Link2 className="w-3 h-3" />{myLink.groupName}</span>}
              </div>
              {waStatus === 'connected' && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-slate-500">WhatsApp group:</span>
                  <select className="field !py-1.5 text-xs max-w-xs" value={myLink?.groupJid || ''} onChange={e => e.target.value && linkGroup(b.id, e.target.value)}>
                    <option value="">Choose a group…</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.subject}</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
