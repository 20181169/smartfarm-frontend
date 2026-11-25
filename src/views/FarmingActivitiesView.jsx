import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/useApp'
import {
  apiAssessmentPlants, apiFarmingActivities, apiFarmingActivity, apiActivityReviews,
  apiCreateActivity, apiResubmitActivity, apiReviewActivity, apiAvailableEvidence,
  apiWorkflowContext, apiFarmingPlan, apiPlanMatches, apiMatchActivity,
} from '../lib/api'
import { useWorkflowQuery, useWorkflowMutation, QueryStatus, MutationStatus, ReviewHistory } from '../components/WorkflowUI'
import FarmingWorkflow, { ActivityTypeSelect, PlanSummary } from '../components/FarmingWorkflow'
import {
  workflowTime, workflowStates, activityPayload, canResubmitActivity, canReviewActivity,
  activityTypeLabel, planActivityIssues, workflowPath, workflowDate,
} from '../lib/workflow'
import { confirmActivityAndLink } from '../lib/activityReview'
import ActivityEvidence from './ActivityEvidence'

const reviewApi = { getActivity: apiFarmingActivity, getPlan: apiFarmingPlan, confirm: apiReviewActivity, getMatches: apiPlanMatches, link: apiMatchActivity }
const planOption = plan => `${plan.title} · ${activityTypeLabel(plan.activity_type)} · ${plan.planned_start_date} ~ ${plan.planned_end_date}`

