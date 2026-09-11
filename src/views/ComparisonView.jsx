import { useState, useEffect, useCallback } from 'react'
import { BarChart3, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useApp } from '../context/useApp'
import { COMPARE_ROWS } from '../data/market'
import { apiPlantsWithOverview, getToken } from '../lib/api'

const DS_BADGE = {
  OK: { cls: 'badge-active', label: '정상' },
  STALE: { cls: 'badge-warning', label: '수신지연' },
  NO_DEVICE: { cls: 'badge-neutral', label: '장비없음' },
}
const STATUS_BADGE = {
  ACTIVE: { cls: 'badge-active', label: '운전중' },
  INACTIVE: { cls: 'badge-neutral', label: '정지' },
  MAINTENANCE: { cls: 'badge-warning', label: '점검중' },
}
const fmtTime = (t) => {
  try {
    return t ? new Date(t).toLocaleString('ko-KR') : '-'
  } catch {
    return '-'
  }
}

// 백엔드 실발전소 비교표. 백엔드가 주는 값(용량·현재출력·인버터수·수신상태)으로 구성.
function RealCompare({ rows, plantId, selectPlant, canSwitchPlant, onReload }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><BarChart3 /> 발전소별 실시간 비교 (백엔드)</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-active"><Wifi size={13} /> 백엔드 연결됨</span>
          <button className="icon-btn" onClick={onReload} title="다시 불러오기"><RefreshCw size={14} /></button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>발전소명</th><th>설비용량</th><th>현재출력</th><th>인버터</th>
              <th>데이터 상태</th><th>마지막 수신</th><th>운전상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const selected = r.id === plantId
              const ds = DS_BADGE[r.ds] || { cls: 'badge-neutral', label: r.ds || '-' }
              const st = STATUS_BADGE[r.status] || STATUS_BADGE.INACTIVE
              return (
                <tr
                  key={r.id}
                  className={selected ? 'row-selected' : ''}
                  style={{ cursor: canSwitchPlant ? 'pointer' : 'default' }}
                  onClick={() => canSwitchPlant && selectPlant(r.id)}
                >
                  <td style={{ textAlign: 'left' }}>
                    {r.name}
                    {selected && <span className="text-blue" style={{ fontWeight: 800, marginLeft: 6 }}>(현재 선택)</span>}
                  </td>
                  <td>{r.cap}</td>
                  <td className="text-sage"><strong>{r.power}</strong></td>
                  <td>{r.inv}</td>
                  <td><span className={`badge ${ds.cls}`}>{ds.label}</span></td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{r.updated}</td>
                  <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// 목(데모) 성과 비교표 — 백엔드에 발전량/PR/수익/작물 지표가 없어 데모로 유지.
function MockCompare({ plantId, selectPlant, canSwitchPlant, note }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><BarChart3 /> 발전소별 성과 비교표</span>
        {note && <span className="badge badge-neutral"><WifiOff size={13} /> {note}</span>}
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>발전소명</th><th>설비용량</th><th>오늘 발전량</th><th>평균 발전시간</th>
              <th>성능지수(PR)</th><th>금일 수익</th><th>kWh당 수익</th><th>작물 생육</th><th>평가</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((r) => {
              const selected = r.id === plantId
              return (
                <tr
                  key={r.id}
                  className={selected ? 'row-selected' : ''}
                  style={{ cursor: canSwitchPlant ? 'pointer' : 'default' }}
                  onClick={() => canSwitchPlant && selectPlant(r.id)}
                >
                  <td style={{ textAlign: 'left' }}>
                    {r.name}
                    {selected && <span className="text-blue" style={{ fontWeight: 800, marginLeft: 6 }}>(현재 선택)</span>}
                  </td>
                  <td>{r.cap}</td>
                  <td><strong>{r.gen}</strong></td>
                  <td>{r.hrs}</td>
                  <td><strong>{r.pr}</strong></td>
                  <td className="text-terra"><strong>{r.rev}</strong></td>
                  <td>{r.eff}</td>
                  <td className="text-sage">{r.crop}</td>
                  <td><span className={`badge ${r.evalText === '최우수' ? 'badge-active' : 'badge-neutral'}`}>{r.evalText}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ComparisonView() {
  const { plantId, selectPlant, canSwitchPlant } = useApp()
  const [state, setState] = useState('idle') // idle | loading | ok | error
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    if (!getToken()) {
      setState('idle')
      return
    }
    setState('loading')
    try {
      const data = await apiPlantsWithOverview()
      setRows(
        data.map(({ plant, overview, live }) => ({
          id: plant.plant_id,
          name: plant.name,
          cap: plant.capacity_kw != null ? `${plant.capacity_kw} kW` : '-',
          power: live ? `${live.currentPowerKw} kW` : '-',
          inv: overview?.devices?.inverters ?? 0,
          ds: overview?.data_status?.status || (overview ? '-' : '조회실패'),
          updated: fmtTime(overview?.data_status?.last_updated_at),
          status: plant.status,
        }))
      )
      setState('ok')
    } catch (err) {
      setState('error')
      setMsg(
        err.status === 401
          ? '로그인이 필요합니다. 백엔드 계정으로 로그인하세요.'
          : err.status === 0
            ? '백엔드에 연결할 수 없습니다.'
            : err.message
      )
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="view stack">
      <div>
        <div className="view-title">발전소 성과 비교</div>
        <div className="view-sub">
          {state === 'ok'
            ? '백엔드 실발전소 실시간 비교 (행 클릭 시 해당 발전소로 전환)'
            : '발전소별 성과 비교 (행 클릭 시 해당 발전소로 전환)'}
        </div>
      </div>

      {state === 'loading' && <div className="text-muted" style={{ fontSize: 13 }}>백엔드에서 불러오는 중…</div>}
      {state === 'error' && (
        <div style={{ fontSize: 13, color: 'var(--terracotta)', fontWeight: 600 }}>{msg}</div>
      )}

      {state === 'ok' && rows.length > 0 ? (
        <RealCompare
          rows={rows}
          plantId={plantId}
          selectPlant={selectPlant}
          canSwitchPlant={canSwitchPlant}
          onReload={load}
        />
      ) : (
        <MockCompare
          plantId={plantId}
          selectPlant={selectPlant}
          canSwitchPlant={canSwitchPlant}
          note={state === 'idle' ? '데모 데이터 (로그인 시 실비교)' : state === 'error' ? '데모 데이터 (백엔드 조회 실패)' : ''}
        />
      )}
    </div>
  )
}
