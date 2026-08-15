'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Users, Plus, X, Loader2, FileText, Building2 } from 'lucide-react';

type Client = { id: string; name: string; email: string | null; phone: string | null; idType: string | null; idNumber: string | null; deals: number; docs: number };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => api<{ clients: Client[] }>('/api/clients').then(r => setClients(r.clients)), []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2"><Users className="w-6 h-6 text-indigo-400" /><h1 className="text-2xl font-bold text-white">Clients</h1></div>
          <p className="text-slate-400 text-sm mt-1">Every buyer, their units, and their documents. Clients are created automatically when a unit is booked.</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> New client</button>
      </div>

      {adding && <ClientForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}

      <div className="card mt-6 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-xs text-slate-500 text-left border-b border-slate-800"><tr><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Contact</th><th className="px-4 py-2.5">ID / Passport</th><th className="px-4 py-2.5 text-center">Units</th><th className="px-4 py-2.5 text-center">Docs</th></tr></thead>
          <tbody className="divide-y divide-slate-800/60">
            {!clients.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No clients yet.</td></tr>}
            {clients.map(c => (
              <tr key={c.id} className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5"><Link href={`/clients/${c.id}`} className="text-white hover:text-indigo-300 font-medium">{c.name}</Link></td>
                <td className="px-4 py-2.5 text-slate-400">{[c.phone, c.email].filter(Boolean).join(' · ') || '—'}</td>
                <td className="px-4 py-2.5 text-slate-400">{c.idNumber || '—'}</td>
                <td className="px-4 py-2.5 text-center"><span className="inline-flex items-center gap-1 text-slate-300"><Building2 className="w-3.5 h-3.5" />{c.deals}</span></td>
                <td className="px-4 py-2.5 text-center"><span className="inline-flex items-center gap-1 text-slate-300"><FileText className="w-3.5 h-3.5" />{c.docs}</span></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

function ClientForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', idType: 'id', idNumber: '', address: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(s => ({ ...s, [k]: e.target.value }));
  const save = async () => { setBusy(true); setErr(''); try { await api('/api/clients', { method: 'POST', json: f }); onSaved(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  return (
    <div className="card p-5 mt-6 border-indigo-500/30">
      <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-white">New client</h3><button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button></div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="label">Name</label><input className="field" value={f.name} onChange={set('name')} /></div>
        <div><label className="label">Phone</label><input className="field" value={f.phone} onChange={set('phone')} /></div>
        <div><label className="label">Email</label><input className="field" value={f.email} onChange={set('email')} /></div>
        <div><label className="label">ID type</label><select className="field" value={f.idType} onChange={set('idType')}><option value="id">Emirates ID</option><option value="passport">Passport</option></select></div>
        <div><label className="label">{f.idType === 'passport' ? 'Passport no.' : 'Emirates ID'}</label><input className="field" value={f.idNumber} onChange={set('idNumber')} /></div>
        <div><label className="label">Address</label><input className="field" value={f.address} onChange={set('address')} /></div>
      </div>
      {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
      <div className="flex gap-2 mt-4"><button className="btn-primary" onClick={save} disabled={busy || !f.name.trim()}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save</button><button className="btn-ghost" onClick={onClose}>Cancel</button></div>
    </div>
  );
}
