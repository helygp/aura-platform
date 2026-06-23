/**
 * routes/master/backups.js
 *
 * Fase 1 — Painel de backups no master.
 * Proxy para o serviço aura-backup-worker (rede prod_default, porta 4010).
 * Adiciona autenticação via x-master-secret e enriquece algumas respostas
 * com dados do Prisma master quando faz sentido.
 *
 * Endpoints expostos em /master/backups:
 *   GET    /                 → resumo agregado (health + contadores)
 *   GET    /policies         → lista policies + last_success (do worker)
 *   GET    /jobs             → catálogo de execuções
 *   GET    /jobs/heatmap     → matriz tenant × dia (30 dias) para o calendário
 *   POST   /run-now/:slug    → dispara backup manual
 *   POST   /snapshot-all     → dispara snapshot pré-deploy
 *   GET    /settings         → backup_global_settings
 *   PATCH  /settings         → atualiza backup_global_settings
 *   PATCH  /policies/:slug   → atualiza policy de um tenant
 *
 * Variáveis de ambiente:
 *   BACKUP_WORKER_URL  (default http://aura-backup-worker:4010)
 *
 * Autenticação: authenticateMaster (x-master-secret header)
 */

import { Router }             from 'express'
import { prismaMaster as prisma } from '../../lib/prisma-master.js'
import { authenticateMaster } from '../../middleware/authenticateMaster.js'

const WORKER_URL = process.env.BACKUP_WORKER_URL || 'http://aura-backup-worker:4010'
const WORKER_TIMEOUT_MS = 8000

export const masterBackupsRouter = Router()
masterBackupsRouter.use(authenticateMaster)

