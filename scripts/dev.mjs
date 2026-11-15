import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const bridgeUrl = 'http://127.0.0.1:3001/api/solar'
let bridge
let stopping = false

async function bridgeIsRunning() {
  try {
    const response = await fetch(bridgeUrl, { signal: AbortSignal.timeout(1500) })
    const data = await response.json()
    return response.ok && Array.isArray(data.samples) && typeof data.status === 'string'
  } catch {
    return false
  }
}

function shutdown() {
  if (stopping) return
  stopping = true
  bridge?.kill()
  vite.kill()
}

const vite = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '0.0.0.0'], {
  cwd: root,
  stdio: 'inherit',
})
vite.on('error', (error) => {
  console.error(`Não foi possível iniciar o Vite: ${error.message}`)
  shutdown()
  process.exitCode = 1
})
vite.on('exit', (code) => {
  shutdown()
  process.exitCode = code || 0
})

if (await bridgeIsRunning()) {
  console.log(`Ponte AUXSOL já ativa em ${bridgeUrl}`)
} else {
  console.log('Iniciando ponte AUXSOL BLE junto com o dashboard...')
  bridge = spawn(process.env.AUXSOL_PYTHON || 'python', [join(root, 'bridge', 'auxsol_live.py'), '--allow-gatt-write'], {
    cwd: root,
    stdio: 'inherit',
  })
  bridge.on('error', (error) => console.error(`Não foi possível iniciar a ponte BLE: ${error.message}`))
  bridge.on('exit', (code) => {
    if (!stopping) console.error(`A ponte BLE terminou (código ${code}). O dashboard continua disponível sem atualização ao vivo.`)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
