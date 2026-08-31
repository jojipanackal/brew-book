import { loadDotenvx } from '../dotenvx'

if (!process.env.DATABASE_URL) loadDotenvx()

import { db } from '../src/db'
import { company } from '../src/db/schema'
import { ensureTodayResponses, todayKey } from '../src/lib/poll-responses'
import { periods, type Period } from '../src/lib/drinks'

const completed = new Set<string>()

function periodsReady(): Period[] {
  return [...periods]
}

async function run() {
  const date = todayKey()
  const companies = await db.select({ id: company.id }).from(company)

  for (const period of periodsReady()) {
    const key = `${date}:${period}`
    if (completed.has(key)) continue

    await Promise.all(companies.map((item) => ensureTodayResponses(item.id, date, [period])))
    completed.add(key)
    console.log(`Ensured ${period} poll responses for ${date}`)
  }
}

console.log('Poll initializer started (Asia/Kolkata)')
void run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Poll scheduler error:', error)
    process.exit(1)
  })
