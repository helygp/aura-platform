/**
 * routes/customers.js
 *
 * GET    /api/customers
 * POST   /api/customers
 * PUT    /api/customers/:id
 * DELETE /api/customers/:id
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query }        from '../lib/tenantDb.js'

export const customersRouter = Router()
customersRouter.use(authenticate)

/* ── GET /api/customers ── */
customersRouter.get('/', async (req, res) => {
  try {
    const { search='', status='' } = req.query
    const params = []
    const where  = []

    if (search) {
      params.push(`%${search.replace(/\D/g,'')}%`, `%${search}%`)
      where.push(`(regexp_replace(c.document,'\\D','','g') ILIKE $${params.length-1} OR c.name ILIKE $${params.length} OR regexp_replace(c.whatsapp,'\\D','','g') ILIKE $${params.length-1})`)
    }
    if (status) { params.push(status); where.push(`c.status=$${params.length}`) }

    const wClause = where.length ? 'WHERE ' + where.join(' AND ') : ''

    const { rows } = await query(`
      SELECT c.*,
        (SELECT json_agg(json_build_object(
            'id',o.id,'total',o.total,'status',o.status,'createdAt',o.created_at
          ) ORDER BY o.created_at DESC)
         FROM orders o WHERE o.customer_id = c.id
        ) AS orders
      FROM customers c
      ${wClause}
      ORDER BY c.created_at DESC
    `, params)

    res.json({ customers: rows.map(normalizeCust) })
  } catch (err) {
    console.error('[customers/list]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── POST /api/customers ── */
customersRouter.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, personType='pj', document, whatsapp, email, status='ativo', creditLimit=0, address={} } = req.body
    const { rows:[c] } = await query(`
      INSERT INTO customers (name, person_type, document, whatsapp, email, status, credit_limit, address)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *
    `, [name, personType, document, whatsapp, email, status, parseFloat(creditLimit)||0, JSON.stringify(address)])
    res.status(201).json(normalizeCust(c))
  } catch (err) {
    console.error('[customers/create]', err.message)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── PUT /api/customers/:id ── */
customersRouter.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, personType, document, whatsapp, email, status, creditLimit, address={} } = req.body
    const { rows:[c] } = await query(`
      UPDATE customers SET
        name=$1, person_type=$2, document=$3, whatsapp=$4, email=$5,
        status=$6, credit_limit=$7, address=$8::jsonb, updated_at=now()
      WHERE id=$9 RETURNING *
    `, [name, personType, document, whatsapp, email, status, parseFloat(creditLimit)||0, JSON.stringify(address), req.params.id])
    if (!c) return res.status(404).json({ error: 'Cliente não encontrado.' })
    res.json(normalizeCust(c))
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' })
  }
})

/* ── DELETE /api/customers/:id ── */
customersRouter.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await query('DELETE FROM customers WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' })
  }
})

function normalizeCust(c) {
  return {
    id:          c.id,
    name:        c.name,
    personType:  c.person_type,
    document:    c.document,
    whatsapp:    c.whatsapp,
    email:       c.email,
    status:      c.status,
    creditLimit: parseFloat(c.credit_limit ?? 0),
    address:     c.address ?? {},
    orders:      c.orders  ?? [],
    createdAt:   c.created_at,
  }
}

/* ── POST /api/customers/:id/send-portal-access ────────────────────────────────
 * Gera acesso ao portal para um cliente pré-cadastrado no ERP.
 * Cria senha padrão, ativa portal_active e envia email.
 */
customersRouter.post('/:id/send-portal-access', authorize('admin', 'operador'), async (req, res) => {
  try {
    const { rows: [customer] } = await query(
      'SELECT id, name, email FROM customers WHERE id = $1',
      [req.params.id]
    )
    if (!customer) return res.status(404).json({ error: 'Cliente não encontrado.' })
    if (!customer.email) return res.status(422).json({ error: 'Cliente sem e-mail cadastrado.' })

    const bcrypt  = (await import('bcryptjs')).default
    const { prisma } = await import('../lib/prisma.js')

    // Gera senha temporária legível
    const chars    = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
    const tempPass = Array.from(crypto.getRandomValues(new Uint8Array(10)))
      .map(b => chars[b % chars.length]).join('')

    const hash    = await bcrypt.hash(tempPass, 12)
    const tokenId = `cst_${Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString('hex')}`

    await query(
      'UPDATE customers SET password_hash=$1, token_id=$2, portal_active=true, updated_at=NOW() WHERE id=$3',
      [hash, tokenId, customer.id]
    )

    // Busca dados do tenant para montar a URL da loja
    const tenant = await prisma.tenant.findUnique({
      where:  { slug: req.tenantSlug },
      select: { name: true, slug: true },
    })

    const storeUrl  = `https://loja.${req.tenantSlug}.aurabr.app`
    const { sendEmail } = await import('../../../notify/src/email.js').catch(() => ({ sendEmail: null }))

    if (sendEmail) {
      await sendEmail({
        to:      customer.email,
        subject: `Seu acesso ao portal ${tenant?.name ?? ''}`,
        html:    `
          <p>Olá, <strong>${customer.name}</strong>!</p>
          <p>Seu acesso ao portal foi criado.</p>
          <p><strong>E-mail:</strong> ${customer.email}<br/>
          <strong>Senha:</strong> ${tempPass}</p>
          <p>Acesse: <a href="${storeUrl}">${storeUrl}</a></p>
          <p><em>Recomendamos trocar sua senha após o primeiro acesso.</em></p>
        `,
      })
    }

    res.json({
      ok:        true,
      email:     customer.email,
      tempPass:  sendEmail ? undefined : tempPass, // só retorna se email não enviado
      storeUrl,
    })
  } catch (err) {
    console.error('[customers/send-portal-access]', err.message)
    res.status(500).json({ error: 'Erro ao criar acesso.' })
  }
})
