import { BarChart3 } from 'lucide-react'
import { useApp } from '../context/useApp'
import { COMPARE_ROWS } from '../data/market'

export default function ComparisonView() {
  const { plantId, selectPlant, canSwitchPlant } = useApp()

  return (
    <div className="view stack">
      <div>
        <div className="view-title">발전소 성과(PR) 비교</div>
        <div className="view-sub">5개 발전소 발전량·수익·작물 생육 성과 비교 (행 클릭 시 해당 발전소로 전환)</div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title"><BarChart3 /> 발전소별 성과 비교표</span></div>
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
    </div>
  )
}
