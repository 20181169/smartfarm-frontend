import { useState } from 'react'
import { ScrollText } from 'lucide-react'
import { useApp } from '../context/useApp'
import InverterLogModal from '../components/modals/InverterLogModal'
import MpptLogModal from '../components/modals/MpptLogModal'

export default function EquipmentView() {
  const { plant } = useApp()
  const [tab, setTab] = useState('inverter')
  const [logModal, setLogModal] = useState(null) // 'inverter' | 'mppt' | null

  const invs = plant.inverters
  const totalDcP = invs.reduce((s, i) => s + i.powerKw * 1.05, 0)
  const totalAcP = invs.reduce((s, i) => s + i.powerKw, 0)
  const totalGen = invs.reduce((s, i) => s + i.todayGenKwh, 0)

  return (
    <div className="view stack">
      <div>
        <div className="view-title">[{plant.id}] {plant.shortName} 설비 현황</div>
        <div className="view-sub">인버터 및 MPPT 스트링 실시간 계측</div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="segmented">
            <button className={tab === 'inverter' ? 'active' : ''} onClick={() => setTab('inverter')}>인버터 실시간 현황</button>
            <button className={tab === 'mppt' ? 'active' : ''} onClick={() => setTab('mppt')}>MPPT (스트링) 현황</button>
          </div>
          <button className="btn-terracotta" onClick={() => setLogModal(tab === 'mppt' ? 'mppt' : 'inverter')}>
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
                  <td>합계 ({invs.length}대)</td><td>-</td><td>-</td><td>-</td><td>{totalDcP.toFixed(1)}</td>
                  <td>-</td><td>-</td><td><strong>{totalAcP.toFixed(1)} kW</strong></td><td>-</td><td>-</td><td>-</td>
                  <td><strong>{totalGen.toLocaleString()} kWh</strong></td><td>-</td>
                </tr>
                {invs.map((inv) => (
                  <tr key={inv.id}>
                    <td>#{inv.id} 호기</td>
                    <td><span className="badge badge-active">가동</span></td>
                    <td>{inv.dcV}</td><td>{inv.dcA}</td><td>{(inv.powerKw * 1.05).toFixed(1)}</td>
                    <td>{inv.acV}</td><td>{inv.acA}</td><td><strong>{inv.powerKw.toFixed(1)}</strong></td>
                    <td>{(inv.powerKw * 1.25).toFixed(1)}</td><td>60.0</td><td>{inv.temp}</td>
                    <td><strong>{inv.todayGenKwh}</strong></td>
                    <td className="text-muted" style={{ fontSize: 11.5 }}>{inv.comm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {logModal === 'inverter' && <InverterLogModal count={invs.length} onClose={() => setLogModal(null)} />}
      {logModal === 'mppt' && <MpptLogModal count={invs.length} onClose={() => setLogModal(null)} />}
    </div>
  )
}
