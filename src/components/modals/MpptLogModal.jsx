import { useState } from 'react'
import { X } from 'lucide-react'
import { MpptLogChart } from '../charts'
import { MPPT_LOG_TABLE } from '../../data/market'

export default function MpptLogModal({ count = 4, onClose }) {
  const [mode, setMode] = useState('chart')
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 860 }}>
        <div className="modal-header">
          <h3 style={{ fontSize: 17 }}>MPPT (스트링) 로그</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="date" className="input" defaultValue="2026-07-22" style={{ width: 'auto' }} />
            <button className="icon-btn">검색</button>
            <button className="modal-close" onClick={onClose}><X /></button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
          <select className="input" style={{ maxWidth: 240 }}>
            {Array.from({ length: count }, (_, i) => <option key={i} value={i + 1}>인버터-{i + 1}</option>)}
          </select>
          <div className="segmented">
            <button className={mode === 'chart' ? 'active' : ''} onClick={() => setMode('chart')}>차트</button>
            <button className={mode === 'table' ? 'active' : ''} onClick={() => setMode('table')}>표</button>
          </div>
        </div>
        {mode === 'chart' ? (
          <div style={{ height: 320, position: 'relative' }}><MpptLogChart /></div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="data">
              <thead><tr><th>통신시간</th><th>1CH (A)</th><th>2CH (A)</th><th>3CH (A)</th><th>4CH (A)</th></tr></thead>
              <tbody>
                {MPPT_LOG_TABLE.map((r, i) => (
                  <tr key={i}><td className="text-muted" style={{ fontSize: 11.5 }}>{r.time}</td><td>{r.ch1}</td><td>{r.ch2}</td><td>{r.ch3}</td><td>{r.ch4}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
