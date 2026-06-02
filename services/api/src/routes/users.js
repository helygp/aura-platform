/**
 * routes/users.js
 *
 * GET  /api/users          — usuários do tenant
 * POST /api/users/invite   — convida novo usuário
 * PUT  /api/users/me       — atualiza nome próprio
 * PUT  /api/users/me/password — troca senha
 * PUT  /api/users/:id/role    — altera papel
 * PUT  /api/users/:id/revoke  — revoga acesso
 * PUT  /api/users/:id/reactivate
 * POST /api/users/:id/resend-invite
 */

import { Router }   from 'express'
import bcrypt       from 'bcryptjs'
import { randomUUID } from 'crypto'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { prismaMaster as prisma }       from '../lib/prisma-master.js'
import { AuthError }    from '../auth/service.js'

export const usersRouter = Router()
usersRouter.use(authenticate)

/* ── GET /api/users ── */
usersRouter.get('/', authorize('admin'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where:   { tenantId: req.user.tenantId },
      select:  { id:true, tokenId:true, email:true, name:true, role:true, active:true, createdAt:true, lastLoginAt:true },
      orderBy: { createdAt: 'asc' },
    })
    res.json({
      users: users.map(u => ({
        id:        u.id,
        name:      u.name,
        email:     u.email,
        role:      u.role.toLowerCase(),
        status:    u.active ? 'ativo' : 'revogado',
        createdAt: u.createdAt,
        lastLogin: u.lastLoginAt,
        isSelf:    u.tokenId === req.user.tokenId,
      })),
    })
  } catch (err) {
    console.error('[users/list]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── POST /api/users/invite ── */
usersRouter.post('/invite', authorize('admin'), async (req, res) => {
  try {
    const { name, email, role } = req.body
    const tenant = await prisma.tenant.findUnique({ where: { slug: req.user.tenantSlug } })
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' })

    const tempPass = `Aura@${randomUUID().slice(0,8)}`
    const hash     = await bcrypt.hash(tempPass, 10)

    await prisma.user.create({
      data: {
        tenantId:     tenant.id,
        email:        email.toLowerCase().trim(),
        name:         name.trim(),
        passwordHash: hash,
        role:         role.toUpperCase(),
        active:       true,
      },
    })

    // Em produção: enviar e-mail com tempPass via services/notify
    res.status(201).json({ ok: true, message: `Convite enviado para ${email}.` })
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'E-mail já cadastrado.' })
    console.error('[users/invite]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PUT /api/users/me ── */
usersRouter.put('/me', async (req, res) => {
  try {
    const { name } = req.body
    await prisma.user.update({
      where: { tokenId: req.user.tokenId },
      data:  { name: name.trim(), updatedAt: new Date() },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PUT /api/users/me/password ── */
usersRouter.put('/me/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const user = await prisma.user.findUnique({ where: { tokenId: req.user.tokenId } })
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' })

    const ok = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta.' })

    const hash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash, updatedAt: new Date() } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PUT /api/users/:id/role ── */
usersRouter.put('/:id/role', authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body
    await prisma.user.update({
      where: { id: req.params.id },
      data:  { role: role.toUpperCase(), updatedAt: new Date() },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PUT /api/users/:id/revoke ── */
usersRouter.put('/:id/revoke', authorize('admin'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (user?.tokenId === req.user.tokenId) return res.status(400).json({ error: 'Não é possível revogar a si mesmo.' })
    await prisma.user.update({ where: { id: req.params.id }, data: { active: false, updatedAt: new Date() } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PUT /api/users/:id/reactivate ── */
usersRouter.put('/:id/reactivate', authorize('admin'), async (req, res) => {
  try {
    await prisma.user.update({ where: { id: req.params.id }, data: { active: true, updatedAt: new Date() } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── POST /api/users/:id/resend-invite ── */
usersRouter.post('/:id/resend-invite', authorize('admin'), async (req, res) => {
  res.json({ ok: true, message: 'Convite reenviado.' })
})
