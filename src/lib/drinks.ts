export const drinks = ['Tea', 'Coffee', 'Green tea', 'Milk', 'Black Coffee', 'Black Tea', 'No drink'] as const
export const periods = ['morning', 'evening'] as const

export type Drink = (typeof drinks)[number]
export type Period = (typeof periods)[number]
export type Company = string
export type CompanyRecord = { id: string; name: string; emailEnding1: string; emailEnding2: string | null }
export type PollSource = 'default' | 'manual' | 'admin'
export type AttendanceStatus = 'office' | 'wfh' | 'leave'
export type DrinkChoice = Record<Period, Drink>
export type SugarChoice = Record<Period, boolean>
export type User = { id?: string; name: string; email: string; image?: string | null; role?: 'user' | 'admin' | 'guest'; isOnLeave?: boolean; availability?: Record<Period, AttendanceStatus> }
export type PollRecord = {
  user: User
  choices: DrinkChoice
  sugar: SugarChoice
  sources: Record<Period, PollSource>
  availability: Record<Period, AttendanceStatus>
}
export type DrinkDay = {
  date: string
  defaults: DrinkChoice
  sugarDefaults: SugarChoice
  responses: PollRecord[]
  availability: Record<Period, AttendanceStatus>
}
export type Profile = {
  company: Company | null
  requiresCompany: boolean
  needsOnboarding: boolean
  defaults: DrinkChoice
  sugarDefaults: SugarChoice
  role: 'user' | 'admin' | 'guest'
  accessDenied: boolean
  isOnLeave: boolean
  availability: Record<Period, AttendanceStatus>
}

export function setAvailability(input: { date: string; period: Period; status: AttendanceStatus }) {
  return request<{ date: string; period: Period; status: AttendanceStatus }>('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
export type GuestSession = { user: User; date: string; status: 'pending' | 'approved' | 'rejected'; defaults: DrinkChoice; sugarDefaults: SugarChoice; responses: PollRecord[] }
export type AdminDashboard = { date: string; pendingGuests: Array<{ id: string; name: string; company: string | null; requestedAt: string | null }>; responses: PollRecord[] }

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error || `Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function getDrinkDay(date: string) {
  return request<DrinkDay>(`/api/drinks?date=${encodeURIComponent(date)}`)
}

export function saveResponse(input: { date: string; period: Period; drink: Drink; sugar: boolean }) {
  return request<DrinkDay>('/api/drinks', {
    method: 'PUT',
    body: JSON.stringify({ type: 'response', ...input }),
  })
}

export function saveDefault(input: { period: Period; drink: Drink; sugar: boolean }) {
  return request<{ defaults: DrinkChoice; sugarDefaults: SugarChoice }>('/api/drinks', {
    method: 'PUT',
    body: JSON.stringify({ type: 'default', ...input }),
  })
}

export function getProfile() {
  return request<Profile>('/api/profile')
}

export function getCompanies() {
  return request<CompanyRecord[]>('/api/companies')
}

export function completeOnboarding(input: { company: Company; defaults: DrinkChoice; sugarDefaults: SugarChoice }) {
  return request<Profile>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function getGuestSession() {
  return request<GuestSession>('/api/guest')
}

export function createGuest(input: { name: string; company: Company }) {
  return request<GuestSession>('/api/guest', { method: 'POST', body: JSON.stringify(input) })
}

export function leaveGuest() {
  return request<{ ok: true }>('/api/guest', { method: 'DELETE' })
}

export function getStats(days = 30) {
  return request<import('#/routes/api/stats').StatsResponse>(`/api/stats?days=${days}`)
}

export function getAdminDashboard() {
  return request<AdminDashboard>('/api/admin')
}

export function updateGuestRequest(input: { type: 'approve' | 'reject' | 'removeGuest'; userId: string }) {
  return request<{ ok: true }>('/api/admin', { method: 'POST', body: JSON.stringify(input) })
}

export function updateUserResponse(input: { userId: string; period: Period; drink: Drink; sugar: boolean }) {
  return request<{ ok: true }>('/api/admin', { method: 'POST', body: JSON.stringify({ type: 'response', date: new Date().toISOString().slice(0, 10), ...input }) })
}

export type Cook = { id: string; name: string; phoneNumber: string; isActive: boolean; createdAt: Date; updatedAt: Date }

export type PollResults = {
  period: Period
  date: string
  results: Record<Drink, number>
  total: number
}

export function calculatePollResults(responses: PollRecord[], period: Period): PollResults {
  const results: Record<Drink, number> = {}
  
  // Initialize all drinks with 0
  for (const drink of drinks) {
    results[drink] = 0
  }
  
  // Count votes
  for (const response of responses) {
    const drinkChoice = response.choices[period]
    if (response.availability[period] === 'office') {
      results[drinkChoice] = (results[drinkChoice] || 0) + 1
    }
  }
  
  // Don't count "No drink" in total
  const total = Object.entries(results)
    .filter(([drink]) => drink !== 'No drink')
    .reduce((sum, [, count]) => sum + count, 0)
  
  return {
    period,
    date: new Date().toISOString().split('T')[0],
    results,
    total,
  }
}

export function formatPollResultsMessage(results: PollResults, date: string): string {
  const periodLabel = results.period === 'morning' ? 'Morning Tea' : 'Evening Tea'
  const lines = [
    `BrewBook - ${periodLabel} Requirement`,
    `Date: ${new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    '',
  ]
  
  // Add drink counts
  for (const [drink, count] of Object.entries(results.results)) {
    if (drink !== 'No drink' && count > 0) {
      lines.push(`${drink}: ${count}`)
    }
  }
  
  // Add total
  lines.push(`Total: ${results.total}`)
  
  return lines.join('\n')
}

export function generateWhatsAppUrl(phoneNumber: string, message: string): string {
  const encodedMessage = encodeURIComponent(message)
  return `https://wa.me/${phoneNumber}?text=${encodedMessage}`
}

export function getCooks() {
  return request<{ cooks: Cook[] }>('/api/cooks')
}

export function createCook(input: { name: string; phoneNumber: string }) {
  return request<{ ok: true; cook: Cook }>('/api/cooks', { method: 'POST', body: JSON.stringify({ type: 'create', ...input }) })
}

export function updateCook(input: { id: string; name?: string; phoneNumber?: string; isActive?: boolean }) {
  return request<{ ok: true; cook: Cook }>('/api/cooks', { method: 'POST', body: JSON.stringify({ type: 'update', ...input }) })
}

export function deleteCook(cookId: string) {
  return request<{ ok: true }>('/api/cooks', { method: 'POST', body: JSON.stringify({ type: 'delete', id: cookId }) })
}