function ActivityForm({ plantId, activity, plans, initialPlan, analysisId, onDone, onCancel, onBusy }) {
  const { hasPermission } = useApp()
  const canWrite = activity ? canResubmitActivity(hasPermission, activity) : hasPermission('farming_activity:create')
  const allowed = canWrite && hasPermission('vision:read') && hasPermission('farming_activity:read')
  const evidence = useWorkflowQuery(signal => allowed ? apiAvailableEvidence(plantId, activity?.event_id, signal) : Promise.resolve([]), [plantId, activity?.event_id, allowed])
  const [selected, setSelected] = useState(() => activity?.evidence?.map(e => e.analysis_id) || (analysisId ? [analysisId] : []))
  const [planId, setPlanId] = useState(initialPlan?.status === 'scheduled' ? initialPlan.plan_id : '')
  const plan = plans.find(p => p.plan_id === planId)
  const [type, setType] = useState(activity?.activity_type || plan?.activity_type || 'machinery_work')
  const [title, setTitle] = useState(activity?.title || (plan ? `${plan.title} 작업` : ''))
  const mutation = useWorkflowMutation()
  useEffect(() => { onBusy(mutation.busy); return () => onBusy(false) }, [mutation.busy, onBusy])
  const selectedRows = (evidence.data || []).filter(row => selected.includes(row.analysis_id))
  const startedAt = selectedRows.map(row => row.captured_at || row.analyzed_at).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))[0]
  const issues = plan && selected.length ? planActivityIssues(plan, { plant_id: plantId, activity_type: type, started_at: startedAt }) : []
  const unavailable = evidence.data && selected.some(id => !evidence.data.some(e => e.analysis_id === id))
  function selectPlan(id) {
    setPlanId(id)
    const next = plans.find(p => p.plan_id === id)
    if (next) { setType(next.activity_type); if (!title) setTitle(`${next.title} 작업`) }
  }
  function submit(e) {
    e.preventDefault()
    if (!allowed || !evidence.data || issues.length || unavailable) return
    const values = { ...Object.fromEntries(new FormData(e.currentTarget)), activity_type: type }
    mutation.run(() => {
      const body = activityPayload(values, selected, activity ? undefined : plantId)
      return activity ? apiResubmitActivity(activity.event_id, body) : apiCreateActivity(body)
    }, a => onDone(a, planId))
  }
  return <section className="card" aria-label={activity ? '영농활동 수정 및 재제출' : '영농활동 등록'}>
    <h3>{activity ? '영농활동 수정 및 재제출' : '영농활동 등록'}</h3>
    {activity?.rejection && <div className="workflow-error"><b>반려 사유</b><p className="workflow-copy">{activity.rejection.comment || '등록된 반려 의견이 없습니다.'}</p><small>{workflowTime(activity.rejection.reviewed_at)}</small></div>}
    {activity && <p className="workflow-next">수정 후 다시 검토 요청합니다. 기존 검토 이력은 유지됩니다.</p>}
    {!allowed ? <p>활동 작성과 증빙 조회 권한을 확인해 주세요.</p> : <form className="workflow-form" onSubmit={submit}><fieldset disabled={mutation.busy}>
      <label>작성 기준 계획<select aria-label="작성 기준 계획" value={planId} onChange={e => selectPlan(e.target.value)}><option value="">계획 미지정으로 작성</option>{plans.filter(p => p.status === 'scheduled').map(p => <option key={p.plan_id} value={p.plan_id}>{planOption(p)}</option>)}</select></label>
      {plan && <><PlanSummary plan={plan} /><p className="text-muted">선택한 계획으로 작업 유형과 기간을 확인합니다. 최종 연결 계획은 검수자가 활동을 검토할 때 선택합니다.</p></>}
      <label>작업 유형<ActivityTypeSelect aria-label="활동 작업 유형" name="activity_type" value={type} disabled={!!plan} onChange={e => setType(e.target.value)} /></label>
      <label>활동 제목<input aria-label="활동 제목" name="title" required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 트랙터 경운 작업" /></label>
      <label>활동 설명<textarea aria-label="활동 설명" name="description" maxLength={4000} rows={4} defaultValue={activity?.description || ''} placeholder="작업 내용과 검토에 필요한 설명을 입력하세요. (선택)" /></label>
      <div><h4>확정된 AI 증빙 선택</h4><p className="text-muted">다른 활동에 사용되지 않은 확정 증빙을 최대 100개 선택할 수 있습니다. 활동일은 선택한 증빙 중 가장 이른 시각을 기준으로 정해집니다.</p>
        <QueryStatus state={evidence} />
        {evidence.data && <><button type="button" className="icon-btn" onClick={evidence.reload}>선택 가능 증빙 새로고침</button>
          {unavailable && <div className="workflow-warning" role="alert">선택한 증빙 중 현재 사용할 수 없는 항목이 있습니다. <button type="button" className="icon-btn" onClick={() => setSelected(v => v.filter(id => evidence.data.some(e => e.analysis_id === id)))}>사용 불가 증빙 해제</button></div>}
          <div className="workflow-evidence">{evidence.data.length ? evidence.data.map(row => <div key={row.analysis_id}>
            <label className="workflow-evidence-choice"><input type="checkbox" aria-label={`증빙 ${row.analysis_id}`} checked={selected.includes(row.analysis_id)} onChange={e => setSelected(v => e.target.checked ? [...v, row.analysis_id] : v.filter(id => id !== row.analysis_id))} /><span>{workflowTime(row.captured_at || row.analyzed_at)} · 확정<small>탐지 {row.detection_count}건 · {row.model_id}</small></span></label><ActivityEvidence id={row.analysis_id} />
          </div>) : <p>선택 가능한 확정 증빙이 없습니다. <Link to={workflowPath('/cctv', { plantId, planId })}>AI 증빙 화면에서 준비하기</Link></p>}</div>
        </>}
      </div>
      <div className="workflow-next">선택한 증빙 <b>{selected.length}건</b>{startedAt && <> · 활동일 <b>{workflowDate(startedAt)}</b></>}{plan && !issues.length && selected.length > 0 && <> · 선택한 계획의 유형·기간과 일치합니다.</>}</div>
      {issues.length > 0 && <div className="workflow-warning" role="alert">{issues.map(issue => <p key={issue}>{issue}</p>)}<p>계획 또는 증빙을 다시 선택해 주세요.</p></div>}
      <div className="workflow-actions"><button className="btn-primary" type="submit" disabled={!evidence.data || !selected.length || selected.length > 100 || unavailable || !!issues.length}>{mutation.busy ? '처리 중…' : activity ? '수정 후 재제출' : '활동 제출'}</button><button type="button" className="icon-btn" onClick={onCancel}>닫기</button></div>
    </fieldset></form>}<MutationStatus state={mutation} />
  </section>
}

