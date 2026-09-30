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
// MRT 정규화 텔레메트리 API — 「MRT 정규화 API 프론트엔드 전달자료 v1.1」 기준.
//   GET /telemetry/{inverter|environment}/latest  ?plant_id&stale_minutes            장비별 최신값
//   GET /telemetry/{inverter|environment}/history ?plant_id&device_id&range_minutes&limit
// 응답(봉투 없음): { measurement, plant_id, items: [...], total }
// 화면에는 정규화 필드(_kw/_v/_a/_hz/_c/_wm2 …)만 쓴다. 원본 필드(grid_power 등)는
// 단위가 달라서(W, ×10 저장) 그대로 표시하면 1000배·10배로 틀린다.

export function apiTelemetryLatest(kind, plantId, { staleMinutes = 5 } = {}) {
  const q = new URLSearchParams({ plant_id: plantId, stale_minutes: String(staleMinutes) })
  return request(`/telemetry/${kind}/latest?${q}`)
}

export function apiTelemetryHistory(kind, plantId, { deviceId, externalSeq, rangeMinutes = 60, limit = 100 } = {}) {
  const q = new URLSearchParams({ plant_id: plantId, range_minutes: String(rangeMinutes), limit: String(limit) })
  if (deviceId) q.set('device_id', deviceId)
  if (externalSeq != null) q.set('external_seq', String(externalSeq))
  return request(`/telemetry/${kind}/history?${q}`)
}

