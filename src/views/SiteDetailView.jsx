import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Video } from 'lucide-react'
import { AGRI_ADMIN_DATA, complianceBadge } from '../data/compliance'

const SITES = Object.values(AGRI_ADMIN_DATA.sites)
const demoAction = (n) => alert(`데모: '${n}' 은(는) 백엔드 액션 API가 아직 없습니다.`)

export default function SiteDetailView() {
  const navigate = useNavigate()
  const [siteId, setSiteId] = useState(SITES[0].id)
  const s = AGRI_ADMIN_DATA.sites[siteId]

  const kpis = [
    { label: '영농이행지수', value: s.complianceScore, color: 'var(--sage-strong)' },
    { label: '신고작물 일치', value: `${s.permitCrop}${s.cropMatch ? ' (일치)' : ' (확인)'}`, color: s.cropMatch ? 'var(--sage-strong)' : 'var(--terracotta)', small: true },
    { label: '실경작면적', value: `${s.areaRatio}%`, color: 'var(--blue)' },
    { label: '월간 이벤트', value: `${s.eventsCount}건`, color: 'var(--blue)' },
    { label: '연속 미활동', value: `${s.inactiveDays}일`, color: 'var(--sage-strong)' },
  ]

  return (
    <div className="view stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="view-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={20} /> 영농 사업장 상세 관제 <span className="badge badge-neutral" style={{ fontSize: 11 }}>데모</span>
          </div>
          <div className="view-sub">사업장 / {s.code}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`badge ${complianceBadge(s.statusBadge)}`} style={{ fontSize: 13, padding: '6px 12px' }}>{s.status}</span>
          <select className="plant-select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {SITES.map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>{k.label}</div>
            <div style={{ fontSize: k.small ? 16 : 22, fontWeight: 800, color: k.color, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-3">
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <span className="card-title">월간 영농활동 이력</span>
            <button className="icon-btn" onClick={() => navigate('/cctv')}><Video size={14} /> 영상 검토</button>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>일시</th><th>탐지 활동</th><th>카메라</th><th>신뢰도</th><th>검토</th></tr></thead>
              <tbody>
                {s.timeline.map((t, i) => (
                  <tr key={i}>
                    <td className="text-muted" style={{ fontSize: 12 }}>{t.date}</td>
                    <td style={{ textAlign: 'left' }}>{t.title}</td>
                    <td>{t.cam}</td>
                    <td>{t.confidence}</td>
                    <td><span className={`badge ${t.review === '인정' ? 'badge-active' : 'badge-warning'}`}>{t.review}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">허가정보 비교</span></div>
          <div className="info-list">
            <div className="info-row"><span>신고 작물</span><b>{s.permitCrop}</b></div>
            <div className="info-row"><span>AI 확인 작물</span><b className={s.cropMatch ? 'text-sage' : 'text-terra'}>{s.aiCrop}{s.cropMatch ? ' (일치)' : ' (확인 필요)'}</b></div>
            <div className="info-row"><span>허가 면적</span><b>{s.permitArea.toLocaleString()} ㎡</b></div>
            <div className="info-row"><span>실경작 면적</span><b>{s.actualArea.toLocaleString()} ㎡ ({s.areaRatio}%)</b></div>
            <div className="info-row"><span>타용도 의심</span><b className="text-sage">{s.otherUseCount > 0 ? `${s.otherUseCount}건` : '없음 (미탐지)'}</b></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ borderColor: 'var(--terracotta)' }}>
        <div className="card-header">
          <span className="card-title text-terra">⚠️ 이상징후 및 관찰 항목</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="icon-btn" onClick={() => demoAction('사업자 보충 사진 요청')}>사업자 보충 사진 요청</button>
            <button className="btn-terracotta" onClick={() => demoAction('현장점검 배정')}>현장점검 배정</button>
          </div>
        </div>
        <div className="info-list">
          {s.anomalies.map((a, i) => (
            <div key={i} className="info-row" style={{ alignItems: 'flex-start', gap: 8 }}>
              <div><b style={{ fontSize: 13 }}>{a.title}</b><div className="text-muted" style={{ fontSize: 12 }}>{a.desc}</div></div>
              <span className={`badge ${complianceBadge(a.badge)}`}>{a.status}</span>
            </div>
          ))}
        </div>
        <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>※ 사진 요청·현장점검 배정은 백엔드 액션 API 미구현(데모)</div>
      </div>
    </div>
  )
}
