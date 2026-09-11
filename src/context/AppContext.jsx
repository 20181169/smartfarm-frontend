import { useState, useEffect, useCallback, useMemo } from 'react'
import { PLANTS, DEFAULT_PLANT_ID, getPlant } from '../data/plants'
import { fetchWeather } from '../lib/weather'
import {
  apiLogin, apiGetMe, apiGetPlants, apiPlantLive, apiGetRoles, mapPlant, setToken, getToken,
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
  return {
    ...TEMPLATE,
    id: bp.id,
    name: bp.name,
    shortName: bp.name,
    capacityKw: bp.capacityKw ?? TEMPLATE.capacityKw,
    status: bp.status || 'ACTIVE',
    address: bp.address ?? TEMPLATE.address,
    location: bp.address ?? TEMPLATE.location,
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
      return
    }
    let alive = true
    const load = () =>
      apiPlantLive(plantId) // plantId = 백엔드 plant_id(UUID)
        .then((l) => alive && setLive(l && l.hasData ? l : null))
        .catch(() => alive && setLive(null))
    load()
    const t = setInterval(load, 30 * 1000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [connected, isBackendPlant, plantId])

  // Open-Meteo 날씨 (백엔드 환경센서가 없을 때 폴백)
  useEffect(() => {
    let alive = true
    const load = async () => {
      const w = await fetchWeather(plantId)
      if (alive && w) setMeteo(w)
    }
    load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [plantId])

  // 실시간 계측을 발전소 객체에 병합 → 뷰는 그대로 실데이터 표시.
  // 백엔드가 실제 주는 값(현재출력·인버터 계측)은 0이어도 그대로 노출하고(실측),
  // 미제공 값(일발전량·시세·이력)은 목 템플릿으로 폴백한다.
  const plant = useMemo(() => {
    if (!live || !live.hasData) return basePlant
    const cur = live.currentPowerKw != null ? live.currentPowerKw : basePlant.currentPowerKw
    const gen = live.todayGenKwh != null ? live.todayGenKwh : basePlant.todayGenKwh
    const env = live.environment
    const inv = live.inverters.length
      ? live.inverters.map((iv) => ({
          id: iv.id,
          powerKw: iv.powerKw,
          runHours: 1.9,
          todayGenKwh: iv.dailyKwh,
          state: iv.stale ? '지연' : '가동',
          comm: iv.comm,
          dcV: iv.voltage,
          dcA: iv.current,
          acV: `${iv.voltage}, ${iv.voltage}, ${iv.voltage}`,
          acA: `${iv.current}, ${iv.current}, ${iv.current}`,
          temp: 40 + (iv.id % 6),
        }))
      : basePlant.inverters
    return {
      ...basePlant,
      currentPowerKw: cur,
      todayGenKwh: gen,
      todayRevenueMan: +(gen * 0.017).toFixed(1),
      co2ReducedTon: +((gen * 0.48) / 1000).toFixed(2),
      acPower: `${cur.toFixed(1)} kW`,
      dcPower: `${(cur * 1.05).toFixed(1)} kW`,
      acVolt: live.acVolt != null ? `${live.acVolt} V` : basePlant.acVolt,
      acFreq: `${live.acFreq} Hz`,
      dcVolt: live.acVolt != null ? `${(live.acVolt * 1.63).toFixed(1)} V` : basePlant.dcVolt,
      inverters: inv,
      soilMoisture: env && env.soilMoisture != null ? `${env.soilMoisture} %` : basePlant.soilMoisture,
      soilTemp: env && env.soilTemp != null ? `${env.soilTemp} °C` : basePlant.soilTemp,
      cardTemp: env ? `${env.airTemp}°C` : basePlant.cardTemp,
      _live: true,
      _stale: live.stale,
      _dataStatus: live.dataStatus,
      _lastUpdatedAt: live.lastUpdatedAt,
    }
  }, [basePlant, live])

  // 날씨: 백엔드 환경센서가 있으면 우선, 없으면 Open-Meteo
  const weather = useMemo(() => {
    const env = live?.environment
    if (env) {
      return {
        cond: env.irradiance > 300 ? '☀️ 맑음' : '☁️ 흐림',
        temp: `${env.airTemp}°C`,
        humidity: `${env.humidity}%`,
        wind: `${env.wind}m/s`,
        inclinedIrr: `${Math.round(env.irradiance * 1.05)} W/m²`,
        horizontalIrr: `${Math.round(env.irradiance)} W/m²`,
        sunrise: meteo?.sunrise ?? '05:28',
        sunset: meteo?.sunset ?? '19:42',
        syncedAt: live.updatedAt,
        source: 'sensor',
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
    setPlantId(DEFAULT_PLANT_ID)
  }, [])

  const value = {
    plantId,
    plant,
    plantList,
    user,
    theme,
    weather,
    connected,
    backendPlants,
    isLive: !!(plant && plant._live),
    // 영농이행 감독 권한: 데모/미로그인(레벨 없음)은 허용, API 계정은 level ≤ 60(SYS~INSPECTOR).
    isSupervisor: user?.level == null ? true : user.level <= SUPERVISOR_MAX_LEVEL,
    selectPlant,
    toggleTheme,
    login,
    apiSignIn,
    logout,
    refreshBackend,
    canSwitchPlant: user?.role !== '발전사업자',
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
