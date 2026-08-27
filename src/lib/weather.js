import { PLANT_COORDS } from '../data/plants'

// WMO 기상 코드 → 아이콘/텍스트
export function weatherFromWmo(code) {
  if (code === 0) return { icon: '☀️', text: '맑음' }
  if (code === 1 || code === 2) return { icon: '🌤️', text: '구름조금' }
  if (code === 3) return { icon: '☁️', text: '흐림' }
  if (code >= 45 && code <= 48) return { icon: '🌫️', text: '안개' }
  if (code >= 51 && code <= 67) return { icon: '🌧️', text: '비' }
  if (code >= 71 && code <= 77) return { icon: '❄️', text: '눈' }
  if (code >= 80 && code <= 82) return { icon: '🌦️', text: '소나기' }
  if (code >= 85 && code <= 86) return { icon: '🌨️', text: '진눈깨비' }
  if (code >= 95) return { icon: '⚡', text: '뇌우' }
  return { icon: '☀️', text: '맑음' }
}

// 발전소 좌표 기준 실시간 날씨 (Open-Meteo). 실패 시 null 반환.
export async function fetchWeather(plantId) {
  const loc = PLANT_COORDS[plantId] || PLANT_COORDS['12139']
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&current_weather=true&daily=sunrise,sunset` +
    `&hourly=temperature_2m,relativehumidity_2m,direct_normal_irradiance&timezone=Asia%2FSeoul`

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('weather fetch failed')
    const data = await res.json()
    const cur = data.current_weather
    if (!cur) return null

    const w = weatherFromWmo(cur.weathercode)
    const now = new Date()
    const hour = now.getHours()
    const humidity = data.hourly?.relativehumidity_2m?.[hour] ?? 62
    const directIrr = Math.round(data.hourly?.direct_normal_irradiance?.[hour] ?? 480)

    return {
      loc: loc.name,
      icon: w.icon,
      text: w.text,
      cond: `${w.icon} ${w.text}`,
      temp: `${cur.temperature.toFixed(1)}°C`,
      wind: `${(cur.windspeed / 3.6).toFixed(1)}m/s`,
      humidity: `${humidity}%`,
      inclinedIrr: `${Math.round(directIrr * 1.05)} W/m²`,
      horizontalIrr: `${directIrr} W/m²`,
      sunrise: data.daily?.sunrise?.[0]?.split('T')[1] ?? '05:28',
      sunset: data.daily?.sunset?.[0]?.split('T')[1] ?? '19:42',
      syncedAt: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    }
  } catch {
    return null
  }
}
