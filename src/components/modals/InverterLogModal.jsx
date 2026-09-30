import { useState, useEffect, useCallback } from 'react'
import { X, RefreshCw } from 'lucide-react'
import { INVERTER_LOG_SAMPLE } from '../../data/market'
import { apiTelemetryHistory, mapInverterTelemetry } from '../../lib/api'

const RANGES = [
  { minutes: 60, label: '최근 1시간' },
  { minutes: 1440, label: '최근 1일' },
  { minutes: 10080, label: '최근 7일' }, // API 허용 최대
]
const LIMIT = 1000 // API 허용 최대

const f1 = (v) => (v == null ? '-' : Number(v).toFixed(1))
const f2 = (v) => (v == null ? '-' : Number(v).toFixed(2))
const phases = (vals) => (vals.every((x) => x == null) ? '-' : vals.map(f1).join(', '))
const fmtTime = (t) => {
  const d = new Date(t)
  return !t || Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('ko-KR')
}

// 실연동: GET /telemetry/inverter/history (MRT 정규화 필드)
function LiveInverterLog({ plantId, inverters }) {
  const [deviceId, setDeviceId] = useState(inverters[0]?.deviceId || '')
  const [range, setRange] = useState(60)
  const [state, setState] = useState('loading') // loading | ok | error
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    if (!deviceId) return
    setState('loading')
    try {
      const res = await apiTelemetryHistory('inverter', plantId, { deviceId, rangeMinutes: range, limit: LIMIT })
      setRows((res?.items || []).map((d) => mapInverterTelemetry(d)))
      setState('ok')
    } catch (err) {
      setState('error')
      setMsg(err.status === 403 ? '이력 조회 권한(telemetry:read)이 없습니다.' : err.message)
    }
  }, [plantId, deviceId, range])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select className="input" style={{ flex: 1, minWidth: 180 }} value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
          {inverters.map((iv) => (
            <option key={iv.deviceId || iv.id} value={iv.deviceId || ''}>
              인버터-{iv.id}{iv.externalSeq != null ? ` (seq ${iv.externalSeq})` : ''}
            </option>
          ))}
        </select>
        <select className="input" style={{ width: 'auto' }} value={range} onChange={(e) => setRange(Number(e.target.value))}>
          {RANGES.map((r) => <option key={r.minutes} value={r.minutes}>{r.label}</option>)}
        </select>
        <button className="icon-btn" onClick={load} title="다시 불러오기"><RefreshCw size={14} /></button>
      </div>

      {state === 'loading' && <div className="text-muted" style={{ fontSize: 13, padding: '6px 2px' }}>불러오는 중…</div>}
      {state === 'error' && <div style={{ fontSize: 13, color: 'var(--terracotta)', fontWeight: 600, padding: '6px 2px' }}>{msg}</div>}
      {state === 'ok' && rows.length === 0 && (
        <div className="text-muted" style={{ fontSize: 13, padding: '6px 2px' }}>해당 기간에 수집된 데이터가 없습니다.</div>
      )}
      {state === 'ok' && rows.length > 0 && (
        <>
          <div className="text-muted" style={{ fontSize: 11.5, marginBottom: 6 }}>
            {rows.length.toLocaleString()}건{rows.length >= LIMIT ? ` (최근 ${LIMIT}건까지만 표시)` : ''}
          </div>
          <div className="table-wrap" style={{ maxHeight: 480, overflowY: 'auto' }}>
            <table className="data">
              <thead>
                <tr>
                  <th>측정시각</th><th>입력전압(V)</th><th>입력전류(A)</th><th>입력전력(kW)</th>
                  <th>출력전압 RS,ST,TR(V)</th><th>출력전류 R,S,T(A)</th><th>출력전력(kW)</th>
                  <th>주파수(Hz)</th><th title="단위(% / 0~1 계수) 업체 확인 대기">역률*</th><th>누적발전량(kWh)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="text-muted" style={{ fontSize: 11.5 }}>{fmtTime(r.measuredAt)}</td>
                    <td>{f1(r.dcVoltV)}</td><td>{f1(r.dcCurrentA)}</td><td>{f2(r.dcPowerKw)}</td>
                    <td>{phases(r.acVoltV)}</td><td>{phases(r.acCurrentA)}</td><td><strong>{f2(r.powerKw)}</strong></td>
                    <td>{f1(r.freqHz)}</td><td>{f1(r.powerFactor)}</td><td>{f1(r.energyKwh)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>
            * 역률은 단위(% 또는 0~1 계수)가 업체 확인 대기 중인 원시 정규화값입니다. 누적발전량은 보정값(corrected_energy_wh) 기준.
          </div>
        </>
      )}
    </>
  )
}

// 데모: 샘플 로그
function DemoInverterLog({ count }) {
  const [inv, setInv] = useState('1')
  return (
    <>
      <select className="input" style={{ marginBottom: 12 }} value={inv} onChange={(e) => setInv(e.target.value)}>
        {Array.from({ length: count }, (_, i) => (
          <option key={i} value={i + 1}>인버터-{i + 1}</option>
        ))}
      </select>
      <div className="table-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}>
        <table className="data">
          <thead>
            <tr>
              <th>번호</th><th>입력전압</th><th>입력전류</th><th>입력전력</th>
              <th>출력전압(RST)</th><th>출력전류(RST)</th><th>출력전력</th>
              <th>주파수</th><th>역률</th><th>통신시간</th>
            </tr>
          </thead>
          <tbody>
            {INVERTER_LOG_SAMPLE.map((r, i) => (
              <tr key={i}>
                <td>{inv}</td><td>{r.dcV}</td><td>{r.dcA}</td><td>{r.dcP}</td>
                <td>{r.rstV}</td><td>{r.rstA}</td><td><strong>{r.acP}</strong></td>
                <td>{r.freq}</td><td>{r.pf}</td>
                <td className="text-muted" style={{ fontSize: 11.5 }}>{r.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function InverterLogModal({ count = 4, plantId, inverters = [], onClose }) {
  const live = !!plantId && inverters.some((iv) => iv.deviceId)
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: live ? 1040 : 860 }}>
        <div className="modal-header">
          <h3 style={{ fontSize: 17 }}>
            인버터 이력 로그
            {live
              ? <span className="badge badge-active" style={{ marginLeft: 8, fontSize: 11 }}>백엔드 실데이터</span>
              : <span className="badge badge-neutral" style={{ marginLeft: 8, fontSize: 11 }}>데모</span>}
          </h3>
          <button className="modal-close" onClick={onClose}><X /></button>
        </div>
        {live ? (
          <LiveInverterLog plantId={plantId} inverters={inverters.filter((iv) => iv.deviceId)} />
        ) : (
          <DemoInverterLog count={count} />
        )}
      </div>
    </div>
  )
}