function hhmmss(iso) {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return '-'
  const p = (x) => String(x).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const toNum = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const sumOf = (vals) => {
  const xs = vals.filter((v) => v != null)
  return xs.length ? xs.reduce((s, v) => s + v, 0) : null
}
const avgOf = (vals) => {
  const xs = vals.filter((v) => v != null)
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null
}
const latestTime = (times) =>
  times.filter(Boolean).reduce((a, b) => (a == null || new Date(b) > new Date(a) ? b : a), null)

// 정규화 필드 우선. 정규화 이전 백엔드(원본 필드만 반환)면 명세에서 '확정'된
// 변환 규칙(W÷1000, ×10 저장÷10)으로만 보정한다. 온도처럼 장비 프로토콜마다
// 다른 값은 프론트에서 추정하지 않고 백엔드 정규화에만 맡긴다.
function pickField(d, normKey, rawKey, divisor = 1) {
  if (normKey in d) return toNum(d[normKey])
  if (rawKey && rawKey in d) {
    const n = toNum(d[rawKey])
    return n == null ? null : n / divisor
  }
  return null
}

// 인버터 1건(latest 또는 history 행) → 화면용 값.
export function mapInverterTelemetry(d, i = 0) {
  const energyWh = pickField(d, 'corrected_energy_wh', 'process_add_power')
  return {
    id: i + 1,
    deviceId: d.device_id ?? null,
    externalSeq: d.external_seq ?? null,
    powerKw: pickField(d, 'grid_power_kw', 'grid_power', 1000), // AC 출력
    dcPowerKw: pickField(d, 'pv_power_kw', 'pv_power', 1000),
    dcVoltV: pickField(d, 'pv_total_voltage_v', 'pv_total_volt', 10),
    dcCurrentA: pickField(d, 'pv_total_current_a', 'pv_total_current', 10),
    acVoltV: [
      pickField(d, 'grid_rs_voltage_v', 'grid_rs_volt', 10),
      pickField(d, 'grid_st_voltage_v', 'grid_st_volt', 10),
      pickField(d, 'grid_tr_voltage_v', 'grid_tr_volt', 10),
    ],
    acCurrentA: [
      pickField(d, 'grid_r_current_a', 'grid_r_current', 10),
      pickField(d, 'grid_s_current_a', 'grid_s_current', 10),
      pickField(d, 'grid_t_current_a', 'grid_t_current', 10),
    ],
    freqHz: pickField(d, 'grid_frequency_hz', 'grid_frq', 10),
    powerFactor: toNum(d.grid_factor_value), // % 인지 0~1 계수인지 미확정 → 정규화값만, 라벨 주의
    energyKwh: energyWh == null ? null : energyWh / 1000, // 보정 누적 발전량
    measuredAt: d.measured_at ?? null,
    comm: hhmmss(d.measured_at),
    stale: !!d.is_stale,
  }
}

// 환경센서 종류. 백엔드가 이름('surface'/'ambient', 'inclined'/'horizontal')으로 주고,
// 없으면 normalization_metadata 의 원본 코드(0/1)로 판단한다.
//   temperature_type 0=표면온도, 1=외기온도 / sun_type 0=경사일사량, 1=수평일사량
function tempKind(d) {
  if (d.temperature_type) return d.temperature_type
  const m = d.normalization_metadata?.temperature_type
  return m === 0 ? 'surface' : m === 1 ? 'ambient' : null
}
function irrKind(d) {
  if (d.irradiance_type) return d.irradiance_type
  const m = d.normalization_metadata?.sun_type
  return m === 0 ? 'inclined' : m === 1 ? 'horizontal' : null
}
// 기상센서(WH-2300S 등): 표면/외기·경사/수평 구분이 없는 장비 → 습도·풍속 등 기상값의 우선 출처.
const isWeatherStation = (d) =>
  d.normalization_metadata?.external_protocol === 'WH-2300S' || (tempKind(d) == null && irrKind(d) == null)

function mapEnvironment(items) {
  // 정규화 이전 백엔드면 온도 스케일·센서 종류를 알 수 없으므로 쓰지 않는다(상위에서 Open-Meteo 폴백).
  const normalized = items.filter((d) => 'temperature_c' in d || 'irradiance_wm2' in d)
  if (!normalized.length) return null

  // 수신 지연(is_stale) 안 된 장비 값을 우선 사용
  const ordered = [...normalized].sort((a, b) => Number(!!a.is_stale) - Number(!!b.is_stale))
  const pick = (key, ...preds) => {
    for (const pred of preds) {
      const hit = ordered.find((d) => pred(d) && toNum(d[key]) != null)
      if (hit) return { value: toNum(hit[key]), stale: !!hit.is_stale }
    }
    return null
  }
  const any = () => true

  const airTemp = pick('temperature_c', (d) => tempKind(d) === 'ambient', isWeatherStation)
  const surfaceTemp = pick('temperature_c', (d) => tempKind(d) === 'surface')
  const inclinedIrr = pick('irradiance_wm2', (d) => irrKind(d) === 'inclined')
  const horizontalIrr = pick('irradiance_wm2', (d) => irrKind(d) === 'horizontal')
  const anyIrr = pick('irradiance_wm2', any)
  const humidity = pick('humidity_pct', isWeatherStation, any)
  const wind = pick('wind_speed_ms', isWeatherStation, any) // 업체 답변 대기(값 스케일 변경 가능)
  const windDir = pick('wind_direction_deg', isWeatherStation, any)
  const rain60m = pick('rainfall_60m_mm', isWeatherStation, any) // 최근 60분 누적(mm/h 아님)
  const lux = pick('light_lux', isWeatherStation, any)
  const uvRaw = pick('uv_index_raw', isWeatherStation, any) // UVI 원시값 — 일반 UV Index 로 해석 금지

  const used = [airTemp, surfaceTemp, inclinedIrr, horizontalIrr, anyIrr, humidity, wind].filter(Boolean)
  if (!used.length) return null

  const v = (x) => (x ? x.value : null)
  const measuredAt = latestTime(normalized.map((d) => d.measured_at))
  return {
    airTemp: v(airTemp), // 외기온도
    surfaceTemp: v(surfaceTemp), // 표면(모듈)온도
    inclinedIrr: v(inclinedIrr),
    horizontalIrr: v(horizontalIrr),
    irradiance: v(horizontalIrr) ?? v(inclinedIrr) ?? v(anyIrr),
    humidity: v(humidity),
    wind: v(wind),
    windDir: v(windDir),
    rain60m: v(rain60m),
    lux: v(lux),
    uvRaw: v(uvRaw),
    soilTemp: null, // MRT 환경센서엔 토양값 없음 → 상위에서 템플릿 폴백
    soilMoisture: null,
    stale: used.every((x) => x.stale),
    measuredAt,
    ts: hhmmss(measuredAt),
  }
}

// latest 응답(items) → 대시보드 live 형태.
export function mapLatestToLive(invItems = [], envItems = []) {
  const inverters = invItems.map(mapInverterTelemetry)
  const currentPowerKw = sumOf(inverters.map((iv) => iv.powerKw))
  const dcPowerKw = sumOf(inverters.map((iv) => iv.dcPowerKw))
  const environment = mapEnvironment(envItems)
  const staleCount = inverters.filter((iv) => iv.stale).length
  // 전압·주파수 평균은 정상 수신 중인 인버터로만 계산(끊긴 인버터의 0 값이 섞이면 60Hz→40Hz 처럼 왜곡).
  // 전부 지연이면 마지막 값이라도 보여주기 위해 전체로 계산한다.
  const fresh = inverters.filter((iv) => !iv.stale)
  const basis = fresh.length ? fresh : inverters
  return {
    inverters,
    currentPowerKw,
    dcPowerKw,
    dcVoltV: avgOf(basis.map((iv) => iv.dcVoltV)),
    dcCurrentA: sumOf(inverters.map((iv) => iv.dcCurrentA)),
    acVoltV: avgOf(basis.flatMap((iv) => iv.acVoltV)),
    acFreqHz: avgOf(basis.map((iv) => iv.freqHz)),
    // 인버터 변환효율 = AC 출력 / DC 입력 (DC 가 너무 작으면 의미 없어 계산 안 함)
    conversionEff: currentPowerKw != null && dcPowerKw >= 1 ? (currentPowerKw / dcPowerKw) * 100 : null,
    totalEnergyKwh: sumOf(inverters.map((iv) => iv.energyKwh)), // 보정 누적 발전량 합
    todayGenKwh: null, // apiPlantLive 에서 history 로 계산
    environment,
    hasData: currentPowerKw != null || !!environment,
    stale: inverters.length ? staleCount === inverters.length : !!environment?.stale,
    staleCount,
    lastUpdatedAt: latestTime([...invItems, ...envItems].map((d) => d.measured_at)),
    updatedAt: hhmmss(new Date().toISOString()),
  }
}

// 금일 발전량 = Σ 인버터별 (현재 보정 누적 − 오늘 0시(KST) 이후 첫 보정 누적).
// corrected_energy_wh 는 증가만 하는 누적값이라 오늘 구간의 최소값 = 하루 시작값.
// 시작값은 인버터별로 하루 1번만 history 를 조회해 캐시한다.
// ※ corrected_energy_wh 를 공식 발전량으로 쓸지는 업무 기준 확정 필요(명세 v1.1).
const baselineCache = new Map() // `${deviceId}|${yyyy-mm-dd}` → { wh, partial }

function kstToday() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000) // KST 벽시계를 UTC 필드로 읽기 위한 이동
  return {
    ymd: kst.toISOString().slice(0, 10),
    minutes: Math.max(1, kst.getUTCHours() * 60 + kst.getUTCMinutes()),
  }
}