function ActivityDetail({ id, refresh, context, contextState, contextPlan, onChanged, onEdit, onBusy }) {
  const { hasPermission } = useApp()
  const panel = useRef(null), reviewForm = useRef(null), shown = useRef(false)
  const state = useWorkflowQuery(async signal => {
    const [activity, reviews] = await Promise.all([apiFarmingActivity(id, signal), apiActivityReviews(id, signal)])
    return { activity, reviews }
  }, [id, refresh])
  const mutation = useWorkflowMutation()
  const [result, setResult] = useState(''), [comment, setComment] = useState(''), [planId, setPlanId] = useState('')
  const [partial, setPartial] = useState(false), [notice, setNotice] = useState('')
  useEffect(() => { onBusy(mutation.busy); return () => onBusy(false) }, [mutation.busy, onBusy])
  const a = state.data?.activity
  useEffect(() => {
    if (a && !shown.current) { shown.current = true; panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  }, [a])
  const linked = context?.matches.find(m => m.event_id === id)
  const candidates = a ? (context?.plans || []).filter(p => !planActivityIssues(p, a).length) : []
  useEffect(() => {
    if (a && contextPlan && !planActivityIssues(contextPlan, a).length) setPlanId(previous => previous || contextPlan.plan_id)
  }, [a?.event_id, contextPlan?.plan_id])
  const canMatch = hasPermission('farming_match:update')
  const canReview = a && canReviewActivity(hasPermission, a)
  const canLink = a?.status === 'confirmed' && canMatch && context && !linked
  const badEvidence = a?.evidence.some(ev => ev.vision_status !== 'confirmed')
  const rejection = state.data?.reviews.find(r => r.new_status === 'cancelled')
  const selectedPlanValid = planId === 'none' || candidates.some(p => p.plan_id === planId)
  async function review(e) {
    e.preventDefault()
    const decision = canLink ? 'confirmed' : result
    if (!a || (!canReview && !canLink) || !decision || (decision === 'cancelled' && !comment.trim())) return
    if (decision === 'confirmed' && (badEvidence || (canMatch && !linked && !selectedPlanValid))) return
    setNotice('')
    mutation.run(async () => {
      if (decision === 'cancelled') return apiReviewActivity(id, { status: 'cancelled', comment: comment.trim() })
      try {
        return await confirmActivityAndLink({ eventId: id, planId: canMatch && !linked && planId !== 'none' ? planId : null, comment: comment.trim() }, reviewApi)
      } catch (error) {
        if (error.activityConfirmed) { setPartial(true); state.reload(); onChanged() }
        throw error
      }
    }, outcome => {
      setNotice(decision === 'cancelled' ? '반려했습니다. 담당자가 사유를 확인하고 수정·재제출할 수 있습니다.' : outcome.linked ? '활동을 확정하고 계획에 연결했습니다. 계획평가에서 이행 현황을 확인하세요.' : '활동을 확정했습니다. 계획에 연결할 수 있습니다.')
      setPartial(false); setResult(''); setComment(''); if (!outcome.linked) setPlanId(''); state.reload(); onChanged()
    })
  }
  return <section ref={panel} className="card workflow-review-panel" aria-label="영농활동 상세"><QueryStatus state={state} />{a && <>
    <div className="workflow-card-heading"><h3>{a.title}</h3><div className="workflow-actions"><span className="badge badge-neutral">{workflowStates[a.status]}</span><button className="icon-btn" disabled={mutation.busy} onClick={() => { state.reload(); onChanged() }}>활동 상세 새로고침</button></div></div>
    {canReview && <div className="workflow-next">담당자가 제출한 작업 내용과 첨부 증빙 {a.evidence.length}건을 확인하세요. <button type="button" className="icon-btn" onClick={() => { reviewForm.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); reviewForm.current?.focus({ preventScroll: true }) }}>검토 결과 입력으로 이동</button></div>}
    {a.status === 'cancelled' && <div className="workflow-error"><b>반려 사유</b><p>{rejection?.comment || '등록된 반려 의견이 없습니다.'}</p>{rejection && <small>{workflowTime(rejection.reviewed_at)}</small>}</div>}
    {linked ? <PlanSummary plan={linked.plan}><span className="badge badge-active">계획 연결 완료</span></PlanSummary> : contextState?.error ? <div className="workflow-warning">계획 연결 정보를 확인하지 못했습니다. <button className="icon-btn" onClick={contextState.reload}>연결 정보 다시 조회</button></div> : contextState?.loading ? <p role="status">계획 연결 정보를 확인하는 중입니다.</p> : <p className="workflow-next">{a.status === 'draft' ? '다음 단계: 검수자가 증빙과 활동을 확인한 뒤, 연결할 계획을 선택해 확정합니다.' : a.status === 'cancelled' ? '다음 단계: 담당자가 반려 사유를 확인해 수정 후 재제출합니다.' : '활동 확정 완료 · 아직 계획에 연결되지 않았습니다.'}</p>}
    <p>{activityTypeLabel(a.activity_type)} · {workflowTime(a.started_at)}{a.ended_at && ` ~ ${workflowTime(a.ended_at)}`}</p><p className="workflow-copy">{a.description || '설명 없음'}</p>
    <dl className="workflow-summary" aria-label="활동 등록 및 확정 정보">
      <div><dt>등록자 ID</dt><dd>{a.created_by_user_id || '미등록'}</dd></div>
      <div><dt>최종 확정자 ID</dt><dd>{a.confirmed_by_user_id || '미등록'}</dd></div>
      <div><dt>확정 시각</dt><dd>{workflowTime(a.confirmed_at)}</dd></div>
    </dl>
    <h4>AI 증빙 ({a.evidence.length}건)</h4>
    {badEvidence && <p className="workflow-warning" role="alert">현재 확정되지 않은 AI 증빙이 포함되어 있습니다. 증빙의 검토 상태를 먼저 확인해 주세요.</p>}
    {a.evidence.map((ev, index) => <div key={ev.analysis_id}><div className="workflow-actions"><p>증빙 {index + 1} · {workflowTime(ev.evidence_at)} · {workflowStates[ev.vision_status] || ev.vision_status}</p>{hasPermission('vision:read') && <Link className="icon-btn" to={workflowPath('/cctv', { plantId: a.plant_id, planId: linked?.plan_id || contextPlan?.plan_id, analysisId: ev.analysis_id })}>{hasPermission('vision:review') ? '이 증빙 검토' : '증빙 상세'}</Link>}</div>{hasPermission('vision:read') && <ActivityEvidence id={ev.analysis_id} defaultOpen={hasPermission('farming_activity:review') && index === 0} />}</div>)}
    {canResubmitActivity(hasPermission, a) && <button className="btn-primary" disabled={mutation.busy} onClick={() => onEdit({ ...a, rejection })}>영농활동 수정 및 재제출</button>}
    {(canReview || canLink) && <form ref={reviewForm} tabIndex={-1} onSubmit={review} className="workflow-form workflow-review-panel"><fieldset disabled={mutation.busy}>
      <h4>{canLink ? '확정된 활동을 계획에 연결' : '활동 검토 및 계획 연결'}</h4>
      {canReview && <label>활동 검토 결과<select aria-label="활동 검토 결과" required value={result} onChange={e => setResult(e.target.value)}><option value="">선택하세요</option><option value="confirmed">확인 · 승인</option><option value="cancelled">반려</option></select></label>}
      {(result === 'confirmed' || canLink) && canMatch && !linked && <>
        <label>연결할 계획<select aria-label="활동 연결 계획" required value={planId} onChange={e => setPlanId(e.target.value)} disabled={!context}><option value="">연결할 계획을 선택하세요</option>{candidates.map(p => <option value={p.plan_id} key={p.plan_id}>{planOption(p)}</option>)}{!canLink && <option value="none">계획 연결 없이 활동만 확정</option>}</select></label>
        {context && !candidates.length && <p className="workflow-warning">발전소·작업 유형·활동일이 맞는 계획이 없습니다. 계획의 유형과 기간을 확인해 주세요.</p>}
        {planId && planId !== 'none' && <PlanSummary plan={candidates.find(p => p.plan_id === planId)} />}
      </>}
      <label>활동 검토 의견<textarea aria-label="활동 검토 의견" required={result === 'cancelled'} maxLength={2000} rows={3} value={comment} onChange={e => setComment(e.target.value)} /></label>
      <button type="submit" className="btn-primary" disabled={canLink ? !selectedPlanValid || planId === 'none' || badEvidence : !result || (result === 'cancelled' ? !comment.trim() : badEvidence || (canMatch && !linked && !selectedPlanValid))}>{mutation.busy ? '처리 중…' : canLink ? partial ? '계획 연결 다시 시도' : '계획 연결' : result === 'confirmed' && canMatch && planId && planId !== 'none' && !linked ? '활동 확정 및 계획 연결' : '활동 검토 저장'}</button>
    </fieldset></form>}
    {notice && <p className="workflow-notice" role="status">{notice}</p>}
    <ReviewHistory items={state.data.reviews} />
  </>}<MutationStatus state={mutation} /></section>
}

