/**
 * routes/auth.js
 * Controller HTTP para autenticação.
 *
 * POST /auth/login            — {identifier, password} ou {email, password} legacy
 * POST /auth/refresh
 * POST /auth/logout
 * GET  /auth/me
 * POST /auth/forgot-password  — {identifier} → gera token + envia email (sempre 200)
 * POST /auth/reset-password   — {token, newPassword} → valida e atualiza
 */

import { Router }        from 'express'
import { z }             from 'zod'
import { randomBytes, createHash } from 'crypto'
import bcrypt            from 'bcryptjs'
import { loginService, refreshService, logoutService, AuthError } from '../auth/service.js'
import { setAuthCookies, clearAuthCookies } from '../lib/cookies.js'
import { authenticate }  from '../middleware/authenticate.js'
import { prismaMaster as prisma } from '../lib/prisma-master.js'
import { sendPasswordResetEmail } from '../lib/mailer.js'

export const authRouter = Router()

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000  // 1h

/* ─── Schemas ─── */
const loginSchema = z.object({
  identifier: z.string().min(1).max(255).optional(),
  email:      z.string().max(255).optional(),
  password:   z.string().min(1, 'Senha obrigatória.').max(128),
}).refine(d => d.identifier || d.email, {
  message: 'Login (ou e-mail) é obrigatório.',
  path: ['identifier'],
})

const forgotSchema = z.object({
  identifier: z.string().min(1).max(255),
})

const resetSchema = z.object({
  token:       z.string().length(64, 'Token inválido.'),
  newPassword: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.').max(128),
})

/* ─── POST /auth/login ─── */
authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error:  'Dados inválidos.',
      fields: parsed.error.flatten().fieldErrors,
    })
  }

  try {
    const { accessToken, refreshToken, user } = await loginService(parsed.data)
    setAuthCookies(res, { accessToken, refreshToken })

    return res.status(200).json({
      user,
      accessToken,
      message: 'Login realizado com sucesso.',
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message })
    }
    console.error('[auth/login]', err)
    return res.status(500).json({ error: 'Erro interno. Tente novamente.' })
  }
})

/* ─── POST /auth/refresh ─── */
authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.aura_refresh

  try {
    const { accessToken, refreshToken, user } = await refreshService(token)
    setAuthCookies(res, { accessToken, refreshToken })

    return res.status(200).json({ user })
  } catch (err) {
    clearAuthCookies(res)
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message })
    }
    console.error('[auth/refresh]', err)
    return res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ─── POST /auth/logout ─── */
authRouter.post('/logout', authenticate, async (req, res) => {
  try {
    await logoutService(req.auth.tokenId)
  } catch {}
  finally {
    clearAuthCookies(res)
    return res.status(200).json({ message: 'Logout realizado.' })
  }
})

/* ─── GET /auth/me ─── */
authRouter.get('/me', authenticate, async (req, res) => {
  return res.status(200).json({ auth: req.auth })
})

/* ─── POST /auth/forgot-password ───
 *
 * Resposta SEMPRE 200, mesmo se o usuário não existir (não revela enumeração).
 * Filtra pelo TENANT_SLUG do container — token só vale para o tenant atual.
 */
authRouter.post('/forgot-password', async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Login ou e-mail inválido.' })
  }

  const ident = parsed.data.identifier.toLowerCase().trim()
  const CONTAINER_TENANT = process.env.TENANT_SLUG ?? null

  try {
    const user = await prisma.user.findFirst({
      where: {
        AND: [
          { active: true },
          { OR: [ { login: ident }, { email: ident } ] },
          ...(CONTAINER_TENANT ? [{ tenant: { slug: CONTAINER_TENANT } }] : []),
        ],
      },
      include: { tenant: { select: { slug: true } } },
    })

    if (user) {
      // Gera token raw + salva HASH
      const rawToken  = randomBytes(32).toString('hex')                 // 64 chars
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)

      // Invalida tokens anteriores não usados (limpa lixo)
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
        data:  { usedAt: new Date() },  // marca como "usado" sem permitir reset
      })

      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      })

      // Envia o email com o RAW token (DB só guarda hash)
      const tenantSlug = user.tenant?.slug ?? CONTAINER_TENANT ?? 'app'
      const resetUrl = `https://${tenantSlug}.aurabr.app/reset-password?token=${rawToken}`
      try {
        await sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl,
          expiresInMinutes: 60,
        })
      } catch (mailErr) {
        console.error('[auth/forgot-password] mail error', mailErr.message)
        // Não revela ao cliente
      }
    }
  } catch (err) {
    console.error('[auth/forgot-password]', err.message)
    // Continua para retornar 200 (não vaza nada)
  }

  return res.status(200).json({
    message: 'Se houver uma conta com este login ou e-mail, enviaremos um link de redefinição.',
  })
})

/* ─── POST /auth/reset-password ─── */
authRouter.post('/reset-password', async (req, res) => {
  const parsed = resetSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error:  'Dados inválidos.',
      fields: parsed.error.flatten().fieldErrors,
    })
  }

  const { token, newPassword } = parsed.data
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const now = new Date()
  const CONTAINER_TENANT = process.env.TENANT_SLUG ?? null

  try {
    const rec = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { tenant: { select: { slug: true } } } } },
    })

    if (!rec) return res.status(400).json({ error: 'Link inválido ou já utilizado.' })
    if (rec.usedAt)           return res.status(400).json({ error: 'Este link já foi utilizado.' })
    if (rec.expiresAt < now)  return res.status(400).json({ error: 'Este link expirou. Solicite um novo.' })
    if (!rec.user || !rec.user.active) {
      return res.status(400).json({ error: 'Usuário inválido.' })
    }
    // Bloqueia token de outro tenant (mesmo que vaze)
    const userTenantSlug = rec.user.tenant?.slug ?? rec.user.tenantSlug
    if (CONTAINER_TENANT && userTenantSlug !== CONTAINER_TENANT) {
      return res.status(400).json({ error: 'Link inválido para este tenant.' })
    }

    // Atualiza senha + marca token como usado + invalida refresh sessions
    const hash = await bcrypt.hash(newPassword, 10)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: rec.userId },
        data:  { passwordHash: hash, refreshFamily: null, updatedAt: new Date() },
      }),
      prisma.passwordResetToken.update({
        where: { id: rec.id },
        data:  { usedAt: now },
      }),
    ])

    return res.status(200).json({ message: 'Senha redefinida com sucesso. Faça login com sua nova senha.' })
  } catch (err) {
    console.error('[auth/reset-password]', err.message)
    return res.status(500).json({ error: 'Erro interno. Tente novamente.' })
  }
})
