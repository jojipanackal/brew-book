import type { Drink } from './drinks'
import type { Weather, WeatherCondition } from './weather'

type Pool = string[]

function pick(pool: Pool): string {
  return pool[Math.floor(Math.random() * pool.length)]
}

function inject(template: string, name: string): string {
  return template.replace(/\{name\}/g, name)
}

// ❤️ Cute & Personal
const cute: Pool = [
  "I know two things that make {name}'s day better... tea and a little break. ❤️",
  "If I could hug you, I'd bring coffee too, {name}.",
  "Some days need more kindness. And more chai, {name}.",
  "{name}, you deserve five peaceful minutes and a hot drink.",
  "Just checking in {name}... have you had your tea today?",
  "{name}, today's reminder: stay hydrated and be kind to yourself.",
  "{name}, your cup is lonely.",
  "Warm drink. Warm heart. 🧡",
  "{name}, sending you a virtual hug... and a hot cup. ☕",
]

// 😂 Funny
const funny: Pool = [
  "{name}, your kettle is secretly hoping you'll order today.",
  "Your mug asked where you've been, {name}.",
  "Coffee: because meetings exist, {name}.",
  "We don't judge {name}... but your empty cup does.",
  "Tea solves 90% of today's problems, {name}.",
  "{name}, adulting level low? Coffee level high.",
  "{name}, today's forecast: 100% chance of tea.",
  "{name}, your biscuits are waiting for their soulmate.",
]

// 🍪 Tea + Snacks
const snacks: Pool = [
  "{name}, biscuits called. They found your tea.",
  "Tea without biscuits, {name}? That's a missed opportunity.",
  "{name}, one dunk away from happiness. 🍪",
  "Your chai deserves company, {name}.",
  "Crunch. Sip. Repeat. That's the {name} way.",
  "{name}, tea and biscuits: a timeless duo.",
  "The perfect tea break starts here, {name}.",
  "{name}, cookies and coffee — name a better pair.",
]

// 🥛 Milk / Horlicks / Boost
const milk: Pool = [
  "{name}, fuel your day, one sip at a time.",
  "Strong mornings start with strong drinks, {name}.",
  "{name}, Horlicks is ready whenever you are.",
  "Boost your energy. Literally, {name}. 💪",
  "{name}, your future self says thanks.",
  "Recharge your body, not just your phone, {name}.",
  "{name}, a healthy habit starts with one order.",
  "Good mornings taste like warm milk, {name}. 🥛",
]

// 💧 Water / No drink
const water: Pool = [
  "{name}, gentle reminder: your body called. It wants water. 💧",
  "Hydration check! Have you had enough today, {name}?",
  "Stay cool. Stay hydrated, {name}. 💧",
  "{name}, water first. Everything else later.",
  "{name}, drink water. Your brain likes that. 🧠",
  "Your plants aren't the only ones needing water, {name}.",
  "{name}, one glass today, many smiles tomorrow. 💧",
]

// ☕ Tea & Coffee (general)
const teaCoffee: Pool = [
  "Life happens. Tea helps, {name}. ☕",
  "{name}, brewing something special... just for you. ☕",
  "Your coffee misses you more than your alarm does, {name}.",
  "{name}, sip happens. We've got coffee. ☕",
  "Tea is calling, {name}. You should answer.",
  "{name}, one cup closer to a better day. ☕",
  "Coffee first. Adulting later, {name}.",
  "{name}, every great idea starts with a cup.",
  "Happiness is only a sip away, {name}. ☕",
  "A warm cup is waiting for you, {name}.",
]

// 🌦️ Weather-aware messages
const weatherMessages: Record<WeatherCondition, Pool> = {
  rainy: [
    "{name}, it's raining outside — the perfect excuse for chai. 🌧️☕",
    "Rainy day energy hits different with a hot cup, {name}. 🌧️",
    "{name}, the rain is literally calling for something warm. ☔",
    "Outside: wet. Inside: {name} with a hot drink. Perfect. 🌧️",
    "{name}, on days like this the only right answer is chai. 🌧️☕",
    "Let it rain, {name} — you've got your cup. 🌧️",
  ],
  cold: [
    "{name}, it's chilly out there — warm up from the inside. 🥶☕",
    "Cold weather and a hot drink? That's the dream, {name}. ❄️",
    "{name}, your body is literally asking for something warm right now. 🧣",
    "Nothing fights the cold like a hot cup, {name}. ❄️☕",
    "{name}, cosy weather, cosy drink. You know what to do. 🧣",
    "Wrap up, {name} — and wrap your hands around a hot cup. ❄️☕",
  ],
  hot: [
    "{name}, it's a scorcher today — brave the hot chai? 🔥☕",
    "{name}, hot outside, hotter chai inside? ☀️🔥",
    "The sun is doing its thing, {name} — your cup is doing its thing too. ☀️",
    "{name}, even in this heat, a good drink fixes everything. 🌡️☕",
    "Sweating it out, {name}? Treat yourself. 🌞☕",
  ],
  sunny: [
    "{name}, sunny day vibes + a good drink = perfection. ☀️☕",
    "Beautiful day outside, {name}! Celebrate with your favourite cup. 🌤️",
    "{name}, the sun says hi — and so does your tea. ☀️",
    "Sunshine and a warm drink, {name}? Yes please. ☀️☕",
    "{name}, bright skies, bright mood, hot tea. Make it happen. ☀️",
  ],
  cloudy: [
    "{name}, grey skies are just tea weather in disguise. ☁️☕",
    "Cloudy day energy calls for a warm cup, {name}. ☁️",
    "{name}, when it's cloudy outside, the best answer is a hot drink. ☁️☕",
    "Cloud cover unlocked: perfect chai weather, {name}. ☁️",
    "{name}, moody skies, cosy drink. Sounds right. ☁️☕",
  ],
  windy: [
    "{name}, it's breezy out there — hold your cup tight. 🌬️☕",
    "Windy day, warm drink. That's the deal, {name}. 🌬️",
    "{name}, the wind is basically telling you to stay in with a hot chai. 💨☕",
    "Let the wind blow, {name} — your cup keeps you grounded. 🌬️",
    "{name}, gusty outside. Cosy inside. You know what to order. 💨",
  ],
  unknown: [],
}

function poolForDrink(drink: Drink): Pool {
  if (drink === 'No drink') return water
  if (drink === 'Milk') return [...milk, ...cute]
  if (drink === 'Coffee' || drink === 'Black Coffee') return [...teaCoffee, ...funny]
  if (drink === 'Green tea') return [...teaCoffee, ...cute, ...snacks]
  if (drink === 'Tea' || drink === 'Black Tea') return [...teaCoffee, ...snacks, ...cute]
  return teaCoffee
}

export function getGreeting(name: string, drink: Drink, weather: Weather | null): string {
  const firstName = name.trim().split(/\s+/)[0]

  // 40% chance of a weather message when condition is notable
  if (weather && weather.condition !== 'unknown') {
    const pool = weatherMessages[weather.condition]
    if (pool.length > 0 && Math.random() < 0.4) {
      return inject(pick(pool), firstName)
    }
  }

  const pool = poolForDrink(drink)
  return inject(pick(pool), firstName)
}
