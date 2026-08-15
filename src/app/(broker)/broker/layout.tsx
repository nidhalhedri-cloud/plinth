import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { BrokerShell } from '@/components/broker-shell';

export default async function BrokerLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (user.role !== 'BROKER') redirect('/dashboard');

  const [company, brokerage] = await Promise.all([
    user.companyId ? prisma.company.findUnique({ where: { id: user.companyId }, select: { name: true } }) : null,
    user.brokerageId ? prisma.brokerage.findUnique({ where: { id: user.brokerageId }, select: { name: true } }) : null,
  ]);

  return <BrokerShell developer={company?.name || 'Developer'} brokerage={brokerage?.name || null}>{children}</BrokerShell>;
}
