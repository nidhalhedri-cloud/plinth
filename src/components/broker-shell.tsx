'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { Users, Boxes, CalendarClock, LogOut } from 'lucide-react';
import { PlinthMark } from '@/components/plinth-logo';

const NAV = [
  { href: '/broker', label: 'My clients', icon: Users, exact: true },
  { href: '/broker/inventory', label: 'Available units', icon: Boxes },
  { href: '/broker/meetings', label: 'Meetings', icon: CalendarClock },
];

export function BrokerShell({ developer, brokerage, children }: { developer: string; brokerage: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = (h: string, exact?: boolean) => (exact ? pathname === h : pathname === h || pathname.startsWith(h + '/'));
  const logout = async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); router.push('/login'); router.refresh(); };

  return (
    <div className="min-h-screen">
      <header className="h-14 border-b border-slate-800 bg-slate-900 flex items-center px-4 gap-4 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white"><PlinthMark size={15} /></div>
          <div className="leading-tight"><p className="text-sm font-semibold text-white">{developer}</p><p className="text-[10px] text-slate-500">Broker portal{brokerage ? ` · ${brokerage}` : ''}</p></div>
        </div>
        <nav className="flex items-center gap-1 ml-4">
          {NAV.map(n => { const Icon = n.icon; return (
            <Link key={n.href} href={n.href} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] ${active(n.href, n.exact) ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}>
              <Icon className="w-4 h-4" /> {n.label}
            </Link>
          ); })}
        </nav>
        <button onClick={logout} className="ml-auto p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800" title="Sign out"><LogOut className="w-4 h-4" /></button>
      </header>
      <main className="p-6 lg:p-8">{children}</main>
    </div>
  );
}
