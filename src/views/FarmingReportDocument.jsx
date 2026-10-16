import { useEffect, useMemo, useRef, useState } from 'react'

const REPORT_COMPANY_NAME = '동양연합 엔지니어링'
const REPORT_COMPANY_LOGO = `${import.meta.env.BASE_URL}logo.png`

const LABELS = {
  machinery_work: '농기계 작업', sowing: '파종', transplanting: '이식',
  irrigation: '관수', fertilization: '시비', harvesting: '수확', harvest: '수확',
  weeding: '제초', pest_control: '병해충 방제',
  tractor: '트랙터', person: '사람', car: '승용차', truck: '트럭',
}
const PHASES = { waiting: '대기', monitoring: '관찰 중', review_required: '검토 필요', excluded: '제외' }
const ASSESSMENTS = { fulfilled: '이행', not_fulfilled: '미이행', unable_to_determine: '판단 불가' }
const STATES = { draft: '검토 전', confirmed: '확정', cancelled: '취소', candidate: '후보', pending: '검토 대기', rejected: '반려' }
// Requested presentation values. These are not API results or assessment scores.
const FARMING_DEMO = {
  monthlyActivityCount: 8,
  completedStages: 3,
  // rice_stage_single_robust_v2_yolo11n_cls: SOWING, VEGETATIVE, FLOWERING, HARVEST.
  stages: ['파종', '생육', '개화', '수확'],
}
const list = value => Array.isArray(value) ? value : []
const text = value => value === null || value === undefined || value === '' ? '—' : String(value)
const label = value => LABELS[value] || text(value)
const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
const number = value => numeric(value) ? Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : '—'
const metric = (value, unit) => numeric(value) ? `${number(value)} ${unit}` : '미등록'
const timestamp = value => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '—'
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(part => [part.type, part.value]))
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}
const confidence = value => numeric(value) && Number(value) >= 0 && Number(value) <= 1 ? `${(Number(value) * 100).toFixed(1)}%` : '—'
// Long free-text fields continue as separate printable blocks, without ellipsis.
const paragraphs = value => {
  const parts = []
  let part = '', lines = 0
  for (const char of String(value || '')) {
    part += char
    if (char === '\n') lines++
    if (part.length >= 450 || lines >= 12) { parts.push(part); part = ''; lines = 0 }
  }
  if (part) parts.push(part)
  return parts
}

function Field({ title, children }) {
  return <div className="report-field"><dt>{title}</dt><dd>{children ?? '—'}</dd></div>
}
function Stat({ title, value, unit = '건', detail, tone = '' }) {
  return <div className={`report-stat ${tone}`}><span>{title}</span><strong>{number(value)}<small>{unit}</small></strong>{detail && <p>{detail}</p>}</div>
}
function Badge({ value, assessment = false }) {
  const tone = value === 'fulfilled' || value === 'confirmed' ? 'positive' : value === 'not_fulfilled' || value === 'rejected' ? 'negative' : 'neutral'
  return <span className={`report-badge ${tone}`}>{assessment ? ASSESSMENTS[value] || '평가 전' : STATES[value] || text(value)}</span>
}
function Heading({ children, detail }) {
  return <div className="report-subhead"><h2>{children}</h2>{detail && <span>{detail}</span>}</div>
}
function Empty({ children }) { return <div className="report-empty">{children}</div> }
// A printed report's signatures are independent of the farming workflow history.
function ReportSignoff() {
  const roles = ['담당', '검토', '승인']
  return (
    <table className="report-signoff" aria-label="보고서 서면 결재란">
      <tbody>
        <tr><th rowSpan={3} className="report-signoff-label" scope="rowgroup">결<br />재</th>{roles.map(role => <th key={role} scope="col">{role}</th>)}</tr>
        <tr>{roles.map(role => <td key={role} className="report-signoff-blank" aria-label={`${role} 서명란`} />)}</tr>
        <tr>{roles.map(role => <td key={role} className="report-signoff-date" aria-label={`${role} 결재일 기입란`}>일자:　　/　　</td>)}</tr>
      </tbody>
    </table>
  )
}

const WORKFLOW_STAGES = [
  { key: 'author', title: '계획 작성', results: { created: '작성완료' } },
  { key: 'reviewer', title: '활동 검토', results: { confirmed: '검토완료' } },
  { key: 'final_reviewer', title: '최종 평가', results: { fulfilled: '이행', not_fulfilled: '미이행', unable_to_determine: '판단불가' } },
]

