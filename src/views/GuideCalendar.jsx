import { RICE_GUIDE_MONTHS } from '../lib/riceGuideSchedule'

export default function GuideCalendar({ year }) {
  return <section className="fw-guide-calendar" aria-label="월별 영농 가이드">
    <div className="fw-subhead"><h3>{year}년 벼 재배 가이드</h3><span className="fw-tag">가이드 기반 계획</span></div>
    <p>가이드 일정을 기본으로 계획을 작성합니다. 재배구역과 장비·인력을 입력한 뒤 저장하세요.</p>
    <ol>{RICE_GUIDE_MONTHS.map(item => <li key={item.month}><span>{item.month}</span><strong>{item.title}</strong><small>{item.detail}</small></li>)}</ol>
    <p className="fw-muted">벼 이앙재배의 시연 일정입니다. 월별 흐름과 자동 입력된 일별 날짜는 지역·품종별 확정 재배력이 아니며, 실제 적용 전 현장 기준을 확인해야 합니다.</p>
  </section>
}
