import { useState } from 'react'
import { X } from 'lucide-react'
import { INVERTER_LOG_SAMPLE } from '../../data/market'

export default function InverterLogModal({ count = 4, onClose }) {
  const [inv, setInv] = useState('1')
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 860 }}>
        <div className="modal-header">
          <h3 style={{ fontSize: 17 }}>인버터 이력 로그</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="date" className="input" defaultValue="2026-07-22" style={{ width: 'auto' }} />
            <button className="icon-btn">검색</button>
            <button className="modal-close" onClick={onClose}><X /></button>
          </div>
        </div>
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
      </div>
    </div>
  )
}
