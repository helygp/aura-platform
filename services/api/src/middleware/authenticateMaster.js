/**
 * middleware/authenticateMaster.js
 *
 * Valida o MASTER_SECRET header para rotas /master/*.
 * Nunca exposto via frontend público — acesso exclusivo ao operador da plataforma.
 *
 * Header esperado:
 *   x-master-secret: <MASTER_SECRET>
 *
 * Uso:
 *   router.get('/tenants', authenticateMaster, handler)
 */

const MASTER_SECRET = process.env.MASTER_SECRET

export function authenticateMaster(req, res, next) {
  if (!MASTER_SECRET) {
    console.error('[master] MASTER_SECRET não definido no ambiente.')
    return res.status(503).json({ error: 'Serviço indisponível.' })
  }

  const secret = req.headers['x-master-secret']

  if (!secret || secret !== MASTER_SECRET) {
    // Log de tentativa suspeita
    console.warn(
      '[master] Tentativa de acesso não autorizado.',
      { ip: req.ip, path: req.path, at: new Date().toISOString() }
    )
    return res.status(401).json({ error: 'Não autorizado.' })
  }

  next()
}
