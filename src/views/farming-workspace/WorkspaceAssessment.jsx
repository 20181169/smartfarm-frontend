import { useState } from 'react'
import { apiPlanPreview, apiPlanAssessments, apiSavePlanAssessment } from '../../lib/api'
import { workflowDate } from '../../lib/workflow'
import { QueryStatus, MutationStatus, useWorkflowQuery, useWorkflowMutation } from '../../components/WorkflowUI'
import { Field, button, dateTime } from './WorkspaceShared'
const RESULTS = { fulfilled: '이행', not_fulfilled: '미이행', unable_to_determine: '판단 불가' }
export default function WorkspaceAssessment({ workspace: w }) {
  const [result, setResult] = useState(''), [comment, setComment] = useState('')
  const mutation = useWorkflowMutation()
  const preview = useWorkflowQuery(signal => apiPlanPreview(w.planId, signal), [w.planId, w.version])
  const history = useWorkflowQuery(signal => apiPlanAssessments(w.planId, signal), [w.planId, w.version])
  const ready = w.plan.status === 'scheduled' && workflowDate() > w.plan.planned_end_date
  return <section className="fw-panel"><h2>작업 계획 이행 평가</h2><p>{w.plan.title}</p><QueryStatus state={preview} /><QueryStatus state={history} />{preview.data && <p>유효 활동 {preview.data.valid_event_count}건 · 최종 평가 {RESULTS[preview.data.final_assessment] || '미평가'}</p>}
    {w.hasPermission('farming_assessment:update') && <form className="fw-form" onSubmit={e => { e.preventDefault(); if (ready) mutation.run(() => apiSavePlanAssessment(w.planId, { result, comment }), () => { setComment(''); setResult(''); w.changed() }) }}>
      {!ready && <p className="fw-guide-note">취소되지 않은 계획의 종료 다음 날부터 최종 평가를 저장할 수 있습니다.</p>}
      <fieldset className="fw-live-fieldset" disabled={!ready || mutation.busy}><Field label="작업 계획 최종 평가"><select required value={result} onChange={e => setResult(e.target.value)}><option value="">평가 선택</option>{Object.entries(RESULTS).map(([key, text]) => <option value={key} key={key}>{text}</option>)}</select></Field><Field label="작업 계획 평가 의견"><textarea rows={3} required maxLength={2000} value={comment} onChange={e => setComment(e.target.value)} /></Field><button className={button(true)}>작업 계획 평가 저장</button></fieldset>
    </form>}<MutationStatus state={mutation} />{history.data?.map(entry => <article className="fw-record" key={entry.assessment_id}><strong>{RESULTS[entry.new_result]}</strong><p>{entry.comment}</p><small>{dateTime(entry.assessed_at)}</small></article>)}
  </section>
}
