import { useEffect, useRef, useState } from 'react'
import { FileCheck2, FileDown, RefreshCw } from 'lucide-react'
import { useApp } from '../context/useApp'
import { apiReportPlants, apiFarmingReport, apiGenerateFarmingReport, apiReportArchive, apiDownloadFarmingReport, apiReportEvidenceImage } from '../lib/api'
import './ReportCenterView.css'

const PHASES = { waiting: '대기', monitoring: '관찰 중', review_required: '검토 필요', excluded: '평가 제외' }
const RESULTS = { fulfilled: '이행', not_fulfilled: '미이행', unable_to_determine: '판단 불가' }
const STATUSES = { confirmed: '확정', pending: '검토 대기', draft: '초안', rejected: '반려', cancelled: '취소' }
const num = (v) => v == null ? '—' : Number(v).toLocaleString('ko-KR')
const time = (v) => !v || Number.isNaN(new Date(v).getTime()) ? '확인 불가' : new Date(v).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
const today = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
function message(e) {
  if (e.status === 403) return '이 작업을 수행할 권한이 없습니다. 담당 발전소와 보고서 권한을 확인해 주세요.'
  if (e.status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  return e.message || '요청에 실패했습니다.'
}
function ErrorBox({ error, retry }) {
  return <div className="report-message report-error" role="alert">{error}{retry && <div><button className="icon-btn" onClick={retry}>다시 불러오기</button></div>}</div>
}
function Download({ report }) {
  const { hasPermission } = useApp()
  const allowed = hasPermission('report:download')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(null)
  useEffect(() => () => active.current?.abort(), [])
  const download = async () => {
    if (!allowed || active.current) return
    const controller = new AbortController()
    active.current = controller
    setBusy(true); setError('')
    try {
      const blob = await apiDownloadFarmingReport(report.report_id, controller.signal)
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = (report.file_name || `farming-report-${report.report_id}.pdf`).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      if (!controller.signal.aborted) setError(message(e))
    } finally {
      if (!controller.signal.aborted) { active.current = null; setBusy(false) }
    }
  }
  if (!allowed) return null
  return <div><button className="icon-btn" disabled={busy} onClick={download}><FileDown size={14} />{busy ? '다운로드 중…' : 'PDF 다운로드'}</button>{error && <ErrorBox error={error} />}</div>
}
function Evidence({ evidence }) {
  const { hasPermission } = useApp()
  const canView = hasPermission('vision:read')
  const [open, setOpen] = useState(false)
  const [state, setState] = useState({})
  const imageType = !canView ? null : evidence.annotated_image_url ? 'annotated' : evidence.source_image_url ? 'source' : null
  useEffect(() => {
    if (!open || !imageType) return undefined
    const controller = new AbortController()
    let url
    setState({ loading: true })
    apiReportEvidenceImage(evidence.analysis_id, imageType, controller.signal).then((blob) => {
      if (controller.signal.aborted) return
      url = URL.createObjectURL(blob); setState({ url })
    }).catch((e) => { if (!controller.signal.aborted) setState({ error: message(e) }) })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [open, imageType, evidence.analysis_id])
  return <div className="report-evidence">
    <div className="report-row"><span>{time(evidence.evidence_at)} · {STATUSES[evidence.status] || evidence.status}</span>
      {imageType ? <button className="icon-btn" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '증빙 닫기' : '증빙 이미지 보기'}</button> : <span className="text-muted">{canView ? '저장된 이미지 없음' : '증빙 이미지 조회 권한 없음'}</span>}</div>
    <p className="report-copy">탐지: {evidence.detections?.length ? evidence.detections.map((d) => `${d.label}${Number.isFinite(d.confidence) ? ` ${(d.confidence * 100).toFixed(1)}%` : ''}`).join(' · ') : '탐지 객체 없음'}</p>
    {evidence.latest_review && <p className="report-copy">최근 검토: {STATUSES[evidence.latest_review.new_status] || evidence.latest_review.new_status} · {evidence.latest_review.comment || '의견 없음'}</p>}
    {open && (state.loading ? <p role="status">증빙을 불러오는 중입니다.</p> : state.error ? <ErrorBox error={state.error} /> : state.url && <img src={state.url} alt="보고서 영농활동 AI 증빙" />)}
  </div>
}
function ReportBody({ data }) {
  const { plant, summary, activity_summary: activity } = data
  return <>
    <div className="report-banner">
      <h2>{plant.name || '발전소명 미등록'}</h2>
      <p>{data.from_date} ~ {data.to_date}</p>
      <p>{plant.address || '주소 미등록'} · 설비용량 {num(plant.capacity_kw)} kW · 면적 {num(plant.area_m2)} m²</p>
      <p className="text-muted">집계 기준일 {data.as_of_date} · 조회 시각 {time(data.generated_at)}</p>
    </div>
    <div className="report-metrics">
      <div>전체 계획<b>{num(data.total_plans)}건</b></div>
      <div>확정 활동<b>{num(activity.confirmed_event_count)}건</b></div>
      <div>무효화된 활동<b>{num(activity.invalidated_event_count)}건</b></div>
      <div>연결된 AI 증빙<b>{num(activity.vision_evidence_count)}건</b></div>
    </div>
    <div className="report-summary">
      <section><h3>계획 진행 단계</h3>{Object.entries(PHASES).map(([key, label]) => <span className="badge badge-neutral" key={key}>{label} {num(summary.phase_counts?.[key])}건</span>)}</section>
      <section><h3>최종 평가</h3>{Object.entries(RESULTS).map(([key, label]) => <span className="badge badge-neutral" key={key}>{label} {num(summary.assessment_counts?.[key])}건</span>)}<p>기간 종료 후 미평가 {num(summary.assessment_counts?.unassessed_review_required)}건</p></section>
    </div>
    <p className="text-muted">미평가는 미이행 판정과 다릅니다. 활동·증빙의 확정 여부와 최종 평가는 서버에 등록된 결과입니다.</p>
    <h3>계획별 활동 · 증빙</h3>
    {!data.plans.length ? <p>선택한 기간에 해당하는 영농계획이 없습니다.</p> : data.plans.map((plan) => <details className="report-plan" key={plan.plan_id}>
      <summary><strong>{plan.title}</strong> <span className="badge badge-neutral">{PHASES[plan.phase] || plan.phase}</span> <span className="badge badge-neutral">{RESULTS[plan.final_assessment] || '미평가'}</span></summary>
      <p>{plan.planned_start_date} ~ {plan.planned_end_date} · {plan.activity_type}{plan.plan_status === 'cancelled' ? ' · 취소된 계획' : ''}</p>
      {plan.description && <p className="report-copy">{plan.description}</p>}
      <p>유효 활동 {num(plan.valid_event_count)}건 · 무효화 {num(plan.invalidated_event_count)}건{plan.latest_assessed_at && ` · 최근 평가 ${time(plan.latest_assessed_at)}`}</p>
      {!plan.matched_events?.length ? <p>연결된 활동이 없습니다.</p> : plan.matched_events.map((event) => <section className="report-event" key={event.event_id}>
        <h4>{event.title} · {event.is_valid_evidence ? '유효 활동' : '유효 활동으로 집계되지 않음'}</h4>
        <p>{time(event.started_at)} · {STATUSES[event.event_status] || event.event_status}</p>
        {event.description && <p className="report-copy">{event.description}</p>}
        {event.vision_evidence?.length ? event.vision_evidence.map((ev) => <Evidence key={ev.analysis_id} evidence={ev} />) : <p>연결된 AI 증빙이 없습니다.</p>}
      </section>)}
    </details>)}
  </>
}
function ReportPreview({ query, onBusy, onGenerated }) {
  const { hasPermission } = useApp()
  const canGenerate = hasPermission('report:generate')
  const [state, setState] = useState({ loading: true })
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState(null)
  const posting = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; onBusy(false) } }, [onBusy])
  useEffect(() => {
    const controller = new AbortController()
    setState({ loading: true })
    apiFarmingReport(query, controller.signal).then((data) => {
      if (!data?.plant || !data?.summary || !data?.activity_summary || !Array.isArray(data.plans)) throw new Error('보고서 응답 형식을 확인할 수 없습니다.')
      if (!controller.signal.aborted) setState({ data })
    }).catch((e) => { if (!controller.signal.aborted) setState({ error: message(e) }) })
    return () => controller.abort()
  }, [query, reload])
  const generate = async () => {
    if (!canGenerate || posting.current || !state.data) return
    posting.current = true; setBusy(true); onBusy(true); setError(''); setGenerated(null)
    try {
      const report = await apiGenerateFarmingReport(query)
      if (!report?.report_id) throw new Error('생성 결과를 확인하지 못했습니다. 보관 목록을 새로 조회해 주세요.')
      if (alive.current) { setGenerated(report); onGenerated() }
    } catch (e) {
      if (alive.current) setError(`${message(e)}${e.status === 0 || e.status >= 500 ? ' 생성 결과가 불확실할 수 있습니다. 재시도 전에 보관 목록을 새로 조회해 주세요.' : ''}`)
    } finally {
      posting.current = false
      if (alive.current) { setBusy(false); onBusy(false) }
    }
  }
  return <section className="card" aria-label="보고서 조회 결과">
    <div className="report-row"><h2 className="card-title">영농이행 보고서</h2>{canGenerate && <button className="btn-terracotta" disabled={busy || !state.data} onClick={generate}><FileCheck2 size={15} />{busy ? 'PDF 생성 중…' : 'PDF 보고서 생성'}</button>}</div>
    <p className="text-muted">PDF는 생성 시점의 최신 데이터로 만들어져 서버에 보관됩니다.</p>
    {busy && <p role="status">PDF를 생성하고 있습니다. 완료될 때까지 기다려 주세요.</p>}
    {error && <ErrorBox error={error} />}
    {generated && <div className="report-message" role="status">PDF 보고서를 생성하여 보관했습니다. <Download report={generated} /></div>}
    {state.loading ? <p role="status">보고서를 불러오는 중입니다.</p> : state.error ? <ErrorBox error={state.error} retry={() => setReload((v) => v + 1)} /> : <ReportBody data={state.data} />}
  </section>
}
function Archive({ plantId, refresh }) {
  const [skip, setSkip] = useState(0)
  const [reload, setReload] = useState(0)
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    const controller = new AbortController()
    setState({ loading: true })
    apiReportArchive(plantId, skip, controller.signal).then((data) => {
      if (!Array.isArray(data?.items) || !Number.isFinite(data.total)) throw new Error('보관 목록 응답 형식을 확인할 수 없습니다.')
      if (!controller.signal.aborted) setState({ data })
    }).catch((e) => { if (!controller.signal.aborted) setState({ error: message(e) }) })
    return () => controller.abort()
  }, [plantId, skip, reload, refresh])
  return <section className="card" aria-label="보관된 PDF 보고서">
    <div className="report-row"><h2 className="card-title">보관된 PDF 보고서</h2><button className="icon-btn" onClick={() => { setSkip(0); setReload((v) => v + 1) }}><RefreshCw size={14} /> 보관 목록 새로고침</button></div>
    <p className="text-muted">선택한 발전소의 전체 기간 보고서입니다. 생성된 PDF는 생성 당시 내용을 유지합니다.</p>
    {state.loading ? <p role="status">보관 목록을 불러오는 중입니다.</p> : state.error ? <ErrorBox error={state.error} retry={() => setReload((v) => v + 1)} /> : <>
      {!state.data.items.length ? <p>보관된 보고서가 없습니다.</p> : <ul className="report-archives">{state.data.items.map((report) => <li key={report.report_id}>
        <div><strong>{report.period}</strong><p className="report-copy">{report.file_name}</p><p className="text-muted">발행 {time(report.issued_at)}</p></div><Download report={report} />
      </li>)}</ul>}
      {state.data.total > 20 && <div className="report-row"><button className="icon-btn" disabled={!skip} onClick={() => setSkip(Math.max(0, skip - 20))}>이전</button><span>{Math.floor(skip / 20) + 1} / {Math.ceil(state.data.total / 20)} 페이지 · 총 {state.data.total}건</span><button className="icon-btn" disabled={skip + 20 >= state.data.total} onClick={() => setSkip(skip + 20)}>다음</button></div>}
    </>}
  </section>
}
function Workspace({ initialPlantId }) {
  const [plants, setPlants] = useState(null)
  const [plantError, setPlantError] = useState('')
  const [plantReload, setPlantReload] = useState(0)
  const [plantId, setPlantId] = useState('')
  const [from, setFrom] = useState(() => today().slice(0, 7) + '-01')
  const [to, setTo] = useState(today)
  const [query, setQuery] = useState(null)
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [archiveVersion, setArchiveVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setPlants(null); setPlantError(''); setQuery(null); setPlantId('')
    apiReportPlants(controller.signal).then((items) => {
      if (controller.signal.aborted) return
      const id = items.some((p) => p.plant_id === initialPlantId) ? initialPlantId : items[0]?.plant_id || ''
      setPlants(items); setPlantId(id)
      if (id) setQuery({ plant_id: id, from_date: from, to_date: to })
    }).catch((e) => { if (!controller.signal.aborted) setPlantError(message(e)) })
    return () => controller.abort()
    // This screen keeps its own report filters, initialized from the selected plant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantReload])
  const valid = !!from && !!to && from <= to
  const submit = (e) => {
    e.preventDefault()
    if (!valid || !plantId || busy) return
    setQuery({ plant_id: plantId, from_date: from, to_date: to }); setVersion((v) => v + 1)
  }
  return <>
    <section className="card">
      {plantError ? <ErrorBox error={plantError} retry={() => setPlantReload((v) => v + 1)} /> : !plants ? <p role="status">발전소 목록을 불러오는 중입니다.</p> : !plants.length ? <p>조회 가능한 발전소가 없습니다.</p> : <form onSubmit={submit}>
        <div className="report-controls">
          <label>보고서 대상 발전소<select className="input" aria-label="보고서 대상 발전소" disabled={busy} value={plantId} onChange={(e) => { if (e.target.value === plantId) return; setPlantId(e.target.value); setQuery(null) }}>{plants.map((p) => <option value={p.plant_id} key={p.plant_id}>{p.name}</option>)}</select></label>
          <label>시작일<input className="input" aria-label="시작일" type="date" required disabled={busy} value={from} onChange={(e) => { setFrom(e.target.value); setQuery(null) }} /></label>
          <label>종료일<input className="input" aria-label="종료일" type="date" required disabled={busy} value={to} onChange={(e) => { setTo(e.target.value); setQuery(null) }} /></label>
          <button className="btn-primary" disabled={busy || !valid} type="submit">보고서 조회</button>
        </div>
        {!valid && <p className="report-message" role="alert">시작일과 종료일을 확인해 주세요. 종료일은 시작일 이후여야 합니다.</p>}
      </form>}
    </section>
    {query ? <ReportPreview key={`${query.plant_id}:${query.from_date}:${query.to_date}:${version}`} query={query} onBusy={setBusy} onGenerated={() => setArchiveVersion((v) => v + 1)} /> : plantId && <p className="report-message">조건을 선택한 뒤 ‘보고서 조회’를 눌러 주세요.</p>}
    {plantId && <Archive key={`${plantId}:${archiveVersion}`} plantId={plantId} refresh={archiveVersion} />}
  </>
}
export default function ReportCenterView() {
  const { user, plantId } = useApp()
  return <div className="view stack report-center">
    <div><div className="view-title"><FileCheck2 size={20} /> 영농이행 리포트 센터</div><div className="view-sub">발전소별 계획·평가·활동 증빙을 조회하고 PDF 보고서를 생성합니다.</div></div>
    {user?.source === 'api' ? <Workspace key={user.email} initialPlantId={plantId} /> : <div className="card">실제 계정으로 로그인하면 담당 발전소의 보고서를 조회할 수 있습니다.</div>}
  </div>
}
