import { Sprout } from 'lucide-react'
import { AGRI_ADMIN_DATA, complianceBadge } from '../data/compliance'

// 사업자(발전소 소유주) 본인 발전소의 영농이행 준수 상태. 데모: 온누리3,4 기준.
const s = AGRI_ADMIN_DATA.sites['12139']

export default function OwnerAgriStatusView() {
  const normal = s.status.includes('정상')
  return (
    <div className="view stack">
      <div>
        <div className="view-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sprout size={20} /> 내 발전소 영농형 의무 이행 준수 <span className="badge badge-neutral" style={{ fontSize: 11 }}>데모</span>
        </div>
        <div className="view-sub">농지법 및 지자체 영농형 태양광 허가 유지에 필요한 AI 영농이행 검증 상태</div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>🌾 {s.code} · 이행 상태</div>
        <div className="grid grid-3">
          <div className="card" style={{ textAlign: 'center', background: 'var(--bg-subtle)' }}>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>이행 상태</div>
            <div style={{ marginTop: 6 }}><span className={`badge ${complianceBadge(s.statusBadge)}`} style={{ fontSize: 14, padding: '6px 12px' }}>{s.status}</span></div>
          </div>
          <div className="card" style={{ textAlign: 'center', background: 'var(--bg-subtle)' }}>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>신고 작물</div>
            <b style={{ fontSize: 16 }}>{s.permitCrop} {s.cropMatch ? '(일치)' : '(확인)'}</b>
          </div>
          <div className="card" style={{ textAlign: 'center', background: 'var(--bg-subtle)' }}>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>실제 영농 면적 비율</div>
            <b style={{ fontSize: 16, color: 'var(--sage-strong)' }}>{s.areaRatio}% (허가 기준 {s.areaRatio >= 80 ? '충족' : '미달'})</b>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: 14, background: 'var(--bg-subtle)', borderLeft: '4px solid var(--sage-strong)', borderRadius: 8, fontSize: 13, fontWeight: 600, lineHeight: 1.6 }}>
          {normal
            ? '✅ 안내: 영농 활동 검증이 완료되었으며, 발전소 허가 유지에 이상이 없습니다.'
            : '⚠️ 안내: 일부 관찰 항목이 있어 감독기관의 재확인이 필요할 수 있습니다. 상세는 감독기관 리포트를 확인하세요.'}
        </div>
      </div>
    </div>
  )
}
