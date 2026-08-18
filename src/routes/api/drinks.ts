import { and, eq, gt, inArray } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { db } from '#/db'
import { attendance, drinkDefault, drinkResponse, user } from '#/db/schema'
import { auth } from '#/lib/auth'
import { drinks, periods, type AttendanceStatus, type Drink, type DrinkChoice, type Period, type PollSource, type SugarChoice } from '#/lib/drinks'
import { currentlyOpenPeriods, ensureTodayResponses, openPeriodsForToday, todayKey } from '#/lib/poll-responses'

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

function isPeriod(value: unknown): value is Period {
  return typeof value === 'string' && periods.includes(value as Period)
}

function isDrink(value: unknown): value is Drink {
  return typeof value === 'string' && drinks.includes(value as Drink)
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

async function getCurrentUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (session?.user) {
    const member = await db.select({ companyId: user.companyId }).from(user).where(eq(user.id, session.user.id)).limit(1)
    if (member[0]?.companyId) return session.user
    return null
  }
  const token = request.headers.get('cookie')?.match(/(?:^|;\s*)brewbook_guest=([^;]+)/)?.[1]
  if (!token) return null
  const guest = await db.select({ id: user.id, name: user.name, email: user.email, image: user.image }).from(user).where(and(eq(user.guestToken, decodeURIComponent(token)), eq(user.isGuest, true), gt(user.guestExpiresAt, new Date()))).limit(1)
  return guest[0] ?? null
}

function defaultsFromRows(rows: Array<{ period: Period; drink: Drink; sugar: boolean }>): { defaults: DrinkChoice; sugarDefaults: SugarChoice } {
  const defaults: DrinkChoice = { morning: 'No drink', evening: 'No drink' }
  const sugarDefaults: SugarChoice = { morning: true, evening: true }
  for (const row of rows) { defaults[row.period] = row.drink; sugarDefaults[row.period] = row.sugar }
  return { defaults, sugarDefaults }
}

export async function readDay(userId: string | undefined, date: string) {
  const [defaultRows, currentUserRows] = await Promise.all([
    userId ? db.select({ period: drinkDefault.period, drink: drinkDefault.drink, sugar: drinkDefault.sugar }).from(drinkDefault).where(eq(drinkDefault.userId, userId)) : Promise.resolve([]),
    userId ? db.select({ companyId: user.companyId }).from(user).where(eq(user.id, userId)).limit(1) : Promise.resolve([]),
  ])
  const companyId = currentUserRows[0]?.companyId
  const responseRows = await db.select({
      userId: drinkResponse.userId,
      name: user.name,
      email: user.email,
      image: user.image,
      period: drinkResponse.period,
      drink: drinkResponse.drink,
      sugar: drinkResponse.sugar,
      source: drinkResponse.source,
    }).from(drinkResponse).innerJoin(user, eq(user.id, drinkResponse.userId)).where(companyId ? and(eq(drinkResponse.date, date), eq(user.companyId, companyId)) : eq(drinkResponse.date, date))
  const availabilityRows = await db.select({ userId: attendance.userId, period: attendance.period, status: attendance.status })
    .from(attendance).where(eq(attendance.date, date))
  const members = await db.select({ id: user.id, name: user.name, email: user.email, image: user.image })
    .from(user).where(companyId ? eq(user.companyId, companyId) : undefined)

  const grouped = new Map<string, { user: { id: string; name: string; email: string; image: string | null }; choices: Partial<DrinkChoice>; sugar: Partial<SugarChoice>; sources: Partial<Record<Period, PollSource>>; availability: Partial<Record<Period, AttendanceStatus>> }>()
  for (const member of members) grouped.set(member.id, { user: member, choices: {}, sugar: {}, sources: {}, availability: {} })
  for (const row of responseRows) {
    const existing = grouped.get(row.userId) ?? { user: { id: row.userId, name: row.name, email: row.email, image: row.image }, choices: {}, sugar: {}, sources: {}, availability: {} }
    existing.choices[row.period] = row.drink
    existing.sugar[row.period] = row.sugar
    existing.sources[row.period] = row.source
    grouped.set(row.userId, existing)
  }
  for (const row of availabilityRows) {
    const existing = grouped.get(row.userId)
    if (existing) existing.availability[row.period] = row.status
  }

  const defaultSettings = defaultsFromRows(defaultRows)
  return { ...defaultSettings, availability: { morning: 'office' as const, evening: 'office' as const }, responses: [...grouped.values()].filter((entry) => entry.user.email && !entry.user.email.endsWith('@guest.brewbook.local') || responseRows.some((row) => row.userId === entry.user.id)).map((entry) => {
    const availability = { morning: entry.availability.morning ?? 'office', evening: entry.availability.evening ?? 'office' }
    const inactive = (period: Period) => availability[period] !== 'office'
    return {
    user: entry.user,
    choices: { morning: inactive('morning') ? 'No drink' : (entry.choices.morning ?? 'No drink'), evening: inactive('evening') ? 'No drink' : (entry.choices.evening ?? 'No drink') },
    sugar: { morning: entry.sugar.morning ?? true, evening: entry.sugar.evening ?? true },
    sources: { morning: entry.sources.morning ?? 'default', evening: entry.sources.evening ?? 'default' },
    availability,
  }
  }) }
}

