import { and, eq, inArray } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { db } from '#/db'
import { attendance, company, companyAdmin, drinkResponse, user } from '#/db/schema'
import { auth } from '#/lib/auth'
import { drinks, periods, type AttendanceStatus, type Drink, type Period } from '#/lib/drinks'
import { ensureTodayResponses, openPeriodsForToday } from '#/lib/poll-responses'
import { readDay } from './drinks'
import { publishPollChange } from '#/lib/poll-events'

const indiaDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })
const todayKey = () => indiaDateFormatter.format(new Date())

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

function isPeriod(value: unknown): value is Period { return typeof value === 'string' && periods.includes(value as Period) }
function isPeriodList(value: unknown): value is Period[] {
  return Array.isArray(value) && value.length > 0 && new Set(value).size === value.length && value.every(isPeriod)
}
function isDrink(value: unknown): value is Drink { return typeof value === 'string' && drinks.includes(value as Drink) }
function isAttendanceStatus(value: unknown): value is AttendanceStatus { return value === 'office' || value === 'wfh' || value === 'leave' }
function isDate(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) }

async function getAdmin(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return null
  const normalizedEmail = session.user.email.trim().toLowerCase()
  const [userRow, memberships] = await Promise.all([
    db.select({ id: user.id, role: user.role, companyId: user.companyId }).from(user).where(eq(user.id, session.user.id)).limit(1),
    db.select({ companyId: companyAdmin.companyId }).from(companyAdmin).where(eq(companyAdmin.email, normalizedEmail)),
  ])
  if (userRow[0]?.role === 'admin') return { userId: session.user.id, companyIds: null as string[] | null }
  if (!memberships.length) return null
  return { userId: session.user.id, companyIds: memberships.map((item) => item.companyId) }
}

async function canManage(admin: { companyIds: string[] | null }, targetId: string) {
  if (!admin.companyIds) return true
  const target = await db.select({ companyId: user.companyId }).from(user).where(eq(user.id, targetId)).limit(1)
  return Boolean(target[0]?.companyId && admin.companyIds.includes(target[0].companyId))
}

export const Route = createFileRoute('/api/admin')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const admin = await getAdmin(request)
        if (!admin) return json({ error: 'Admin access required' }, { status: 403 })
        const pending = await db.select({ id: user.id, name: user.name, company: user.company, companyId: user.companyId, requestedAt: user.guestRequestedAt }).from(user).where(and(eq(user.isGuest, true), eq(user.guestStatus, 'pending'), ...(admin.companyIds ? [inArray(user.companyId, admin.companyIds)] : [])))
        const companyIds = admin.companyIds ?? (await db.select({ id: company.id }).from(company)).map((row) => row.id)
        await Promise.all(companyIds.map((companyId) => ensureTodayResponses(companyId, todayKey(), openPeriodsForToday())))
        const day = await readDay(undefined, todayKey())
        const allowedUserIds = admin.companyIds ? (await db.select({ id: user.id }).from(user).where(inArray(user.companyId, admin.companyIds))).map((row) => row.id) : null
        return json({ date: todayKey(), pendingGuests: pending, responses: allowedUserIds ? day.responses.filter((entry) => entry.user.id && allowedUserIds.includes(entry.user.id)) : day.responses })
      },
      POST: async ({ request }) => {
        const admin = await getAdmin(request)
        if (!admin) return json({ error: 'Admin access required' }, { status: 403 })
        const body = await request.json() as { type?: unknown; userId?: unknown; period?: unknown; periods?: unknown; drink?: unknown; sugar?: unknown; status?: unknown; date?: unknown; onLeave?: unknown }
        if (typeof body.userId !== 'string' || !await canManage(admin, body.userId)) return json({ error: 'User is outside your company' }, { status: 403 })
        const target = (await db.select({ companyId: user.companyId }).from(user).where(eq(user.id, body.userId)).limit(1))[0]
        const changed = async () => {
          const date = isDate(body.date) ? body.date : todayKey()
          if (target?.companyId) {
            await ensureTodayResponses(target.companyId, date)
            publishPollChange(target.companyId, date)
          }
          return json({ ok: true })
        }
        if (body.type === 'deleteUser') {
          if (body.userId === admin.userId) return json({ error: 'You cannot delete your own account' }, { status: 400 })
          const deleted = await db.delete(user).where(eq(user.id, body.userId)).returning({ id: user.id })
          if (!deleted.length) return json({ error: 'User not found' }, { status: 404 })
          return changed()
        }
        if (body.type === 'approve') {
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
          await db.update(user).set({ guestStatus: 'approved', guestExpiresAt: expiresAt, guestReviewedAt: new Date() }).where(and(eq(user.id, body.userId), eq(user.isGuest, true)))
          await db.insert(drinkResponse).values(periods.map((period) => ({ id: crypto.randomUUID(), userId: body.userId as string, date: todayKey(), period, drink: 'No drink' as Drink, sugar: true, source: 'default' as const }))).onConflictDoNothing({ target: [drinkResponse.userId, drinkResponse.date, drinkResponse.period] })
          return changed()
        }
        if (body.type === 'reject') {
          await db.update(user).set({ guestStatus: 'rejected', guestReviewedAt: new Date(), guestToken: null, guestExpiresAt: null }).where(and(eq(user.id, body.userId), eq(user.isGuest, true)))
          return changed()
        }
        if (body.type === 'removeGuest') {
          await db.delete(user).where(and(eq(user.id, body.userId), eq(user.isGuest, true)))
          return changed()
        }
        if (body.type === 'response' && isPeriod(body.period) && isDrink(body.drink) && typeof body.sugar === 'boolean') {
          const sugar = body.drink === 'No drink' ? true : body.sugar
          const responseDate = isDate(body.date) ? body.date : todayKey()
          await db.insert(drinkResponse).values({ id: crypto.randomUUID(), userId: body.userId, date: responseDate, period: body.period, drink: body.drink, sugar, source: 'admin' }).onConflictDoUpdate({ target: [drinkResponse.userId, drinkResponse.date, drinkResponse.period], set: { drink: body.drink, sugar, source: 'admin', updatedAt: new Date() } })
          return changed()
        }
        if (body.type === 'availability' && isPeriod(body.period) && isAttendanceStatus(body.status)) {
          const attendanceDate = isDate(body.date) ? body.date : todayKey()
          await db.insert(attendance).values({ id: crypto.randomUUID(), userId: body.userId, date: attendanceDate, period: body.period, status: body.status, source: 'admin' }).onConflictDoUpdate({ target: [attendance.userId, attendance.date, attendance.period], set: { status: body.status, source: 'admin', updatedAt: new Date() } })
          return changed()
        }
        if (body.type === 'leave' && isDate(body.date) && isPeriodList(body.periods) && typeof body.onLeave === 'boolean') {
          const status = body.onLeave ? 'leave' as const : 'office' as const
          await db.transaction(async (tx) => {
            for (const period of body.periods) {
              await tx.insert(attendance).values({ id: crypto.randomUUID(), userId: body.userId as string, date: body.date as string, period, status, source: 'admin' }).onConflictDoUpdate({ target: [attendance.userId, attendance.date, attendance.period], set: { status, source: 'admin', updatedAt: new Date() } })
            }
          })
          return changed()
        }
        return json({ error: 'Invalid admin action' }, { status: 400 })
      },
    },
  },
})
