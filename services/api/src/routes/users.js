/**
 * routes/users.js
 *
 * GET  /api/users                  — usuários do tenant
 * POST /api/users/invite           — convida novo usuário
 * PUT  /api/users/me               — atualiza nome próprio
 * PUT  /api/users/me/password      — troca senha
 * PUT  /api/users/:id              — atualiza dados (admin)
 * PUT  /api/users/:id/role         — altera papel único (legacy, mantido)
 * PUT  /api/users/:id/roles        — altera array de papéis (novo)
 * PUT  /api/users/:id/revoke       — revoga acesso
 * PUT  /api/users/:id/reactivate
 * POST /api/users/:id/resend-invite
 *
 * Multi-role: aceita `roles[]` no body. Mantém `role` (single) sincronizado
 * com o de maior nível para compat com código legado.
 */

import { Router }   from 'express'
import bcrypt       from 'bcryptjs'
import { randomUUID } from 'crypto'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { prismaMaster as prisma } from '../lib/prisma-master.js'
import { sendNewUserCredentialsEmail } from '../lib/mailer.js'

export const usersRouter = Router()
usersRouter.use(authenticate)

/* ─── Helpers ─── */

const VALID_ROLES = ['admin', 'financeiro', 'estoque', 'operador']
const ROLE_LEVEL  = { admin: 4, financeiro: 3, estoque: 2, operador: 1 }

/* Normaliza array de roles → uppercase únicos, válidos */
function normalizeRoles(input) {
  if (!input) return []
  const arr = Array.isArray(input) ? input : [input]
  const seen = new Set()
  const out  = []
  for (const r of arr) {
    if (!r) continue
    const lower = String(r).toLowerCase().trim()
    if (!VALID_ROLES.includes(lower)) continue
    const upper = lower.toUpperCase()
    if (!seen.has(upper)) { seen.add(upper); out.push(upper) }
  }
  return out
}

/* Pega o role de maior nível para sincronizar com a coluna `role` single */
function pickPrimary(rolesUpper) {
  if (!rolesUpper?.length) return null
  return rolesUpper.reduce(
    (best, r) => (ROLE_LEVEL[r.toLowerCase()] ?? 0) > (ROLE_LEVEL[best.toLowerCase()] ?? 0) ? r : best,
    rolesUpper[0]
  )
}

/* Sanitiza e valida o login */
function sanitizeLogin(input) {
  if (!input) return null
  const s = String(input).toLowerCase().trim()
  if (!/^[a-z0-9_.-]{3,20}$/.test(s)) return { error: 'Login inválido: 3-20 caracteres, apenas letras, números, ponto, traço e sublinhado.' }
  return { value: s }
}

/* Sufixa o login se já houver no tenant (admin → admin2 → admin3...) */
async function uniqueLogin(tenantId, base) {
  let candidate = base
  let i = 2
  while (await prisma.user.findFirst({ where: { tenantId, login: candidate }, select: { id: true } })) {
    candidate = `${base}${i++}`
    if (i > 99) throw new Error('Não foi possível gerar login único.')
  }
  return candidate
}

