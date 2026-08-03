import { APIError, betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { drizzleAdapter } from '@better-auth/drizzle-adapter'

import { db } from '#/db'
import * as schema from '#/db/schema'

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
const trustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean)

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  onAPIError: {
    errorURL: process.env.BETTER_AUTH_URL ? `${process.env.BETTER_AUTH_URL}/` : '/',
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          const email = newUser.email.trim().toLowerCase()
          const companies = await db.select({ emailEnding1: schema.company.emailEnding1, emailEnding2: schema.company.emailEnding2 }).from(schema.company)
          const isCompanyEmail = companies.some((item) => [item.emailEnding1, item.emailEnding2].some((ending) => ending && email.endsWith(ending.trim().toLowerCase())))
          if (!isCompanyEmail) {
            throw new APIError('FORBIDDEN', { message: 'Your work email is not registered with BrewBook.' })
          }
        },
      },
    },
  },
  socialProviders: googleClientId && googleClientSecret ? { google: { clientId: googleClientId, clientSecret: googleClientSecret, prompt: 'select_account' } } : undefined,
  plugins: [tanstackStartCookies()],
})
