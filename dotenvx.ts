import { config } from '@dotenvx/dotenvx'
import path from 'node:path'

const rootDir = process.cwd()

export function loadDotenvx() {
  const isProduction = process.env.NODE_ENV === 'production'
  const privateKeyName = isProduction
    ? 'DOTENV_PRIVATE_KEY_PRODUCTION'
    : 'DOTENV_PRIVATE_KEY_LOCAL'
  const hasPrivateKey = Boolean(
    process.env[privateKeyName] || process.env.DOTENV_PRIVATE_KEY,
  )
  const paths = isProduction
    ? ['.env.production']
    : [hasPrivateKey ? '.env.local' : '.env.example']

  config({
    path: paths.map((envPath) => path.join(rootDir, envPath)),
    ignore: ['MISSING_ENV_FILE'],
  })
}
