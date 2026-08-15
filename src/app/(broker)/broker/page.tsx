'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { CheckCircle2, Clock, Building2 } from 'lucide-react';

const money = (n: number) => 'AED ' + Math.round(n).toLocaleString('en-AE');
const fdate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

type Deal = {
  id: string; client: string; unit: string; project: string; price: number; status: string;
  paidPercent: number; threshold: number | null; qualified: boolean;
  commission: number | null; commissionRate: number | null; commissionStatus: string | null;
  nextDue: { label: string; dueDate: string; amount: number } | null;
};

export default function BrokerDealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api<{ deals: Deal[] }>('/api/broker/deals').then(r => { setDeals(r.deals); setLoading(false); }); }, []);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-white">My clients</h1>
      <p className="text-slate-400 text-sm mt-1">Buyers you brought, how much they&apos;ve paid, and whether your commission is ready to collect.</p>

      {loading ? <p className="text-slate-500 text-sm mt-6">Loading…</p> : !deals.length ? (
        <div className="card p-10 text-center text-slate-500 text-sm mt-6">No booked clients yet.</div>
      ) : (
        <div className="space-y-3 mt-6">
          {deals.map(d => (
            <div key={d.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-semibold">{d.client}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5"><Building2 className="w-3.5 h-3.5" /> Unit {d.unit} · {d.project} · {money(d.price)}</p>
                </div>
                {d.qualified ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300"><CheckCircle2 className="w-4 h-4" /> Commission ready</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300"><Clock className="w-4 h-4" /> Not yet qualified</span>
                )}
              </div>

              {/* % paid progress */}
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Buyer paid</span><span className="text-slate-200 font-medium">{d.paidPercent}%{d.threshold != null && <span className="text-slate-500"> / {d.threshold}% to release</span>}</span></div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden relative">
                  <div className={`h-full ${d.qualified ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, d.paidPercent)}%` }} />
                  {d.threshold != null && d.threshold <= 100 && <div className="absolute top-0 bottom-0 w-0.5 bg-white/50" style={{ left: `${d.threshold}%` }} title={`${d.threshold}% release threshold`} />}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-8 gap-y-1 mt-4 text-sm">
                <div><span className="text-slate-500 text-xs">Your commission</span><p className="text-white font-semibold">{d.commission != null ? money(d.commission) : '—'} {d.commissionRate != null && <span className="text-xs text-slate-500">({d.commissionRate}%)</span>}</p></div>
                <div><span className="text-slate-500 text-xs">Status</span><p className="text-slate-300 capitalize">{d.commissionStatus || '—'}</p></div>
                {d.nextDue && <div><span className="text-slate-500 text-xs">Next payment due</span><p className="text-slate-300">{money(d.nextDue.amount)} · {fdate(d.nextDue.dueDate)}</p></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
