import { useState, useEffect, useCallback, useMemo } from 'react'
import { PLANTS, DEFAULT_PLANT_ID, getPlant } from '../data/plants'
import { fetchWeather } from '../lib/weather'
import {
  apiLogin, apiGetMe, apiGetPlants, apiPlantLive, mapPlant, setToken, getToken,
} from '../lib/api'
import { AppContext } from './useApp'

const CATALOG = Object.values(PLANTS)

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
  const [backendMap, setBackendMap] = useState({}) // shortName -> backend plant_id(UUID)
  const [backendPlants, setBackendPlants] = useState([]) // 실발전소 목록(매핑됨)
  const [live, setLive] = useState(null) // 선택 발전소 실시간 텔레메트리

  const basePlant = useMemo(() => getPlant(plantId), [plantId])
  const backendId = backendMap[basePlant.shortName]

  // 테마 적용
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('dongyang_theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  // 백엔드 실발전소 목록 조회 → 카탈로그(목)와 이름 매칭
  const refreshBackend = useCallback(async () => {
    try {
      const data = await apiGetPlants()
      const items = data?.items || []
      const map = {}
      for (const cat of CATALOG) {
        const hit = items.find((r) => r.name && r.name.includes(cat.shortName))
        if (hit) map[cat.shortName] = hit.plant_id
      }
      setBackendMap(map)
      setBackendPlants(items.map(mapPlant))
      setConnected(items.length > 0)
    } catch {
      setConnected(false)
      setBackendMap({})
      setBackendPlants([])
    }
  }, [])

  // 저장된 JWT 로 세션 복원 + 백엔드 데이터 로드
  useEffect(() => {
    if (!getToken()) return
    let alive = true
    apiGetMe()
      .then((me) => {
        if (!alive) return
        if (me) setUser({ name: me.name, email: me.email, role: '관리자', source: 'api' })
        refreshBackend()
      })
      .catch(() => setToken(null))
    return () => {
      alive = false
    }
  }, [refreshBackend])

  // 선택 발전소 실시간 텔레메트리 (연결 + 매칭될 때만, 30초 주기)
  useEffect(() => {
    if (!connected || !backendId) {
      setLive(null)
      return
    }
    let alive = true
    const load = () =>
      apiPlantLive(backendId)
        .then((l) => alive && setLive(l && l.hasData ? l : null))
        .catch(() => alive && setLive(null))
    load()
    const t = setInterval(load, 30 * 1000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [connected, backendId])

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

  // 실시간 텔레메트리를 발전소 객체에 병합 → 뷰는 그대로 실데이터 표시
  const plant = useMemo(() => {
    if (!live || !live.hasData) return basePlant
    const cur = live.currentPowerKw || basePlant.currentPowerKw
    const gen = live.todayGenKwh || basePlant.todayGenKwh
    const env = live.environment
    const inv = live.inverters.length
      ? live.inverters.map((iv) => ({
          id: iv.id,
          powerKw: iv.powerKw,
          runHours: 1.9,
          todayGenKwh: iv.dailyKwh,
          state: '가동',
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
      acVolt: live.acVolt ? `${live.acVolt} V` : basePlant.acVolt,
      acFreq: `${live.acFreq} Hz`,
      dcVolt: live.acVolt ? `${(live.acVolt * 1.63).toFixed(1)} V` : basePlant.dcVolt,
      inverters: inv,
      soilMoisture: env ? `${env.soilMoisture} %` : basePlant.soilMoisture,
      soilTemp: env ? `${env.soilTemp} °C` : basePlant.soilTemp,
      cardTemp: env ? `${env.airTemp}°C` : basePlant.cardTemp,
      _live: true,
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
      if (PLANTS[id]) setPlantId(id)
    },
    [user]
  )

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const login = useCallback((u) => setUser(u), [])

  const apiSignIn = useCallback(
    async (email, password) => {
      await apiLogin(email, password)
      const me = await apiGetMe()
      const u = { name: me?.name || email, email: me?.email || email, role: '관리자', source: 'api' }
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
    setBackendMap({})
    setBackendPlants([])
    setLive(null)
    setPlantId(DEFAULT_PLANT_ID)
  }, [])

  const value = {
    plantId,
    plant,
    user,
    theme,
    weather,
    connected,
    backendPlants,
    isLive: !!(plant && plant._live),
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
