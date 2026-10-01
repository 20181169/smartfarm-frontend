import { useEffect, useRef, useState, useMemo } from 'react'
import { ShieldCheck, MapPin, ListChecks, ClipboardCheck, Lock, Database } from 'lucide-react'
import { useApp } from '../context/useApp'
import { apiGetPlants, getToken } from '../lib/api'
import { AGRI_ADMIN_DATA, complianceBadge } from '../data/compliance'

const { summary, sites, priorityWatchlist, recentReports } = AGRI_ADMIN_DATA
const DEMO_SITES = Object.values(sites)

const DEMO_KPIS = [
  { key: 'all', label: '전체 사업장', value: summary.totalSites, color: 'var(--blue)' },
  { key: 'normal', label: '정상 이행', value: summary.normalSites, color: 'var(--sage-strong)' },
  { key: 'watch', label: '관찰 필요', value: summary.watchSites, color: 'var(--terracotta)' },
  { key: 'inspection', label: '현장점검', value: summary.inspectionSites, color: 'var(--text-3)' },
  { key: 'action', label: '시정 검토', value: summary.actionSites, color: 'var(--text-3)' },
]

function StatTile({ label, value, color, active, clickable, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: 'var(--card, #fff)',
        border: `1px solid ${active ? 'var(--sage-strong)' : 'var(--border)'}`,
        outline: active ? '2px solid var(--sage-strong)' : 'none',
        borderRadius: 12,
        padding: '14px 16px',
        cursor: clickable ? 'pointer' : 'default',
        boxShadow: active ? '0 6px 18px rgba(61,90,71,.18)' : 'none',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
    </button>
  )
}

