import { useEffect, useRef, useState } from 'react'
import { ClipboardCheck, RefreshCw } from 'lucide-react'
import { useApp } from '../context/useApp'
import {
  apiAssessmentPlants, apiFarmingPlans, apiFarmingPlan, apiPlanMatches, apiPlanPreview,
  apiPlanAssessments, apiSavePlanAssessment, apiFarmingActivity, apiAssessmentAnalysis, apiAssessmentImage,
} from '../lib/api'
import './PlanAssessmentView.css'

const RESULTS = { fulfilled: '이행', not_fulfilled: '미이행', unable_to_determine: '판단 불가' }
const PHASES = { waiting: '대기', monitoring: '관찰 중', review_required: '검토 필요', excluded: '평가 제외' }
const STATUSES = { draft: '초안', confirmed: '확정', cancelled: '취소', pending: '검토 대기', candidate: '후보', rejected: '반려' }
const fmtTime = (value) => {
  if (!value) return '확인 불가'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '확인 불가' : date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}
function errorText(error) {
  if (error.status === 403) return '이 작업을 수행할 권한이 없습니다. 담당 발전소와 평가 권한을 확인해 주세요.'
  if (error.status === 404) return '대상 정보를 찾을 수 없습니다. 목록을 다시 불러와 주세요.'
  if (error.status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  return error.message || '요청에 실패했습니다. 잠시 후 다시 시도해 주세요.'
}
function Failure({ error, retry }) {
  return <div className="assessment-message assessment-error" role="alert">{error}
    {retry && <div style={{ marginTop: 8 }}><button className="icon-btn" onClick={retry}>다시 불러오기</button></div>}
  </div>
}

function Evidence({ evidence }) {
  const [opened, setOpened] = useState(false)
  const [data, setData] = useState(null)
  useEffect(() => {
    if (!opened) return undefined
    const controller = new AbortController()
    let url
    setData(null)
    Promise.allSettled([
      apiAssessmentAnalysis(evidence.analysis_id, controller.signal),
      apiAssessmentImage(evidence.analysis_id, controller.signal),
    ]).then(([detail, picture]) => {
      if (controller.signal.aborted) return
      if (picture.status === 'fulfilled') url = URL.createObjectURL(picture.value)
      setData({ detail: detail.status === 'fulfilled' ? detail.value : null, url,
        error: [detail, picture].filter((r) => r.status === 'rejected').map((r) => errorText(r.reason)).join(' ') })
    })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [opened, evidence.analysis_id])
  return <div className="assessment-evidence">
    <div className="assessment-row"><span>{fmtTime(evidence.evidence_at)} · {STATUSES[evidence.vision_status] || evidence.vision_status}</span>
      <button className="icon-btn" aria-expanded={opened} onClick={() => setOpened((v) => !v)}>{opened ? '증빙 닫기' : '증빙 보기'}</button></div>
    {opened && (!data ? <p role="status">증빙을 불러오는 중입니다.</p> : <>
      {data.error && <Failure error={data.error} />}
      {data.url && <img src={data.url} alt="선택한 영농활동의 분석 증빙 이미지" />}
      {data.detail && <><p className="text-muted">분석: {fmtTime(data.detail.analyzed_at)} · {data.detail.model_id}</p>
        <p className="assessment-copy">{data.detail.detections?.length
          ? data.detail.detections.map((d) => `${d.label} ${Number.isFinite(d.confidence) ? (d.confidence * 100).toFixed(1) + '%' : ''}`).join(' · ')
          : '탐지된 객체가 없습니다.'}</p></>}
    </>)}
  </div>
}

function Activity({ match, valid, invalid }) {
  const [opened, setOpened] = useState(false)
  const [state, setState] = useState({ loading: true })
  const [reload, setReload] = useState(0)
  useEffect(() => {
    if (!opened) return undefined
    const controller = new AbortController()
    setState({ loading: true })
    apiFarmingActivity(match.event_id, controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ data })
    }).catch((e) => { if (!controller.signal.aborted) setState({ error: errorText(e) }) })
    return () => controller.abort()
  }, [opened, match.event_id, reload])
  return <div className="assessment-activity">
    <div className="assessment-row"><strong>{match.event_title}</strong>
      <span className="badge badge-neutral">{valid ? '유효 증빙' : invalid ? '무효화된 증빙' : '유효 증빙으로 집계되지 않음'}</span></div>
    <div className="text-muted">{match.activity_type} · {fmtTime(match.event_started_at)} · {STATUSES[match.event_status] || match.event_status}</div>
    {match.comment && <p className="assessment-copy">연결 의견: {match.comment}</p>}
    <button className="icon-btn" aria-expanded={opened} onClick={() => setOpened((v) => !v)}>{opened ? '활동 닫기' : '활동·증빙 확인'}</button>
    {opened && (state.loading ? <p role="status">활동을 불러오는 중입니다.</p> : state.error ? <Failure error={state.error} retry={() => setReload((v) => v + 1)} /> : <>
      <p className="assessment-copy">{state.data.description || '활동 설명이 없습니다.'}</p>
      {state.data.evidence?.length ? state.data.evidence.map((ev) => <Evidence key={ev.analysis_id} evidence={ev} />) : <p>연결된 영상 증빙이 없습니다.</p>}
    </>)}
  </div>
}

