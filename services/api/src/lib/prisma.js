/**
 * lib/prisma.js
 * Singleton do Prisma Client.
 * Em dev, evita múltiplas instâncias no hot-reload do --watch.
 */

import { PrismaClient } from '@prisma/client'
import { IS_PROD } from './env.js'

const globalForPrisma = globalThis

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: IS_PROD ? ['error'] : ['warn', 'error'],
  })

if (!IS_PROD) globalForPrisma.__prisma = prisma
