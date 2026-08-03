export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'cold' | 'hot' | 'windy' | 'unknown'

export type Weather = {
  condition: WeatherCondition
  temp: number
  description: string
}

// Open-Meteo WMO weather code → condition
function wmoToCondition(code: number, temp: number): WeatherCondition {
  if (code === 0 || code === 1) return temp >= 32 ? 'hot' : temp <= 15 ? 'cold' : 'sunny'
  if (code === 2 || code === 3) return 'cloudy'
  if (code >= 51 && code <= 67) return 'rainy'
  if (code >= 80 && code <= 82) return 'rainy'
  if (code >= 95 && code <= 99) return 'rainy'
  if (code >= 71 && code <= 77) return 'cold'
  if (temp <= 15) return 'cold'
  if (temp >= 35) return 'hot'
  return 'cloudy'
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 5000,
      maximumAge: 10 * 60 * 1000,
    }),
  )
}

let cached: { weather: Weather; fetchedAt: number } | null = null
const CACHE_MS = 30 * 60 * 1000

export async function getWeather(): Promise<Weather | null> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.weather

  try {
    const position = await getPosition()
    const { latitude, longitude } = position.coords

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=celsius&forecast_days=1`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json() as {
      current: { temperature_2m: number; weathercode: number; windspeed_10m: number }
    }

    const temp = Math.round(data.current.temperature_2m)
    const code = data.current.weathercode
    const wind = data.current.windspeed_10m
    const condition = wind > 30 ? 'windy' : wmoToCondition(code, temp)

    const weather: Weather = { condition, temp, description: `${temp}°C` }
    cached = { weather, fetchedAt: Date.now() }
    return weather
  } catch {
    return null
  }
}
