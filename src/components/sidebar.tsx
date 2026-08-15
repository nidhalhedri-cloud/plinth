'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import type { Role } from '@prisma/client';
import {
  LayoutDashboard, Building2, Boxes, Layers, Wallet, Receipt, FileText, Users, LogOut, Settings, Coins, ClipboardList,
} from 'lucide-react';

type Item = { href: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean; soon?: boolean };

const NAV: Item[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/layouts', label: 'Layouts', icon: Layers },
  { href: '/plans', label: 'Payment plans', icon: Wallet, adminOnly: true },
  { href: '/fees', label: 'Fees', icon: Receipt, adminOnly: true },
  { href: '/brokerages', label: 'Brokerages', icon: Building2 },
  { href: '/eoi', label: 'EOI / Launch', icon: ClipboardList, adminOnly: true },
  { href: '/offers', label: 'Offers', icon: FileText },
  { href: '/collections', label: 'Collections', icon: Coins, adminOnly: true },
  { href: '/team', label: 'Team', icon: Users, adminOnly: true },
  { href: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export function Sidebar({ user, company }: { user: { firstName: string; role: Role }; company: { name: string } | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = user.role === 'COMPANY_ADMIN' || user.role === 'PLATFORM_ADMIN';

  const logout = async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); router.push('/login'); router.refresh(); };
  const active = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="w-60 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      <div className="h-16 flex items-center gap-2.5 px-4 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm">D</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{company?.name || 'Developer CRM'}</p>
          <p className="text-[11px] text-slate-500">Developer CRM</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {NAV.filter(i => !i.adminOnly || isAdmin).map(i => {
          const Icon = i.icon;
          return (
            <Link key={i.href} href={i.soon ? '#' : i.href}
              onClick={e => i.soon && e.preventDefault()}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                active(i.href) ? 'bg-slate-800 text-white font-medium'
                : i.soon ? 'text-slate-600 cursor-default' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              }`}>
              <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
              <span className="flex-1">{i.label}</span>
              {i.soon && <span className="text-[9px] uppercase tracking-wide text-slate-600">soon</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-medium text-slate-300">
            {user.firstName?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-white truncate">{user.firstName}</p>
            <p className="text-[11px] text-slate-500 capitalize">{user.role.replace('_', ' ').toLowerCase()}</p>
          </div>
          <button onClick={logout} title="Sign out" className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
