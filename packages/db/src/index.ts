import { PrismaClient } from '@prisma/client';

export * from "@prisma/client";
export * from "./importer";
export * from "./learning";

const globalForPrisma = globalThis as unknown as { __bmPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__bmPrisma ?? new PrismaClient({ log: ['warn', 'error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.__bmPrisma = prisma;
