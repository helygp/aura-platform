/**
 * middleware/authorize.js
 * RBAC baseado em papel do usuário.
 *
 * Papéis disponíveis (do mais ao menos privilegiado):
 *   admin       — acesso total
 *   financeiro  — financeiro + operacional
 *   estoque     — gestão de produtos e estoque
 *   operador    — operações do dia a dia (pedidos, clientes)
 *
 * Uso:
 *   router.delete('/product/:slug', authenticate, authorize('admin'), handler)
 *   router.get('/orders',           authenticate, authorize('operador', 'admin'), handler)
 *   router.post('/inventory',       authenticate, authorize(['estoque', 'admin']), handler)
 *
 * authorize() sem argumentos = qualquer usuário autenticado (só verifica req.auth)
 */

export const ROLES = {
  admin:      4,
  financeiro: 3,
  estoque:    2,
  operador:   1,
}

/**
 * @param {...string|string[]} allowed  Papéis permitidos (string ou array).
 *                                      Se omitido, permite qualquer papel autenticado.
 */
export function authorize(...allowed) {
  // Normaliza: authorize('admin', 'financeiro') ou authorize(['admin'])
  const roles = allowed.flat().filter(Boolean)

  return function (req, res, next) {
    if (!req.auth) {
      return res.status(401).json({ error: 'Não autenticado.' })
    }

    // Sem restrição de papel — apenas autenticação
    if (roles.length === 0) return next()

    const userRole = (req.auth.role ?? '').toLowerCase();
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        error: 'Permissão insuficiente.',
        code:  'FORBIDDEN',
      })
    }

    next()
  }
}

/**
 * Atalho: authorize a partir de um nível mínimo de hierarquia.
 * authorize.atLeast('financeiro') → permite financeiro e admin
 *
 * @param {string} minRole
 */
authorize.atLeast = function (minRole) {
  const minLevel = ROLES[minRole]
  if (!minLevel) throw new Error(`Papel desconhecido: ${minRole}`)

  return function (req, res, next) {
    if (!req.auth) {
      return res.status(401).json({ error: 'Não autenticado.' })
    }

    const userLevel = ROLES[(req.auth.role ?? "").toLowerCase()] ?? 0
    if (userLevel < minLevel) {
      return res.status(403).json({
        error: 'Permissão insuficiente.',
        code:  'FORBIDDEN',
      })
    }

    next()
  }
}
