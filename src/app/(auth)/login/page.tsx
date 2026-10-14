'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { AuthShell } from '@/components/auth-shell';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api('/api/auth/login', { method: 'POST', json: form });
      router.push('/dashboard'); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Sign in" subtitle="Plinth · Developer OS">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Email</label>
          <input className="field" type="email" autoComplete="email" required
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="field" type="password" autoComplete="current-password" required
            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="text-sm text-slate-400 mt-4 text-center">
        New developer company? <Link href="/signup" className="text-indigo-400 hover:text-indigo-300">Create an account</Link>
      </p>
    </AuthShell>
  );
}
