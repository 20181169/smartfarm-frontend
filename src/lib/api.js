/* ==========================================================================
   백엔드(FastAPI Smartfarm Platform) 연동 API 클라이언트
   - 개발 중에는 Vite 프록시로 '/api/v1' 호출이 http://localhost:8000 로 전달됩니다.
   - 응답 봉투: { success, message, data } → data 만 반환
   - 인증: JWT Bearer 토큰을 localStorage 에 저장/첨부
   ========================================================================== */

const BASE = import.meta.env.VITE_API_BASE || '/api/v1'
const TOKEN_KEY = 'dongyang_token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (e) {
    // 네트워크 오류 (백엔드 미가동 등) → 상태 0 으로 구분
    throw new ApiError('백엔드에 연결할 수 없습니다.', 0, 'NETWORK')
  }

  let json = null
  try {
    json = await res.json()
  } catch {
    /* 본문 없음 */
  }

  if (!res.ok) {
    const msg = json?.message || `요청 실패 (${res.status})`
    throw new ApiError(msg, res.status, json?.error_code)
  }

  // 성공 봉투 { success, message, data } 에서 data 만 반환.
  return json && 'data' in json ? json.data : json
}

/* ------------------------------------------------------------------ Auth */

export async function apiLogin(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  })
  if (data?.access_token) setToken(data.access_token)
  return data // { access_token, token_type, expires_in }
}

export function apiGetMe() {
  return request('/auth/me') // { user_id, email, name, role_id, status, ... }
}

/* ---------------------------------------------------------------- Plants */

export async function apiGetPlants({ skip = 0, limit = 100 } = {}) {
  const data = await request(`/plants?skip=${skip}&limit=${limit}`)
  return data // { items: [...], pagination: {...} }
}

// 백엔드 발전소(PlantResponse) → 프론트 표시용 형태로 매핑.
// 백엔드에 없는 값(발전량/수익/센서 등)은 undefined 이며 UI에서 폴백 처리.
export function mapPlant(p) {
  return {
    id: p.plant_id,
    name: p.name,
    shortName: p.name,
    capacityKw: p.capacity_kw ?? null,
    status: p.status, // ACTIVE | INACTIVE | MAINTENANCE
    address: p.address ?? null,
    location: p.address ?? null,
    lat: p.lat,
    lng: p.lng,
    areaM2: p.area_m2 ?? null,
    regionId: p.region_id,
    source: 'api',
  }
}

/* -------------------------------------------------------------- Telemetry */

export function apiRecentInverterTelemetry(siteId, { rangeMinutes = 60, limit = 100 } = {}) {
  return request(
    `/telemetry/inverter/recent?site_id=${encodeURIComponent(siteId)}&range_minutes=${rangeMinutes}&limit=${limit}`
  )
}

export function apiRecentEnvironmentTelemetry(siteId, { rangeMinutes = 60, limit = 100 } = {}) {
  return request(
    `/telemetry/environment/recent?site_id=${encodeURIComponent(siteId)}&range_minutes=${rangeMinutes}&limit=${limit}`
  )
}

const r2 = (n) => Math.round(Number(n) * 100) / 100
function hhmmss(iso) {
  try {
    const d = new Date(iso)
    const p = (x) => String(x).padStart(2, '0')
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  } catch {
    return '-'
  }
}

// 선택 발전소(site_id=plant_id)의 실시간 텔레메트리를 대시보드용으로 정규화.
// 인버터: 최신 1건/대 → 합산 출력·일발전량, 환경: 최신 1건.
export async function apiPlantLive(siteId) {
  const [inv, env] = await Promise.all([
    apiRecentInverterTelemetry(siteId, { rangeMinutes: 180, limit: 30 }),
    apiRecentEnvironmentTelemetry(siteId, { rangeMinutes: 180, limit: 5 }),
  ])

  // inverter_id별 최신값 (records는 그룹 내 시간 내림차순)
  const seen = new Map()
  for (const rec of inv?.records || []) {
    if (!seen.has(rec.inverter_id)) seen.set(rec.inverter_id, rec)
  }
  const inverters = [...seen.values()]
    .sort((a, b) => Number(a.inverter_id) - Number(b.inverter_id))
    .map((rec) => ({
      id: Number(rec.inverter_id),
      powerKw: r2(rec.active_power_kw),
      dailyKwh: Math.round(rec.daily_energy_kwh ?? 0),
      voltage: r2(rec.voltage_v),
      current: r2(rec.current_a),
      freq: r2(rec.frequency_hz ?? 60),
      pf: rec.power_factor ?? null,
      comm: hhmmss(rec.timestamp),
    }))

  const currentPowerKw = r2(inverters.reduce((s, i) => s + i.powerKw, 0))
  const todayGenKwh = Math.round(inverters.reduce((s, i) => s + i.dailyKwh, 0))
  const acVolt = inverters.length
    ? r2(inverters.reduce((s, i) => s + i.voltage, 0) / inverters.length)
    : null

  const e = env?.records?.[0] || null
  const environment = e
    ? {
        airTemp: e.air_temperature_c,
        humidity: e.air_humidity_pct,
        soilTemp: e.soil_temperature_c,
        soilMoisture: e.soil_moisture_pct,
        irradiance: e.solar_irradiance_wm2,
        wind: e.wind_speed_ms,
        ts: hhmmss(e.timestamp),
      }
    : null

  return {
    inverters,
    currentPowerKw,
    todayGenKwh,
    acVolt,
    acFreq: inverters[0]?.freq ?? 60,
    environment,
    hasData: inverters.length > 0 || !!environment,
    updatedAt: hhmmss(new Date().toISOString()),
  }
}
