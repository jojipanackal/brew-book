import { and, eq, gt } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { db } from '#/db'
import { attendance, company, companyAdmin, drinkDefault, drinkResponse, user } from '#/db/schema'
import { drinks, periods, type AttendanceStatus, type Company, type Drink, type DrinkChoice, type Period, type SugarChoice } from '#/lib/drinks'
import { getRequestUser } from '#/lib/request-user'

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

const indiaDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })
const todayKey = () => indiaDateFormatter.format(new Date())

function isCompany(value: unknown): value is Company {
  return typeof value === 'string' && value.trim().length > 0
}

function readGuestToken(request: Request) {
  const token = request.headers.get('cookie')?.match(/(?:^|;\s*)brewbook_guest=([^;]+)/)?.[1]
  return token ? decodeURIComponent(token) : null
}

function isDrink(value: unknown): value is Drink {
  return typeof value === 'string' && drinks.includes(value as Drink)
}
function isPeriod(value: unknown): value is Period { return typeof value === 'string' && periods.includes(value as Period) }
function isDate(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) }
function isAttendanceStatus(value: unknown): value is AttendanceStatus { return value === 'office' || value === 'wfh' || value === 'leave' }

function defaultsFromRows(rows: Array<{ period: 'morning' | 'evening'; drink: Drink; sugar: boolean }>): { defaults: DrinkChoice; sugarDefaults: SugarChoice } {
  const defaults: DrinkChoice = { morning: 'No drink', evening: 'No drink' }
  const sugarDefaults: SugarChoice = { morning: true, evening: true }
  for (const row of rows) { defaults[row.period] = row.drink; sugarDefaults[row.period] = row.sugar }
  return { defaults, sugarDefaults }
}

async function getCurrentUser(request: Request) {
  return getRequestUser(request)
}

/**
 * A guest can start a response before signing in. If they then authenticate in
 * the same browser, the guest cookie is proof that both identities belong to
 * the same person. Move those responses to the authenticated user before the
 * normal day/profile reads happen, so details never show both identities.
 */
async function claimGuestResponses(request: Request, currentUser: { id: string; email: string }) {
  const token = readGuestToken(request)
  if (!token) return

  const guestRows = await db
    .select({ id: user.id, companyId: user.companyId })
    .from(user)
    .where(and(eq(user.guestToken, token), eq(user.isGuest, true), eq(user.guestStatus, 'approved'), gt(user.guestExpiresAt, new Date())))
    .limit(1)
  const guest = guestRows[0]
  if (!guest || guest.id === currentUser.id) return

  const companyRows = await db
    .select({ id: company.id, emailEnding1: company.emailEnding1, emailEnding2: company.emailEnding2 })
    .from(company)
  const email = currentUser.email.trim().toLowerCase()
  const matchedCompany = companyRows.find((item) =>
    [item.emailEnding1, item.emailEnding2].some((ending) =>
      ending && email.endsWith(ending.trim().toLowerCase()),
    ),
  )
  if (!matchedCompany || guest.companyId !== matchedCompany.id) return

  await db.transaction(async (tx) => {
    const guestResponses = await tx
      .select()
      .from(drinkResponse)
      .where(eq(drinkResponse.userId, guest.id))

    for (const response of guestResponses) {
      await tx
        .insert(drinkResponse)
        .values({ ...response, userId: currentUser.id })
        .onConflictDoNothing({
          target: [drinkResponse.userId, drinkResponse.date, drinkResponse.period],
        })
    }

    await tx.delete(user).where(eq(user.id, guest.id))
  })
}

async function readProfile(currentUser: { id: string; email: string }) {
  const normalizedEmail = currentUser.email.trim().toLowerCase()
  const [userRow, defaultRows, companyRows, adminRows, availabilityRows] = await Promise.all([
    db.select({ companyId: user.companyId, legacyCompany: user.company, role: user.role, isOnLeave: user.isOnLeave }).from(user).where(eq(user.id, currentUser.id)).limit(1),
    db.select({ period: drinkDefault.period, drink: drinkDefault.drink, sugar: drinkDefault.sugar }).from(drinkDefault).where(eq(drinkDefault.userId, currentUser.id)),
    db.select({ id: company.id, name: company.name, emailEnding1: company.emailEnding1, emailEnding2: company.emailEnding2 }).from(company),
    db.select({ email: companyAdmin.email }).from(companyAdmin).where(eq(companyAdmin.email, normalizedEmail)),
    db.select({ period: attendance.period, status: attendance.status }).from(attendance).where(and(eq(attendance.userId, currentUser.id), eq(attendance.date, todayKey()))),
  ])
  const email = currentUser.email.trim().toLowerCase()
  const matchedCompany = companyRows.find((item) => [item.emailEnding1, item.emailEnding2].some((ending) => ending && email.endsWith(ending.trim().toLowerCase())))
  const companyName = matchedCompany?.name ?? null
  const accessDenied = !matchedCompany
  const isAdmin = userRow[0]?.role === 'admin' || adminRows.length > 0
  if (matchedCompany && (userRow[0]?.companyId !== matchedCompany.id || userRow[0]?.legacyCompany !== matchedCompany.name)) {
    await db.update(user).set({ company: matchedCompany.name, companyId: matchedCompany.id, updatedAt: new Date() }).where(eq(user.id, currentUser.id))
  }
  const availability: Record<Period, AttendanceStatus> = { morning: 'office', evening: 'office' }
  for (const row of availabilityRows) availability[row.period] = row.status
  return { company: companyName, requiresCompany: false, accessDenied, needsOnboarding: !accessDenied && defaultRows.length < periods.length, role: isAdmin ? 'admin' as const : 'user' as const, isOnLeave: userRow[0]?.isOnLeave ?? false, availability, ...defaultsFromRows(defaultRows) }
}

