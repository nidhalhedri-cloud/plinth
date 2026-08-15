'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Wallet, AlertTriangle, CalendarClock, TrendingUp } from 'lucide-react';

const money = (n: number) => 'AED ' + Math.round(n).toLocaleString('en-AE');
const fdate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

type Row = { paymentId: string; offerId: string; label: string; unit: string; project: string; client: string | null; amount: number; outstanding: number; dueDate: string };
type Data = { totals: { contracted: number; collected: number; outstanding: number; overdueCount: number; overdueAmount: number }; overdue: Row[]; upcoming: Row[] };

export default function CollectionsPage() {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { api<Data>('/api/collections').then(setD); }, []);

  const cards = d ? [
    { label: 'Contract value', value: money(d.totals.contracted), icon: TrendingUp, tone: 'text-white' },
    { label: 'Collected', value: money(d.totals.collected), icon: Wallet, tone: 'text-emerald-300' },
    { label: 'Outstanding', value: money(d.totals.outstanding), icon: Wallet, tone: 'text-indigo-300' },
    { label: `Overdue (${d.totals.overdueCount})`, value: money(d.totals.overdueAmount), icon: AlertTriangle, tone: 'text-red-300' },
  ] : [];

  const Table = ({ title, rows, icon: Icon, tone }: { title: string; rows: Row[]; icon: typeof AlertTriangle; tone: string }) => (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 text-sm font-semibold text-white flex items-center gap-2"><Icon className={`w-4 h-4 ${tone}`} /> {title} <span className="text-slate-500 font-normal">({rows.length})</span></div>
      {!rows.length ? <div className="px-4 py-8 text-center text-slate-500 text-sm">Nothing here.</div> : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-xs text-slate-500 text-left border-b border-slate-800"><tr><th className="px-4 py-2">Unit</th><th className="px-4 py-2">Buyer</th><th className="px-4 py-2">Milestone</th><th className="px-4 py-2">Due</th><th className="px-4 py-2 text-right">Outstanding</th></tr></thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map(r => (
              <tr key={r.paymentId} className="hover:bg-slate-800/30">
                <td className="px-4 py-2"><Link href={`/collections/${r.offerId}`} className="text-white hover:text-indigo-300">{r.unit}</Link><div className="text-[11px] text-slate-500">{r.project}</div></td>
                <td className="px-4 py-2 text-slate-300">{r.client || '—'}</td>
                <td className="px-4 py-2 text-slate-400">{r.label}</td>
                <td className="px-4 py-2 text-slate-400">{fdate(r.dueDate)}</td>
                <td className="px-4 py-2 text-right text-slate-200">{money(r.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-2"><Wallet className="w-6 h-6 text-indigo-400" /><h1 className="text-2xl font-bold text-white">Collections</h1></div>
      <p className="text-slate-400 text-sm mt-1">Installments due across every deal. Open a unit for its full Statement of Account.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {cards.map(c => { const Icon = c.icon; return (
          <div key={c.label} className="card p-5"><Icon className="w-5 h-5 text-indigo-400" /><p className={`text-2xl font-bold mt-3 ${c.tone}`}>{c.value}</p><p className="text-xs text-slate-400 mt-0.5">{c.label}</p></div>
        ); })}
      </div>

      <div className="space-y-4 mt-6">
        <Table title="Overdue" rows={d?.overdue || []} icon={AlertTriangle} tone="text-red-400" />
        <Table title="Due in the next 60 days" rows={d?.upcoming || []} icon={CalendarClock} tone="text-amber-400" />
      </div>
    </div>
  );
}
