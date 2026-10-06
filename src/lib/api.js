/* ==========================================================================
   백엔드(FastAPI Smartfarm Platform) 연동 API 클라이언트
   - 개발 중에는 Vite 프록시로 '/api/v1' 호출이 http://localhost:8000 로 전달됩니다.
   - 응답 봉투: { success, message, data } → data 만 반환
   - 인증: JWT Bearer 토큰을 localStorage 에 저장/첨부
   ========================================================================== */

const BASE = import.meta.env.VITE_API_BASE || '/api/v1'
const TOKEN_KEY = 'dongyang_token'
export const AUTH_EXPIRED_EVENT = 'dongyang:auth-expired'

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
    // 보낸 토큰이 만료·무효(백엔드 JWT 기본 30분) → 토큰을 지우고 앱에 알린다(AppContext 가 로그아웃 + 재로그인 안내).
    if (res.status === 401 && auth && token) {
      setToken(null)
      globalThis.dispatchEvent?.(new Event(AUTH_EXPIRED_EVENT))
    }
    // 표준 봉투는 message, 텔레메트리·대시보드 API(FastAPI HTTPException)는 detail 로 사유를 준다
    const detail = typeof json?.detail === 'string' ? json.detail : null
    const msg = json?.message || detail || `요청 실패 (${res.status})`
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
    // 발전소 관계자(백엔드 82ce469~): 이름만 제공, 등록 전 발전소는 null
    ownerName: blankToNull(p.owner_name),
    safetyManagerName: blankToNull(p.safety_manager_name),
    contractorName: blankToNull(p.contractor_name),
    source: 'api',
  }
}