export const Route = createFileRoute('/api/profile')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const currentUser = await getCurrentUser(request)
        if (!currentUser) return json({ error: 'Unauthorized' }, { status: 401 })
        await claimGuestResponses(request, currentUser)
        return json(await readProfile(currentUser))
      },
      PUT: async ({ request }) => {
        const currentUser = await getCurrentUser(request)
        if (!currentUser) return json({ error: 'Unauthorized' }, { status: 401 })
        await claimGuestResponses(request, currentUser)
        const body = await request.json() as { company?: unknown; defaults?: Partial<Record<'morning' | 'evening', unknown>>; sugarDefaults?: Partial<Record<'morning' | 'evening', unknown>> }
        const profile = await readProfile(currentUser)
        const companyName = profile.company
        if (!isCompany(companyName) || profile.accessDenied) return json({ error: 'Your work email is not registered with a BrewBook company.' }, { status: 403 })
        const defaults = body.defaults
        if (!defaults || !isDrink(defaults.morning) || !isDrink(defaults.evening)) return json({ error: 'Choose both default drinks' }, { status: 400 })
        const validatedDefaults: DrinkChoice = { morning: defaults.morning, evening: defaults.evening }
        const sugarDefaults = body.sugarDefaults
        if (!sugarDefaults || typeof sugarDefaults.morning !== 'boolean' || typeof sugarDefaults.evening !== 'boolean') return json({ error: 'Choose sugar preferences' }, { status: 400 })
        const validatedSugarDefaults: SugarChoice = { morning: validatedDefaults.morning === 'No drink' ? true : sugarDefaults.morning, evening: validatedDefaults.evening === 'No drink' ? true : sugarDefaults.evening }

        await db.transaction(async (tx) => {
          await tx.update(user).set({ company: companyName, updatedAt: new Date() }).where(eq(user.id, currentUser.id))
          for (const period of periods) {
            await tx.insert(drinkDefault).values({ userId: currentUser.id, period, drink: validatedDefaults[period], sugar: validatedSugarDefaults[period] }).onConflictDoUpdate({ target: [drinkDefault.userId, drinkDefault.period], set: { drink: validatedDefaults[period], sugar: validatedSugarDefaults[period], updatedAt: new Date() } })
            await tx.insert(drinkResponse).values({ id: crypto.randomUUID(), userId: currentUser.id, date: todayKey(), period, drink: validatedDefaults[period], sugar: validatedSugarDefaults[period], source: 'default' }).onConflictDoUpdate({ target: [drinkResponse.userId, drinkResponse.date, drinkResponse.period], set: { drink: validatedDefaults[period], sugar: validatedSugarDefaults[period], source: 'default', updatedAt: new Date() }, where: eq(drinkResponse.source, 'default') })
          }
        })
        return json(await readProfile(currentUser))
      },
      PATCH: async ({ request }) => {
        const currentUser = await getCurrentUser(request)
        if (!currentUser) return json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as { date?: unknown; period?: unknown; status?: unknown }
        if (!isDate(body.date) || !isPeriod(body.period) || !isAttendanceStatus(body.status)) return json({ error: 'Invalid availability' }, { status: 400 })
        await db.insert(attendance).values({ id: crypto.randomUUID(), userId: currentUser.id, date: body.date, period: body.period, status: body.status })
          .onConflictDoUpdate({ target: [attendance.userId, attendance.date, attendance.period], set: { status: body.status, updatedAt: new Date() } })
        if (body.status !== 'office') {
          await db.insert(drinkResponse).values({ id: crypto.randomUUID(), userId: currentUser.id, date: body.date, period: body.period, drink: 'No drink', sugar: true, source: 'manual' }).onConflictDoUpdate({ target: [drinkResponse.userId, drinkResponse.date, drinkResponse.period], set: { drink: 'No drink', sugar: true, source: 'manual', updatedAt: new Date() } })
        }
        return json({ date: body.date, period: body.period, status: body.status })
      },
    },
  },
})
