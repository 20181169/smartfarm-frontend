import { useState } from 'react'
import { Video } from 'lucide-react'
import { AGRI_ADMIN_DATA, complianceBadge } from '../data/compliance'

const SITES = Object.values(AGRI_ADMIN_DATA.sites)
const demoAction = (n) => alert(`데모: '${n}' 은(는) 백엔드 액션 API가 아직 없습니다.`)

export default function CctvEvidenceView() {
  const [siteId, setSiteId] = useState(SITES[0].id)
  const s = AGRI_ADMIN_DATA.sites[siteId]
  const ev = s.cameraEvidence
  const rv = ev.reviewHistory?.[0]

  return (
    <div className="view stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="view-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Video size={20} /> AI 영상 증빙 검토 <span className="badge badge-neutral" style={{ fontSize: 11 }}>데모</span>
          </div>
          <div className="view-sub">{s.code} / {ev.camId}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn-primary" onClick={() => demoAction('리포트에 반영')}>리포트에 반영</button>
          <select className="plant-select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {SITES.map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div className="card">
          <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(135deg,#233a2b,#3b5a47)', border: '1px solid var(--border)' }}>
            <div style={{ position: 'absolute', top: 10, right: 12, color: '#fff', fontFamily: 'monospace', fontSize: 12, fontWeight: 800, background: 'rgba(0,0,0,.7)', padding: '4px 10px', borderRadius: 6 }}>{ev.timestamp} KST</div>
            <div style={{ position: 'absolute', top: '42%', left: '47%', width: 58, height: 108, border: '2.5px solid #10b981', background: 'rgba(16,185,129,.15)' }}>
              <div style={{ position: 'absolute', top: -22, left: -2, background: '#10b981', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: '4px 4px 0 0', whiteSpace: 'nowrap' }}>작업자 0.98</div>
            </div>
            {ev.machinery > 0 && (
              <div style={{ position: 'absolute', top: '52%', left: '43%', width: 118, height: 150, border: '2.5px solid #0284c7', background: 'rgba(2,132,199,.15)' }}>
                <div style={{ position: 'absolute', top: -22, left: -2, background: '#0284c7', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: '4px 4px 0 0', whiteSpace: 'nowrap' }}>농기계 0.96</div>
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 10, left: 12, color: '#fff', fontSize: 11, fontWeight: 700, background: 'rgba(0,0,0,.6)', padding: '3px 8px', borderRadius: 6 }}>🔴 REC · {ev.camId} ({ev.zone})</div>
          </div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 12, fontWeight: 600 }}>📅 {ev.timestamp} · 📍 GPS {ev.gps} · 🔒 원본 무결성 보존</div>
        </div>

        <div className="card">
          <div className="text-muted" style={{ fontSize: 12, fontWeight: 600 }}>AI 분류 및 분석 결과</div>
          <div style={{ fontSize: 20, fontWeight: 800, margin: '4px 0 8px' }}>{ev.classification}</div>
          <span className={`badge ${ev.confidence >= 90 ? 'badge-active' : 'badge-warning'}`}>신뢰도 {ev.confidence}%</span>
          <div className="info-list" style={{ marginTop: 12 }}>
            <div className="info-row"><span>촬영 일시</span><b>{ev.timestamp}</b></div>
            <div className="info-row"><span>작업자</span><b>{ev.workers}명</b></div>
            <div className="info-row"><span>농기계</span><b>{ev.machinery}대</b></div>
            <div className="info-row"><span>활동구역</span><b>{ev.zone}</b></div>
            <div className="info-row"><span>허가작물</span><b>{s.permitCrop}</b></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
            <button className="btn-primary" style={{ justifyContent: 'center' }} onClick={() => demoAction('인정')}>인정</button>
            <button className="icon-btn" style={{ justifyContent: 'center' }} onClick={() => demoAction('보류')}>보류</button>
            <button className="icon-btn" style={{ justifyContent: 'center' }} onClick={() => demoAction('오탐')}>오탐</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">판단 근거</span></div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9, color: 'var(--text-3)' }}>
            {ev.decisionBasis.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">검토 이력</span></div>
          {rv ? (
            <div className="info-row" style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: '12px 14px' }}>
              <div><b style={{ fontSize: 13 }}>{rv.reviewer}</b><div className="text-muted" style={{ fontSize: 11.5 }}>{rv.time}</div></div>
              <span className={`badge ${complianceBadge(rv.badge)}`}>{rv.action}</span>
            </div>
          ) : <div className="text-muted" style={{ fontSize: 13 }}>검토 이력 없음</div>}
        </div>
      </div>

      <div className="text-muted" style={{ fontSize: 11 }}>※ 인정/보류/오탐·리포트 반영은 백엔드 액션 API 미구현(데모). 영상은 샘플 오버레이입니다.</div>
    </div>
  )
}
