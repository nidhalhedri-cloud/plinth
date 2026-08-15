'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Search } from 'lucide-react';

const money = (n: number) => 'AED ' + Math.round(n).toLocaleString('en-AE');
type Unit = { id: string; unitNumber: string; layoutCode: string; floor: number | null; sizeSqft: number | null; view: string | null; price: number; handover: string | null; project: string };

export default function BrokerInventoryPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => { const sp = new URLSearchParams(); if (q.trim()) sp.set('q', q.trim()); api<{ units: Unit[] }>(`/api/broker/inventory?${sp}`).then(r => setUnits(r.units)); }, 200); return () => clearTimeout(t); }, [q]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-white">Available units</h1>
      <p className="text-slate-400 text-sm mt-1">Live availability to share with your buyers.</p>
      <div className="relative mt-4 max-w-xs"><Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" /><input className="field pl-9" placeholder="Search unit #" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="card mt-4 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-xs text-slate-500 text-left border-b border-slate-800"><tr><th className="px-4 py-2.5">Unit</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Size</th><th className="px-4 py-2.5">Project</th><th className="px-4 py-2.5">Handover</th><th className="px-4 py-2.5 text-right">Price</th></tr></thead>
          <tbody className="divide-y divide-slate-800/60">
            {!units.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No available units.</td></tr>}
            {units.map(u => (
              <tr key={u.id} className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 text-white font-medium">{u.unitNumber}</td>
                <td className="px-4 py-2.5 text-slate-300">{u.layoutCode}</td>
                <td className="px-4 py-2.5 text-slate-400">{u.sizeSqft ? `${u.sizeSqft} sqft` : '—'}</td>
                <td className="px-4 py-2.5 text-slate-400">{u.project}</td>
                <td className="px-4 py-2.5 text-slate-400">{u.handover || '—'}</td>
                <td className="px-4 py-2.5 text-right text-slate-200">{money(u.price)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
