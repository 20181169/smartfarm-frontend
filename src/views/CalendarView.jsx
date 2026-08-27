import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../context/useApp'
import DailyReportModal from '../components/modals/DailyReportModal'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function CalendarView() {
  const { plant } = useApp()
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(7)
  const [selectedDay, setSelectedDay] = useState(null)

  const firstDayIndex = new Date(year, month - 1, 1).getDay()
  const totalDays = new Date(year, month, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDayIndex; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) {
    const baseGen = plant.capacityKw * 2.8
    const gen = Math.round(baseGen + ((d * 37 + month * 19) % (baseGen * 0.5)))
    const rev = (gen * 0.0203).toFixed(1)
    cells.push({ day: d, gen, rev })
  }

  const changeMonth = (delta) => {
    let y = year
    let m = month + delta
    if (m > 12) { m = 1; y++ } else if (m < 1) { m = 12; y-- }
    setYear(y); setMonth(m)
  }

  return (
    <div className="view stack">
      <div>
        <div className="view-title">{year}년 {month}월 발전량 달력</div>
        <div className="view-sub">날짜를 클릭하면 상세 일간 리포트가 표시됩니다</div>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="icon-btn" onClick={() => changeMonth(-1)}><ChevronLeft /></button>
            <button className="icon-btn" onClick={() => changeMonth(1)}><ChevronRight /></button>
            <button className="btn-terracotta" onClick={() => { setYear(2026); setMonth(7) }}>오늘</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input" style={{ width: 'auto' }} value={year} onChange={(e) => setYear(+e.target.value)}>
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select className="input" style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(+e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}월</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12.5, fontWeight: 700 }}>
          <span className="text-blue">● 발전량 (kWh)</span>
          <span className="text-terra">● 매출액 (만원)</span>
        </div>

        <div className="cal-head">
          {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
        </div>
        <div className="cal-grid" style={{ marginTop: 6 }}>
          {cells.map((c, i) =>
            c ? (
              <div className="cal-cell" key={i} onClick={() => setSelectedDay(c.day)}>
                <div className="d-num">{c.day}</div>
                <div className="d-gen">{c.gen.toLocaleString()}</div>
                <div className="d-rev">{c.rev}</div>
              </div>
            ) : (
              <div className="cal-cell empty" key={i} />
            )
          )}
        </div>
      </div>

      {selectedDay && (
        <DailyReportModal plant={plant} year={year} month={month} day={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  )
}
