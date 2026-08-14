'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { AuthShell } from '@/components/auth-shell';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ companyName: '', firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api('/api/auth/signup', { method: 'POST', json: form });
      router.push('/dashboard'); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Create your workspace" subtitle="Developer CRM">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Company name</label>
          <input className="field" required value={form.companyName} onChange={set('companyName')} placeholder="Emaar, Damac, …" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First name</label>
            <input className="field" required value={form.firstName} onChange={set('firstName')} />
          </div>
          <div>
            <label className="label">Last name</label>
            <input className="field" value={form.lastName} onChange={set('lastName')} />
          </div>
        </div>
        <div>
          <label className="label">Work email</label>
          <input className="field" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="field" type="password" autoComplete="new-password" required value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Creating…' : 'Create workspace'}</button>
      </form>
      <p className="text-sm text-slate-400 mt-4 text-center">
        Already have an account? <Link href="/login" className="text-indigo-400 hover:text-indigo-300">Sign in</Link>
      </p>
    </AuthShell>
  );
}
