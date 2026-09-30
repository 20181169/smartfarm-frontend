import { useState, useEffect, useCallback } from 'react'
import { ScrollText, Server, Wifi, RefreshCw } from 'lucide-react'
import { useApp } from '../context/useApp'
import { apiGetDevices, getToken } from '../lib/api'
import InverterLogModal from '../components/modals/InverterLogModal'
import MpptLogModal from '../components/modals/MpptLogModal'

const DEVICE_TYPE_LABEL = {
  inverter: '인버터',
  environment_sensor: '환경센서',
  weather_station: '기상관측',
  camera: '카메라',
  rtu: 'RTU',
}
const DEVICE_STATUS_BADGE = {
  active: { cls: 'badge-active', label: '운영' },
  inactive: { cls: 'badge-neutral', label: '정지' },
  maintenance: { cls: 'badge-warning', label: '점검' },
  fault: { cls: 'badge-warning', label: '고장' },
}

// 백엔드 장비 인벤토리 (선택 발전소가 백엔드 발전소일 때만 표시)
function DeviceInventory({ plantId }) {
  const [state, setState] = useState('idle') // idle | loading | ok | error
  const [devices, setDevices] = useState([])
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    if (!getToken()) {
      setState('idle')
      return
    }
    setState('loading')
    try {
      const data = await apiGetDevices(plantId)
      setDevices(data?.items || [])
      setState('ok')
    } catch (err) {
      setState('error')
      setMsg(
        err.status === 401
          ? '로그인이 필요합니다.'
          : err.status === 0
            ? '백엔드에 연결할 수 없습니다.'
            : err.message
      )
    }
  }, [plantId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><Server /> 장비 인벤토리 (백엔드)</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {state === 'ok' && <span className="badge badge-active"><Wifi size={13} /> 백엔드 연결됨</span>}
          <button className="icon-btn" onClick={load} title="다시 불러오기"><RefreshCw size={14} /></button>
        </div>
      </div>

      {state === 'loading' && <div className="text-muted" style={{ fontSize: 13, padding: '4px 2px' }}>불러오는 중…</div>}
      {state === 'error' && <div style={{ fontSize: 13, color: 'var(--terracotta)', fontWeight: 600, padding: '4px 2px' }}>{msg}</div>}
      {state === 'ok' && devices.length === 0 && (
        <div className="text-muted" style={{ fontSize: 13, padding: '6px 2px' }}>등록된 장비가 없습니다.</div>
      )}
      {state === 'ok' && devices.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>장비명</th><th>종류</th><th>모델</th><th>S/N</th><th>설치일</th><th>상태</th></tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                const b = DEVICE_STATUS_BADGE[d.status] || { cls: 'badge-neutral', label: d.status || '-' }
                return (
                  <tr key={d.device_id}>
                    <td style={{ textAlign: 'left' }}><strong>{d.name}</strong></td>
                    <td>{DEVICE_TYPE_LABEL[d.device_type] || d.device_type}</td>
                    <td>{d.model || '-'}</td>
                    <td>{d.serial_number || '-'}</td>
                    <td>{d.install_date || '-'}</td>
                    <td><span className={`badge ${b.cls}`}>{b.label}</span></td>
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

const f1 = (v) => (v == null ? '-' : Number(v).toFixed(1))
const sum = (vals) => {
  const xs = vals.filter((v) => v != null)
  return xs.length ? xs.reduce((s, v) => s + v, 0) : null
}
// 실연동 인버터(_live)는 백엔드 정규화 값만 쓰고(없으면 '-'), 데모 인버터는 기존 표시식을 유지한다.
const dcPowerOf = (inv) => (inv._live ? inv.dcPowerKw : inv.powerKw * 1.05)
const peakOf = (inv) => (inv._live ? inv.peakKw : inv.powerKw * 1.25)
const freqOf = (inv) => (inv._live ? inv.freqHz : 60)

export default function EquipmentView() {
  const { plant } = useApp()
  const [tab, setTab] = useState('inverter')
  const [logModal, setLogModal] = useState(null) // 'inverter' | 'mppt' | null

  const invs = plant.inverters
  const isLive = !!plant._live
  const totalDcP = sum(invs.map(dcPowerOf))
  const totalAcP = sum(invs.map((i) => i.powerKw))
  const totalGen = sum(invs.map((i) => i.todayGenKwh))

  return (
    <div className="view stack">
      <div>
        <div className="view-title">{plant._backend ? plant.name : `[${plant.id}] ${plant.shortName}`} 설비 현황</div>
        <div className="view-sub">
          {isLive ? '인버터 실시간 계측 (MRT 정규화 텔레메트리)' : '인버터 및 MPPT 스트링 실시간 계측'}
        </div>
      </div>

      {plant._backend && <DeviceInventory plantId={plant.id} />}

      <div className="card">
        <div className="card-header">
          <div className="segmented">
            <button className={tab === 'inverter' ? 'active' : ''} onClick={() => setTab('inverter')}>인버터 실시간 현황</button>
            <button className={tab === 'mppt' ? 'active' : ''} onClick={() => setTab('mppt')}>MPPT (스트링) 현황</button>
          </div>
          <button
            className="btn-terracotta"
            disabled={isLive && tab === 'mppt'}
            title={isLive && tab === 'mppt' ? 'MPPT 데이터는 수집하지 않습니다' : undefined}
            onClick={() => setLogModal(tab === 'mppt' ? 'mppt' : 'inverter')}
          >
            <ScrollText /> 이력 로그 조회
          </button>
        </div>

        <div className="text-sage" style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 8 }}>
          👈 좌우로 스와이프하여 상세 데이터를 확인하세요
        </div>

        {tab === 'inverter' ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>번호</th><th>상태</th><th>입력전압(V)</th><th>입력전류(A)</th><th>입력전력(kW)</th>
                  <th>출력전압 L1,L2,L3(V)</th><th>출력전류 L1,L2,L3(A)</th><th>출력전력(kW)</th>
                  <th>PEAK(kW)</th><th>주파수(Hz)</th><th>온도(°C)</th><th>일일발전량(kWh)</th><th>최종통신시간</th>
                </tr>
              </thead>
              <tbody>
                <tr className="row-summary">
                  <td>합계 ({invs.length}대)</td><td>-</td><td>-</td><td>-</td><td>{f1(totalDcP)}</td>
                  <td>-</td><td>-</td><td><strong>{totalAcP == null ? '-' : `${f1(totalAcP)} kW`}</strong></td><td>-</td><td>-</td><td>-</td>
                  <td><strong>{totalGen == null ? '-' : `${totalGen.toLocaleString()} kWh`}</strong></td><td>-</td>
                </tr>
                {invs.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      #{inv.id} 호기
                      {inv.externalSeq != null && <span className="text-muted" style={{ fontSize: 10.5, marginLeft: 4 }}>seq {inv.externalSeq}</span>}
                    </td>
                    <td>
                      <span className={`badge ${inv.state === '지연' ? 'badge-warning' : 'badge-active'}`}>{inv.state || '가동'}</span>
                    </td>
                    <td>{inv.dcV ?? '-'}</td><td>{inv.dcA ?? '-'}</td><td>{f1(dcPowerOf(inv))}</td>
                    <td>{inv.acV}</td><td>{inv.acA}</td><td><strong>{f1(inv.powerKw)}</strong></td>
                    <td>{f1(peakOf(inv))}</td><td>{f1(freqOf(inv))}</td><td>{inv.temp ?? '-'}</td>
                    <td><strong>{inv.todayGenKwh ?? '-'}</strong></td>
                    <td className="text-muted" style={{ fontSize: 11.5 }}>{inv.comm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : isLive ? (
          <div className="text-muted" style={{ fontSize: 13, padding: '10px 2px', lineHeight: 1.6 }}>
            MPPT(스트링) 채널 데이터는 MRT 연동 범위에서 수집하지 않습니다.
            <br />(업체 원본 PvChVolt·PvCurrent·Mppt_Volt·Mppt_Current 는 미수집 항목)
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>번호</th><th>구분</th><th>1CH (A)</th><th>2CH (A)</th><th>3CH (A)</th><th>4CH (A)</th><th>상태</th></tr>
              </thead>
              <tbody>
                {invs.map((inv) => {
                  const a = (inv.dcA * 0.25).toFixed(1)
                  return (
                    <tr key={inv.id}>
                      <td>#{inv.id} 호기</td><td><strong>MPPT</strong></td>
                      <td>{a}</td><td>{a}</td><td>{a}</td><td>0.0</td>
                      <td><span className="badge badge-active">정상</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {logModal === 'inverter' && (
        <InverterLogModal
          count={invs.length}
          plantId={plant.id}
          inverters={isLive ? invs : []}
          onClose={() => setLogModal(null)}
        />
      )}
      {logModal === 'mppt' && <MpptLogModal count={invs.length} onClose={() => setLogModal(null)} />}
    </div>
  )
}