function PlantActivities({ plantId, params, setParams, onBusy }) {
  const { hasPermission } = useApp()
  const canReview = hasPermission('farming_activity:review')
  const reviewMode = canReview && params.get('review') === '1'
  const canReadContext = hasPermission('farming_plan:read') && hasPermission('farming_match:read')
  const [selected, setSelected] = useState(params.get('activity') || '')
  const [form, setForm] = useState(() => params.get('create') === '1' && hasPermission('farming_activity:create') ? {} : null)
  const [version, setVersion] = useState(0), [notice, setNotice] = useState(''), [filter, setFilter] = useState(reviewMode ? 'draft' : ''), [linkFilter, setLinkFilter] = useState('')
  useEffect(() => { if (reviewMode) setFilter('draft') }, [reviewMode])
  const [busy, setBusy] = useState(false)
  useEffect(() => { onBusy(busy); return () => onBusy(false) }, [busy, onBusy])
  const state = useWorkflowQuery(signal => apiFarmingActivities(plantId, signal), [plantId, version])
  const context = useWorkflowQuery(signal => canReadContext ? apiWorkflowContext(plantId, signal) : Promise.resolve({ plans: [], matches: [] }), [plantId, version, canReadContext])
  const plan = context.data?.plans.find(p => p.plan_id === params.get('plan'))
  const links = new Map((context.data?.matches || []).map(m => [m.event_id, m]))
  const rows = state.data?.filter(a => {
    if (filter && a.status !== filter) return false
    if (!linkFilter) return true
    if (!context.data) return false
    if (linkFilter === 'related') return !plan || (links.has(a.event_id) ? links.get(a.event_id).plan_id === plan.plan_id : !planActivityIssues(plan, a).length)
    return linkFilter === 'linked' ? links.has(a.event_id) : !links.has(a.event_id)
  })
  function updateParams(values) {
    const next = new URLSearchParams(params)
    next.set('plant', plantId)
    for (const [key, value] of Object.entries(values)) if (value) next.set(key, value); else next.delete(key)
    setParams(next, { replace: true })
  }
  function changed() { setVersion(v => v + 1) }
  function selectActivity(id) { setSelected(id); updateParams({ activity: id, create: null, evidence: null }) }
  return <>
    <FarmingWorkflow current="activity" context={{ plantId, planId: plan?.plan_id }} />
    {canReadContext && (!reviewMode || params.get('plan')) && <section className="card"><label className="field">작업 기준 계획<select className="input" aria-label="활동 기준 계획" value={plan?.plan_id || ''} disabled={busy || !!form || !context.data} onChange={e => updateParams({ plan: e.target.value })}><option value="">전체 계획 · 계획 미지정</option>{context.data?.plans.map(p => <option key={p.plan_id} value={p.plan_id}>{planOption(p)}{p.status === 'cancelled' ? ' · 취소됨' : ''}</option>)}</select></label><QueryStatus state={context} />{plan && <div style={{ marginTop: 12 }}><PlanSummary plan={plan} /></div>}{params.get('plan') && context.data && !plan && <p role="alert">선택한 계획을 이 발전소에서 찾을 수 없습니다. 계획을 다시 선택해 주세요.</p>}</section>}
    <section className="card"><div className="workflow-card-heading"><h2>영농활동</h2><div className="workflow-actions">{hasPermission('farming_activity:create') && <button className="btn-primary" disabled={!!form || busy || context.loading} onClick={() => { setNotice(''); setForm({}); updateParams({ create: '1', activity: null }) }}>영농활동 등록</button>}<button className="icon-btn" disabled={!!form || busy} onClick={changed}>활동 목록 새로고침</button></div></div>
      {canReview && <><p className="text-muted">이 발전소의 검토 대기 활동에서 ‘검토하기’를 누르면 첨부 사진·증빙과 승인·반려 입력 화면이 열립니다.</p>{state.data && <div className="workflow-queue-tabs" role="group" aria-label="영농활동 검토 분류">{[['draft', '검토 대기'], ['', '전체'], ['confirmed', '확정'], ['cancelled', '반려']].map(([status, label]) => <button type="button" className="icon-btn" aria-pressed={filter === status} disabled={busy || !!form} key={status} onClick={() => setFilter(status)}>{label} {state.data.filter(a => !status || a.status === status).length}건</button>)}</div>}</>}
      <div className="workflow-actions"><label>상태 <select aria-label="활동 상태 필터" value={filter} onChange={e => setFilter(e.target.value)}><option value="">전체</option>{['draft', 'confirmed', 'cancelled'].map(s => <option value={s} key={s}>{workflowStates[s]}</option>)}</select></label>{canReadContext && <label>계획 연결 <select aria-label="계획 연결 상태 필터" value={linkFilter} onChange={e => setLinkFilter(e.target.value)}><option value="">전체</option>{plan && <option value="related">선택한 계획의 활동 · 연결 후보</option>}<option value="linked" disabled={!context.data}>연결 완료</option><option value="unlinked" disabled={!context.data}>미연결</option></select></label>}</div>
      <QueryStatus state={state} />{rows && <ul className="workflow-list">{rows.length ? rows.map(a => {
        const link = links.get(a.event_id)
        return <li key={a.event_id} className={selected === a.event_id ? 'is-selected' : ''}><div className="workflow-card-heading"><div><b>{a.title}</b> <span className="badge badge-neutral">{workflowStates[a.status]}</span></div><button className={canReview && a.status === 'draft' ? 'btn-primary' : 'icon-btn'} disabled={!!form || busy} aria-pressed={selected === a.event_id} onClick={() => selectActivity(a.event_id)}>{canReview && a.status === 'draft' ? '검토하기' : '활동 상세'}</button></div><p>{activityTypeLabel(a.activity_type)} · {workflowTime(a.started_at)} · 증빙 {a.evidence_count}건</p>
          {canReadContext && <div className="workflow-link-state">{link ? <>연결된 계획: <Link to={workflowPath('/plan-assessment', { plantId, planId: link.plan_id })}>{link.plan.title}</Link></> : context.data ? <>계획 미연결{plan && !planActivityIssues(plan, a).length && <> · 선택한 계획과 유형·기간 일치</>}</> : context.error ? '계획 연결 정보 조회 실패' : '계획 연결 정보 확인 중…'}</div>}
        </li>
      }) : <li>{canReview && filter === 'draft' ? <>검토 대기 활동이 없습니다. <button className="icon-btn" onClick={() => setFilter('')}>전체 활동 · 검토 이력 보기</button></> : '해당하는 영농활동이 없습니다.'}</li>}</ul>}
    </section>
    {notice && <p role="status" className="workflow-notice">{notice}</p>}
    {form && !context.loading && <ActivityForm onBusy={setBusy} key={form.event_id || 'new'} plantId={plantId} activity={form.event_id ? form : null} plans={context.data?.plans || []} initialPlan={plan} analysisId={params.get('evidence')} onCancel={() => { setForm(null); updateParams({ create: null, evidence: null }) }} onDone={(a, submittedPlan) => {
      setNotice('영농활동을 제출했습니다. 검수자가 증빙과 활동을 검토하고 계획에 연결할 수 있습니다.')
      setForm(null); setSelected(a.event_id); setFilter(''); setLinkFilter(''); updateParams({ activity: a.event_id, plan: submittedPlan || null, create: null, evidence: null }); changed()
    }} />}
    {selected && !form && <ActivityDetail onBusy={setBusy} key={selected} id={selected} refresh={version} context={context.data} contextState={canReadContext ? context : null} contextPlan={plan} onChanged={changed} onEdit={setForm} />}
  </>
}

