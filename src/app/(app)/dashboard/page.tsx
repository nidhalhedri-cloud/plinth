import { currentUser } from '@/lib/auth';
import { tenantDb } from '@/lib/db';
import { Boxes, Building2, FileText, CheckCircle2 } from 'lucide-react';

export default async function DashboardPage() {
  const user = await currentUser();
  const companyId = user!.companyId!;
  const db = tenantDb(companyId);

  // Every count is tenant-scoped automatically — proof the isolation layer is in force.
  const [units, available, brokerages, offers] = await Promise.all([
    db.unit.count(),
    db.unit.count({ where: { status: 'AVAILABLE' } }),
    db.brokerage.count(),
    db.offer.count(),
  ]);

  const stats = [
    { label: 'Units', value: units, icon: Boxes },
    { label: 'Available', value: available, icon: CheckCircle2 },
    { label: 'Brokerages', value: brokerages, icon: Building2 },
    { label: 'Offers sent', value: offers, icon: FileText },
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-white">Welcome, {user!.firstName}</h1>
      <p className="text-slate-400 text-sm mt-1">Your developer workspace at a glance.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card p-5">
              <Icon className="w-5 h-5 text-indigo-400" strokeWidth={1.75} />
              <p className="text-3xl font-bold text-white mt-3">{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="card p-6 mt-6">
        <h2 className="text-sm font-semibold text-white">Getting started</h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-400 list-decimal list-inside">
          <li>Invite your relationship managers from <span className="text-slate-200">Team</span>.</li>
          <li>Upload your unit inventory (Excel) — <span className="text-slate-500">coming next</span>.</li>
          <li>Add floor-plan layouts, payment plans and fees.</li>
          <li>Register brokerages and link their WhatsApp groups.</li>
          <li>Generate branded sales offers and send them straight to a broker&apos;s group.</li>
        </ol>
      </div>
    </div>
  );
}
