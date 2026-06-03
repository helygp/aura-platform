/**
 * routes/auth.js
 * Controller HTTP para autenticação.
 * Recebe, valida, delega ao service, seta cookies.
 *
 * POST /auth/login
 * POST /auth/refresh
 * POST /auth/logout
 * GET  /auth/me      (rota protegida de exemplo)
 */

import { Router }        from 'express'
import { z }             from 'zod'
import { loginService, refreshService, logoutService, AuthError } from '../auth/service.js'
import { setAuthCookies, clearAuthCookies } from '../lib/cookies.js'
import { authenticate }  from '../middleware/authenticate.js'

export const authRouter = Router()

/* ─── Schemas de validação ─── */
const loginSchema = z.object({
  email:    z.string().email('E-mail inválido.').max(255),
  password: z.string().min(1, 'Senha obrigatória.').max(128),
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
      accessToken, // também no body para Bearer header via proxy
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
  } catch {
    // silencioso — logout nunca deve falhar para o usuário
  } finally {
    clearAuthCookies(res)
    return res.status(200).json({ message: 'Logout realizado.' })
  }
})

/* ─── GET /auth/me ─── */
authRouter.get('/me', authenticate, async (req, res) => {
  // req.auth tem tokenId, tenantSlug, role — já sem IDs internos
  return res.status(200).json({ auth: req.auth })
})
