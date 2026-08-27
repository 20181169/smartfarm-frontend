import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wifi, WifiOff, RefreshCw, ServerCog } from 'lucide-react'
import { useApp } from '../context/useApp'
import { PLANTS } from '../data/plants'
import { nf } from '../lib/format'
import { apiGetPlants, mapPlant, getToken } from '../lib/api'
import PlantDetailModal from '../components/modals/PlantDetailModal'

const list = Object.values(PLANTS)
const totalCap = list.reduce((s, p) => s + p.capacityKw, 0)

const STATUS_BADGE = {
  ACTIVE: { cls: 'badge-active', label: '운전중' },
  INACTIVE: { cls: 'badge-neutral', label: '정지' },
  MAINTENANCE: { cls: 'badge-warning', label: '점검중' },
}

// 백엔드(FastAPI) 실시간 발전소 목록 — 연결 상태에 따라 실데이터/안내 표시
function BackendPlants() {
  const [state, setState] = useState('idle') // idle | loading | ok | error
  const [plants, setPlants] = useState([])
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    if (!getToken()) {
      setState('idle')
      return
    }
    setState('loading')
    try {
      const data = await apiGetPlants()
      setPlants((data?.items || []).map(mapPlant))
      setState('ok')
    } catch (err) {
      setState('error')
      setMsg(
        err.status === 0
          ? '백엔드에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.'
          : err.status === 401
            ? '인증이 필요합니다. 백엔드 계정으로 로그인하세요.'
            : err.status === 403
              ? '발전소 조회 권한(plant:read)이 없는 계정입니다.'
              : err.message
      )
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><ServerCog /> 백엔드 실시간 발전소 목록</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {state === 'ok' ? (
            <span className="badge badge-active"><Wifi size={13} /> 백엔드 연결됨</span>
          ) : (
            <span className="badge badge-neutral"><WifiOff size={13} /> 미연결</span>
          )}
          <button className="icon-btn" onClick={load} title="다시 불러오기"><RefreshCw size={14} /></button>
        </div>
      </div>

      {state === 'idle' && (
        <div className="text-muted" style={{ fontSize: 13, padding: '6px 2px' }}>
          우측 상단 <b>로그인</b>에서 <b>백엔드 계정</b>으로 로그인하면 실시간 발전소 목록을 불러옵니다.
        </div>
      )}
      {state === 'loading' && <div className="text-muted" style={{ fontSize: 13 }}>불러오는 중…</div>}
      {state === 'error' && (
        <div style={{ fontSize: 13, color: 'var(--terracotta)', fontWeight: 600 }}>{msg}</div>
      )}
      {state === 'ok' && plants.length === 0 && (
        <div className="text-muted" style={{ fontSize: 13 }}>연결됐지만 등록된 발전소가 없습니다. (백엔드에 발전소 데이터를 먼저 등록하세요)</div>
      )}
      {state === 'ok' && plants.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>발전소명</th><th>용량(kW)</th><th>상태</th><th>주소</th><th>위경도</th></tr>
            </thead>
            <tbody>
              {plants.map((p) => {
                const b = STATUS_BADGE[p.status] || STATUS_BADGE.INACTIVE
                return (
                  <tr key={p.id}>
                    <td style={{ textAlign: 'left' }}><strong>{p.name}</strong></td>
                    <td>{p.capacityKw ?? '-'}</td>
                    <td><span className={`badge ${b.cls}`}>{b.label}</span></td>
                    <td style={{ textAlign: 'left' }}>{p.address || '-'}</td>
                    <td className="text-muted mono">{p.lat != null ? `${p.lat}, ${p.lng}` : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function OverviewView() {
  const { selectPlant, canSwitchPlant } = useApp()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(null)

  const openPlant = (id) => {
    selectPlant(id)
    navigate('/')
  }

  return (
    <div className="view stack">
      <div>
        <div className="view-title">전체 발전소 종합 현황</div>
        <div className="view-sub">동양연합 영농형 태양광 · 총 {list.length}개 발전소 ({nf(totalCap)} kW)</div>
      </div>

      <BackendPlants />

      <div className="view-sub" style={{ marginTop: 4, marginBottom: -6 }}>데모 데이터 (목)</div>
      <div className="grid grid-3">
        {list.map((p) => {
          const invCount = p.inverters.length
          return (
            <div className="plant-card" key={p.id} onClick={() => canSwitchPlant && openPlant(p.id)}>
              <div className="plant-card-top">
                <span className="plant-card-name">[{p.id}] {p.shortName}</span>
                <span className="badge badge-active">운전중</span>
              </div>
              <div className="plant-card-rows">
                <div>용량 <b>{p.capacityKw} kW</b> · 인버터 {invCount}대</div>
                <div>현재출력 <b className="text-emerald">{p.acPower}</b></div>
                <div>금일발전량 <b>{nf(p.todayGenKwh)} kWh</b></div>
                <div>소재지 {p.location}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  className="icon-btn"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={(e) => { e.stopPropagation(); setDetail(p) }}
                >
                  상세 발전 그래프
                </button>
                {canSwitchPlant && (
                  <button
                    className="btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={(e) => { e.stopPropagation(); openPlant(p.id) }}
                  >
                    대시보드
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {detail && <PlantDetailModal plant={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
