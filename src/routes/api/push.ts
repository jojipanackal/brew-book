import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { user } from '#/db/schema'
import { getRequestUser } from '#/lib/request-user'

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

export const Route = createFileRoute('/api/push')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const currentUser = await getRequestUser(request)
        if (!currentUser) return json({ error: 'Unauthorized' }, { status: 401 })

        const body = await request.json() as { subscription?: unknown }
        if (!body.subscription || typeof body.subscription !== 'object') {
          return json({ error: 'Invalid subscription' }, { status: 400 })
        }

        await db
          .update(user)
          .set({ pushSubscription: JSON.stringify(body.subscription) })
          .where(eq(user.id, currentUser.id))

        return json({ ok: true })
      },
      DELETE: async ({ request }) => {
        const currentUser = await getRequestUser(request)
        if (!currentUser) return json({ error: 'Unauthorized' }, { status: 401 })

        await db
          .update(user)
          .set({ pushSubscription: null })
          .where(eq(user.id, currentUser.id))

        return json({ ok: true })
      },
    },
  },
})
