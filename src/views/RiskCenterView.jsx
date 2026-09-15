import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { AGRI_ADMIN_DATA, complianceBadge } from '../data/compliance'

const SITES = Object.values(AGRI_ADMIN_DATA.sites)

export default function RiskCenterView() {
  const [siteId, setSiteId] = useState(SITES[0].id)
  const s = AGRI_ADMIN_DATA.sites[siteId]

  // 사업장 데이터에서 법령 준수 검토 항목 구성
  const legal = [
    { item: '적합작물 재배', basis: `AI 엽형 분석 · ${s.cropVerificationStatus}`, ai: s.cropMatch ? '일치' : '유사/확인', ok: s.cropMatch },
    { item: '실경작 면적', basis: `영상·위성 면적 분석 (허가 ${s.permitArea.toLocaleString()}㎡)`, ai: `${s.areaRatio}%`, ok: s.areaRatio >= 80 },
    { item: '영농활동 지속', basis: `CCTV 활동 탐지 ${s.eventsCount}건`, ai: '확인', ok: true },
    { item: '농지 타용도 전용', basis: '영상 패턴 분석', ai: s.otherUseCount > 0 ? `${s.otherUseCount}건` : '미탐지', ok: s.otherUseCount === 0 },
    { item: '무활동 기간', basis: '활동 로그 (기준 14일)', ai: `${s.inactiveDays}일`, ok: s.inactiveDays <= 14 },
  ]

  return (
    <div className="view stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="view-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={20} /> 이상징후 및 법령 준수 검토 센터 <span className="badge badge-neutral" style={{ fontSize: 11 }}>데모</span>
          </div>
          <div className="view-sub">강원특별자치도 영농형 태양광 리포트 &amp; 법령 검토 · {s.code}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className={`badge ${complianceBadge(s.riskBadge)}`} style={{ fontSize: 13, padding: '6px 12px' }}>{s.status.includes('관찰') ? '관찰 대상 사업장' : '정상 사업장'}</span>
          <select className="plant-select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {SITES.map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {s.anomalies.map((a, i) => (
          <div key={i} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
              <b style={{ fontSize: 14 }}>{a.title}</b>
              <span className={`badge ${complianceBadge(a.badge)}`}>{a.status}</span>
            </div>
            <div className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{a.desc}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">법령상 준수사항 검토</span>
          <span className="text-muted" style={{ fontSize: 12 }}>농지법 및 영농형 태양광 일시사용허가 기준</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>검토 항목</th><th>근거 자료</th><th>AI 결과</th><th>담당자 판단</th></tr></thead>
            <tbody>
              {legal.map((r, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'left' }}><b>{r.item}</b></td>
                  <td style={{ textAlign: 'left' }} className="text-muted">{r.basis}</td>
                  <td>{r.ai}</td>
                  <td><span className={`badge ${r.ok ? 'badge-active' : 'badge-warning'}`}>{r.ok ? '인정' : '보류'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
