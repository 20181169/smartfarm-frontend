import { useEffect, useState } from 'react'
import { useApp } from '../context/useApp'
import { apiUpdatePlan, apiCancelPlan, apiMatchCandidates, apiMatchActivity } from '../lib/api'
import { useWorkflowMutation, useWorkflowQuery, MutationStatus, QueryStatus } from '../components/WorkflowUI'
import { workflowTime } from '../lib/workflow'

function MatchForm({ plan, matches, onDone, onBusy, disabled }) {
  const { hasPermission } = useApp()
  const state = useWorkflowQuery(signal => apiMatchCandidates(plan.plan_id, signal), [plan.plan_id])
  const mutation = useWorkflowMutation(), [eventId, setEventId] = useState(''), [comment, setComment] = useState('')
  useEffect(() => { onBusy(mutation.busy); return () => onBusy(false) }, [mutation.busy, onBusy])
  const candidates = state.data?.filter(a => a.status === 'confirmed' && a.plant_id === plan.plant_id && !matches.some(m => m.event_id === a.event_id))
  return <form className="workflow-form" onSubmit={e => {
    e.preventDefault()
    if (disabled || !hasPermission('farming_match:update') || !candidates?.some(a => a.event_id === eventId)) return
    mutation.run(() => apiMatchActivity(plan.plan_id, { event_id: eventId, comment: comment.trim() || null }), onDone)
  }}><h4>확정된 영농활동 연결</h4><QueryStatus state={state} /><fieldset disabled={disabled || mutation.busy}>
    <label>연결할 활동<select required aria-label="연결할 활동" value={eventId} onChange={e => setEventId(e.target.value)}><option value="">활동 선택</option>{candidates?.map(a => <option key={a.event_id} value={a.event_id}>{a.title} · {a.activity_type} · {workflowTime(a.started_at)} · 증빙 {a.evidence_count}건 · 확정</option>)}</select></label>
    {candidates && !candidates.length && <p>새로 연결할 수 있는 확정 활동이 없습니다.</p>}
    <label>연결 의견<textarea aria-label="활동 연결 의견" maxLength={2000} value={comment} onChange={e => setComment(e.target.value)} /></label>
    <button className="btn-primary" type="submit" disabled={!eventId || !candidates?.some(a => a.event_id === eventId)}>활동 연결</button>
  </fieldset><MutationStatus state={mutation} /></form>
}
export default function PlanActions({ plan, matches, onDone, onBusy, disabled }) {
  const { hasPermission } = useApp()
  const [matchBusy, setMatchBusy] = useState(false)
  const [mode, setMode] = useState(''), [granularity, setGranularity] = useState(plan.plan_granularity)
  const mutation = useWorkflowMutation()
  useEffect(() => { onBusy(mutation.busy || matchBusy); return () => onBusy(false) }, [mutation.busy, matchBusy, onBusy])
  if (plan.status === 'cancelled') return null
  function submit(e) {
    e.preventDefault()
    if (disabled) return
    const values = Object.fromEntries(new FormData(e.currentTarget))
    mutation.run(() => {
      if (mode === 'cancel' && hasPermission('farming_plan:cancel')) return apiCancelPlan(plan.plan_id, { comment: values.comment.trim() || null })
      if (mode !== 'edit' || !hasPermission('farming_plan:update')) throw new Error('수정 권한이 없습니다.')
      if (!values.title.trim() || !values.activity_type.trim()) throw new Error('계획명과 작업 유형을 입력해 주세요.')
      if (granularity === 'period' && values.planned_end_date < values.planned_start_date) throw new Error('종료일은 시작일 이후여야 합니다.')
      return apiUpdatePlan(plan.plan_id, { title: values.title.trim(), activity_type: values.activity_type.trim(), description: values.description.trim() || null, plan_granularity: granularity, planned_start_date: values.planned_start_date, ...(granularity === 'period' ? { planned_end_date: values.planned_end_date } : {}) })
    }, onDone)
  }
  return <section aria-label="계획 관리"><div className="workflow-actions">
    {hasPermission('farming_plan:update') && <button className="icon-btn" disabled={disabled || mutation.busy || matchBusy} onClick={() => setMode(mode === 'edit' ? '' : 'edit')}>계획 수정</button>}
    {hasPermission('farming_plan:cancel') && <button className="icon-btn" disabled={disabled || mutation.busy || matchBusy} onClick={() => setMode(mode === 'cancel' ? '' : 'cancel')}>계획 취소</button>}
    {hasPermission('farming_match:read') && hasPermission('farming_match:update') && <button className="icon-btn" disabled={disabled || mutation.busy || matchBusy} onClick={() => setMode(mode === 'match' ? '' : 'match')}>확정된 영농활동 연결</button>}
  </div>
    {mode === 'match' ? <MatchForm plan={plan} matches={matches} onDone={onDone} onBusy={setMatchBusy} disabled={disabled} /> : mode && <form onSubmit={submit} className="workflow-form"><fieldset disabled={disabled || mutation.busy}>
      {mode === 'cancel' ? <><p>이 계획을 취소하면 평가 대상에서 제외됩니다. 취소할 계획이 맞는지 확인해 주세요.</p><label>취소 사유<textarea name="comment" maxLength={2000} /></label></> : <>
        <label>계획명<input aria-label="수정 계획명" name="title" maxLength={200} required defaultValue={plan.title} /></label>
        <label>작업 유형<input aria-label="수정 작업 유형" name="activity_type" maxLength={50} required defaultValue={plan.activity_type} /></label>
        <label>설명<textarea name="description" maxLength={4000} defaultValue={plan.description || ''} /></label>
        <label>계획 단위<select value={granularity} onChange={e => setGranularity(e.target.value)}><option value="day">일간</option><option value="week">주간</option><option value="month">월간</option><option value="period">기간 지정</option></select></label>
        <label>{granularity === 'period' ? '시작일' : '기준일'}<input name="planned_start_date" type="date" required defaultValue={plan.planned_start_date} /></label>
        {granularity === 'period' && <label>종료일<input name="planned_end_date" type="date" required defaultValue={plan.planned_end_date} /></label>}
      </>}
      <button className="btn-primary" type="submit">{mutation.busy ? '처리 중…' : mode === 'cancel' ? '계획 취소 확정' : '계획 수정 저장'}</button>
    </fieldset></form>}<MutationStatus state={mutation} />
  </section>
}
