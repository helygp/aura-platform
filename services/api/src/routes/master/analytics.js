/**
 * routes/master/analytics.js
 *
 * GET /master/analytics/:slug/users
 * GET /master/analytics/:slug/sessions
 * GET /master/analytics/:slug/health
 * GET /master/analytics/:slug/logs/:container
 */

import { Router }             from 'express'
import { execFile }           from 'child_process'
import { promisify }          from 'util'
import { prismaMaster as prisma } from '../../lib/prisma-master.js'
import { authenticateMaster } from '../../middleware/authenticateMaster.js'

const execFileAsync = promisify(execFile)
export const masterAnalyticsRouter = Router()
masterAnalyticsRouter.use(authenticateMaster)

async function resolveTenant(slug) {
  const t = await prisma.tenant.findFirst({
    where: { slug },
    select: { id: true, slug: true, name: true },
  })
  if (!t) throw Object.assign(new Error('Tenant nao encontrado.'), { status: 404 })
  return t
}

async function dockerInspect(name) {
  try {
    const { stdout } = await execFileAsync('docker', [
      'inspect', '--format',
      '{"status":"{{.State.Status}}","running":{{.State.Running}},"startedAt":"{{.State.StartedAt}}","restartCount":{{.RestartCount}}}',
      name,
    ])
    return JSON.parse(stdout.trim())
  } catch {
    return { status: 'not_found', running: false, startedAt: null, restartCount: 0 }
  }
}

/* GET /:slug/users */
masterAnalyticsRouter.get('/:slug/users', async (req, res) => {
  try {
    const tenant  = await resolveTenant(req.params.slug)
    const since7d  = new Date(Date.now() - 7  * 86400000)
    const since30d = new Date(Date.now() - 30 * 86400000)
    const since24h = new Date(Date.now() -      86400000)

    const users = await prisma.user.findMany({
      where:   { tenantId: tenant.id },
      orderBy: { lastLoginAt: { sort: 'desc', nulls: 'last' } },
      select:  {
        id: true, name: true, email: true, login: true,
        role: true, active: true, lastLoginAt: true, createdAt: true,
      },
    })

    const activeSessions = await prisma.userSession.findMany({
      where: {
        tenantSlug: tenant.slug,
        revokedAt:  null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { userId: true, lastActivityAt: true, startedAt: true, ip: true },
    })

    const sessionsByUser = {}
    for (const s of activeSessions) {
      if (!sessionsByUser[s.userId]) sessionsByUser[s.userId] = []
      sessionsByUser[s.userId].push(s)
    }

    const [failures7d, logins7d] = await Promise.all([
      prisma.loginEvent.groupBy({
        by: ['userId'],
        where: { tenantSlug: tenant.slug, success: false, createdAt: { gte: since7d } },
        _count: { _all: true },
      }),
      prisma.loginEvent.groupBy({
        by: ['userId'],
        where: { tenantSlug: tenant.slug, success: true, createdAt: { gte: since7d } },
        _count: { _all: true },
      }),
    ])

    const failMap = {}; for (const f of failures7d) if (f.userId) failMap[f.userId] = f._count._all
    const loginMap = {}; for (const l of logins7d) if (l.userId) loginMap[l.userId] = l._count._all

    res.json({
      stats: {
        total:       users.length,
        active:      users.filter(u => u.active).length,
        active24h:   users.filter(u => u.lastLoginAt && u.lastLoginAt >= since24h).length,
        withSession: Object.keys(sessionsByUser).length,
        inactive30d: users.filter(u => !u.lastLoginAt || u.lastLoginAt < since30d).length,
      },
      users: users.map(u => ({
        ...u,
        activeSessions: (sessionsByUser[u.id] ?? []).length,
        lastActivity:   (sessionsByUser[u.id] ?? []).reduce(
          (mx, s) => !mx || s.lastActivityAt > mx ? s.lastActivityAt : mx, null),
        logins7d:   loginMap[u.id]  ?? 0,
        failures7d: failMap[u.id]   ?? 0,
      })),
    })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error('[analytics/users]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* GET /:slug/sessions */
masterAnalyticsRouter.get('/:slug/sessions', async (req, res) => {
  try {
    const tenant = await resolveTenant(req.params.slug)
    const { active, page = '1', limit = '50' } = req.query
    const pageN  = Math.max(1, parseInt(page, 10))
    const limitN = Math.min(200, Math.max(1, parseInt(limit, 10)))

    const where = { tenantSlug: tenant.slug }
    if (active === 'true') {
      where.revokedAt = null
      where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    }

    const [sessions, total] = await Promise.all([
      prisma.userSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip:  (pageN - 1) * limitN,
        take:  limitN,
        include: { user: { select: { name: true, email: true, login: true, role: true } } },
      }),
      prisma.userSession.count({ where }),
    ])

    res.json({
      data: sessions,
      meta: { page: pageN, limit: limitN, total, pages: Math.ceil(total / limitN) },
    })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error('[analytics/sessions]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* GET /:slug/health */
masterAnalyticsRouter.get('/:slug/health', async (req, res) => {
  try {
    const tenant = await resolveTenant(req.params.slug)
    const s = tenant.slug
    const [api, erp, store] = await Promise.all([
      dockerInspect(`api-${s}`),
      dockerInspect(`erp-${s}`),
      dockerInspect(`store-${s}`),
    ])
    res.json({ containers: { api, erp, store }, checkedAt: new Date().toISOString() })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error('[analytics/health]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* GET /:slug/logs/:container */
masterAnalyticsRouter.get('/:slug/logs/:container', async (req, res) => {
  try {
    const { slug, container } = req.params
    if (!['api', 'erp', 'store'].includes(container)) {
      return res.status(400).json({ error: 'Container invalido. Use: api | erp | store' })
    }
    await resolveTenant(slug)

    const tail = Math.min(500, Math.max(50, parseInt(req.query.tail ?? '200', 10)))
    const name = `${container}-${slug}`

    const { stdout, stderr } = await execFileAsync(
      'docker', ['logs', '--tail', String(tail), '--timestamps', name],
      { timeout: 10000 }
    ).catch(e => ({ stdout: '', stderr: e.message }))

    const lines = [stdout, stderr].join('\n')
      .split('\n').filter(Boolean).slice(-tail)

    res.json({ container: name, tail, lines, fetchedAt: new Date().toISOString() })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error('[analytics/logs]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})
