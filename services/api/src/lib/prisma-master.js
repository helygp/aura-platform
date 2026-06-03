/**
 * lib/prisma-master.js
 * Prisma Client para o banco master (tenants, users, billing).
 * Separado do prisma.js que aponta para o banco do tenant.
 */

import { PrismaClient } from '@prisma/client'
import { IS_PROD } from './env.js'

const globalForPrismaMaster = globalThis

export const prismaMaster =
  globalForPrismaMaster.__prismaMaster ??
  new PrismaClient({
    datasources: { db: { url: process.env.MASTER_DB_URL } },
    log: IS_PROD ? ['error'] : ['warn', 'error'],
  })

if (!IS_PROD) globalForPrismaMaster.__prismaMaster = prismaMaster