/* ─── GET /api/users ─── */
usersRouter.get('/', authorize('admin'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where:   { tenantId: req.user.tenantId },
      select:  {
        id:true, tokenId:true, login:true, email:true, name:true,
        role:true, roles:true, active:true,
        createdAt:true, lastLoginAt:true, whatsapp:true, customerIds:true,
      },
      orderBy: { createdAt: 'asc' },
    })
    res.json({
      users: users.map(u => {
        const dbRoles = Array.isArray(u.roles) && u.roles.length
          ? u.roles.map(r => r.toLowerCase())
          : (u.role ? [u.role.toLowerCase()] : [])
        return {
          id:        u.id,
          name:      u.name,
          login:     u.login,
          email:     u.email,
          role:      u.role?.toLowerCase() ?? null,  // legacy
          roles:     dbRoles,                        // novo
          status:    u.active ? 'ativo' : 'revogado',
          createdAt: u.createdAt,
          lastLogin: u.lastLoginAt,
          isSelf:    u.tokenId === req.user.tokenId,
          whatsapp:  u.whatsapp ?? null,
          customerIds: u.customerIds ?? [],
        }
      }),
    })
  } catch (err) {
    console.error('[users/list]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─── POST /api/users/invite ─── */
usersRouter.post('/invite', authorize('admin'), async (req, res) => {
  try {
    const { name, email, login, role, roles, password, whatsapp, customerIds = [] } = req.body

    if (!name?.trim())  return res.status(400).json({ error: 'Nome é obrigatório.' })
    if (!email?.trim()) return res.status(400).json({ error: 'E-mail é obrigatório.' })

    // Aceita roles[] (novo) ou role (legacy)
    const rolesUpper = normalizeRoles(roles?.length ? roles : (role ? [role] : []))
    if (!rolesUpper.length) return res.status(400).json({ error: 'Selecione ao menos um perfil.' })

    const tenant = await prisma.tenant.findUnique({ where: { slug: req.user.tenantSlug } })
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' })

    // Login: usa o enviado, ou deriva de email
    let loginFinal
    if (login !== undefined && login !== null && login !== '') {
      const r = sanitizeLogin(login)
      if (r.error) return res.status(400).json({ error: r.error })
      loginFinal = await uniqueLogin(tenant.id, r.value)
    } else {
      const base = String(email).toLowerCase().split('@')[0]
        .replace(/[^a-z0-9_.-]/g, '').slice(0, 20) || 'user'
      loginFinal = await uniqueLogin(tenant.id, base)
    }

    // Usa senha fornecida ou gera temporária
    const finalPass = password?.trim() || `Aura@${randomUUID().slice(0,8)}`
    const hash      = await bcrypt.hash(finalPass, 10)

    const user = await prisma.user.create({
      data: {
        tenantId:     tenant.id,
        login:        loginFinal,
        email:        email.toLowerCase().trim(),
        name:         name.trim(),
        passwordHash: hash,
        mustChangePassword: !password,
        role:         pickPrimary(rolesUpper),  // legacy: maior nível
        roles:        rolesUpper,
        active:       true,
        whatsapp:     whatsapp?.trim() || null,
        customerIds:  Array.isArray(customerIds) ? customerIds : [],
      },
    })

    // Envia credenciais por e-mail quando a senha foi gerada automaticamente
    if (!password) {
      const erpUrl = `https://${tenant.slug}.aurabr.app`
      sendNewUserCredentialsEmail({
        to: user.email, name: user.name, login: user.login,
        tempPassword: finalPass, erpUrl,
      }).catch(e => console.error('[users/invite] mail error', e.message))
    }

    res.status(201).json({
      ok: true,
      id: user.id,
      login: user.login,
      message: password
        ? `Usuário ${name} criado com sucesso.`
        : `Usuário criado. Senha temporária: ${finalPass}`,
      tempPassword: password ? null : finalPass,
    })
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'E-mail ou login já cadastrado neste tenant.' })
    console.error('[users/invite]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─── PUT /api/users/me ─── */
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

/* ─── PUT /api/users/me/password ─── */
usersRouter.put('/me/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const user = await prisma.user.findUnique({ where: { tokenId: req.user.tokenId } })
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' })

    const ok = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta.' })

    const hash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash, mustChangePassword: false, updatedAt: new Date() } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─── PUT /api/users/:id/role ─── (legacy single role) */
usersRouter.put('/:id/role', authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body
    const rolesUpper = normalizeRoles([role])
    if (!rolesUpper.length) return res.status(400).json({ error: 'Papel inválido.' })
    await prisma.user.update({
      where: { id: req.params.id },
      data:  { role: rolesUpper[0], roles: rolesUpper, updatedAt: new Date() },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─── PUT /api/users/:id/roles ─── (novo: array) */
usersRouter.put('/:id/roles', authorize('admin'), async (req, res) => {
  try {
    const { roles } = req.body
    const rolesUpper = normalizeRoles(roles)
    if (!rolesUpper.length) return res.status(400).json({ error: 'Selecione ao menos um perfil.' })
    await prisma.user.update({
      where: { id: req.params.id },
      data:  { role: pickPrimary(rolesUpper), roles: rolesUpper, updatedAt: new Date() },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─── PUT /api/users/:id/revoke ─── */
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

/* ─── PUT /api/users/:id/reactivate ─── */
usersRouter.put('/:id/reactivate', authorize('admin'), async (req, res) => {
  try {
    await prisma.user.update({ where: { id: req.params.id }, data: { active: true, updatedAt: new Date() } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─── PUT /api/users/:id — atualiza dados (admin) ─── */
usersRouter.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, email, login, whatsapp, customerIds, password, role, roles } = req.body
    const data = {}

    if (name !== undefined)        data.name        = name.trim()
    if (email !== undefined)       data.email       = email.toLowerCase().trim()
    if (whatsapp !== undefined)    data.whatsapp    = whatsapp?.trim() || null
    if (customerIds !== undefined) data.customerIds = Array.isArray(customerIds) ? customerIds : []
    if (password?.trim())          data.passwordHash = await bcrypt.hash(password.trim(), 10)

    /* roles: aceita array (novo) ou single (legacy) */
    if (roles !== undefined || role !== undefined) {
      const rolesUpper = normalizeRoles(roles?.length ? roles : (role ? [role] : []))
      if (!rolesUpper.length) return res.status(400).json({ error: 'Selecione ao menos um perfil.' })
      data.roles = rolesUpper
      data.role  = pickPrimary(rolesUpper)
    }

    /* login: se enviado, valida e checa unicidade no tenant */
    if (login !== undefined && login !== null && login !== '') {
      const r = sanitizeLogin(login)
      if (r.error) return res.status(400).json({ error: r.error })
      // Permite manter o mesmo login (sem mudar)
      const current = await prisma.user.findUnique({ where: { id: req.params.id }, select: { tenantId: true, login: true } })
      if (!current) return res.status(404).json({ error: 'Usuário não encontrado.' })
      if (current.login !== r.value) {
        const dup = await prisma.user.findFirst({ where: { tenantId: current.tenantId, login: r.value, NOT: { id: req.params.id } }, select: { id: true } })
        if (dup) return res.status(409).json({ error: 'Login já em uso neste tenant.' })
        data.login = r.value
      }
    }

    data.updatedAt = new Date()
    await prisma.user.update({ where: { id: req.params.id }, data })
    res.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Login ou e-mail já cadastrado.' })
    console.error('[users/update]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─── POST /api/users/:id/resend-invite ─── (stub) */
usersRouter.post('/:id/resend-invite', authorize('admin'), async (req, res) => {
  res.json({ ok: true, message: 'Convite reenviado.' })
})
