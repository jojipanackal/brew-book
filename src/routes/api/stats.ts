import { and, eq, gte, ne } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { db } from '#/db'
import { drinkResponse, user } from '#/db/schema'
import { drinks, type Drink } from '#/lib/drinks'
import { getRequestUser } from '#/lib/request-user'

const indiaDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })
const todayKey = () => indiaDateFormatter.format(new Date())

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

function dateOffset(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return indiaDateFormatter.format(d)
}

async function getCurrentUserId(request: Request) {
  const currentUser = await getRequestUser(request)
  return currentUser?.id ?? null
}

export type StatsResponse = {
  days: number
  totalDays: number
  byDrink: Record<string, number>
  byPeriod: { morning: Record<string, number>; evening: Record<string, number> }
  sugarRate: number
  nodrinkRate: number
  streak: number
  mostCommon: string | null
  dailyLog: Array<{ date: string; morning: string; evening: string }>
}

export const Route = createFileRoute('/api/stats')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await getCurrentUserId(request)
        if (!userId) return json({ error: 'Unauthorized' }, { status: 401 })

        const daysParam = new URL(request.url).searchParams.get('days')
        const days = Math.min(90, Math.max(7, Number(daysParam) || 30))
        const from = dateOffset(days - 1)

        const rows = await db
          .select({
            date: drinkResponse.date,
            period: drinkResponse.period,
            drink: drinkResponse.drink,
            sugar: drinkResponse.sugar,
          })
          .from(drinkResponse)
          .innerJoin(user, eq(user.id, drinkResponse.userId))
          .where(
            and(
              eq(drinkResponse.userId, userId),
              gte(drinkResponse.date, from),
              ne(user.isOnLeave, true),
            ),
          )
          .orderBy(drinkResponse.date)

        // byDrink count
        const byDrink: Record<string, number> = {}
        const byPeriod: { morning: Record<string, number>; evening: Record<string, number> } = { morning: {}, evening: {} }
        let sugarCount = 0, drinkCount = 0

        const dateMap = new Map<string, { morning: string; evening: string }>()

        for (const row of rows) {
          byDrink[row.drink] = (byDrink[row.drink] ?? 0) + 1
          byPeriod[row.period][row.drink] = (byPeriod[row.period][row.drink] ?? 0) + 1
          if (row.drink !== 'No drink') {
            drinkCount++
            if (row.sugar) sugarCount++
          }
          const entry = dateMap.get(row.date) ?? { morning: 'No drink', evening: 'No drink' }
          entry[row.period] = row.drink
          dateMap.set(row.date, entry)
        }

        // streak: consecutive days with at least one non-"No drink" response up to today
        let streak = 0
        const today = todayKey()
        for (let i = 0; i <= days; i++) {
          const d = dateOffset(i)
          if (d > today) continue
          const entry = dateMap.get(d)
          const hasDrink = entry && (entry.morning !== 'No drink' || entry.evening !== 'No drink')
          if (hasDrink) streak++
          else if (d !== today) break
        }

        const mostCommon = drinks
          .filter((d) => d !== 'No drink')
          .sort((a, b) => (byDrink[b] ?? 0) - (byDrink[a] ?? 0))[0] ?? null

        const dailyLog = Array.from(dateMap.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .slice(0, 30)
          .map(([date, entry]) => ({ date, ...entry }))

        const response: StatsResponse = {
          days,
          totalDays: dateMap.size,
          byDrink,
          byPeriod,
          sugarRate: drinkCount > 0 ? Math.round((sugarCount / drinkCount) * 100) : 0,
          nodrinkRate: rows.length > 0 ? Math.round(((byDrink['No drink'] ?? 0) / rows.length) * 100) : 0,
          streak,
          mostCommon: (mostCommon as Drink | null),
          dailyLog,
        }
        return json(response)
      },
    },
  },
})
