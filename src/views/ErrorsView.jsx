import { useState, useEffect, useRef, useCallback } from 'react'
import { AlertTriangle, Download, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { ERROR_LOGS } from '../data/market'
import { exportTableToCsv } from '../lib/format'
import { apiPlantsWithOverview, apiPlantAlerts, getToken } from '../lib/api'
import { buildRealLogs } from '../lib/collectorLogs'
import { buildAlertLogs, mergeLogs } from '../lib/alertLogs'

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'warning', label: '주의' },
  { key: 'resolved', label: '해제' },
]

export default function ErrorsView() {
  const [filter, setFilter] = useState('all')
  const [state, setState] = useState('idle') // idle | loading | ok | error
  const [realLogs, setRealLogs] = useState([])
  const [msg, setMsg] = useState('')
  const [alertNote, setAlertNote] = useState('')
  const tableRef = useRef(null)

  const load = useCallback(async () => {
    if (!getToken()) {
      setState('idle')
      return
    }
    setState('loading')
    try {
      const data = await apiPlantsWithOverview()
      // 장비 알람은 발전소별로 조회. 일부가 실패해도(권한·네트워크) 수집기 상태 로그는 그대로 보여준다.
      const results = await Promise.allSettled(data.map(({ plant }) => apiPlantAlerts(plant.plant_id)))
      const failed = results.filter((r) => r.status === 'rejected')
      setAlertNote(
        failed.length ? `장비 알람 조회 실패 (${failed.length}/${results.length}개 발전소): ${failed[0].reason?.message || '알 수 없는 오류'}` : ''
      )
      const plantAlerts = data.map(({ plant }, i) => ({
        plant,
        items: results[i].status === 'fulfilled' ? results[i].value : [],
      }))
      setRealLogs(mergeLogs(buildAlertLogs(plantAlerts), buildRealLogs(data)))
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

  const isReal = state === 'ok'
  const logs = isReal ? realLogs : ERROR_LOGS

  const warnCount = logs.filter((l) => l.status === 'warning').length
  const resCount = logs.filter((l) => l.status === 'resolved').length
  const rows = logs.filter((l) => filter === 'all' || l.status === filter)
  const countFor = (k) => (k === 'warning' ? warnCount : k === 'resolved' ? resCount : logs.length)

  return (
    <div className="view stack">
      <div>
        <div className="view-title">장애 · 경보 이력</div>
        <div className="view-sub">
          {isReal
            ? 'MRT 장비 알람(통신 두절·경보) · 수집기 상태 · 데이터 수신 이상 — 미해결 먼저 표시'
            : '실시간 장애·경보 로그 및 AI 원인 분석'}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <AlertTriangle /> 장애 / 경보 이력
            {isReal ? (
              <span className="badge badge-active" style={{ marginLeft: 8 }}><Wifi size={13} /> 백엔드 실시간</span>
            ) : (
              <span className="badge badge-neutral" style={{ marginLeft: 8 }}>
                <WifiOff size={13} /> {state === 'error' ? '데모 (조회 실패)' : '데모 데이터'}
              </span>
            )}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="chip-toggle">
              {FILTERS.map((f) => (
                <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
                  {f.label} ({countFor(f.key)})
                </button>
              ))}
            </div>
            {isReal && (
              <button className="icon-btn" onClick={load} title="다시 불러오기"><RefreshCw size={14} /></button>
            )}
            <button className="btn-primary" onClick={() => exportTableToCsv(tableRef.current, '장애경보이력_보고서')}>
              <Download /> 엑셀 내보내기
            </button>
          </div>
        </div>

        {state === 'loading' && <div className="text-muted" style={{ fontSize: 13, padding: '4px 2px' }}>백엔드에서 불러오는 중…</div>}
        {state === 'error' && (
          <div style={{ fontSize: 13, color: 'var(--terracotta)', fontWeight: 600, padding: '4px 2px' }}>{msg}</div>
        )}
        {isReal && alertNote && (
          <div style={{ fontSize: 13, color: 'var(--terracotta)', fontWeight: 600, padding: '4px 2px' }}>{alertNote}</div>
        )}
        {isReal && rows.length === 0 && (
          <div className="text-muted" style={{ fontSize: 13, padding: '6px 2px' }}>현재 감지된 장애·경보가 없습니다.</div>
        )}

        <div className="table-wrap">
          <table className="data" ref={tableRef}>
            <thead>
              <tr>
                <th>시각</th><th>발전소</th><th>설비 / 대상</th><th>진단 유형</th>
                <th>심각도</th><th>상세 내용 및 조치</th><th>상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((log, i) => (
                <tr key={i}>
                  <td>{log.time}</td>
                  <td>{log.plant}</td>
                  <td>{log.device}</td>
                  <td>{log.type}</td>
                  <td><span className={`badge ${log.badge || (log.status === 'warning' ? 'badge-warning' : 'badge-active')}`}>{log.statusText}</span></td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal', minWidth: 260 }} title={log.raw}>{log.desc}</td>
                  <td><strong>{log.stateText}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
