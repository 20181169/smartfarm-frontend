import { useState, useEffect, useCallback, useMemo } from 'react'
import { PLANTS, DEFAULT_PLANT_ID, getPlant } from '../data/plants'
import { fetchWeather } from '../lib/weather'
import { smpWon, recWon } from '../lib/format'
import { RPS_PRICE } from '../data/market'
import { hasKpxKey, loadMarket, peekMarket, smpNow, recSummary } from '../lib/kpx'
import {
  apiLogin, apiGetMe, apiGetPlants, apiPlantLive, apiGetRoles, apiGetDevices, mapPlant, setToken, getToken,
  AUTH_EXPIRED_EVENT,
} from '../lib/api'
import { menuRoleOf, isSupervisorRole } from '../lib/roles'
import { AppContext } from './useApp'

// 인버터 모델 표기: 장비 목록(관리자 등 device:read 권한)이 있으면 실제 모델, 없으면 실시간 수신 대수만
function inverterModelLabel(devices, liveCount) {
  const models = (devices || []).filter((d) => d.device_type === 'inverter').map((d) => d.model || '모델 미등록')
  if (models.length) return `${[...new Set(models)].join(', ')} (${models.length}대)`
  return liveCount ? `${liveCount}대 (모델 정보 없음)` : null
}

// role_id → 역할 정보(role_code/role_name/level) 해석. 실패해도 로그인은 유지.
async function resolveRole(me) {
  if (!me?.role_id) return {}
  try {
    const data = await apiGetRoles()
    const role = (data?.items || []).find((r) => r.role_id === me.role_id)
    if (role) return { roleCode: role.role_code, roleName: role.role_name, level: role.level }
  } catch {
    /* 역할 조회 실패 시 무시 */
  }
  return {}
}

const MOCK_LIST = Object.values(PLANTS)
// 백엔드 실발전소를 대시보드에 띄울 때 쓰는 표시용 템플릿.
// 시세/이력/작물 등 백엔드 미제공 필드는 데모값으로 스캐폴딩하고,
// 식별정보·실시간 계측만 실데이터로 덮어쓴다.
const TEMPLATE = PLANTS[DEFAULT_PLANT_ID]

// mapPlant 결과(백엔드 발전소) → 대시보드 표시용 plant 객체.
function toDisplayPlant(bp) {
  const capacityKw = bp.capacityKw ?? TEMPLATE.capacityKw
  return {
    ...TEMPLATE,
    id: bp.id,
    name: bp.name,
    shortName: bp.name,
    capacityKw,
    // 목표 발전량은 템플릿(200kW)의 용량 대비 목표시간을 이 발전소 용량으로 환산
    targetGenKwh: Math.round((TEMPLATE.targetGenKwh / TEMPLATE.capacityKw) * capacityKw),
    // 사업주·안전관리자·시공사는 백엔드 발전소 정보(미등록이면 null → '-'). 템플릿(다른 발전소) 정보는 쓰지 않는다.
    // 인버터 모델은 장비 목록(/devices)에서 따로 채운다.
    owner: bp.ownerName ?? null,
    manager: bp.safetyManagerName ?? null,
    contractor: bp.contractorName ?? null,
    inverterModel: null,
    status: bp.status || 'ACTIVE',
    address: bp.address ?? null,
    location: bp.address ?? null,
    lat: bp.lat ?? null,
    lng: bp.lng ?? null,
    source: 'api',
    _backend: true,
  }
}

