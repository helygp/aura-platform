/**
 * services/notify/src/index.js
 * Entry-point: inicia o worker e exporta a função notify.
 */

import { startWorker } from './queue/index.js'
import { notify }      from './notify.js'

// Inicia worker se rodando como processo principal
startWorker()

// Graceful shutdown
process.on('SIGTERM', () => { stopWorker(); process.exit(0) })
process.on('SIGINT',  () => { stopWorker(); process.exit(0) })

export { notify }
