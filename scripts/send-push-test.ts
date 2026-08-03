import { loadDotenvx } from '../dotenvx'
if (!process.env.VAPID_PUBLIC_KEY) loadDotenvx()

import { Pool } from 'pg'
import { getPostgresConnectionConfig } from '../src/db/connection'

// Ensure column exists before looping
const pool = new Pool(getPostgresConnectionConfig())
const client = await pool.connect()
await client.query('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "push_subscription" text')
console.log('✅ push_subscription column ready')
client.release()
await pool.end()

// Now loop every 3 minutes
const { default: { execSync } } = await import('node:child_process')

const INTERVAL_MS = 3 * 60 * 1000

async function send(period: 'morning' | 'evening') {
  console.log(`\n[${new Date().toLocaleTimeString()}] Sending ${period} push...`)
  try {
    execSync(`tsx scripts/send-push.ts ${period}`, { stdio: 'inherit' })
  } catch {
    // error already printed by send-push
  }
}

// Send immediately on start
await send('morning')

console.log(`\nWill send again every 3 minutes. Press Ctrl+C to stop.`)

setInterval(() => { void send('morning') }, INTERVAL_MS)
