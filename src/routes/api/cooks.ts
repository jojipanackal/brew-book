import { and, eq, inArray } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { db } from '#/db'
import { company, companyAdmin, cook, user } from '#/db/schema'
import { auth } from '#/lib/auth'

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

interface GetAdminResult {
  userId: string
  companyIds: string[] | null
  companyId: string | null
}

async function getAdmin(request: Request): Promise<GetAdminResult | null> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return null
  const normalizedEmail = session.user.email.trim().toLowerCase()
  const [userRow, memberships] = await Promise.all([
    db.select({ id: user.id, role: user.role, companyId: user.companyId }).from(user).where(eq(user.id, session.user.id)).limit(1),
    db.select({ companyId: companyAdmin.companyId }).from(companyAdmin).where(eq(companyAdmin.email, normalizedEmail)),
  ])
  const companyId = userRow[0]?.companyId ?? memberships[0]?.companyId ?? null
  if (userRow[0]?.role === 'admin') return { userId: session.user.id, companyIds: null as string[] | null, companyId }
  if (!memberships.length) return null
  return { userId: session.user.id, companyIds: memberships.map((item) => item.companyId), companyId }
}

function isValidPhoneNumber(phoneNumber: string): boolean {
  // Accept phone numbers with country code (10-15 digits)
  // Examples: 919876543210, +919876543210, 9876543210
  const cleaned = phoneNumber.replace(/\D/g, '')
  return cleaned.length >= 10 && cleaned.length <= 15
}

function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digits and return clean number
  const cleaned = phoneNumber.replace(/\D/g, '')
  
  // If it doesn't start with country code and has 10 digits (India), add 91
  if (cleaned.length === 10) {
    return '91' + cleaned
  }
  
  return cleaned
}

export type CookRecord = {
  id: string
  name: string
  phoneNumber: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const Route = createFileRoute('/api/cooks')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const admin = await getAdmin(request)
        if (!admin) return json({ error: 'Admin access required' }, { status: 403 })
        
        const cooks = await db.select({
          id: cook.id,
          name: cook.name,
          phoneNumber: cook.phoneNumber,
          isActive: cook.isActive,
          createdAt: cook.createdAt,
          updatedAt: cook.updatedAt,
        })
        .from(cook)
        .where(admin.companyIds ? inArray(cook.companyId, admin.companyIds) : undefined)
        .orderBy(cook.createdAt)
        
        return json({ cooks })
      },

      POST: async ({ request }) => {
        const admin = await getAdmin(request)
        if (!admin) return json({ error: 'Admin access required' }, { status: 403 })
        
        const body = await request.json() as { type?: unknown; id?: unknown; name?: unknown; phoneNumber?: unknown; isActive?: unknown }
        
        if (body.type === 'create') {
          const { name, phoneNumber } = body
          if (typeof name !== 'string' || !name.trim()) {
            return json({ error: 'Cook name is required' }, { status: 400 })
          }
          if (typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
            return json({ error: 'Phone number is required' }, { status: 400 })
          }
          if (!isValidPhoneNumber(phoneNumber)) {
            return json({ error: 'Invalid phone number format. Please include country code (e.g., +91 98765 43210)' }, { status: 400 })
          }
          
          // Use the signed-in admin's company context, including for global admins.
          if (!admin.companyId) {
            return json({ error: 'Unable to determine company for cook' }, { status: 400 })
          }
          
          const companyId = admin.companyId
          const normalizedPhone = normalizePhoneNumber(phoneNumber)
          
          const cookId = crypto.randomUUID()
          await db.insert(cook).values({
            id: cookId,
            companyId,
            name: name.trim(),
            phoneNumber: normalizedPhone,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          
          const newCook = await db.select({
            id: cook.id,
            name: cook.name,
            phoneNumber: cook.phoneNumber,
            isActive: cook.isActive,
            createdAt: cook.createdAt,
            updatedAt: cook.updatedAt,
          })
          .from(cook)
          .where(eq(cook.id, cookId))
          .limit(1)
          
          return json({ ok: true, cook: newCook[0] })
        }
        
        if (body.type === 'update') {
          const { id, name, phoneNumber, isActive } = body
          if (typeof id !== 'string') {
            return json({ error: 'Cook ID is required' }, { status: 400 })
          }
          
          // Verify the cook belongs to the admin's company
          const targetCook = await db.select({ companyId: cook.companyId })
            .from(cook)
            .where(eq(cook.id, id))
            .limit(1)
          
          if (!targetCook[0] || (admin.companyIds && !admin.companyIds.includes(targetCook[0].companyId))) {
            return json({ error: 'Cook not found or access denied' }, { status: 403 })
          }
          
          const updates: Record<string, unknown> = {}
          if (typeof name === 'string' && name.trim()) {
            updates.name = name.trim()
          }
          if (typeof phoneNumber === 'string' && phoneNumber.trim()) {
            if (!isValidPhoneNumber(phoneNumber)) {
              return json({ error: 'Invalid phone number format' }, { status: 400 })
            }
            updates.phoneNumber = normalizePhoneNumber(phoneNumber)
          }
          if (typeof isActive === 'boolean') {
            updates.isActive = isActive
          }
          
          if (Object.keys(updates).length === 0) {
            return json({ error: 'No updates provided' }, { status: 400 })
          }
          
          updates.updatedAt = new Date()
          
          await db.update(cook).set(updates).where(eq(cook.id, id))
          
          const updatedCook = await db.select({
            id: cook.id,
            name: cook.name,
            phoneNumber: cook.phoneNumber,
            isActive: cook.isActive,
            createdAt: cook.createdAt,
            updatedAt: cook.updatedAt,
          })
          .from(cook)
          .where(eq(cook.id, id))
          .limit(1)
          
          return json({ ok: true, cook: updatedCook[0] })
        }
        
        if (body.type === 'delete') {
          const { id } = body
          if (typeof id !== 'string') {
            return json({ error: 'Cook ID is required' }, { status: 400 })
          }
          
          // Verify the cook belongs to the admin's company
          const targetCook = await db.select({ companyId: cook.companyId })
            .from(cook)
            .where(eq(cook.id, id))
            .limit(1)
          
          if (!targetCook[0] || (admin.companyIds && !admin.companyIds.includes(targetCook[0].companyId))) {
            return json({ error: 'Cook not found or access denied' }, { status: 403 })
          }
          
          await db.delete(cook).where(eq(cook.id, id))
          
          return json({ ok: true })
        }
        
        return json({ error: 'Invalid cook action' }, { status: 400 })
      },
    },
  },
})
