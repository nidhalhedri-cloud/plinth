import type { Prisma } from '@prisma/client';

// Editable Dubai-market fee defaults seeded for every new company (§3.7). These are conventions,
// NOT constants — the Company Admin can change amounts/percentages or add lines. isSystem just marks
// the ones we pre-created.
export async function seedFeeDefaults(tx: Prisma.TransactionClient, companyId: string) {
  await tx.feeSetting.createMany({
    data: [
      { companyId, label: 'DLD transfer fee', kind: 'PERCENT', value: '4', payer: 'BUYER', taxable: false, sortOrder: 1, isSystem: true },
      { companyId, label: 'Oqood / DLD registration', kind: 'FIXED', value: '3000', payer: 'BUYER', taxable: false, sortOrder: 2, isSystem: true },
      { companyId, label: 'DLD trustee / admin', kind: 'FIXED', value: '580', payer: 'BUYER', taxable: true, sortOrder: 3, isSystem: true },
    ],
  });
}