export function AppProvider({ children }) {
  const [plantId, setPlantId] = useState(DEFAULT_PLANT_ID)
  const [user, setUser] = useState(null)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('dongyang_theme') || 'light'
    } catch {
      return 'light'
    }
  })
  const [meteo, setMeteo] = useState(null) // Open-Meteo 실시간 날씨(폴백용)

  // 백엔드 연동 상태
  const [connected, setConnected] = useState(false)
  const [backendPlants, setBackendPlants] = useState([]) // 실발전소 목록(mapPlant 적용)
  const [live, setLive] = useState(null) // 선택 발전소 실시간 현황
  const [liveState, setLiveState] = useState('idle') // idle | loading | ok | empty(계측 데이터 없음) | error
  const [devices, setDevices] = useState(null) // 선택 발전소 장비 목록(조회 권한 없으면 null — 뷰어 403)

  // 선택 가능한 발전소: 연결되면 백엔드 실발전소, 아니면 목(데모).
  const backendDisplay = useMemo(() => backendPlants.map(toDisplayPlant), [backendPlants])
  const plantList = useMemo(
    () => (connected && backendDisplay.length ? backendDisplay : MOCK_LIST),
    [connected, backendDisplay]
  )
  // id → plant 사전 (목 + 백엔드 모두 포함 → 어느 쪽이든 선택 가능)
  const catalog = useMemo(() => {
    const m = {}
    for (const p of MOCK_LIST) m[p.id] = p
    for (const p of backendDisplay) m[p.id] = p
    return m
  }, [backendDisplay])

  const basePlant = useMemo(() => catalog[plantId] || getPlant(plantId), [catalog, plantId])
  const isBackendPlant = !!basePlant?._backend

  // 전력거래소 SMP·REC 시세(공공데이터포털 직접 호출). 30분마다 다시 읽고(응답은 kpx.js 가 캐시),
  // 지금 시각의 SMP(시간대별 값)가 바뀌므로 요약은 5분마다 다시 계산한다.
  // 저장해 둔 시세가 있으면 그 값으로 시작(새로고침 직후 '불러오는 중'이 보이지 않게), 없으면 불러오는 중.
  const [marketRaw, setMarketRaw] = useState(() => peekMarket() ?? { status: hasKpxKey() ? 'loading' : 'nokey' })
  const [marketTick, setMarketTick] = useState(0)
  useEffect(() => {
    if (!hasKpxKey()) return undefined
    let alive = true
    const load = async () => {
      const m = await loadMarket()
      if (alive) setMarketRaw(m)
    }
    load()
    const t1 = setInterval(load, 30 * 60 * 1000)
    const t2 = setInterval(() => setMarketTick((x) => x + 1), 5 * 60 * 1000)
    return () => {
      alive = false
      clearInterval(t1)
      clearInterval(t2)
    }
  }, [])
  const market = useMemo(() => {
    const smp = smpNow(marketRaw.smp)
    const rec = recSummary(marketRaw.rec)
    return {
      status: marketRaw.status, // nokey | loading | ok
      loading: marketRaw.status === 'loading', // 아직 시세를 못 받음 → 화면은 데모 숫자 대신 '-'
      error: marketRaw.error || null,
      smp, // 오늘 시간별 SMP 요약(없으면 null)
      rec, // 최근 REC 거래일 요약(없으면 null)
      // 수익 계산 단가: SMP = 최근 게시일 육지 평균, REC = 최근 거래일 종가. 없는 쪽은 데모 단가.
      price: { smp: smp?.avg ?? RPS_PRICE.smp, rec: rec?.price ?? RPS_PRICE.rec, weight: RPS_PRICE.weight },
    }
    // marketTick: 시간이 지나면 smpNow 가 고르는 '현재 시간대'가 바뀐다
  }, [marketRaw, marketTick])

  // 테마 적용
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('dongyang_theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  // 백엔드 실발전소 목록 조회
  const refreshBackend = useCallback(async () => {
    try {
      const data = await apiGetPlants()
      const items = data?.items || []
      setBackendPlants(items.map(mapPlant))
      setConnected(items.length > 0)
      // 목 발전소를 보고 있었다면 첫 실발전소로 자동 전환(수동 선택은 유지).
      if (items.length) {
        const firstId = items[0].plant_id
        setPlantId((prev) => (PLANTS[prev] ? firstId : prev))
      }
    } catch {
      setConnected(false)
      setBackendPlants([])
    }
  }, [])

  // 저장된 JWT 로 세션 복원 + 백엔드 데이터 로드
  useEffect(() => {
    if (!getToken()) return
    let alive = true
    apiGetMe()
      .then(async (me) => {
        if (!alive) return
        if (me) {
          const roleInfo = await resolveRole(me)
          if (alive) setUser({ name: me.name, email: me.email, role: '관리자', source: 'api', ...roleInfo })
        }
        refreshBackend()
      })
      .catch(() => setToken(null))
    return () => {
      alive = false
    }
  }, [refreshBackend])

  // 선택 발전소 실시간 현황 (연결 + 백엔드 발전소일 때만, 30초 주기)
  useEffect(() => {
    if (!connected || !isBackendPlant) {
      setLive(null)
      setLiveState('idle')
      return
    }
    let alive = true
    setLive(null)
    setLiveState('loading')
    const load = () =>
      apiPlantLive(plantId) // plantId = 백엔드 plant_id(UUID)
        .then((l) => {
          if (!alive) return
          const ok = !!(l && l.hasData)
          setLive(ok ? l : null)
          setLiveState(ok ? 'ok' : 'empty')
        })
        // 일시 조회 실패면 직전 계측값은 유지하고 상태만 표시(화면이 30초간 빈 화면으로 바뀌지 않게)
        .catch(() => alive && setLiveState('error'))
    load()
    const t = setInterval(load, 30 * 1000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [connected, isBackendPlant, plantId])

  // 선택 발전소 장비 목록(인버터 모델 표기용). 권한이 없거나 실패하면 null.
  useEffect(() => {
    if (!connected || !isBackendPlant) {
      setDevices(null)
      return
    }
    let alive = true
    apiGetDevices(plantId)
      .then((d) => alive && setDevices(d?.items || []))
      .catch(() => alive && setDevices(null))
    return () => {
      alive = false
    }
  }, [connected, isBackendPlant, plantId])

  // Open-Meteo 날씨 (백엔드 환경센서가 없을 때 폴백). 백엔드 발전소는 등록 좌표 기준이고,
  // 좌표가 없으면 다른 지역(데모 기본 원주) 예보를 이 발전소 날씨처럼 보여주지 않도록 조회하지 않는다.
  // 있는 그대로: 등록 좌표가 있으면 값이 이상해도 그 좌표로 조회하고(화면에 좌표를 함께 표시), 없으면 조회하지 않는다.
  const plantLat = basePlant?.lat ?? null
  const plantLng = basePlant?.lng ?? null
  const noCoords = isBackendPlant && (plantLat == null || plantLng == null)
  const forecastAt = isBackendPlant && !noCoords ? { lat: plantLat, lng: plantLng } : null
  useEffect(() => {
    if (noCoords) {
      setMeteo(null)
      return undefined
    }
    let alive = true
    const coords = plantLat != null && plantLng != null ? { lat: plantLat, lon: plantLng } : null
    const load = async () => {
      const w = await fetchWeather(plantId, coords)
      // 어느 발전소용 예보인지 붙여 둔다 — 발전소를 바꾼 직후 이전 발전소 예보가 새 발전소 값처럼 보이지 않게
      if (alive && w) setMeteo({ ...w, _for: plantId })
    }
    load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [plantId, plantLat, plantLng, noCoords])

  // 실시간 계측(MRT 정규화 텔레메트리)을 발전소 객체에 병합 → 뷰는 그대로 실데이터 표시.
  // 백엔드가 주는 값은 0이어도 그대로 노출하고(실측), 미제공 값(PEAK·인버터 온도·시세·이력)은
  // 인버터는 null('-' 표시), 발전소 단위는 목 템플릿으로 폴백한다.
  const plant = useMemo(() => {
    if (!live || !live.hasData) {
      // 계측 데이터가 없는 백엔드 발전소도 장비 목록이 있으면 인버터 모델은 보여준다
      return basePlant?._backend && devices ? { ...basePlant, inverterModel: inverterModelLabel(devices, 0) } : basePlant
    }
    const round = (v, d = 1) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d)
    const withUnit = (v, unit, d = 1) => (v == null ? '-' : `${v.toFixed(d)} ${unit}`)
    const joinPhases = (vals) =>
      vals.every((x) => x == null) ? '-' : vals.map((x) => (x == null ? '-' : x.toFixed(1))).join(', ')

    const cur = round(live.currentPowerKw, 2) // 인버터 데이터가 없으면 null('-')
    // 금일 발전량을 계산할 수 없으면(이력 없음·오늘 내내 통신 두절) null('-') — 템플릿 값으로 채우지 않는다
    const genLive = live.todayGenKwh != null
    const gen = genLive ? round(live.todayGenKwh) : null
    const env = live.environment
    // 인버터 데이터가 없으면 빈 목록(템플릿의 가상 인버터를 실발전소에 보여주지 않음).
    // 통신 두절 인버터의 계측값은 측정값이 아니므로(RTU 가 채운 0·직전값) '-' 로 표시한다.
    const inv = live.inverters.map((iv) => {
      const nr = !!iv.noResponse
      const val = (v, d) => (nr ? null : round(v, d))
      return {
        id: iv.id,
        deviceId: iv.deviceId,
        externalSeq: iv.externalSeq,
        powerKw: val(iv.powerKw, 2), // AC 출력(grid_power_kw)
        dcPowerKw: val(iv.dcPowerKw, 2), // DC 전력(pv_power_kw)
        dcV: val(iv.dcVoltV), // pv_total_voltage_v
        dcA: val(iv.dcCurrentA), // pv_total_current_a
        acV: nr ? '-' : joinPhases(iv.acVoltV), // R-S, S-T, T-R 선간전압
        acA: nr ? '-' : joinPhases(iv.acCurrentA), // R, S, T 상전류
        freqHz: val(iv.freqHz),
        energyKwh: round(iv.energyKwh), // 보정 누적(corrected_energy_wh)
        todayGenKwh: round(iv.todayKwh),
        peakKw: null, // 백엔드 미제공
        temp: null, // 인버터 온도 미제공
        runHours: null, // 미제공
        // 지연=백엔드 수신 끊김(stale) / 통신 두절=RTU 요청에 인버터 무응답(receive_count 정지) /
        // 정지=값이 전부 0(송수신 카운트가 없어 두절 여부 판단 불가) / 대기=응답 정상·출력 0 / 가동=출력 중
        state: iv.stale ? '지연'
          : nr ? '통신 두절'
            : iv.noMeasurement ? '정지'
              : (iv.powerKw ?? 0) > 0 ? '가동' : '대기',
        lastRecvAt: iv.lastRecvAt, // 통신 두절 시작 판단용(마지막 응답 시각)
        comm: iv.comm,
        _live: true,
      }
    })
    return {
      ...basePlant,
      currentPowerKw: cur,
      todayGenKwh: gen,
      // 금일 발전시간 = 금일 발전량 / 설비용량 (등가 가동시간)
      todayGenHours: genLive && basePlant.capacityKw ? +(gen / basePlant.capacityKw).toFixed(2) : null,
      yesterdayGenKwh: null, // 발전 이력 API 없음
      // 대시보드 표기 단가(SMP + REC×가중치)와 같은 식 — KPX 시세가 있으면 시세, 없으면 데모 단가
      // 시세를 불러오는 중이면 데모 단가로 잠깐 계산하지 않고 '-'
      todayRevenueMan: genLive && !market.loading ? +((smpWon(gen, market.price) + recWon(gen, market.price)) / 10000).toFixed(1) : null,
      co2ReducedTon: genLive ? +((gen * 0.48) / 1000).toFixed(2) : null,
      acPower: withUnit(live.currentPowerKw, 'kW'),
      dcPower: withUnit(live.dcPowerKw, 'kW'),
      dcVolt: withUnit(live.dcVoltV, 'V'),
      dcCurr: withUnit(live.dcCurrentA, 'A'),
      acVolt: withUnit(live.acVoltV, 'V'),
      acFreq: withUnit(live.acFreqHz, 'Hz'),
      conversionEff: live.conversionEff, // AC/DC(%) — 계산 불가면 null
      totalEnergyKwh: live.totalEnergyKwh,
      inverters: inv,
      inverterModel: inverterModelLabel(devices, inv.length),
      soilMoisture: env && env.soilMoisture != null ? `${env.soilMoisture} %` : basePlant.soilMoisture,
      soilTemp: env && env.soilTemp != null ? `${env.soilTemp} °C` : basePlant.soilTemp,
      cardTemp: env?.airTemp != null ? `${env.airTemp.toFixed(1)}°C` : basePlant.cardTemp,
      _live: true,
      _stale: live.stale,
      _lastUpdatedAt: live.lastUpdatedAt,
      _invNoData: live.noMeasurementCount || 0, // 계측값 없는(통신 두절·정지) 인버터 수
      _invNoResponse: live.noResponseCount || 0, // 그중 통신 두절(receive_count 정지)로 확인된 수
      _invTotal: live.inverters.length,
      _todayGenLive: genLive, // false 면 금일 발전량 확인 불가('-')
      _todayGenPartial: !!live.todayGenPartial,
      _todayGenUntil: live.todayGenUntilAt, // 통신 두절 전 마지막 응답 시각 → '금일 발전량 (09:08까지)'
    }
  }, [basePlant, live, devices, market.price, market.loading])

  // 날씨: 응답 중인 백엔드 환경센서 값을 우선, 센서가 없으면 Open-Meteo.
  // 기온=외기온도 센서(없으면 기상센서), 모듈온도=표면온도 센서, 경사/수평 일사량=센서 종류(sun_type)별 실측값.
  const weather = useMemo(() => {
    const env = live?.environment
    // 현재 발전소용으로 받은 예보만 쓴다(발전소 전환 직후 이전 발전소 예보가 남아 있을 수 있음)
    const m = meteo?._for === plantId ? meteo : null
    const sensorInfo = env && { staleSeqs: env.staleSeqs, sensorCount: env.sensorCount, source: 'sensor', noCoords }
    // 일출·일몰은 예보에서만 온다. 실발전소에서 예보가 없으면(좌표 미등록 등) 데모 시각 대신 '-'
    const sun = (key, demo) => m?.[key] ?? (isBackendPlant ? '-' : demo)
    if (env && !env.stale) {
      const fmt = (v, unit, d = 1) => (v == null ? '-' : `${v.toFixed(d)}${unit}`)
      const irr = env.irradiance
      return {
        // 일사 센서가 응답하지 않으면 날씨 상태는 예보(Open-Meteo)로
        cond: irr == null ? m?.cond ?? '-' : irr < 10 ? '🌙 일사 없음' : irr > 300 ? '☀️ 맑음' : '☁️ 흐림',
        temp: fmt(env.airTemp, '°C'),
        surfaceTemp: env.surfaceTemp != null ? fmt(env.surfaceTemp, '°C') : null,
        humidity: fmt(env.humidity, '%', 0),
        wind: fmt(env.wind, 'm/s'),
        inclinedIrr: env.inclinedIrr == null ? '-' : `${Math.round(env.inclinedIrr)} W/m²`,
        horizontalIrr: env.horizontalIrr == null ? '-' : `${Math.round(env.horizontalIrr)} W/m²`,
        sunrise: sun('sunrise', '05:28'),
        sunset: sun('sunset', '19:42'),
        syncedAt: env.ts,
        stale: false,
        ...sensorInfo,
      }
    }
    if (env) {
      // 센서가 전부 응답 없음 → 예보 값(있으면)을 보여주고 배지로 센서 상태를 알린다.
      // 예보의 일사량은 실측이 아니므로 표시하지 않는다.
      return {
        cond: m?.cond ?? '-',
        temp: m?.temp ?? '-',
        surfaceTemp: null,
        humidity: m?.humidity ?? '-',
        wind: m?.wind ?? '-',
        inclinedIrr: '-',
        horizontalIrr: '-',
        sunrise: sun('sunrise', '05:28'),
        sunset: sun('sunset', '19:42'),
        syncedAt: env.ts,
        stale: true,
        forecast: !!m,
        forecastAt: m ? forecastAt : null,
        ...sensorInfo,
      }
    }
    if (m) return { ...m, source: 'meteo', forecastAt }
    // 환경센서도 예보도 없는 실발전소(좌표 미등록이거나 예보 조회 중) → 화면의 데모 기본값 대신 모두 '-'
    if (isBackendPlant) {
      return {
        source: 'none', noCoords, cond: '-', temp: '-', surfaceTemp: null, humidity: '-', wind: '-',
        sunrise: '-', sunset: '-', inclinedIrr: '-', horizontalIrr: '-',
      }
    }
    return null
    // forecastAt 은 plantLat·plantLng 로만 바뀌므로 두 값을 의존성으로 둔다
  }, [live, meteo, noCoords, isBackendPlant, plantLat, plantLng, plantId])

  const selectPlant = useCallback(
    (id) => {
      if (user?.role === '발전사업자') return
      if (catalog[id]) setPlantId(id)
    },
    [user, catalog]
  )

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const login = useCallback((u) => setUser(u), [])

  const apiSignIn = useCallback(
    async (email, password) => {
      await apiLogin(email, password)
      const me = await apiGetMe()
      const roleInfo = await resolveRole(me)
      const u = { name: me?.name || email, email: me?.email || email, role: '관리자', source: 'api', ...roleInfo }
      setUser(u)
      await refreshBackend()
      return u
    },
    [refreshBackend]
  )

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setConnected(false)
    setBackendPlants([])
    setLive(null)
    setLiveState('idle')
    setPlantId(DEFAULT_PLANT_ID)
  }, [])

  // 사용 중 로그인 만료(API 401) → 로그아웃하고 재로그인 안내. 안내 없이 데모 화면으로 바뀌지 않게 한다.
  const [sessionExpired, setSessionExpired] = useState(false)
  useEffect(() => {
    const onExpired = () => {
      logout()
      setSessionExpired(true)
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [logout])
  const clearSessionExpired = useCallback(() => setSessionExpired(false), [])

  // 역할 메뉴 그룹: admin(시스템 관리자) | official(지자체 감독관) | owner(발전사업자)
  const menuRole = menuRoleOf(user)

  const value = {
    plantId,
    plant,
    plantList,
    user,
    theme,
    weather,
    market, // KPX SMP·REC 시세 { status, error, smp, rec, price }
    connected,
    backendPlants,
    menuRole,
    isLive: !!(plant && plant._live),
    liveState, // 백엔드 발전소 계측 조회 상태: loading | ok | empty(데이터 없음) | error
    // 감독 권한 = 시스템 관리자 또는 지자체 감독관 (실계정 level≤60, 또는 데모에서 감독관/관리자 선택).
    isSupervisor: isSupervisorRole(menuRole),
    selectPlant,
    toggleTheme,
    login,
    apiSignIn,
    logout,
    sessionExpired, // 로그인 만료로 자동 로그아웃됨 → 재로그인 안내
    clearSessionExpired,
    refreshBackend,
    canSwitchPlant: user?.role !== '발전사업자',
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
