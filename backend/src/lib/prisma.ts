import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

if (process.env.APP_ENV !== 'production') {
  global.__prisma = prisma;
}

// Log errors from Prisma
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(prisma as any).$on('error', (e: any) => {
  logger.error(e, 'Prisma Client Error');
});