function Workspace({ initialPlantId, params, setParams }) {
  const plants = useWorkflowQuery(apiAssessmentPlants, [])
  const [choice, setChoice] = useState(''), [busy, setBusy] = useState(false)
  const selected = plants.data?.some(p => p.plant_id === choice) ? choice : plants.data?.some(p => p.plant_id === initialPlantId) ? initialPlantId : plants.data?.[0]?.plant_id
  return <><section className="card"><QueryStatus state={plants} />{plants.data && <label className="field">대상 발전소<select className="input" aria-label="영농활동 발전소" disabled={busy} value={selected || ''} onChange={e => { setChoice(e.target.value); setParams({ plant: e.target.value }, { replace: true }) }}>{plants.data.map(p => <option key={p.plant_id} value={p.plant_id}>{p.name}</option>)}</select>{!plants.data.length && <p>조회 가능한 발전소가 없습니다.</p>}</label>}</section>{selected && <PlantActivities onBusy={setBusy} key={selected} plantId={selected} params={params} setParams={setParams} />}</>
}

export default function FarmingActivitiesView() {
  const { user, plantId, hasPermission } = useApp()
  const [params, setParams] = useSearchParams()
  return <div className="view stack"><header><h1 className="view-title">{hasPermission('farming_activity:review') ? '영농활동 검토' : '영농이행'}</h1><p className="view-sub">{hasPermission('farming_activity:review') ? '담당자가 제출한 작업 내용과 사진·증빙을 확인하고 승인·반려 및 계획 연결을 처리합니다.' : '계획에 맞춰 증빙을 첨부해 활동을 제출하고, 검토 결과와 계획 연결 상태를 확인합니다.'}</p></header><Workspace key={`${user.userId}:${params.get('plant') || ''}`} initialPlantId={params.get('plant') || plantId} params={params} setParams={setParams} /></div>
}