export default function OversightView() {
  const { connected, isSupervisor } = useApp()
  const mapRef = useRef(null)
  const mapObj = useRef(null)
  const groupRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [filter, setFilter] = useState('all') // 데모 지도 필터
  const [source, setSource] = useState('demo') // 'demo' | 'backend'
  const [realPlants, setRealPlants] = useState([])
  const [beState, setBeState] = useState('idle') // idle|loading|ok|error
  const [beMsg, setBeMsg] = useState('')

  // 백엔드 소스 선택 시 실발전소(/plants) 조회
  useEffect(() => {
    if (source !== 'backend') return
    if (!getToken()) {
      setBeState('error')
      setBeMsg('로그인이 필요합니다.')
      return
    }
    let alive = true
    setBeState('loading')
    apiGetPlants({ limit: 100 })
      .then((d) => alive && (setRealPlants(d?.items || []), setBeState('ok')))
      .catch((e) => alive && (setRealPlants([]), setBeState('error'), setBeMsg(e.status === 401 ? '로그인이 필요합니다.' : '발전소 조회 실패')))
    return () => {
      alive = false
    }
  }, [source])

  // 지도에 표시할 사이트 목록 (소스/필터에 따라)
  const mapSites = useMemo(() => {
    if (source === 'backend') {
      return realPlants
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => ({ id: p.plant_id, code: p.name, lat: p.lat, lng: p.lng, score: null, watch: false, real: true, capacity: p.capacity_kw, status: p.status }))
    }
    const pass = (s) =>
      filter === 'all' ||
      (filter === 'watch' && s.status.includes('관찰')) ||
      (filter === 'normal' && s.status.includes('정상'))
    return DEMO_SITES.filter(pass).map((s) => ({ id: s.id, code: s.code, lat: s.lat, lng: s.lng, score: s.complianceScore, watch: s.status.includes('관찰'), real: false }))
  }, [source, realPlants, filter])

  // Leaflet 지도 초기화 (index.html 에서 CDN 로드)
  useEffect(() => {
    let cancelled = false
    let tries = 0
    const init = () => {
      if (cancelled) return
      const L = window.L
      if (!L) {
        if (tries++ < 30) setTimeout(init, 100)
        return
      }
      if (!mapRef.current || mapObj.current) return
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map)
      groupRef.current = L.layerGroup().addTo(map)
      mapObj.current = map
      setMapReady(true)
      setTimeout(() => map.invalidateSize(), 120)
    }
    init()
    return () => {
      cancelled = true
      if (mapObj.current) {
        mapObj.current.remove()
        mapObj.current = null
        groupRef.current = null
      }
    }
  }, [])

  // 사이트 목록 변경 시 마커 재구성
  useEffect(() => {
    const map = mapObj.current
    const group = groupRef.current
    const L = window.L
    if (!map || !group || !L) return
    group.clearLayers()
    const pts = []
    mapSites.forEach((s) => {
      const color = s.real ? '#2563eb' : s.watch ? '#f59e0b' : '#10b981'
      const tail = s.score != null ? ` <span style="opacity:.9;font-weight:700;">(${s.score}점)</span>` : s.real ? ' <span style="opacity:.9;">(미평가)</span>' : ''
      const icon = L.divIcon({
        className: 'agri-pin',
        html: `<div style="background:${color};color:#fff;padding:5px 11px;border-radius:20px;font-weight:800;font-size:11px;border:2.5px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.35);white-space:nowrap;display:inline-flex;align-items:center;gap:5px;"><span>🌾</span><span>${s.code}</span>${tail}</div>`,
        iconSize: null,
        iconAnchor: [70, 16],
      })
      const m = L.marker([s.lat, s.lng], { icon }).addTo(group)
      m.bindPopup(
        s.real
          ? `<b>${s.code}</b><br/>용량 ${s.capacity ?? '-'}kW · 상태 ${s.status}<br/>영농이행: 백엔드 미제공(미평가)`
          : `<b>${s.code}</b><br/>이행점수 ${s.score}점`
      )
      pts.push([s.lat, s.lng])
    })
    map.invalidateSize()
    if (pts.length) map.fitBounds(pts, { padding: [45, 45], maxZoom: source === 'backend' ? 11 : 9.5, animate: true })
  }, [mapSites, source, mapReady])

  // 감독 권한 없는 계정(운영자/조회전용)은 접근 차단
  if (!isSupervisor) {
    return (
      <div className="view stack">
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <Lock size={40} style={{ color: 'var(--text-3)', marginBottom: 12 }} />
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>접근 권한이 없습니다</div>
          <div className="text-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
            영농이행 감독 화면은 <b>감독 권한(시스템·지자체 관리자, 현장 점검자)</b> 계정만 이용할 수 있습니다.<br />
            현재 계정은 조회/운영 권한입니다.
          </div>
        </div>
      </div>
    )
  }

  const isBackend = source === 'backend'
  const withCoords = realPlants.filter((p) => p.lat != null).length

  return (
    <div className="view stack">
      <div>
        <div className="view-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <ShieldCheck size={20} /> 영농형 태양광 영농이행 감독 관제
          {isBackend
            ? <span className="badge badge-active" style={{ fontSize: 11 }}>백엔드 발전소</span>
            : <span className="badge badge-neutral" style={{ fontSize: 11 }}>데모 데이터</span>}
        </div>
        <div className="view-sub">
          {/* 백엔드 모드에선 데모 관할·리포트 기간(2027년 예시)을 보여주지 않는다 */}
          {isBackend
            ? `백엔드 실발전소 ${beState === 'ok' ? `${realPlants.length}곳` : ''} · 영농이행 판정·정기점검 API 미제공`
            : `${summary.authority} · 리포트 기간 ${summary.reportingPeriod} · 생성 ${summary.generatedAt}`}
        </div>
      </div>

      {/* KPI 요약 */}
      {isBackend ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <StatTile label="전체 사업장(백엔드)" value={beState === 'ok' ? realPlants.length : '-'} color="var(--blue)" />
          <StatTile label="지도 표시(좌표 등록)" value={beState === 'ok' ? withCoords : '-'} color="var(--sage-strong)" />
          <StatTile label="영농이행 미평가" value={beState === 'ok' ? realPlants.length : '-'} color="var(--text-3)" />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {DEMO_KPIS.map((k) => {
            const clickable = k.key === 'all' || k.value > 0
            return (
              <StatTile
                key={k.key}
                label={k.label}
                value={k.value}
                color={k.color}
                active={filter === k.key}
                clickable={clickable}
                onClick={() => clickable && setFilter(k.key)}
              />
            )
          })}
        </div>
      )}

      {/* 지도 */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><MapPin /> 지역별 사업장 현황</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isBackend && (
              <span className="text-muted" style={{ fontSize: 12 }}>🟢 정상 · 🟠 관찰 · KPI 클릭 시 필터</span>
            )}
            {connected && (
              <div className="segmented">
                <button className={!isBackend ? 'active' : ''} onClick={() => setSource('demo')}>데모</button>
                <button className={isBackend ? 'active' : ''} onClick={() => setSource('backend')}>
                  <Database size={12} /> 백엔드 실발전소
                </button>
              </div>
            )}
          </div>
        </div>

        {isBackend && beState === 'loading' && <div className="text-muted" style={{ fontSize: 13, paddingBottom: 6 }}>백엔드에서 불러오는 중…</div>}
        {isBackend && beState === 'error' && <div style={{ fontSize: 13, color: 'var(--terracotta)', fontWeight: 600, paddingBottom: 6 }}>{beMsg}</div>}
        {isBackend && beState === 'ok' && (
          <div className="text-muted" style={{ fontSize: 12, paddingBottom: 6, lineHeight: 1.5 }}>
            백엔드 실발전소 <b>{realPlants.length}곳</b> 중 좌표 등록된 <b>{withCoords}곳</b>만 지도에 표시됩니다.
            영농이행 판정·정기점검은 백엔드 API가 없어 <b>미평가</b>로 표시됩니다.
          </div>
        )}

        <div ref={mapRef} style={{ height: 380, borderRadius: 12, overflow: 'hidden', background: 'var(--bg-subtle)' }} />
      </div>

      {/* 우선 확인 대상 + 정기점검 (영농이행 = 데모. 백엔드 소스에선 미제공 안내) */}
      <div className="grid grid-3">
        <div className="card">
          <div className="card-header">
            <span className="card-title"><ListChecks /> 우선 확인 대상</span>
            <span className="text-muted" style={{ fontSize: 12 }}>위험도 순</span>
          </div>
          {isBackend ? (
            <div className="text-muted" style={{ fontSize: 13, padding: '6px 2px', lineHeight: 1.6 }}>
              백엔드에 영농이행 판정 API가 없어 표시할 데이터가 없습니다. (데모 소스에서 확인)
            </div>
          ) : (
            <div className="info-list">
              {priorityWatchlist.map((p) => (
                <div key={p.id} className="info-row" style={{ alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>{p.issue}</div>
                  </div>
                  <span className={`badge ${complianceBadge(p.badge)}`}>{p.level}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <span className="card-title"><ClipboardCheck /> 최근 정기점검 현황</span>
            <span className="text-muted" style={{ fontSize: 12 }}>월간 자동생성</span>
          </div>
          {isBackend ? (
            <div className="text-muted" style={{ fontSize: 13, padding: '6px 2px', lineHeight: 1.6 }}>
              백엔드에 정기점검 API가 없어 표시할 데이터가 없습니다. (데모 소스에서 확인)
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>사업장 명칭</th><th>신고 작물</th><th>월간 영농활동</th>
                    <th>실경작 면적 비율</th><th>종합 판정</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReports.map((r) => (
                    <tr key={r.id}>
                      <td style={{ textAlign: 'left' }}><strong>{r.name}</strong></td>
                      <td>{r.crop}</td>
                      <td>{r.events}</td>
                      <td>{r.area}</td>
                      <td><span className={`badge ${complianceBadge(r.badge)}`}>{r.result}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
