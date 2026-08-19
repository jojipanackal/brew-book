import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '../db'
import { attendance, drinkDefault, drinkResponse, user } from '../db/schema'
import { periods, type Period } from './drinks'

const indiaDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })
const indiaTimeFormatter = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })

export const todayKey = () => indiaDateFormatter.format(new Date())
const allPeriods: Period[] = [...periods]

function minutesInIndia() {
  const [hours, minutes] = indiaTimeFormatter.format(new Date()).split(':').map(Number)
  return hours * 60 + minutes
}

/** Periods whose opening time has passed and may need a missing response backfilled. */
export function openPeriodsForToday(): Period[] {
  const minutes = minutesInIndia()
  if (minutes >= 14 * 60 + 30) return allPeriods
  if (minutes >= 10 * 60 + 30) return ['morning']
  return []
}

export function currentlyOpenPeriods(): Period[] {
  const minutes = minutesInIndia()
  // Prepare one minute before opening so the poll is ready at its start time.
  if (minutes >= 10 * 60 + 29 && minutes < 11 * 60) return ['morning']
  if (minutes >= 14 * 60 + 29 && minutes < 15 * 60 + 15) return ['evening']
  return []
}

export async function ensureTodayResponses(companyId: string, date: string, periodsToEnsure: Period[] = allPeriods) {
  if (date !== todayKey() || periodsToEnsure.length === 0) return

  const members = await db.select({ id: user.id, isGuest: user.isGuest }).from(user).where(eq(user.companyId, companyId))
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

  const insert = db.insert(drinkResponse).values(eligibleMembers.flatMap((member) => periodsToEnsure.filter((period) => !unavailable.has(`${member.id}:${period}`)).map((period) => {
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
  })))
  const openPeriods = currentlyOpenPeriods()
  if (openPeriods.length === 0) {
    await insert.onConflictDoNothing({ target: [drinkResponse.userId, drinkResponse.date, drinkResponse.period] })
  } else {
    await insert.onConflictDoUpdate({
      target: [drinkResponse.userId, drinkResponse.date, drinkResponse.period],
      set: { drink: sql`excluded.drink`, sugar: sql`excluded.sugar`, updatedAt: sql`now()` },
      where: and(eq(drinkResponse.source, 'default'), inArray(drinkResponse.period, openPeriods)),
    })
  }
}