/* ── helper: chama o worker com timeout e retorna json ────────────── */
async function workerFetch(path, options = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), WORKER_TIMEOUT_MS)
  try {
    const res = await fetch(`${WORKER_URL}${path}`, {
      ...options,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
    const text = await res.text()
    let body
    try { body = text ? JSON.parse(text) : null } catch { body = { raw: text } }
    return { ok: res.ok, status: res.status, body }
  } finally {
    clearTimeout(timer)
  }
}

/* ── GET /master/backups — resumo agregado ────────────────────────── */
masterBackupsRouter.get('/', async (req, res) => {
  try {
    const [health, policies, recent] = await Promise.all([
      workerFetch('/health').catch((e) => ({ ok: false, body: { error: e.message } })),
      workerFetch('/policies').catch((e) => ({ ok: false, body: { error: e.message } })),
      workerFetch('/jobs?limit=50').catch((e) => ({ ok: false, body: { error: e.message } })),
    ])

    const items = policies.body?.items ?? []
    const jobs  = recent.body?.items ?? []
    const enabled = items.filter((p) => p.enabled).length
    const total   = items.length

    const stale = items.filter((p) => {
      if (!p.enabled) return false
      if (!p.last_success) return true
      const hours = (Date.now() - new Date(p.last_success).getTime()) / 3600000
      return hours > 36
    }).length

    const last24h = jobs.filter((j) => {
      const ts = j.started_at ? new Date(j.started_at).getTime() : 0
      return Date.now() - ts < 86_400_000
    })
    const successLast24h = last24h.filter((j) => j.status === 'success').length
    const failedLast24h  = last24h.filter((j) => j.status === 'failed').length

    res.json({
      workerHealthy:    health.ok && health.body?.ok === true,
      workerRunning:    health.body?.running ?? null,
      workerUrl:        WORKER_URL,
      policies:         { total, enabled, dormant: total - enabled, stale },
      last24h:          { success: successLast24h, failed: failedLast24h, total: last24h.length },
      generatedAt:      new Date().toISOString(),
    })
  } catch (err) {
    console.error('[master/backups GET /]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── GET /master/backups/policies ─────────────────────────────────── */
masterBackupsRouter.get('/policies', async (_req, res) => {
  const r = await workerFetch('/policies').catch((e) => ({ ok: false, status: 502, body: { error: e.message } }))
  res.status(r.status || (r.ok ? 200 : 502)).json(r.body)
})

/* ── GET /master/backups/jobs ─────────────────────────────────────── */
masterBackupsRouter.get('/jobs', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500)
  const r = await workerFetch(`/jobs?limit=${limit}`).catch((e) => ({ ok: false, status: 502, body: { error: e.message } }))
  res.status(r.status || (r.ok ? 200 : 502)).json(r.body)
})

/* ── GET /master/backups/jobs/heatmap (30 dias × tenants) ─────────── */
masterBackupsRouter.get('/jobs/heatmap', async (_req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT t.slug,
             (j.started_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
             j.status,
             COUNT(*)::int AS n
        FROM backup_jobs j
        JOIN tenants t ON t.id = j.tenant_id
       WHERE j.started_at >= NOW() - INTERVAL '30 days'
       GROUP BY t.slug, day, j.status
       ORDER BY t.slug, day
    `)
    res.json({ count: rows.length, items: rows })
  } catch (err) {
    console.error('[master/backups GET /jobs/heatmap]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── POST /master/backups/run-now/:slug ───────────────────────────── */
masterBackupsRouter.post('/run-now/:slug', async (req, res) => {
  const slug = req.params.slug
  const label = (req.body && req.body.label) || `manual-${Date.now()}`
  const r = await workerFetch(`/jobs/run-now/${encodeURIComponent(slug)}`, {
    method: 'POST',
    body:   JSON.stringify({ label }),
  }).catch((e) => ({ ok: false, status: 502, body: { error: e.message } }))
  res.status(r.status || (r.ok ? 202 : 502)).json(r.body)
})

/* ── POST /master/backups/snapshot-all ────────────────────────────── */
masterBackupsRouter.post('/snapshot-all', async (req, res) => {
  const label = (req.body && req.body.label) || `snapshot-${Date.now()}`
  const r = await workerFetch('/jobs/snapshot-all', {
    method: 'POST',
    body:   JSON.stringify({ label }),
  }).catch((e) => ({ ok: false, status: 502, body: { error: e.message } }))
  res.status(r.status || (r.ok ? 202 : 502)).json(r.body)
})

/* ── GET /master/backups/settings ─────────────────────────────────── */
masterBackupsRouter.get('/settings', async (_req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT * FROM backup_global_settings WHERE id = 1 LIMIT 1'
    )
    res.json(rows[0] || null)
  } catch (err) {
    console.error('[master/backups GET /settings]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PATCH /master/backups/settings ───────────────────────────────── */
masterBackupsRouter.patch('/settings', async (req, res) => {
  try {
    const allowed = [
      'default_cron', 'default_window_start', 'default_window_end',
      'default_retention_daily', 'default_retention_weekly',
      'default_retention_monthly', 'default_retention_yearly',
      'max_parallel_jobs', 'alert_after_hours', 'paused',
    ]
    const fields = []
    const values = []
    let p = 1
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        fields.push(`"${k}" = $${p++}`)
        values.push(req.body[k])
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo válido informado.' })
    fields.push('updated_at = NOW()')
    const sql = `UPDATE backup_global_settings SET ${fields.join(', ')} WHERE id = 1 RETURNING *`
    const rows = await prisma.$queryRawUnsafe(sql, ...values)
    res.json(rows[0])
  } catch (err) {
    console.error('[master/backups PATCH /settings]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PATCH /master/backups/policies/:slug ─────────────────────────── */
masterBackupsRouter.patch('/policies/:slug', async (req, res) => {
  try {
    const t = await prisma.tenant.findUnique({ where: { slug: req.params.slug } })
    if (!t) return res.status(404).json({ error: 'Tenant não encontrado.' })

    const allowed = [
      'enabled', 'cron_expr', 'window_start', 'window_end',
      'retention_daily', 'retention_weekly', 'retention_monthly', 'retention_yearly',
      'pre_deploy_snapshot',
    ]
    const fields = []
    const values = []
    let p = 1
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        fields.push(`"${k}" = $${p++}`)
        values.push(req.body[k])
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo válido informado.' })
    fields.push('updated_at = NOW()')
    values.push(t.id)
    const sql = `UPDATE backup_policies SET ${fields.join(', ')} WHERE tenant_id = $${p} RETURNING *`
    const rows = await prisma.$queryRawUnsafe(sql, ...values)
    if (!rows.length) return res.status(404).json({ error: 'Policy não encontrada para este tenant.' })
    res.json(rows[0])
  } catch (err) {
    console.error('[master/backups PATCH /policies/:slug]', err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})
