'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { AuthShell } from '@/components/auth-shell';

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api('/api/invites/accept', { method: 'POST', json: { token: params.token, ...form } });
      router.push('/dashboard'); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Join your team" subtitle="Set up your account">
      <form onSubmit={submit} className="space-y-3">
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
          <label className="label">Choose a password</label>
          <input className="field" type="password" autoComplete="new-password" required value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Joining…' : 'Join'}</button>
      </form>
    </AuthShell>
  );
}
