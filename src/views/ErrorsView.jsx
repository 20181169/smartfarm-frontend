import { useState, useRef } from 'react'
import { AlertTriangle, Download } from 'lucide-react'
import { ERROR_LOGS } from '../data/market'
import { exportTableToCsv } from '../lib/format'

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'warning', label: '주의' },
  { key: 'resolved', label: '해제' },
]

export default function ErrorsView() {
  const [filter, setFilter] = useState('all')
  const tableRef = useRef(null)

  const warnCount = ERROR_LOGS.filter((l) => l.status === 'warning').length
  const resCount = ERROR_LOGS.filter((l) => l.status === 'resolved').length
  const rows = ERROR_LOGS.filter((l) => filter === 'all' || l.status === filter)

  const countFor = (k) => (k === 'warning' ? warnCount : k === 'resolved' ? resCount : ERROR_LOGS.length)

  return (
    <div className="view stack">
      <div>
        <div className="view-title">AI 고장 진단 이력</div>
        <div className="view-sub">실시간 장애·경보 로그 및 AI 원인 분석</div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><AlertTriangle /> 장애 / 경보 이력</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="chip-toggle">
              {FILTERS.map((f) => (
                <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
                  {f.label} ({countFor(f.key)})
                </button>
              ))}
            </div>
            <button className="btn-primary" onClick={() => exportTableToCsv(tableRef.current, 'AI_고장진단이력_보고서')}>
              <Download /> 엑셀 내보내기
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data" ref={tableRef}>
            <thead>
              <tr>
                <th>시각</th><th>발전소</th><th>설비 / 대상</th><th>진단 유형</th>
                <th>심각도</th><th>AI 상세 진단 및 추천 조치</th><th>상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((log, i) => (
                <tr key={i}>
                  <td>{log.time}</td>
                  <td>{log.plant}</td>
                  <td>{log.device}</td>
                  <td>{log.type}</td>
                  <td><span className={`badge ${log.status === 'warning' ? 'badge-warning' : 'badge-active'}`}>{log.statusText}</span></td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal', minWidth: 260 }}>{log.desc}</td>
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
