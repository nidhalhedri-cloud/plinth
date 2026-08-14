import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword, startSession, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

const Login = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

export function POST(req: Request) {
  return route(async () => {
    const body = Login.parse(await req.json());
    const email = body.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    // Same message whether the email or the password is wrong — don't leak which.
    if (!user || !user.isActive || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new HttpError(401, 'Wrong email or password');
    }

    await startSession(user.id);
    return { id: user.id, email: user.email, role: user.role };
  });
}
