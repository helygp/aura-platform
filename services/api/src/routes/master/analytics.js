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


/* GET /:slug/heatmap — matrix 7x24 de logins dos últimos 30d */
masterAnalyticsRouter.get('/:slug/heatmap', async (req, res) => {
  try {
    const tenant  = await resolveTenant(req.params.slug)
    const since30d = new Date(Date.now() - 30 * 86400000)

    const events = await prisma.loginEvent.findMany({
      where:  { tenantSlug: tenant.slug, success: true, createdAt: { gte: since30d } },
      select: { createdAt: true },
    })

    // matrix[weekday 0-6][hour 0-23] = count
    const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0))
    for (const e of events) {
      const d = new Date(e.createdAt)
      matrix[d.getUTCDay()][d.getUTCHours()]++
    }

    const max = Math.max(...matrix.flat())
    res.json({ matrix, max, totalLogins: events.length, days: 30 })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error('[analytics/heatmap]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* GET /:slug/events — audit log paginado de login_events */
masterAnalyticsRouter.get('/:slug/events', async (req, res) => {
  try {
    const tenant = await resolveTenant(req.params.slug)
    const {
      userId, success, page = '1', limit = '50',
      from, to,
    } = req.query

    const pageN  = Math.max(1, parseInt(page, 10))
    const limitN = Math.min(200, Math.max(1, parseInt(limit, 10)))

    const where = { tenantSlug: tenant.slug }
    if (userId)             where.userId  = userId
    if (success !== undefined && success !== '') {
      where.success = success === 'true'
    }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to)   where.createdAt.lte = new Date(to)
    }

    const [events, total] = await Promise.all([
      prisma.loginEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:  (pageN - 1) * limitN,
        take:  limitN,
        include: { user: { select: { name: true, login: true, role: true } } },
      }),
      prisma.loginEvent.count({ where }),
    ])

    res.json({
      data: events,
      meta: { page: pageN, limit: limitN, total, pages: Math.ceil(total / limitN) },
    })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error('[analytics/events]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* POST /:slug/users/:userId/revoke — revoga todas as sessões ativas do usuário */
masterAnalyticsRouter.post('/:slug/users/:userId/revoke', async (req, res) => {
  try {
    const tenant = await resolveTenant(req.params.slug)
    const { userId } = req.params

    // Confirma que o usuário pertence ao tenant
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId: tenant.id },
      select: { id: true, name: true, login: true },
    })
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado neste tenant.' })

    const result = await prisma.userSession.updateMany({
      where: { userId, tenantSlug: tenant.slug, revokedAt: null },
      data:  { revokedAt: new Date() },
    })

    // Invalida refresh family (força relogin)
    await prisma.user.update({
      where: { id: userId },
      data:  { refreshFamily: null },
    })

    res.json({
      ok:      true,
      revoked: result.count,
      user:    { id: user.id, name: user.name, login: user.login },
    })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error('[analytics/revoke]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* GET /:slug/suspicious — usuários com atividade suspeita (>5 falhas em 24h) */
masterAnalyticsRouter.get('/:slug/suspicious', async (req, res) => {
  try {
    const tenant   = await resolveTenant(req.params.slug)
    const since24h = new Date(Date.now() - 86400000)
    const threshold = parseInt(req.query.threshold ?? '5', 10)

    // Falhas por userId nas últimas 24h
    const allFailures = await prisma.loginEvent.groupBy({
      by:     ['userId', 'identifier'],
      where:  { tenantSlug: tenant.slug, success: false, createdAt: { gte: since24h } },
      _count: { _all: true },
    })
    const failuresByUser = allFailures
      .filter(f => f._count._all >= threshold)
      .sort((a, b) => b._count._all - a._count._all)

    // Enriquece com dados do usuário quando userId existe
    const userIds = failuresByUser.map(f => f.userId).filter(Boolean)
    const users = userIds.length
      ? await prisma.user.findMany({
          where:  { id: { in: userIds } },
          select: { id: true, name: true, login: true, email: true, role: true },
        })
      : []
    const userMap = Object.fromEntries(users.map(u => [u.id, u]))

    // IPs de origem das falhas
    const failureIps = await prisma.loginEvent.findMany({
      where:  {
        tenantSlug: tenant.slug,
        success:    false,
        createdAt:  { gte: since24h },
        OR: failuresByUser.map(f => ({
          identifier: f.identifier,
          ...(f.userId ? { userId: f.userId } : {}),
        })),
      },
      select:  { ip: true, identifier: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take:    200,
    })

    // Agrupa IPs por identifier
    const ipsByIdentifier = {}
    for (const e of failureIps) {
      if (!ipsByIdentifier[e.identifier]) ipsByIdentifier[e.identifier] = new Set()
      if (e.ip) ipsByIdentifier[e.identifier].add(e.ip)
    }

    res.json({
      suspicious: failuresByUser.map(f => ({
        userId:     f.userId,
        identifier: f.identifier,
        failures24h: f._count._all,
        user:       f.userId ? (userMap[f.userId] ?? null) : null,
        ips:        [...(ipsByIdentifier[f.identifier] ?? [])],
      })),
      threshold,
      checkedAt: new Date().toISOString(),
    })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error('[analytics/suspicious]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})
