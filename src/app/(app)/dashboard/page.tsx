'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Boxes, CheckCircle2, Building2, FileText, Clock, TrendingUp } from 'lucide-react';

type Stats = {
  totals: { units: number; available: number; reserved: number; sold: number; brokerages: number; offers: number };
  unitsByStatus: Record<string, number>;
  offersByStatus: Record<string, number>;
  offersWeek: number; offersMonth: number;
  topBrokerages: { name: string; count: number }[];
};

const OFFER_STAGES = ['DRAFT', 'SENT', 'VIEWED', 'RESERVED', 'SPA_SIGNED', 'SOLD', 'DROPPED'];
const UNIT_STAGES = ['AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED'];
const STAGE_COLOR: Record<string, string> = {
  DRAFT: 'bg-slate-500', SENT: 'bg-blue-500', VIEWED: 'bg-indigo-500', RESERVED: 'bg-amber-500',
  SPA_SIGNED: 'bg-purple-500', SOLD: 'bg-emerald-500', DROPPED: 'bg-red-500',
  AVAILABLE: 'bg-emerald-500', BLOCKED: 'bg-red-500',
};
const label = (s: string) => s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function DashboardPage() {
  const [me, setMe] = useState<{ firstName: string } | null>(null);
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    api<{ user: { firstName: string } }>('/api/me').then(r => setMe(r.user));
    api<Stats>('/api/dashboard').then(setS);
  }, []);

  const cards = s ? [
    { label: 'Units', value: s.totals.units, icon: Boxes },
    { label: 'Available', value: s.totals.available, icon: CheckCircle2 },
    { label: 'Reserved', value: s.totals.reserved, icon: Clock },
    { label: 'Brokerages', value: s.totals.brokerages, icon: Building2 },
    { label: 'Offers', value: s.totals.offers, icon: FileText },
  ] : [];

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-white">Welcome{me ? `, ${me.firstName}` : ''}</h1>
      <p className="text-slate-400 text-sm mt-1">Your developer workspace at a glance.</p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
        {cards.map(c => { const Icon = c.icon; return (
          <div key={c.label} className="card p-5">
            <Icon className="w-5 h-5 text-indigo-400" strokeWidth={1.75} />
            <p className="text-3xl font-bold text-white mt-3">{c.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{c.label}</p>
          </div>
        ); })}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Breakdown title="Offer pipeline" data={s?.offersByStatus} order={OFFER_STAGES} />
        <Breakdown title="Inventory" data={s?.unitsByStatus} order={UNIT_STAGES} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white mb-4"><TrendingUp className="w-4 h-4 text-indigo-400" /> Offers sent</div>
          <div className="flex gap-8">
            <div><p className="text-3xl font-bold text-white">{s?.offersWeek ?? '—'}</p><p className="text-xs text-slate-400">this week</p></div>
            <div><p className="text-3xl font-bold text-white">{s?.offersMonth ?? '—'}</p><p className="text-xs text-slate-400">this month</p></div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white mb-4"><Building2 className="w-4 h-4 text-indigo-400" /> Top brokerages</div>
          {!s?.topBrokerages.length ? <p className="text-sm text-slate-500">No offers sent to brokerages yet.</p> : (
            <div className="space-y-2">
              {s.topBrokerages.map((b, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{b.name}</span>
                  <span className="text-slate-400">{b.count} offer{b.count === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Breakdown({ title, data, order }: { title: string; data?: Record<string, number>; order: string[] }) {
  const total = data ? Object.values(data).reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4"><span className="text-sm font-semibold text-white">{title}</span><span className="text-xs text-slate-500">{total} total</span></div>
      {!total ? <p className="text-sm text-slate-500">Nothing here yet.</p> : (
        <div className="space-y-2.5">
          {order.filter(st => data?.[st]).map(st => {
            const v = data![st];
            return (
              <div key={st}>
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-300">{label(st)}</span><span className="text-slate-400">{v}</span></div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full ${STAGE_COLOR[st] || 'bg-slate-500'}`} style={{ width: `${(v / total) * 100}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
