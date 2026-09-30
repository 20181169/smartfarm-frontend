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

export function apiVisionCameras(plantId, signal) {
  return request(`/vision/cameras?plant_id=${encodeURIComponent(plantId)}`, { signal })
}

export async function apiDetectTractor({ plantId, cameraId, blob, threshold, signal }) {
  const query = new URLSearchParams({ plant_id: plantId, threshold: String(threshold) })
  const path = cameraId ? `/vision/cameras/${encodeURIComponent(cameraId)}/detect` : '/vision/detect'
  const body = blob ? new FormData() : undefined
  if (body) body.append('file', blob, 'frame.jpg')
  const response = await fetch(`${BASE}${path}?${query}`, {
    method: 'POST', headers: { Authorization: `Bearer ${getToken() || ''}` }, body, signal,
  })
  const json = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(json?.message || json?.detail || `분석 실패 (${response.status})`, response.status)
  return json?.data ?? json
}

/* ----------------------------------------------------------------- Roles */

// 역할 목록(계층형). 공개 엔드포인트. role_id → { role_code, role_name, level } 해석용.
// level: 10 SYS_ADMIN … 60 INSPECTOR(감독 상한) … 70 PLANT_OPERATOR, 80 VIEWER
export function apiGetRoles() {
  return request('/roles', { auth: false }) // { items: [{ role_id, role_code, role_name, level, ... }] }
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

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/* ------------------------------------------------------------- Dashboard */

// 발전소 대시보드 종합 현황 (plant_id 기준, 인증 필요).
// 응답(봉투 없음): { plant, devices, inverters[], environment_sensors[], data_status, collector_health }
// ※ 예전의 /telemetry/.../recent?site_id= 는 InfluxDB의 site_id(예: site_001) 규약이라
//   발전소 UUID로는 빈값이 떨어진다. plant_id 기준인 이 엔드포인트가 올바른 경로다.
export function apiDashboardOverview(plantId, { staleMinutes = 10 } = {}) {
  return request(
    `/dashboard/plants/${encodeURIComponent(plantId)}/overview?stale_minutes=${staleMinutes}`
  )
}

// overview 응답 → 기존 live(텔레메트리) 형태로 정규화.
// 백엔드가 주는 계측값(MRT raw_values: grid_* / pv_* 등)만 실데이터로 싣고,
// 제공하지 않는 값(일발전량 등)은 null 로 두어 상위에서 목값으로 폴백한다.
export function mapOverviewToLive(ov) {
  const invRaw = Array.isArray(ov?.inverters) ? ov.inverters : []
  const inverters = invRaw.map((d, i) => {
    const rv = d.raw_values || {}
    const vAvg = num(rv.grid_rs_voltage) || num(rv.grid_st_voltage) || num(rv.grid_tr_voltage)
    const cAvg = num(rv.grid_r_current) || num(rv.grid_s_current) || num(rv.grid_t_current)
    return {
      id: i + 1,
      deviceId: d.device_id,
      powerKw: r2(num(rv.grid_power)), // 계통(AC) 유효전력
      dcPowerKw: r2(num(rv.pv_power)), // DC 입력전력
      dailyKwh: 0, // overview 미제공
      voltage: r2(vAvg),
      current: r2(cAvg),
      freq: r2(num(rv.grid_frequency) || 60),
      pf: rv.grid_power_factor ?? null,
      comm: hhmmss(d.measured_at),
      stale: !!d.is_stale,
    }
  })

  const currentPowerKw = r2(inverters.reduce((s, iv) => s + iv.powerKw, 0))
  const acVolt = inverters.length
    ? r2(inverters.reduce((s, iv) => s + iv.voltage, 0) / inverters.length)
    : null

  // 환경센서: 지연(stale)이 아니고 유효값이 있을 때만 사용(죽은 센서의 0값 노출 방지).
  const envRaw = (Array.isArray(ov?.environment_sensors) ? ov.environment_sensors : [])[0] || null
  let environment = null
  if (envRaw && !envRaw.is_stale) {
    const r = envRaw.raw_values || {}
    if ([r.temperature, r.humidity, r.solar].some((x) => num(x) > 0)) {
      environment = {
        airTemp: num(r.temperature),
        humidity: num(r.humidity),
        soilTemp: null, // 기상형 센서 → 토양값 없음
        soilMoisture: null,
        irradiance: num(r.solar),
        wind: num(envRaw.wind_speed_ms ?? r.wind_speed),
        ts: hhmmss(envRaw.measured_at),
      }
    }
  }

  const ds = ov?.data_status || {}
  return {
    inverters,
    currentPowerKw, // 실측(오프라인이면 0)
    todayGenKwh: null, // overview 미제공 → 상위에서 목값 폴백
    acVolt,
    acFreq: inverters[0]?.freq ?? 60,
    environment,
    hasData: inverters.length > 0 || !!environment,
    stale: !!ds.is_stale,
    dataStatus: ds.status || null, // OK | STALE | ...
    lastUpdatedAt: ds.last_updated_at || null,
    collectorStatus: ov?.collector_health?.overall_status || null,
    updatedAt: hhmmss(new Date().toISOString()),
  }
}

// 선택 발전소(plant_id)의 실시간 현황을 대시보드용으로 반환.
export async function apiPlantLive(plantId) {
  const ov = await apiDashboardOverview(plantId)
  return mapOverviewToLive(ov)
}

/* ---------------------------------------------------------------- Devices */

// 발전소 장비 인벤토리 조회. plantId 생략 시 전체.
// 응답(봉투 언랩): { items: [{ device_id, name, device_type, model, serial_number, install_date, status, ... }], total }
export function apiGetDevices(plantId) {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : ''
  return request(`/devices${q}`)
}

// 전체 발전소 + 각 발전소 overview 를 함께 조회 (발전소비교·에러정보 화면용).
// overview 조회가 실패한 발전소는 overview/live=null 로 채워 목록은 유지한다.
export async function apiPlantsWithOverview() {
  const data = await apiGetPlants({ limit: 100 })
  const items = data?.items || []
  return Promise.all(
    items.map(async (plant) => {
      try {
        const overview = await apiDashboardOverview(plant.plant_id)
        return { plant, overview, live: mapOverviewToLive(overview) }
      } catch {
        return { plant, overview: null, live: null }
      }
    })
  )
}
