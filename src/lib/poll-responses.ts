import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '../db'
import { attendance, drinkDefault, drinkResponse, user } from '../db/schema'
import { periods, type Period } from './drinks'
import { getPollClock, pollCutoffs } from './poll-clock'
import { publishPollChange } from './poll-events'

export const todayKey = () => getPollClock().date
const allPeriods: Period[] = [...periods]

/** Both daily polls open at midnight and may need a missing response backfilled. */
export function openPeriodsForToday(): Period[] {
  return allPeriods
}

export function currentlyOpenPeriods(now = new Date()): Period[] {
  const { minutes } = getPollClock(now)
  return allPeriods.filter((period) =>
    minutes < pollCutoffs[period],
  )
}

export async function ensureTodayResponses(companyId: string, date: string, periodsToEnsure: Period[] = allPeriods) {
  const now = new Date()
  if (date !== getPollClock(now).date || periodsToEnsure.length === 0) return
  // Keep one clock snapshot across asynchronous queries, especially at midnight.
  const openPeriods = currentlyOpenPeriods(now)

  const members = await db.select({ id: user.id, isGuest: user.isGuest }).from(user).where(eq(user.companyId, companyId))
  if (!members.length) return
  const attendanceRows = await db.select({ userId: attendance.userId, period: attendance.period, status: attendance.status }).from(attendance).where(and(eq(attendance.date, date), inArray(attendance.userId, members.map((member) => member.id))))
  const unavailable = new Set(attendanceRows.filter((row) => row.status !== 'office').map((row) => `${row.userId}:${row.period}`))
  const eligibleMembers = members.filter((member) => !member.isGuest)
  if (!eligibleMembers.length) return

  const memberIds = eligibleMembers.map((member) => member.id)
  const defaultRows = await db.select({ userId: drinkDefault.userId, period: drinkDefault.period, drink: drinkDefault.drink, sugar: drinkDefault.sugar }).from(drinkDefault).where(inArray(drinkDefault.userId, memberIds))
  const defaultsByUser = new Map<string, Partial<Record<Period, { drink: typeof defaultRows[number]['drink']; sugar: boolean }>>>()
  for (const row of defaultRows) {
    const defaults = defaultsByUser.get(row.userId) ?? {}
    defaults[row.period] = { drink: row.drink, sugar: row.sugar }
    defaultsByUser.set(row.userId, defaults)
  }

  const values = eligibleMembers.flatMap((member) => periodsToEnsure.filter((period) => !unavailable.has(`${member.id}:${period}`)).map((period) => {
    const preference = defaultsByUser.get(member.id)?.[period]
    return {
      id: crypto.randomUUID(),
      userId: member.id,
      date,
      period,
      drink: preference?.drink ?? 'No drink' as const,
      sugar: preference?.sugar ?? true,
      source: 'default' as const,
    }
  }))
  if (!values.length) return
  const insert = db.insert(drinkResponse).values(values)
  let changed: Array<{ id: string }>
  if (openPeriods.length === 0) {
    changed = await insert.onConflictDoNothing({ target: [drinkResponse.userId, drinkResponse.date, drinkResponse.period] }).returning({ id: drinkResponse.id })
  } else {
    changed = await insert.onConflictDoUpdate({
      target: [drinkResponse.userId, drinkResponse.date, drinkResponse.period],
      set: { drink: sql`excluded.drink`, sugar: sql`excluded.sugar`, updatedAt: sql`now()` },
      where: and(eq(drinkResponse.source, 'default'), inArray(drinkResponse.period, openPeriods), sql`(${drinkResponse.drink} IS DISTINCT FROM excluded.drink OR ${drinkResponse.sugar} IS DISTINCT FROM excluded.sugar)`),
    }).returning({ id: drinkResponse.id })
  }
  if (changed.length) publishPollChange(companyId, date)
}
