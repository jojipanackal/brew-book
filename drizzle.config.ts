import { defineConfig } from 'drizzle-kit'
import { loadDotenvx } from './dotenvx'
import { getPostgresSslConfig } from './src/db/connection'

loadDotenvx()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for Drizzle Kit')
}

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
    ssl: getPostgresSslConfig(),
  },
})