function PlanDetail({ planId, canAssess, onBusy }) {
  const [state, setState] = useState({ loading: true })
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const posting = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; onBusy(false) } }, [onBusy])
  useEffect(() => {
    const controller = new AbortController()
    setState({ loading: true })
    Promise.all([apiFarmingPlan(planId, controller.signal), apiPlanPreview(planId, controller.signal),
      apiPlanMatches(planId, controller.signal), apiPlanAssessments(planId, controller.signal)]).then(([plan, preview, matches, history]) => {
      if (!controller.signal.aborted) setState({ plan, preview, matches, history: [...history].sort((a, b) => new Date(b.assessed_at) - new Date(a.assessed_at)) })
    }).catch((e) => { if (!controller.signal.aborted) setState({ error: errorText(e) }) })
    return () => controller.abort()
  }, [planId, reload])
  const save = async (event) => {
    event.preventDefault()
    if (posting.current || !canAssess || !result || !comment.trim() || state.loading || state.error || state.plan.status === 'cancelled' || state.preview.phase === 'excluded') return
    posting.current = true
    setSaving(true); onBusy(true); setSaveError(''); setNotice('')
    try {
      await apiSavePlanAssessment(planId, { result, comment })
      if (!alive.current) return
      setNotice('평가를 저장했습니다. 최신 평가와 이력을 다시 조회합니다.')
      setResult(''); setComment(''); setReload((v) => v + 1)
    } catch (e) {
      if (alive.current) setSaveError(e.status === 0 ? '저장 결과를 확인하지 못했습니다. 평가 이력을 새로 조회해 반영 여부를 확인한 뒤 다시 시도해 주세요.' : errorText(e))
    } finally {
      posting.current = false
      if (alive.current) { setSaving(false); onBusy(false) }
    }
  }
  if (state.loading || state.error) return <div className="card">
    {notice && <p className="assessment-message assessment-success" role="status">{notice}</p>}
    {state.loading ? <p role="status">계획과 평가 이력을 불러오는 중입니다.</p> : <Failure error={state.error} retry={() => setReload((v) => v + 1)} />}
  </div>
  const { plan, preview, matches, history } = state
  const excluded = plan.status === 'cancelled' || preview.phase === 'excluded'
  const validIds = new Set(preview.valid_event_ids || [])
  return <>
    <div className="card">
      <div className="assessment-row"><h2 style={{ fontSize: 18 }}>{plan.title}</h2><button className="icon-btn" disabled={saving} onClick={() => setReload((v) => v + 1)}><RefreshCw size={14} /> 평가 새로고침</button></div>
      <p className="text-muted">{plan.activity_type} · {plan.planned_start_date} ~ {plan.planned_end_date} · {plan.status === 'cancelled' ? '취소된 계획' : '등록된 계획'}</p>
      {plan.description && <p className="assessment-copy">{plan.description}</p>}
      <div className="assessment-metrics">
        <div>진행 단계<b>{PHASES[preview.phase] || '확인 필요'}</b></div>
        <div>유효 활동<b>{preview.valid_event_count ?? '—'}건</b></div>
        <div>무효화된 활동<b>{preview.invalidated_event_count ?? '—'}건</b></div>
        <div>최종 평가<b>{RESULTS[preview.final_assessment] || '미평가'}</b></div>
      </div>
      {notice && <p className="assessment-message assessment-success" role="status">{notice}</p>}
    </div>
    <div className="assessment-layout">
      <section className="card" aria-label="연결된 활동 및 증빙">
        <h3 className="card-title">연결된 활동 · 증빙 ({matches.length}건)</h3>
        <p className="view-sub">증빙 유효 여부는 현재 계획 평가에 반영된 서버 조회 결과입니다.</p>
        {matches.length ? matches.map((match) => <Activity key={match.match_id} match={match} valid={validIds.has(match.event_id)} invalid={match.event_status === 'cancelled'} />)
          : <p>이 계획에 연결된 영농활동이 없습니다.</p>}
      </section>
      <section className="card" aria-label="평가 입력">
        <h3 className="card-title">계획 이행 평가</h3>
        {!canAssess ? <p className="assessment-message">조회 전용입니다. 평가는 관리자·감독 계정에서 등록할 수 있습니다.</p>
          : excluded ? <p className="assessment-message">취소되었거나 평가에서 제외된 계획입니다. 기존 평가 이력만 확인할 수 있습니다.</p>
            : <form className="assessment-form" onSubmit={save}>
              <p className="view-sub">연결된 활동과 증빙을 확인한 뒤 결과와 판단 근거를 입력해 주세요.</p>
              <label>평가 결과<select aria-label="평가 결과" className="input" required value={result} disabled={saving} onChange={(e) => setResult(e.target.value)}><option value="">결과 선택</option>{Object.entries(RESULTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label>평가 의견<textarea aria-label="평가 의견" className="input" rows={5} required maxLength={2000} value={comment} disabled={saving} placeholder="평가 근거를 입력하세요." onChange={(e) => setComment(e.target.value)} /></label>
              <div className="text-muted">{comment.length.toLocaleString()} / 2,000자 · 저장한 결과는 평가 이력에 남습니다.</div>
              {saveError && <Failure error={saveError} />}
              <button className="btn-terracotta" disabled={saving || !result || !comment.trim()} type="submit">{saving ? '저장 중…' : '평가 저장'}</button>
            </form>}
      </section>
    </div>
    <section className="card" aria-label="평가 이력">
      <h3 className="card-title">평가 이력 ({history.length}건)</h3>
      {history.length ? <ol className="assessment-history">{history.map((entry) => <li key={entry.assessment_id}>
        <div className="assessment-row"><b>{RESULTS[entry.previous_result] || '미평가'} → {RESULTS[entry.new_result] || entry.new_result}</b><time>{fmtTime(entry.assessed_at)}</time></div>
        <p className="assessment-copy">{entry.comment || '의견 없음'}</p>
        <div className="text-muted">평가 당시 유효 활동 {entry.valid_event_count}건 · 무효화 {entry.invalidated_event_count}건</div>
        <div className="assessment-copy text-muted">평가자 ID: {entry.reviewer_user_id || '확인 불가'}</div>
      </li>)}</ol> : <p>아직 등록된 평가가 없습니다. 미평가 상태는 미이행 판정과 다릅니다.</p>}
    </section>
  </>
}

function AssessmentWorkspace({ initialPlantId, canAssess }) {
  const [plants, setPlants] = useState(null)
  const [plantId, setPlantId] = useState('')
  const [plantError, setPlantError] = useState('')
  const [plantReload, setPlantReload] = useState(0)
  const [plans, setPlans] = useState(null)
  const [planId, setPlanId] = useState('')
  const [planError, setPlanError] = useState('')
  const [planReload, setPlanReload] = useState(0)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setPlants(null); setPlantError(''); setPlantId(''); setPlanId('')
    apiAssessmentPlants(controller.signal).then((items) => {
      if (controller.signal.aborted) return
      setPlants(items)
      setPlantId(items.some((p) => p.plant_id === initialPlantId) ? initialPlantId : items[0]?.plant_id || '')
    }).catch((e) => { if (!controller.signal.aborted) setPlantError(errorText(e)) })
    return () => controller.abort()
    // Initial selection only; this screen has its own scoped plant selector.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantReload])
  useEffect(() => {
    const controller = new AbortController()
    setPlans(null); setPlanId(''); setPlanError('')
    if (plantId) apiFarmingPlans(plantId, controller.signal).then((items) => {
      if (!controller.signal.aborted) { setPlans(items); setPlanId(items[0]?.plan_id || '') }
    }).catch((e) => { if (!controller.signal.aborted) setPlanError(errorText(e)) })
    return () => controller.abort()
  }, [plantId, planReload])
  return <>
    <div className="card">
      {plantError ? <Failure error={plantError} retry={() => setPlantReload((v) => v + 1)} /> : !plants ? <p role="status">발전소 목록을 불러오는 중입니다.</p>
        : !plants.length ? <p>조회 가능한 발전소가 없습니다. 담당 발전소 배정을 확인해 주세요.</p> : <>
          <div className="assessment-controls">
            <label>평가 대상 발전소<select aria-label="평가 대상 발전소" className="input" value={plantId} disabled={busy} onChange={(e) => { if (e.target.value === plantId) return; setPlantId(e.target.value); setPlanId(''); setPlans(null) }}>{plants.map((p) => <option key={p.plant_id} value={p.plant_id}>{p.name}</option>)}</select></label>
            <label>영농계획<select aria-label="영농계획" className="input" value={planId} disabled={busy || !plans?.length} onChange={(e) => setPlanId(e.target.value)}>
              {!plans?.length && <option value="">{planError ? '조회 실패' : plans ? '등록된 계획 없음' : '불러오는 중…'}</option>}
              {plans?.map((p) => <option key={p.plan_id} value={p.plan_id}>{p.title} ({p.planned_start_date} ~ {p.planned_end_date}){p.status === 'cancelled' ? ' · 취소' : ''}</option>)}
            </select></label>
            <button className="icon-btn" disabled={busy || !plantId} onClick={() => { setPlanId(''); setPlanReload((v) => v + 1) }}><RefreshCw size={14} /> 계획 목록 새로고침</button>
          </div>
          {planError && <Failure error={planError} retry={() => setPlanReload((v) => v + 1)} />}
          {plans && !plans.length && <p>이 발전소에 등록된 영농계획이 없습니다.</p>}
        </>}
    </div>
    {plantId && planId && <PlanDetail key={`${plantId}:${planId}`} planId={planId} canAssess={canAssess} onBusy={setBusy} />}
  </>
}

export default function PlanAssessmentView() {
  const { user, plantId, isSupervisor } = useApp()
  return <div className="view stack plan-assessment">
    <div><div className="view-title"><ClipboardCheck size={20} /> 영농계획 이행 평가</div><div className="view-sub">계획별 활동·증빙을 확인하고 평가 결과와 이력을 관리합니다.</div></div>
    {user?.source === 'api'
      ? <AssessmentWorkspace key={user.email} initialPlantId={plantId} canAssess={isSupervisor} />
      : <div className="card" role="status">실제 계정으로 로그인하면 담당 발전소의 계획과 평가 이력을 확인할 수 있습니다.</div>}
  </div>
}