async function todayBaselineWh(plantId, deviceId) {
  const { ymd, minutes } = kstToday()
  const key = `${deviceId}|${ymd}`
  if (baselineCache.has(key)) return baselineCache.get(key)

  const res = await apiTelemetryHistory('inverter', plantId, { deviceId, rangeMinutes: minutes, limit: 1000 })
  const items = res?.items || []
  const vals = items.map((d) => pickField(d, 'corrected_energy_wh', 'process_add_power')).filter((x) => x != null)
  if (!vals.length) return null // 오늘 데이터가 아직 없으면 캐시하지 않고 다음 폴링 때 재시도

  // limit 에 걸렸으면 가장 이른 시점까지 못 받았을 수 있음(기준값이 늦게 잡혀 과소 계산 가능)
  const entry = { wh: Math.min(...vals), partial: items.length >= 1000 }
  for (const k of baselineCache.keys()) if (!k.endsWith(`|${ymd}`)) baselineCache.delete(k)
  baselineCache.set(key, entry)
  return entry
}

// 선택 발전소(plant_id)의 실시간 현황을 대시보드용으로 반환.
export async function apiPlantLive(plantId) {
  const [inv, env] = await Promise.all([
    apiTelemetryLatest('inverter', plantId),
    // 환경센서 조회 실패는 인버터 표시를 막지 않는다
    apiTelemetryLatest('environment', plantId).catch(() => null),
  ])
  const live = mapLatestToLive(inv?.items || [], env?.items || [])

  const today = await Promise.all(
    live.inverters.map(async (iv) => {
      if (iv.energyKwh == null || !iv.deviceId) return null
      try {
        const base = await todayBaselineWh(plantId, iv.deviceId)
        return base ? { kwh: Math.max(0, iv.energyKwh - base.wh / 1000), partial: base.partial } : null
      } catch {
        return null
      }
    })
  )
  today.forEach((t, i) => {
    live.inverters[i].todayKwh = t ? t.kwh : null
  })
  live.todayGenKwh = sumOf(today.map((t) => (t ? t.kwh : null)))
  live.todayGenPartial = today.some((t) => t?.partial)
  return live
}

/* ------------------------------------------------------------- Dashboard */

// 발전소 대시보드 종합 현황 (plant_id 기준, 인증 필요).
// 응답(봉투 없음): { plant, devices, inverters[], environment_sensors[], data_status, collector_health }
// ※ inverters/environment_sensors 의 raw_values 는 스케일 변환 전 원본(W, ×10)이라 계측값 표시에 쓰지 않는다.
//   계측값은 위의 정규화 텔레메트리 API 를 쓰고, 이 엔드포인트는 data_status·collector_health·장비 수 용도로만 쓴다.
export function apiDashboardOverview(plantId, { staleMinutes = 10 } = {}) {
  return request(
    `/dashboard/plants/${encodeURIComponent(plantId)}/overview?stale_minutes=${staleMinutes}`
  )
}

/* ---------------------------------------------------------------- Devices */

// 발전소 장비 인벤토리 조회. plantId 생략 시 전체.
// 응답(봉투 언랩): { items: [{ device_id, name, device_type, model, serial_number, install_date, status, ... }], total }
export function apiGetDevices(plantId) {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : ''
  return request(`/devices${q}`)
}

// 전체 발전소 + 각 발전소 overview 를 함께 조회 (발전소비교·에러정보 화면용).
// withLive=true 면 인버터 최신값(정규화)으로 현재출력 등을 담은 live 도 채운다.
// 조회가 실패한 발전소는 overview/live=null 로 채워 목록은 유지한다.
export async function apiPlantsWithOverview({ withLive = false } = {}) {
  const data = await apiGetPlants({ limit: 100 })
  const items = data?.items || []
  return Promise.all(
    items.map(async (plant) => {
      const [overview, inv] = await Promise.all([
        apiDashboardOverview(plant.plant_id).catch(() => null),
        withLive ? apiTelemetryLatest('inverter', plant.plant_id).catch(() => null) : null,
      ])
      return { plant, overview, live: inv ? mapLatestToLive(inv.items || [], []) : null }
    })
  )
}
