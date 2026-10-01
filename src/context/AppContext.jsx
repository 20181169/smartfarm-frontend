import { useState, useEffect, useCallback, useMemo } from 'react'
import { PLANTS, DEFAULT_PLANT_ID, getPlant } from '../data/plants'
import { fetchWeather } from '../lib/weather'
import { smpWon, recWon } from '../lib/format'
import {
  apiLogin, apiGetMe, apiGetPlants, apiPlantLive, apiGetRoles, mapPlant, setToken, getToken, AUTH_EXPIRED_EVENT,
} from '../lib/api'
import { AppContext } from './useApp'

// 이 레벨 이하(SYS_ADMIN~INSPECTOR)만 영농이행 감독 기능 접근. 70 운영자·80 조회전용은 제외.
const SUPERVISOR_MAX_LEVEL = 60

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
    // 사업주·안전관리자·시공사·인버터 모델은 백엔드에 없는 항목 → 템플릿(다른 발전소) 정보를 쓰지 않는다
    owner: null,
    manager: null,
    contractor: null,
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

  // Open-Meteo 날씨 (백엔드 환경센서가 없을 때 폴백). 백엔드 발전소는 등록 좌표 기준.
  const plantLat = basePlant?.lat ?? null
  const plantLng = basePlant?.lng ?? null
  useEffect(() => {
    let alive = true
    const coords = plantLat != null && plantLng != null ? { lat: plantLat, lon: plantLng } : null
    const load = async () => {
      const w = await fetchWeather(plantId, coords)
      if (alive && w) setMeteo(w)
    }
    load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [plantId, plantLat, plantLng])

  // 실시간 계측(MRT 정규화 텔레메트리)을 발전소 객체에 병합 → 뷰는 그대로 실데이터 표시.
  // 백엔드가 주는 값은 0이어도 그대로 노출하고(실측), 미제공 값(PEAK·인버터 온도·시세·이력)은
  // 인버터는 null('-' 표시), 발전소 단위는 목 템플릿으로 폴백한다.
  const plant = useMemo(() => {
    if (!live || !live.hasData) return basePlant
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
      // 대시보드 표기 단가(SMP + REC×가중치)와 같은 식으로 계산
      todayRevenueMan: genLive ? +((smpWon(gen) + recWon(gen)) / 10000).toFixed(1) : null,
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
      inverterModel: inv.length ? `${inv.length}대 (모델 정보 없음)` : null,
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
  }, [basePlant, live])

  // 날씨: 응답 중인 백엔드 환경센서 값을 우선, 센서가 없으면 Open-Meteo.
  // 기온=외기온도 센서(없으면 기상센서), 모듈온도=표면온도 센서, 경사/수평 일사량=센서 종류(sun_type)별 실측값.
  const weather = useMemo(() => {
    const env = live?.environment
    const sensorInfo = env && { staleSeqs: env.staleSeqs, sensorCount: env.sensorCount, source: 'sensor' }
    if (env && !env.stale) {
      const fmt = (v, unit, d = 1) => (v == null ? '-' : `${v.toFixed(d)}${unit}`)
      const irr = env.irradiance
      return {
        // 일사 센서가 응답하지 않으면 날씨 상태는 예보(Open-Meteo)로
        cond: irr == null ? meteo?.cond ?? '-' : irr < 10 ? '🌙 일사 없음' : irr > 300 ? '☀️ 맑음' : '☁️ 흐림',
        temp: fmt(env.airTemp, '°C'),
        surfaceTemp: env.surfaceTemp != null ? fmt(env.surfaceTemp, '°C') : null,
        humidity: fmt(env.humidity, '%', 0),
        wind: fmt(env.wind, 'm/s'),
        inclinedIrr: env.inclinedIrr == null ? '-' : `${Math.round(env.inclinedIrr)} W/m²`,
        horizontalIrr: env.horizontalIrr == null ? '-' : `${Math.round(env.horizontalIrr)} W/m²`,
        sunrise: meteo?.sunrise ?? '05:28',
        sunset: meteo?.sunset ?? '19:42',
        syncedAt: env.ts,
        stale: false,
        ...sensorInfo,
      }
    }
    if (env) {
      // 센서가 전부 응답 없음 → 예보 값(있으면)을 보여주고 배지로 센서 상태를 알린다.
      // 예보의 일사량은 실측이 아니므로 표시하지 않는다.
      return {
        cond: meteo?.cond ?? '-',
        temp: meteo?.temp ?? '-',
        surfaceTemp: null,
        humidity: meteo?.humidity ?? '-',
        wind: meteo?.wind ?? '-',
        inclinedIrr: '-',
        horizontalIrr: '-',
        sunrise: meteo?.sunrise ?? '05:28',
        sunset: meteo?.sunset ?? '19:42',
        syncedAt: env.ts,
        stale: true,
        forecast: !!meteo,
        ...sensorInfo,
      }
    }
    return meteo ? { ...meteo, source: 'meteo' } : null
  }, [live, meteo])

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

  // 역할 메뉴 그룹: 실계정은 level로, 데모는 선택한 demoRole로, 미로그인은 owner(발전사업자 화면).
  const menuRole =
    user?.level != null
      ? (user.level <= SUPERVISOR_MAX_LEVEL ? 'supervisor' : 'owner')
      : user?.demoRole || 'owner'

  const value = {
    plantId,
    plant,
    plantList,
    user,
    theme,
    weather,
    connected,
    backendPlants,
    menuRole,
    isLive: !!(plant && plant._live),
    liveState, // 백엔드 발전소 계측 조회 상태: loading | ok | empty(데이터 없음) | error
    // 감독 권한 = 메뉴 그룹이 supervisor (실계정 level≤60, 또는 데모에서 감독/관리자 선택).
    isSupervisor: menuRole === 'supervisor',
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