// The API calls this payload `approval`, but it contains farming workflow events,
// not signatures or electronic approval of this report.
function WorkflowHistory({ approval }) {
  return (
    <table className="report-workflow" aria-label="영농 업무 처리 이력">
      <colgroup><col style={{ width: '15%' }} /><col style={{ width: '18%' }} /><col style={{ width: '25%' }} /><col style={{ width: '25%' }} /><col style={{ width: '17%' }} /></colgroup>
      <thead><tr>{['업무 단계', '처리자', '역할', '처리일시', '처리 결과'].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
      <tbody>{WORKFLOW_STAGES.map(stage => {
        const actor = approval?.[stage.key]
        const result = actor?.result
        const status = result ? stage.results[result] || String(result) : stage.key === 'final_reviewer' ? '미평가' : '-'
        const processedAt = timestamp(actor?.processed_at)
        const [date, time] = processedAt === '—' ? ['-'] : processedAt.split(' ')
        const tone = result === 'not_fulfilled' ? 'negative' : ['created', 'confirmed', 'fulfilled'].includes(result) ? 'positive' : 'neutral'
        return (
          <tr key={stage.key} data-workflow-stage={stage.key}>
            <th scope="row">{stage.title}</th>
            <td className="report-workflow-name">{actor?.name || '-'}</td>
            <td className="report-workflow-role">{actor?.role_name || '-'}</td>
            <td className="report-workflow-date">{time ? <time dateTime={actor.processed_at}>{date}<br />{time}</time> : date}</td>
            <td><span className={`report-badge ${tone} report-workflow-result`}>{status}</span></td>
          </tr>
        )
      })}</tbody>
    </table>
  )
}
function AssessmentStats({ counts }) {
  return <div className="report-stats"><Stat title="이행" value={counts.fulfilled} tone="positive" /><Stat title="미이행" value={counts.not_fulfilled} tone="negative" /><Stat title="판단 불가" value={counts.unable_to_determine} /><Stat title="평가 전" value={counts.pending} /></div>
}
function CountList({ values }) {
  const entries = Object.entries(values || {})
  return entries.length ? <div className="report-count-list">{entries.map(([key, value]) => <span key={key}>{label(key)} <b>{number(value)}</b><small>건</small></span>)}</div> : <span className="report-muted">집계 내역 없음</span>
}

function FarmingProgressDemo({ report }) {
  const achievementPercent = Math.round(FARMING_DEMO.completedStages / FARMING_DEMO.stages.length * 100)
  const month = /^(\d{4})-(\d{2})/.exec(report.to_date || '')
  const monthLabel = month ? `${month[1]}년 ${Number(month[2])}월` : '해당 월'
  return <section className="report-farming-demo" aria-label="영농 진행 현황">
    <div className="report-demo-heading"><h2>벼 재배 진행 현황</h2></div>
    <dl className="report-demo-metrics">
      <div><dt>파종부터 수확까지 달성률</dt><dd>{achievementPercent}% <span>(전체 {FARMING_DEMO.stages.length}단계 중 {FARMING_DEMO.completedStages}단계 완료)</span></dd></div>
      <div><dt>월간 농경활동 횟수</dt><dd>{FARMING_DEMO.monthlyActivityCount}회 <span>({monthLabel} · 보고 종료월 기준)</span></dd></div>
    </dl>
    <ol className="report-farming-stages" style={{ '--report-stage-count': FARMING_DEMO.stages.length }} aria-label="파종부터 수확까지 단계별 진행">
      {FARMING_DEMO.stages.map((stage, index) => <li key={stage} className={index < FARMING_DEMO.completedStages ? 'completed' : ''}><span>{String(index + 1).padStart(2, '0')}</span><b>{stage}</b><small>{index < FARMING_DEMO.completedStages ? '완료' : '예정'}</small></li>)}
    </ol>

  </section>
}

function buildSections(report) {
  const plant = report.plant || {}, activity = report.activity_summary || {}
  const plans = list(report.plans)
  const events = plans.flatMap(plan => list(plan.matched_events).map(event => ({ ...event, plan_title: plan.title })))
  const evidence = events.flatMap(event => list(event.vision_evidence).map(item => ({ ...item, event_title: event.title })))
  const images = evidence.filter(item => item.report_image_data_url)
  const reviews = evidence.filter(item => item.latest_review)
  const counts = { fulfilled: 0, not_fulfilled: 0, unable_to_determine: 0, pending: 0 }
  plans.forEach(plan => { counts[Object.hasOwn(ASSESSMENTS, plan.final_assessment) ? plan.final_assessment : 'pending']++ })
  const completed = plans.length - counts.pending
  const rate = plans.length ? Math.round(completed / plans.length * 1000) / 10 : null
  const block = (node, keep = false) => ({ node, keep })
  const cover = <div className="report-cover-content">
    <div className="report-cover-top"><div className="report-brand"><img src={REPORT_COMPANY_LOGO} alt="동양연합 로고" /><div><strong>{REPORT_COMPANY_NAME}</strong><span>영농형 태양광 통합 관제</span></div></div><ReportSignoff /></div>
    <div className="report-cover-title"><p>영농형 태양광 · 정기점검</p><h1>영농이행 점검 보고서</h1><span>영농계획 · 활동 기록 · 영상 증빙 · 검토 결과</span></div>
    <dl className="report-period"><Field title="보고 대상 기간">{text(report.from_date)} — {text(report.to_date)}</Field><Field title="집계 기준일">{text(report.as_of_date)}</Field></dl>
    <Heading>사업장 개요</Heading>
    <dl className="report-property-grid"><Field title="사업장명">{text(plant.name || report.plant_id)}</Field><Field title="소재지">{text(plant.address)}</Field><Field title="설비용량">{metric(plant.capacity_kw, 'kW')}</Field><Field title="사업장 면적">{metric(plant.area_m2, 'm²')}</Field></dl>
    <Heading detail="보고 대상 기간 기준">주요 집계</Heading>
    <div className="report-stats cover-stats"><Stat title="영농계획" value={report.total_plans ?? plans.length} /><Stat title="확정 영농활동" value={activity.confirmed_event_count} /><Stat title="영상 증빙" value={activity.vision_evidence_count} /><Stat title="최종평가 완료" value={completed} /></div>
    <div className="report-progress-panel"><div className="report-progress-title"><h2>평가 현황</h2><p>조회된 계획 {number(plans.length)}건 중 최종평가 {number(completed)}건 · 평가 완료율 {numeric(rate) ? `${number(rate)}%` : '산정 대상 없음'}</p></div>
      <div className="report-outcomes"><span>이행 <b>{number(counts.fulfilled)}</b>건</span><span>미이행 <b>{number(counts.not_fulfilled)}</b>건</span><span>판단 불가 <b>{number(counts.unable_to_determine)}</b>건</span><span>평가 전 <b>{number(counts.pending)}</b>건</span></div>

    </div>
  </div>

  const planBlocks = [
    block(<FarmingProgressDemo report={report} />),
    block(<><Heading>등록 계획 및 평가 기록</Heading><AssessmentStats counts={counts} /></>, plans.length > 0),
  ]
  plans.forEach((plan, i) => planBlocks.push(block(<article className="report-plan-row" data-record="plan"><div className="report-record-title"><span className="report-index">{String(i + 1).padStart(2, '0')}</span><div><h3>{text(plan.title)}</h3><p>{label(plan.activity_type)}</p></div><Badge value={plan.final_assessment} assessment /></div>
    <dl className="report-plan-fields"><Field title="계획 기간">{text(plan.planned_start_date)} ~ {text(plan.planned_end_date)}</Field><Field title="유효 연결 활동"><b className="report-inline-number">{number(plan.valid_event_count)}</b> 건</Field><Field title="진행 단계">{PHASES[plan.phase] || text(plan.phase)}</Field></dl></article>)))
  if (!plans.length) planBlocks.push(block(<Empty>해당 기간에 등록된 영농계획이 없습니다.</Empty>))

  const imageBlocks = [block(<><div className="report-stats three"><Stat title="전체 영상 증빙" value={activity.vision_evidence_count} /><Stat title="PDF 포함 이미지" value={images.length} unit="장" /><Stat title="이미지 없는 증빙" value={evidence.filter(item => !item.report_image_data_url).length} /></div><div className="report-detection-summary"><b>확정 탐지 객체</b><CountList values={activity.confirmed_detection_counts} /></div></>, false)]
  images.forEach((item, i) => {
    imageBlocks.push(block(<article className="report-evidence-card" data-record="evidence"><div className="report-record-title"><h3>증빙 {String(i + 1).padStart(2, '0')}</h3><Badge value={item.status} /></div><div className="report-image-frame"><img src={item.report_image_data_url} alt={`영상 증빙 ${i + 1}`} data-report-evidence-image="true" /></div><dl className="report-image-fields"><Field title="연결 활동">{text(item.event_title)}</Field><Field title="촬영 / 분석 시각">{timestamp(item.evidence_at)}</Field><Field title="분석 식별번호">{text(item.analysis_id)}</Field><Field title="이미지 구분">{item.report_image_type === 'annotated' ? '탐지 표시 이미지' : '원본 이미지'}</Field></dl></article>))
    const detections = list(item.detections)
    for (let start = 0; start < detections.length; start += 12) imageBlocks.push(block(<div className="report-detection-detail"><span>증빙 {i + 1} · 객체별 예측 신뢰도</span><div className="report-count-list">{detections.slice(start, start + 12).map((d, j) => <span key={j}>{label(d.label)} <b>{confidence(d.confidence)}</b></span>)}</div></div>))
  })
  if (!images.length) imageBlocks.push(block(<Empty>PDF에 포함된 증빙 이미지가 없습니다. 영상 증빙 건수와 이미지 포함 건수는 다를 수 있습니다.</Empty>))

  const eventBlocks = [block(<><div className="report-stats three"><Stat title="연결 영농활동" value={activity.matched_event_count} /><Stat title="확정 영농활동" value={activity.confirmed_event_count} /><Stat title="무효화 영농활동" value={activity.invalidated_event_count} /></div></>, events.length > 0)]
  events.forEach((event, i) => {
    eventBlocks.push(block(<article className="report-event-card" data-record="event"><div className="report-record-title"><span className="report-index">{String(i + 1).padStart(2, '0')}</span><div><h3>{text(event.title)}</h3><p>연결 계획: {text(event.plan_title)}</p></div><Badge value={event.event_status} /></div><dl className="report-property-grid"><Field title="활동유형">{label(event.activity_type)}</Field><Field title="영상 증빙"><b className="report-inline-number">{number(event.vision_evidence_count)}</b> 건</Field><Field title="활동 시작">{timestamp(event.started_at)}</Field><Field title="활동 종료">{timestamp(event.ended_at)}</Field></dl></article>))
    paragraphs(event.description).forEach((part, n) => eventBlocks.push(block(<div className="report-description"><b>활동 {i + 1} · 상세 기록{n ? ' (계속)' : ''}</b><p>{part}</p></div>)))
  })
  if (!events.length) eventBlocks.push(block(<Empty>계획에 연결된 영농활동이 없습니다.</Empty>))

  const assessmentBlocks = [
    block(<><Heading>영농 업무 처리 이력</Heading><WorkflowHistory approval={report.approval} /></>),
    block(<Heading>계획별 최종평가</Heading>, plans.length > 0),
  ]
  plans.forEach(plan => assessmentBlocks.push(block(<article className="report-assessment-row" data-record="assessment"><div className="report-record-title"><h3>{text(plan.title)}</h3><Badge value={plan.final_assessment} assessment /></div><dl className="report-plan-fields"><Field title="계획 기간">{text(plan.planned_start_date)} ~ {text(plan.planned_end_date)}</Field><Field title="유효 연결 활동"><b className="report-inline-number">{number(plan.valid_event_count)}</b> 건</Field><Field title="최근 평가 시각">{plan.latest_assessed_at ? timestamp(plan.latest_assessed_at) : '평가 기록 없음'}</Field></dl></article>)))
  if (!plans.length) assessmentBlocks.push(block(<Empty>평가 대상 계획이 없습니다.</Empty>))
  assessmentBlocks.push(block(<Heading detail="증빙별 최근 검토 기록">영상 증빙 검토</Heading>, reviews.length > 0))
  reviews.forEach((item, i) => {
    const parts = paragraphs(item.latest_review.comment || '검토 의견 없음')
    parts.forEach((part, j) => assessmentBlocks.push(block(<article className="report-review-card" data-record={j === 0 ? 'review' : undefined}><div className="report-record-title"><h3>검토 {i + 1}{j ? ' · 의견 계속' : ''}</h3><Badge value={item.latest_review.new_status} /></div>{j === 0 && <p className="report-review-meta">{timestamp(item.latest_review.reviewed_at)}<br />분석 식별번호: {text(item.analysis_id)}</p>}<p className="report-review-comment">{part}</p></article>)))
  })
  if (!reviews.length) assessmentBlocks.push(block(<Empty>표시할 영상 검토 기록이 없습니다.</Empty>))

  const notesBlocks = [block(<><Heading>조회 및 집계 기준</Heading><dl className="report-property-grid"><Field title="사업장 식별번호">{text(report.plant_id)}</Field><Field title="보고 대상 기간">{text(report.from_date)} ~ {text(report.to_date)}</Field><Field title="집계 기준일">{text(report.as_of_date)}</Field><Field title="활동유형 필터">{report.activity_type ? label(report.activity_type) : '전체'}</Field><Field title="위도">{text(plant.lat)}</Field><Field title="경도">{text(plant.lng)}</Field></dl></>),
    block(<><Heading>확정 활동 · 객체 집계</Heading><div className="report-summary-line"><b>활동유형</b><CountList values={activity.confirmed_activity_type_counts} /></div><div className="report-summary-line"><b>탐지 객체</b><CountList values={activity.confirmed_detection_counts} /></div></>),
  ]
  return [
    { title: '영농이행 점검 보고서', cover: true, blocks: [block(cover)] },
    { title: '영농계획 및 이행 현황', blocks: planBlocks },
    { title: 'AI 영상 증빙', blocks: imageBlocks },
    { title: '영농활동 상세 기록', blocks: eventBlocks },
    { title: '검토 결과 및 최종평가', blocks: assessmentBlocks },
    { title: '보고서 정보', blocks: notesBlocks },
  ]
}

function Sheet({ section, report, children, page, total, measure = false, continuation = false }) {
  return <section className={`report-sheet${section.cover ? ' report-cover' : ''}`}>
    {!section.cover && <header className="report-page-header"><div><p>{REPORT_COMPANY_NAME} · 영농이행 점검 보고서</p><h1>{section.title}{continuation && <small> (계속)</small>}</h1></div><span>{text(report.from_date)}<br />~ {text(report.to_date)}</span></header>}
    <div className="report-page-body" data-measure-body={measure || undefined}>{children}</div>
    <footer className="report-page-footer"><span>생성 {timestamp(report.generated_at)}</span><span>{text(report.plant?.name)}</span><b>{page} / {total}</b></footer>
  </section>
}

// Measure with the same A4 body width and typography used by Chromium PDF.
// Rows move intact to a continuation page; source records are never sliced away.
export default function FarmingReportDocument({ report }) {
  const sections = useMemo(() => buildSections(report), [report])
  const measurement = useRef(null)
  const [layout, setLayout] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let cancelled = false
    window.__FARMING_REPORT_READY__ = false
    window.__FARMING_REPORT_ERROR__ = null
    delete document.documentElement.dataset.reportReady
    setLayout(null)
    setError(null)
    async function paginate() {
      await document.fonts.ready
      await Promise.all([...measurement.current.querySelectorAll('img')].map(img => img.decode().catch(() => {})))
      if (cancelled) return
      const pages = []
      const bodies = [...measurement.current.querySelectorAll('[data-measure-body]')]
      sections.forEach((section, index) => {
        const body = bodies[index], capacity = body.clientHeight - 2
        const heights = [...body.children].map(el => el.getBoundingClientRect().height)
        let blocks = [], used = 0, continuation = false
        const push = () => { pages.push({ section, blocks, continuation }); blocks = []; used = 0; continuation = true }
        section.blocks.forEach((block, i) => {
          if (heights[i] > capacity) throw new Error(`${section.title}: 한 페이지보다 긴 항목이 있습니다. 입력 내용을 확인해 주세요.`)
          const reserve = block.keep && i + 1 < heights.length ? heights[i + 1] : 0
          if (blocks.length && used + heights[i] + reserve > capacity) push()
          blocks.push(block)
          used += heights[i]
        })
        if (blocks.length) push()
      })
      if (!cancelled) setLayout({ report, pages })
    }
    paginate().catch(err => {
      if (!cancelled) { setError(err.message); window.__FARMING_REPORT_ERROR__ = err.message }
    })
    return () => { cancelled = true }
  }, [sections, report])

  const pages = layout?.report === report ? layout.pages : null
  useEffect(() => {
    if (!pages) return
    let cancelled = false
    async function ready() {
      await document.fonts.ready
      await Promise.all([...document.querySelectorAll('.report-document img')].map(img => img.decode().catch(() => {})))
      await new Promise(resolve => requestAnimationFrame(resolve))
      if (cancelled) return
      window.__FARMING_REPORT_READY__ = true
      document.documentElement.dataset.reportReady = 'true'
    }
    ready()
    return () => { cancelled = true }
  }, [pages])

  return <>
    <div className="report-measure" ref={measurement} aria-hidden="true">{sections.map((section, i) => <Sheet key={i} section={section} report={report} measure page={1} total={1}>{section.blocks.map((block, j) => <div className="report-block" key={j}>{block.node}</div>)}</Sheet>)}</div>
    {error ? <main className="report-print-state" role="alert">보고서 페이지를 구성할 수 없습니다. {error}</main> : pages ? <main className="report-document">{pages.map((entry, i) => <Sheet key={i} {...entry} report={report} page={i + 1} total={pages.length}>{entry.blocks.map((block, j) => <div className="report-block" key={j}>{block.node}</div>)}</Sheet>)}</main> : <main className="report-print-state">보고서 인쇄 양식을 준비하고 있습니다.</main>}
  </>
}
