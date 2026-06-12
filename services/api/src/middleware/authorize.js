/**
 * middleware/authorize.js
 * RBAC baseado em papel(éis) do usuário.
 *
 * Papéis disponíveis (do mais ao menos privilegiado):
 *   admin       — acesso total (sempre passa)
 *   financeiro  — financeiro + operacional
 *   estoque     — gestão de produtos e estoque
 *   operador    — operações do dia a dia (pedidos, clientes)
 *
 * Multi-role: um usuário pode ter múltiplos papéis (req.auth.roles[]).
 * - Se QUALQUER role do usuário estiver na lista permitida, passa.
 * - admin sempre passa, independente da lista.
 * - Fallback para req.auth.role (single) se roles[] estiver ausente (legacy tokens).
 *
 * Uso:
 *   router.delete('/product/:slug', authenticate, authorize('admin'), handler)
 *   router.get('/orders',           authenticate, authorize('operador', 'admin'), handler)
 *   router.post('/inventory',       authenticate, authorize(['estoque', 'admin']), handler)
 *
 * authorize() sem argumentos = qualquer usuário autenticado.
 */

export const ROLES = {
  admin:      4,
  financeiro: 3,
  estoque:    2,
  operador:   1,
}

/* Extrai array de papéis do req, em lowercase. Fallback para role single. */
function getUserRoles(req) {
  const auth = req.auth || {}
  if (Array.isArray(auth.roles) && auth.roles.length > 0) {
    return auth.roles.map(r => String(r).toLowerCase())
  }
  if (auth.role) return [String(auth.role).toLowerCase()]
  return []
}

/**
 * @param {...string|string[]} allowed  Papéis permitidos (string ou array).
 *                                      Se omitido, permite qualquer papel autenticado.
 */
export function authorize(...allowed) {
  const roles = allowed.flat().filter(Boolean).map(r => r.toLowerCase())

  return function (req, res, next) {
    if (!req.auth) {
      return res.status(401).json({ error: 'Não autenticado.' })
    }

    if (roles.length === 0) return next()

    const userRoles = getUserRoles(req)
    if (userRoles.length === 0) {
      return res.status(403).json({ error: 'Permissão insuficiente.', code: 'FORBIDDEN' })
    }

    // Admin sempre passa
    if (userRoles.includes('admin')) return next()

    // Intersecção: alguma role do usuário precisa estar na lista
    const passes = userRoles.some(r => roles.includes(r))
    if (!passes) {
      return res.status(403).json({ error: 'Permissão insuficiente.', code: 'FORBIDDEN' })
    }

    next()
  }
}

/**
 * Atalho: authorize a partir de um nível mínimo de hierarquia.
 * Considera o MAIOR nível entre os roles do usuário.
 *
 * authorize.atLeast('financeiro') → permite financeiro, estoque (não!), admin
 * → só passa se userMaxLevel >= minLevel
 */
authorize.atLeast = function (minRole) {
  const minLevel = ROLES[minRole.toLowerCase()]
  if (!minLevel) throw new Error(`Papel desconhecido: ${minRole}`)

  return function (req, res, next) {
    if (!req.auth) {
      return res.status(401).json({ error: 'Não autenticado.' })
    }

    const userRoles = getUserRoles(req)
    const userMaxLevel = userRoles.reduce(
      (max, r) => Math.max(max, ROLES[r] ?? 0),
      0
    )

    if (userMaxLevel < minLevel) {
      return res.status(403).json({ error: 'Permissão insuficiente.', code: 'FORBIDDEN' })
    }

    next()
  }
}

/* Expor helper para outros módulos */
authorize.getUserRoles = getUserRoles