export const Route = createFileRoute('/api/drinks')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const currentUser = await getCurrentUser(request)
        if (!currentUser) return json({ error: 'Unauthorized' }, { status: 401 })
        const requestedDate = new URL(request.url).searchParams.get('date')
        if (!isDate(requestedDate)) return json({ error: 'A valid date is required' }, { status: 400 })
        if (currentUser.email.endsWith('@guest.brewbook.local') && requestedDate !== todayKey()) {
          return json({ error: 'Guest polls are valid for today only' }, { status: 400 })
        }
        const currentUserCompany = await db.select({ companyId: user.companyId }).from(user).where(eq(user.id, currentUser.id)).limit(1)
        const companyId = currentUserCompany[0]?.companyId
        if (!companyId) return json({ error: 'Your account is not assigned to a company' }, { status: 403 })
        const beforeEnsure = await readDay(currentUser.id, requestedDate)
        await ensureTodayResponses(companyId, requestedDate, openPeriodsForToday())
        const day = requestedDate === todayKey() ? await readDay(currentUser.id, requestedDate) : beforeEnsure
        return json({ date: requestedDate, ...day })
      },
      PUT: async ({ request }) => {
        const currentUser = await getCurrentUser(request)
        if (!currentUser) return json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as { type?: unknown; date?: unknown; period?: unknown; drink?: unknown; sugar?: unknown }
        if (body.type === 'default') {
          if (currentUser.email.endsWith('@guest.brewbook.local')) return json({ error: 'Guests cannot set defaults' }, { status: 403 })
          if (!isPeriod(body.period) || !isDrink(body.drink) || typeof body.sugar !== 'boolean') return json({ error: 'Invalid default' }, { status: 400 })
          const sugar = body.drink === 'No drink' ? true : body.sugar
          await db.insert(drinkDefault).values({ userId: currentUser.id, period: body.period, drink: body.drink, sugar }).onConflictDoUpdate({ target: [drinkDefault.userId, drinkDefault.period], set: { drink: body.drink, sugar, updatedAt: new Date() } })
          await db.update(drinkResponse).set({ drink: body.drink, sugar, updatedAt: new Date() }).where(and(eq(drinkResponse.userId, currentUser.id), eq(drinkResponse.date, todayKey()), eq(drinkResponse.period, body.period), eq(drinkResponse.source, 'default'), inArray(drinkResponse.period, currentlyOpenPeriods())))
          const rows = await db.select({ period: drinkDefault.period, drink: drinkDefault.drink, sugar: drinkDefault.sugar }).from(drinkDefault).where(eq(drinkDefault.userId, currentUser.id))
          return json(defaultsFromRows(rows))
        }
        if (body.type === 'response') {
          if (!isDate(body.date) || !isPeriod(body.period) || !isDrink(body.drink) || typeof body.sugar !== 'boolean') return json({ error: 'Invalid response' }, { status: 400 })
          if (currentUser.email.endsWith('@guest.brewbook.local') && body.date !== todayKey()) return json({ error: 'Guest responses are valid for today only' }, { status: 400 })
          const defaults = await readDay(currentUser.id, body.date)
          const sugar = body.drink === 'No drink' ? true : body.sugar
          await db.insert(drinkResponse).values({ id: crypto.randomUUID(), userId: currentUser.id, date: body.date, period: body.period, drink: body.drink, sugar, source: 'manual' }).onConflictDoUpdate({ target: [drinkResponse.userId, drinkResponse.date, drinkResponse.period], set: { drink: body.drink, sugar, source: 'manual', updatedAt: new Date() } })
          const day = await readDay(currentUser.id, body.date)
          return json({ date: body.date, ...day, defaults: defaults.defaults })
        }
        return json({ error: 'Unknown update type' }, { status: 400 })
      },
    },
  },
})
