'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { ChevronLeft, Upload, Loader2, Trash2, FileText, Building2 } from 'lucide-react';

const money = (n: number) => 'AED ' + Math.round(n).toLocaleString('en-AE');
const STATUS: Record<string, string> = { DRAFT: 'text-slate-400 bg-slate-700/40', SENT: 'text-blue-300 bg-blue-500/15', VIEWED: 'text-indigo-300 bg-indigo-500/15', RESERVED: 'text-amber-300 bg-amber-500/15', SPA_SIGNED: 'text-purple-300 bg-purple-500/15', SOLD: 'text-emerald-300 bg-emerald-500/15', DROPPED: 'text-red-300 bg-red-500/15' };

type Deal = { id: string; unit: string; project: string; status: string; price: number; booked: boolean };
type Doc = { id: string; label: string | null; mime: string; createdAt: string };
type Data = { client: { id: string; name: string; email: string | null; phone: string | null; idType: string | null; idNumber: string | null; address: string | null }; deals: Deal[]; documents: Doc[] };

export default function ClientPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [d, setD] = useState<Data | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(() => api<Data>(`/api/clients/${id}`).then(setD), [id]);
  useEffect(() => { load(); }, [load]);

  const upload = async (file: File) => {
    setBusy(true);
    try { const fd = new FormData(); fd.append('file', file); fd.append('label', label || file.name); await api(`/api/clients/${id}/documents`, { method: 'POST', body: fd }); setLabel(''); await load(); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const delDoc = async (assetId: string) => { if (confirm('Delete this document?')) { await api(`/api/clients/${id}/documents/${assetId}`, { method: 'DELETE' }); load(); } };

  if (!d) return <p className="text-slate-500 text-sm">Loading…</p>;
  const c = d.client;

  return (
    <div className="max-w-3xl">
      <Link href="/clients" className="text-xs text-slate-500 hover:text-white flex items-center gap-1 mb-3"><ChevronLeft className="w-3.5 h-3.5" /> Clients</Link>
      <h1 className="text-2xl font-bold text-white">{c.name}</h1>
      <p className="text-slate-400 text-sm mt-1">{[c.phone, c.email, c.idNumber && `${c.idType === 'passport' ? 'Passport' : 'ID'} ${c.idNumber}`].filter(Boolean).join(' · ') || 'No contact details'}</p>
      {c.address && <p className="text-slate-500 text-xs mt-0.5">{c.address}</p>}

      {/* Units / deals */}
      <h2 className="text-sm font-semibold text-white mt-6 mb-2 flex items-center gap-2"><Building2 className="w-4 h-4 text-indigo-400" /> Units</h2>
      <div className="card overflow-hidden">
        {!d.deals.length ? <div className="px-4 py-6 text-center text-slate-500 text-sm">No units yet.</div> : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-800/60">
              {d.deals.map(dl => (
                <tr key={dl.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-2.5 text-white font-medium">{dl.unit}</td>
                  <td className="px-4 py-2.5 text-slate-400">{dl.project}</td>
                  <td className="px-4 py-2.5 text-slate-300">{money(dl.price)}</td>
                  <td className="px-4 py-2.5"><span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS[dl.status] || ''}`}>{dl.status.replace('_', ' ')}</span></td>
                  <td className="px-4 py-2.5 text-right">{dl.booked && <Link href={`/collections/${dl.id}`} className="text-[11px] text-indigo-300 hover:text-indigo-200">SOA →</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Documents */}
      <h2 className="text-sm font-semibold text-white mt-6 mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-400" /> Documents</h2>
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-2 mb-3">
          <div className="flex-1 min-w-[160px]"><label className="label">Label</label><input className="field" placeholder="Passport, Signed SPA, Cheque…" value={label} onChange={e => setLabel(e.target.value)} /></div>
          <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          <button className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload</button>
        </div>
        {!d.documents.length ? <p className="text-slate-500 text-sm">No documents yet.</p> : (
          <div className="divide-y divide-slate-800/60">
            {d.documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 py-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <a href={`/api/assets/${doc.id}`} target="_blank" className="flex-1 text-sm text-white hover:text-indigo-300">{doc.label || 'Document'}</a>
                <span className="text-[11px] text-slate-500">{new Date(doc.createdAt).toLocaleDateString('en-GB')}</span>
                <button onClick={() => delDoc(doc.id)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
