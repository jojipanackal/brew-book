import {
  boolean,
  date,
  index,
  pgTable,
  pgEnum,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

export const drinkPeriod = pgEnum('drink_period', ['morning', 'evening'])
export const drinkChoice = pgEnum('drink_choice', ['Tea', 'Coffee', 'Green tea', 'Milk', 'Black Coffee', 'Black Tea', 'No drink'])
export const drinkSource = pgEnum('drink_source', ['default', 'manual', 'admin'])
export const userRole = pgEnum('user_role', ['user', 'admin', 'guest'])
export const guestStatus = pgEnum('guest_status', ['pending', 'approved', 'rejected'])

export const company = pgTable('company', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  emailEnding1: text('email_ending_1').notNull(),
  emailEnding2: text('email_ending_2'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  company: text('company'),
  companyId: text('company_id').references(() => company.id, { onDelete: 'set null' }),
  role: userRole('role').notNull().default('user'),
  isOnLeave: boolean('is_on_leave').notNull().default(false),
  isGuest: boolean('is_guest').notNull().default(false),
  guestToken: text('guest_token').unique(),
  guestExpiresAt: timestamp('guest_expires_at', { withTimezone: true }),
  guestStatus: guestStatus('guest_status'),
  guestRequestedAt: timestamp('guest_requested_at', { withTimezone: true }),
  guestReviewedAt: timestamp('guest_reviewed_at', { withTimezone: true }),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  pushSubscription: text('push_subscription'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const companyAdmin = pgTable(
  'company_admin',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => company.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [unique().on(table.companyId, table.email), index('company_admin_email_idx').on(table.email)],
)

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const drinkDefault = pgTable(
  'drink_default',
  {
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    period: drinkPeriod('period').notNull(),
    drink: drinkChoice('drink').notNull().default('No drink'),
    sugar: boolean('sugar').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.period] })],
)

export const drinkResponse = pgTable(
  'drink_response',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    period: drinkPeriod('period').notNull(),
    drink: drinkChoice('drink').notNull(),
    sugar: boolean('sugar').notNull().default(true),
    source: drinkSource('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.userId, table.date, table.period),
    index('drink_response_date_idx').on(table.date),
    index('drink_response_user_date_idx').on(table.userId, table.date),
  ],
)
