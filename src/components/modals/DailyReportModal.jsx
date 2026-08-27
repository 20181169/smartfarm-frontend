import { X, FileDown } from 'lucide-react'

export default function DailyReportModal({ plant, year, month, day, onClose }) {
  const baseGen = plant.capacityKw * 3.2
  const dayGen = Math.round(baseGen + ((day * 37 + month * 19) % (baseGen * 0.4)))
  const dayRev = (dayGen * 0.0203).toFixed(1)
  const sunHours = (3.8 + (day % 3) * 0.7).toFixed(1)
  const peakKw = (plant.capacityKw * (0.55 + (day % 4) * 0.08)).toFixed(1)
  const weatherTag = day % 4 === 0 ? '⛈️ 흐림' : day % 3 === 0 ? '☁️ 구름' : '☀️ 맑음'
  const weatherWord = day % 4 === 0 ? '비/흐림' : day % 3 === 0 ? '구름조금' : '맑음'

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: 16 }}>{year}년 {month}월 {day}일 일간 발전 리포트</h3>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginTop: 3 }}>{plant.name}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X /></button>
        </div>

        <div className="stat-tiles" style={{ marginBottom: 14 }}>
          <div className="stat-tile"><div className="t-label">일일 발전량</div><div className="t-value text-sage">{dayGen.toLocaleString()} kWh</div></div>
          <div className="stat-tile"><div className="t-label">예상 수익</div><div className="t-value text-terra">{dayRev} 만원</div></div>
          <div className="stat-tile"><div className="t-label">일조 / 피크</div><div className="t-value" style={{ fontSize: 13 }}>{sunHours}h / {peakKw}kW</div></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
          <span>⚡ 인버터별 상세 발전 내역</span>
          <span className="text-sage">날씨: {weatherTag}</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>ID</th><th>출력</th><th>시간</th><th>발전량</th><th>효율</th></tr></thead>
            <tbody>
              {plant.inverters.map((inv) => {
                const invGen = Math.round(dayGen / plant.inverters.length)
                const invPower = (invGen / parseFloat(sunHours)).toFixed(1)
                const eff = (97.5 + (inv.id % 3) * 0.6).toFixed(1)
                return (
                  <tr key={inv.id}>
                    <td>#{inv.id}</td><td><strong>{invPower}kW</strong></td><td>{sunHours}h</td>
                    <td><strong>{invGen}kWh</strong></td><td className="text-sage">{eff}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ background: 'var(--sage-soft)', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: 10, fontSize: 11.5, lineHeight: 1.55, marginTop: 14 }}>
          <strong className="text-sage">🤖 AI 일간 진단 총평:</strong><br />
          {year}년 {month}월 {day}일 ({weatherWord}) 기준 전체 {plant.inverters.length}대 인버터 가동률 100% 달성.
          평균 발전시간 {sunHours}시간으로 목표 대비 상회함.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="icon-btn" onClick={onClose}>닫기</button>
          <button className="btn-terracotta" onClick={() => alert('일간 리포트 PDF 다운로드 시작')}><FileDown /> PDF 다운로드</button>
        </div>
      </div>
    </div>
  )
}