function blankToNull(v) {
  return v == null || String(v).trim() === '' ? null : String(v).trim()
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

// 측정시각 표시: 오늘이면 시:분:초, 지난 날짜면 '월/일 시:분' (하루 지난 지연 데이터를 오늘로 오인하지 않게)
function whenLabel(iso) {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return '-'
  if (d.toDateString() === new Date().toDateString()) return hhmmss(iso)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
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
  const acVoltV = [
    pickField(d, 'grid_rs_voltage_v', 'grid_rs_volt', 10),
    pickField(d, 'grid_st_voltage_v', 'grid_st_volt', 10),
    pickField(d, 'grid_tr_voltage_v', 'grid_tr_volt', 10),
  ]
  const freqHz = pickField(d, 'grid_frequency_hz', 'grid_frq', 10)
  return {
    id: i + 1,
    deviceId: d.device_id ?? null,
    externalSeq: d.external_seq ?? null,
    powerKw: pickField(d, 'grid_power_kw', 'grid_power', 1000), // AC 출력
    dcPowerKw: pickField(d, 'pv_power_kw', 'pv_power', 1000),
    dcVoltV: pickField(d, 'pv_total_voltage_v', 'pv_total_volt', 10),
    dcCurrentA: pickField(d, 'pv_total_current_a', 'pv_total_current', 10),
    acVoltV,
    acCurrentA: [
      pickField(d, 'grid_r_current_a', 'grid_r_current', 10),
      pickField(d, 'grid_s_current_a', 'grid_s_current', 10),
      pickField(d, 'grid_t_current_a', 'grid_t_current', 10),
    ],
    freqHz,
    powerFactor: toNum(d.grid_factor_value), // % 인지 0~1 계수인지 미확정 → 정규화값만, 라벨 주의
    energyKwh: energyWh == null ? null : energyWh / 1000, // 보정 누적 발전량
    receiveCount: toNum(d.receive_count), // RTU 요청에 인버터가 응답한 누적 횟수(통신 두절 판단용)
    measuredAt: d.measured_at ?? null,
    comm: whenLabel(d.measured_at),
    stale: !!d.is_stale,
    // 계통 주파수·선간전압이 모두 0 = 인버터가 계통 계측값을 못 보내는 상태(야간 정지 또는 통신 무응답).
    // 행은 1분마다 들어와도(is_stale=false) 값이 전부 0 일 수 있어 '가동'과 구분한다.
    noMeasurement: !freqHz && acVoltV.every((v) => !v),
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

  // 응답 없는(is_stale) 센서의 값은 측정값이 아니다. 백엔드(03fdf56)는 센서의 마지막 수신시각으로 stale 을 판단하고,
  // 무응답 센서 행도 RTU 가 0 으로 채워 계속 들어온다(10/1 실측: 113·114 기온·일사 0) → 응답 중인 센서 값만 쓴다.
  const fresh = normalized.filter((d) => !d.is_stale)
  const pick = (key, ...preds) => {
    for (const pred of preds) {
      const hit = fresh.find((d) => pred(d) && toNum(d[key]) != null)
      if (hit) return toNum(hit[key])
    }
    return null
  }
  const ws = isWeatherStation
  const notWs = (d) => !isWeatherStation(d)

  // 기상센서(WH-2300S)는 백엔드가 temperature_type/sun_type 0(표면·경사)으로 보내지만 실제론 외기온도이고,
  // 일사·조도·UV 는 주간에도 0 이라(10/1 실측) 쓰지 않는다 → 모듈온도·일사량은 엠알티 센서에서만.
  const airTemp = pick('temperature_c', (d) => notWs(d) && tempKind(d) === 'ambient', ws)
  const surfaceTemp = pick('temperature_c', (d) => notWs(d) && tempKind(d) === 'surface')
  const inclinedIrr = pick('irradiance_wm2', (d) => notWs(d) && irrKind(d) === 'inclined')
  const horizontalIrr = pick('irradiance_wm2', (d) => notWs(d) && irrKind(d) === 'horizontal')
  const anyIrr = pick('irradiance_wm2', notWs)
  // 습도·풍속 등 기상값은 기상센서에서만 가져온다. 온도/일사 전용(엠알티-Modbus) 센서는 이 칸을
  // 0 으로 채워 보내므로(실측 확인: 113·114 humidity=0) 쓰면 '습도 0%'로 잘못 표시된다.
  const humidity = pick('humidity_pct', ws)
  const wind = pick('wind_speed_ms', ws) // 업체 답변 대기(값 스케일 변경 가능)
  const windDir = pick('wind_direction_deg', ws)
  const rain60m = pick('rainfall_60m_mm', ws) // 최근 60분 누적(mm/h 아님)
  const lux = pick('light_lux', ws)
  const uvRaw = pick('uv_index_raw', ws) // UVI 원시값 — 일반 UV Index 로 해석 금지

  // 응답 중인 센서가 없으면 마지막 수신시각(없으면 행 시각)을 '마지막 응답'으로 표시
  const measuredAt = fresh.length
    ? latestTime(fresh.map((d) => d.measured_at))
    : latestTime(normalized.map((d) => d.last_received_at ?? d.measured_at))
  return {
    airTemp, // 외기온도
    surfaceTemp, // 표면(모듈)온도
    inclinedIrr,
    horizontalIrr,
    irradiance: horizontalIrr ?? inclinedIrr ?? anyIrr,
    humidity,
    wind,
    windDir,
    rain60m,
    lux,
    uvRaw,
    soilTemp: null, // MRT 환경센서엔 토양값 없음 → 상위에서 템플릿 폴백
    soilMoisture: null,
    stale: !fresh.length, // 응답 중인 센서가 하나도 없음
    staleSeqs: normalized.filter((d) => d.is_stale).map((d) => d.external_seq ?? '?'), // 응답 없는 센서 번호
    sensorCount: normalized.length,
    measuredAt,
    ts: whenLabel(measuredAt),
  }
}

// latest 응답(items) → 대시보드 live 형태.
// comm[i]: 인버터별 통신 상태 { noResponse, lastRecvAt } (apiPlantLive 가 receive_count 추적으로 계산, 없으면 판단 보류)
export function mapLatestToLive(invItems = [], envItems = [], comm = []) {
  const inverters = invItems.map((d, i) => {
    const iv = mapInverterTelemetry(d, i)
    const c = comm[i]
    iv.noResponse = c ? c.noResponse : null // null = 판단 불가(송수신 카운트·이력 없음)
    iv.lastRecvAt = c ? c.lastRecvAt : null
    // 응답이 끊겨도 RTU 는 행을 계속 기록하므로 행 시각은 '최종 통신'이 아니다 → 마지막 응답 시각으로 표시.
    // 마지막 응답이 조회한 이력 밖이면 시각을 추정하지 않고 '응답 없음'만 표시한다.
    if (c?.noResponse) iv.comm = c.lastRecvAt ? `${whenLabel(c.lastRecvAt)} 이후 응답 없음` : '응답 없음'
    return iv
  })
  // 통신 두절 인버터의 값은 측정값이 아니다(끊기기 직전 값을 몇 분 유지하다 0 으로 채워짐) → 출력 합계에서 제외.
  // 송수신 카운트로 판단할 수 없는 화면(발전소비교 등)에서도 값이 전부 0(계통 전압·주파수까지 0)이면 같은 상태로 본다.
  // 해당 인버터뿐이면 현재 출력은 알 수 없음(null → '-').
  const responding = inverters.filter((iv) => !iv.noResponse && !iv.noMeasurement)
  const currentPowerKw = sumOf(responding.map((iv) => iv.powerKw))
  const dcPowerKw = sumOf(responding.map((iv) => iv.dcPowerKw))
  const environment = mapEnvironment(envItems)
  const staleCount = inverters.filter((iv) => iv.stale).length
  // 전압·주파수 평균은 실제 계측 중인 인버터로만 계산한다. 끊긴(stale) 인버터나 값이 전부 0 인
  // (noMeasurement) 인버터가 섞이면 60Hz→30Hz 처럼 왜곡된다. 계측 중인 인버터가 없으면 null('-').
  // 전부 수신 지연이면(화면에 '수신 지연' 표시) 마지막 계측값이라도 보여준다.
  const measuring = inverters.filter((iv) => !iv.stale && !iv.noMeasurement && !iv.noResponse)
  const allStale = inverters.length > 0 && staleCount === inverters.length
  const basis = measuring.length ? measuring : allStale ? inverters.filter((iv) => !iv.noMeasurement) : []
  return {
    inverters,
    currentPowerKw,
    dcPowerKw,
    dcVoltV: avgOf(basis.map((iv) => iv.dcVoltV)),
    dcCurrentA: sumOf(responding.map((iv) => iv.dcCurrentA)),
    acVoltV: avgOf(basis.flatMap((iv) => iv.acVoltV)),
    acFreqHz: avgOf(basis.map((iv) => iv.freqHz)),
    // 인버터 변환효율 = AC 출력 / DC 입력 (DC 가 너무 작으면 의미 없어 계산 안 함)
    conversionEff: currentPowerKw != null && dcPowerKw >= 1 ? (currentPowerKw / dcPowerKw) * 100 : null,
    totalEnergyKwh: sumOf(inverters.map((iv) => iv.energyKwh)), // 보정 누적 발전량 합
    todayGenKwh: null, // apiPlantLive 에서 history 로 계산
    environment,
    hasData: inverters.length > 0 || !!environment,
    stale: inverters.length ? allStale : !!environment?.stale,
    staleCount,
    // 계측값 없는 인버터 = 통신 두절 또는 값이 전부 0(정지·무응답)
    noMeasurementCount: inverters.filter((iv) => !iv.stale && (iv.noMeasurement || iv.noResponse)).length,
    noResponseCount: inverters.filter((iv) => iv.noResponse).length,
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

// history 행에서 receive_count 가 마지막으로 오른(=인버터가 응답한) 시각. 카운트가 2행 미만이면 판단 불가.
// RTU 는 송수신 카운트를 매일 00:09 경 0 으로 리셋하므로(10/1 실측: 3569→0) 감소는 응답으로 보지 않는다.
// lastRecvAt=null 이면 조회한 이력 내내 응답 없음(언제부터인지는 모름).
function lastReceiveFromRows(items) {
  const rows = items
    .filter((d) => toNum(d.receive_count) != null)
    .sort((a, b) => new Date(a.measured_at) - new Date(b.measured_at))
  if (rows.length < 2) return { recvKnown: false, lastRecvAt: null }
  let lastRecvAt = null
  for (let k = 1; k < rows.length; k++) {
    if (toNum(rows[k].receive_count) > toNum(rows[k - 1].receive_count)) lastRecvAt = rows[k].measured_at
  }
  return { recvKnown: true, lastRecvAt }
}

async function todayBaselineWh(plantId, deviceId) {
  const { ymd, minutes } = kstToday()
  const key = `${deviceId}|${ymd}`
  if (baselineCache.has(key)) return baselineCache.get(key)

  const res = await apiTelemetryHistory('inverter', plantId, { deviceId, rangeMinutes: minutes, limit: 1000 })
  const items = res?.items || []
  if (!items.length) return null // 오늘 데이터가 아직 없으면 캐시하지 않고 다음 폴링 때 재시도
  const vals = items.map((d) => pickField(d, 'corrected_energy_wh', 'process_add_power')).filter((x) => x != null)

  // limit 에 걸렸으면 가장 이른 시점까지 못 받았을 수 있음(기준값이 늦게 잡혀 과소 계산 가능)
  const entry = {
    wh: vals.length ? Math.min(...vals) : null,
    partial: items.length >= 1000,
    ...lastReceiveFromRows(items), // 첫 조회 시 통신 두절 시작 시각을 알기 위한 기준(이후엔 폴링마다 갱신)
  }
  for (const k of baselineCache.keys()) if (!k.endsWith(`|${ymd}`)) baselineCache.delete(k)
  baselineCache.set(key, entry)
  return entry
}

// 인버터 통신 두절 판단. RTU 는 매분 요청(send_count)을 보내고 응답이 오면 receive_count 가 오른다.
// 응답이 끊겨도 행은 계속 기록되고(is_stale=false) 값은 끊기기 직전 값을 몇 분 유지하다 0 으로 채워지므로,
// 값이나 행 시각이 아니라 receive_count 가 멈춘 것으로 판단한다. (실서버 seq 869: 9/30 09:08 이후 3569 에서 정지)
// 매일 00:09 경 카운트 리셋(감소)은 응답이 아니다.
const commState = new Map() // deviceId → { receive, lastRecvAt }
const NO_RESPONSE_MINUTES = 3

function trackComm(d, base) {
  const recv = toNum(d.receive_count)
  if (recv == null || !d.device_id) return null
  const prev = commState.get(d.device_id)
  let lastRecvAt
  if (prev) lastRecvAt = recv > prev.receive ? d.measured_at : prev.lastRecvAt
  else if (base?.recvKnown) lastRecvAt = base.lastRecvAt
  else return null // 비교 기준(직전 폴링·오늘 이력)이 없으면 판단 보류
  commState.set(d.device_id, { receive: recv, lastRecvAt })
  const silentMin = lastRecvAt ? (new Date(d.measured_at) - new Date(lastRecvAt)) / 60000 : Infinity
  return { noResponse: silentMin > NO_RESPONSE_MINUTES, lastRecvAt }
}

// 선택 발전소(plant_id)의 실시간 현황을 대시보드용으로 반환.
export async function apiPlantLive(plantId) {
  const [inv, env] = await Promise.all([
    apiTelemetryLatest('inverter', plantId),
    // 환경센서 조회 실패는 인버터 표시를 막지 않는다
    apiTelemetryLatest('environment', plantId).catch(() => null),
  ])
  const invItems = inv?.items || []

  // 인버터별 오늘 이력 기준(금일 발전량 시작값·마지막 응답 시각) — 인버터·날짜별 하루 1번 조회
  const bases = await Promise.all(
    invItems.map(async (d) => {
      if (!d.device_id) return null
      try {
        return await todayBaselineWh(plantId, d.device_id)
      } catch {
        return null
      }
    })
  )
  const live = mapLatestToLive(invItems, env?.items || [], invItems.map((d, i) => trackComm(d, bases[i])))

  const today = live.inverters.map((iv, i) => {
    const base = bases[i]
    if (iv.energyKwh == null || base?.wh == null) return null
    // 통신 두절 인버터: 오늘 응답이 한 번도 없었으면 발전량을 알 수 없다(누적값이 멈춰 0 으로 계산되지만 측정값이 아님).
    // 오늘 응답이 있었으면 끊기기 전까지 받은 만큼만(하한값).
    if (iv.noResponse && !iv.lastRecvAt) return null
    return { kwh: Math.max(0, iv.energyKwh - base.wh / 1000), partial: base.partial || !!iv.noResponse }
  })
  today.forEach((t, i) => {
    live.inverters[i].todayKwh = t ? t.kwh : null
  })
  live.todayGenKwh = sumOf(today.map((t) => (t ? t.kwh : null)))
  live.todayGenPartial = today.some((t) => t?.partial) || today.some((t) => t == null)
  // 두절 인버터가 마지막으로 응답한 시각 중 가장 이른 것 → '금일 발전량 (09:08까지)' 표기용
  live.todayGenUntilAt =
    live.inverters
      .filter((iv) => iv.noResponse && iv.lastRecvAt)
      .map((iv) => iv.lastRecvAt)
      .sort((a, b) => new Date(a) - new Date(b))[0] ?? null
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

/* ----------------------------------------------------------------- Alerts */
// MRT 오류 이벤트 기반 알람 (telemetry:read 권한). 봉투 언랩: { items: [AlertResponse], count }
//   AlertResponse: alert_id, device_id, device_name, external_seq, severity(info|warning|critical),
//   trigger_type(communication_lost|communication_restored|mrt_event), message, triggered_at, resolved_at, is_active

export function apiAlertsRecent(plantId, { limit = 500, skip = 0 } = {}) {
  const q = new URLSearchParams({ plant_id: plantId, limit: String(limit), skip: String(skip) })
  return request(`/alerts/recent?${q}`)
}

export function apiAlertsActive(plantId, { limit = 500 } = {}) {
  const q = new URLSearchParams({ plant_id: plantId, limit: String(limit) })
  return request(`/alerts/active?${q}`)
}

// 최근 이력 + 현재 미해결을 합쳐 반환 — 오래된 미해결 알람(예: 며칠 전 강우 경보)이
// 최근 이력 500건 밖으로 밀려도 빠지지 않게 한다.
export async function apiPlantAlerts(plantId) {
  const [recent, active] = await Promise.all([apiAlertsRecent(plantId), apiAlertsActive(plantId)])
  const byId = new Map()
  for (const a of [...(recent?.items || []), ...(active?.items || [])]) byId.set(a.alert_id, a)
  return [...byId.values()]
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
