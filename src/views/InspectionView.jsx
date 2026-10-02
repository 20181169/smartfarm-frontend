import { ClipboardCheck } from 'lucide-react'
import { AGRI_ADMIN_DATA, complianceBadge } from '../data/compliance'

const demoAction = (n) => alert(`데모: '${n}' 은(는) 백엔드 액션 API가 아직 없습니다.`)

// 현장 점검 및 행정조치 관리 (지자체 감독관용) — 통합 버전 화면 포팅. 백엔드 점검 API 가 없어 데모.
export default function InspectionView() {
  const targets = AGRI_ADMIN_DATA.inspectionTargets

  return (
    <div className="view stack">
      <div>
        <div className="view-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardCheck size={20} /> 현장 점검 및 행정조치 관리 <span className="badge badge-neutral" style={{ fontSize: 11 }}>데모</span>
        </div>
        <div className="view-sub">강원특별자치도 영농형 태양광 현장 점검 일정 및 조치 내역</div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">현장 점검 요청 대상 사업장 목록</span></div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>사업장 명칭</th><th>허가 번호</th><th>주요 점검 사유</th><th>위험도</th><th>조치 일정</th><th>행정조치</th></tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id}>
                  <td style={{ textAlign: 'left' }}><strong>{t.name}</strong></td>
                  <td className="text-muted">{t.permitNo}</td>
                  <td style={{ textAlign: 'left' }}>{t.reason}</td>
                  <td><span className={`badge ${complianceBadge(t.badge)}`}>{t.level}</span></td>
                  <td><strong>{t.schedule}</strong></td>
                  <td><button className="icon-btn" onClick={() => demoAction(t.action)}>{t.action}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>※ 시정명령 발송·추가증빙 요청은 백엔드 액션 API 미구현(데모)</div>
      </div>
    </div>
  )
}
