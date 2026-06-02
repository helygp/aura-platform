/**
 * scripts/gen-basic-auth.js
 * Gera o hash SHA1 para basic auth do Traefik.
 *
 * Uso:
 *   MASTER_SECRET=<senha> node scripts/gen-basic-auth.js
 *   MASTER_SECRET=<senha> BASIC_AUTH_USER=hely node scripts/gen-basic-auth.js
 *
 * Saída: user:{SHA}hash  (formato aceito pelo Traefik basicAuth middleware)
 */

import crypto from 'crypto'

const user   = process.env.BASIC_AUTH_USER  ?? 'hely'
const pass   = process.env.MASTER_SECRET
if (!pass) { console.error('MASTER_SECRET não definido.'); process.exit(1) }

const hash   = crypto.createHash('sha1').update(pass).digest('base64')
const result = `${user}:{SHA}${hash}`

console.log(result)
console.log('')
console.log('// Adicione em .credentials/acme.env:')
console.log(`// MASTER_BASIC_AUTH=${result}`)
