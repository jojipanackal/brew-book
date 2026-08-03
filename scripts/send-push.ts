import { loadDotenvx } from '../dotenvx'

if (!process.env.VAPID_PUBLIC_KEY) loadDotenvx()

import webpush from 'web-push'
import { db } from '../src/db'
import { user, drinkDefault } from '../src/db/schema'
import { eq, isNotNull, inArray } from 'drizzle-orm'
import { getGreeting } from '../src/lib/greeting'
import type { Drink } from '../src/lib/drinks'

const period = (process.argv[2] ?? 'morning') as 'morning' | 'evening'
const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidEmail = process.env.VAPID_EMAIL ?? 'mailto:admin@mybev.app'

if (!vapidPublicKey || !vapidPrivateKey) {
  console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY')
  process.exit(1)
}

webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)

async function run() {
  const subscribers = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(isNotNull(user.pushSubscription))

  if (!subscribers.length) {
    console.log('No subscribers, nothing to send.')
    return
  }

  const userIds = subscribers.map((u) => u.id)
  const defaults = await db
    .select({ userId: drinkDefault.userId, drink: drinkDefault.drink })
    .from(drinkDefault)
    .where(inArray(drinkDefault.userId, userIds))
    .where(eq(drinkDefault.period, period))

  const defaultsByUser = new Map(defaults.map((d) => [d.userId, d.drink as Drink]))

  const rows = await db
    .select({ id: user.id, pushSubscription: user.pushSubscription })
    .from(user)
    .where(isNotNull(user.pushSubscription))

  let sent = 0
  let failed = 0

  for (const sub of rows) {
    const subscriber = subscribers.find((u) => u.id === sub.id)
    if (!subscriber || !sub.pushSubscription) continue

    const drink = defaultsByUser.get(sub.id) ?? 'Tea'
    const message = getGreeting(subscriber.name, drink, null)

    try {
      await webpush.sendNotification(
        JSON.parse(sub.pushSubscription),
        JSON.stringify({
          title: 'BrewBook',
          body: message,
          url: '/',
        })
      )
      sent++
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 410 || status === 404) {
        // Subscription expired — clear it
        await db.update(user).set({ pushSubscription: null }).where(eq(user.id, sub.id))
      }
      failed++
    }
  }

  console.log(`Sent: ${sent}, Failed/Expired: ${failed}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
