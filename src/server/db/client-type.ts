import type { prisma } from './prisma';

// What both `prisma` and an interactive-transaction client offer.
export type DbClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;
