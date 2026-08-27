import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { PlantDetailChart } from '../charts'

export default function PlantDetailModal({ plant, onClose }) {
  const [date, setDate] = useState('2026-07-22')

  const shift = (delta) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().split('T')[0])
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h3 style={{ fontSize: 17 }}>{date} 발전량 · {plant.shortName}</h3>
          <button className="modal-close" onClick={onClose}><X /></button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
          <button className="icon-btn" onClick={() => shift(-1)}><ChevronLeft /></button>
          <span className="pill"><Calendar /> <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ border: 'none', background: 'transparent', color: 'var(--text)', fontWeight: 700 }} /></span>
          <button className="icon-btn" onClick={() => shift(1)}><ChevronRight /></button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px 6px', fontSize: 12, fontWeight: 700 }}>
          <span className="text-blue">│ 일출 05:25</span>
          <span className="text-terra">│ 일몰 19:46</span>
        </div>
        <div style={{ height: 250, position: 'relative', background: 'var(--bg-subtle)', borderRadius: 12, padding: 10 }}>
          <PlantDetailChart />
        </div>

        <div style={{ textAlign: 'center', fontSize: 13, marginTop: 14, background: 'var(--bg-subtle)', padding: 10, borderRadius: 10, fontWeight: 600 }}>
          발전량 <b className="text-blue">{plant.cardTodayGen}</b> &nbsp;|&nbsp;
          발전금액(SMP) <b className="text-blue">{plant.cardTodaySmp}</b> &nbsp;|&nbsp;
          발전시간 <b className="text-blue">{plant.cardTodayGenHours}</b>
        </div>
      </div>
    </div>
  )
}
