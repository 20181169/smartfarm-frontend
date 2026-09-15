import { useState } from 'react'
import { FileCheck2, Printer } from 'lucide-react'
import { AGRI_ADMIN_DATA, complianceBadge } from '../data/compliance'

const { summary } = AGRI_ADMIN_DATA
const SITES = Object.values(AGRI_ADMIN_DATA.sites)

export default function ReportCenterView() {
  const [siteId, setSiteId] = useState(SITES[0].id)
  const s = AGRI_ADMIN_DATA.sites[siteId]
  const ev = s.cameraEvidence
  const normal = s.status.includes('정상')

  return (
    <div className="view stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="view-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileCheck2 size={20} /> 영농이행 리포트 센터 <span className="badge badge-neutral" style={{ fontSize: 11 }}>데모</span>
          </div>
          <div className="view-sub">{summary.authority} · 정기점검 보고서</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn-terracotta" onClick={() => window.print()}><Printer size={14} /> PDF 인쇄</button>
          <select className="plant-select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {SITES.map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div style={{ border: '2px solid var(--sage-strong)', borderRadius: 14, padding: 20, background: 'var(--bg-subtle)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--sage-strong)', letterSpacing: 1 }}>AGRIVOLTAIC COMPLIANCE REPORT</div>
          <h2 style={{ fontSize: 19, fontWeight: 800, margin: '6px 0 8px' }}>AI 기반 영농형 태양광 영농이행 정기점검 보고서</h2>
          <p className="text-muted" style={{ fontSize: 12, marginBottom: 16 }}>영농의무·적합작물 재배·농지 이용 적정성 확인을 위한 지자체 행정 지원 보고서</p>

          <div style={{ background: '#27372b', color: '#fff', padding: 14, borderRadius: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#c4d8cc', fontWeight: 800 }}>REPORTING PERIOD</div>
            <div style={{ fontSize: 18, fontWeight: 800, margin: '2px 0 6px' }}>{summary.reportingPeriod}</div>
            <div style={{ fontSize: 12.5, fontWeight: 800 }}>사업장: {s.name}</div>
            <div style={{ fontSize: 11, color: '#c4d8cc', marginTop: 3 }}>허가번호 {s.permitNo} · 관리기관 {summary.authority}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 110, textAlign: 'center', color: 'var(--sage-strong)', fontWeight: 700, fontSize: 12.5 }}>
              📷 {ev.camId} · {ev.timestamp} CCTV 영상 썸네일 증빙
            </div>
            <div className="card">
              <div className="text-muted" style={{ fontSize: 11, fontWeight: 800 }}>MONTHLY RESULT</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: normal ? '#10b981' : 'var(--terracotta)', margin: '4px 0' }}>{normal ? '정상' : '관찰'}</div>
              <span className={`badge ${complianceBadge(s.statusBadge)}`}>{normal ? '영농의무 이행' : '관찰 필요'}</span>
              <p className="text-muted" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
                신고작물({s.permitCrop})과 실제 작물이 {s.cropMatch ? '일치' : '유사(확인 필요)'}하며, 주요 영농활동 {s.eventsCount}건이 확인되었습니다. 실경작 면적 {s.areaRatio}%.
              </p>
            </div>
          </div>
        </div>
        <div className="text-muted" style={{ fontSize: 12, marginTop: 12 }}>자동 생성: {summary.generatedAt} · 페이지 1 / 6</div>
      </div>
    </div>
  )
}
