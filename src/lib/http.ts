import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { HttpError } from './auth';

// Wrap a route handler so thrown HttpError / ZodError / unknown errors become clean JSON responses.
export function route<T>(fn: () => Promise<T>) {
  return (async () => {
    try {
      const data = await fn();
      return NextResponse.json(data ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message || 'Invalid input', issues: e.issues }, { status: 400 });
      // Prisma unique-constraint → 409 with a friendly message.
      const code = (e as { code?: string })?.code;
      if (code === 'P2002') return NextResponse.json({ error: 'That already exists' }, { status: 409 });
      console.error('[route] unhandled', e);
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
  })();
}

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'company';
}

export function token(len = 32): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
