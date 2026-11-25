import { useState } from 'react'
import { apiAvailableEvidence, apiCreateActivity, apiResubmitActivity, apiFarmingActivity, apiActivityReviews, apiReviewActivity, apiFarmingPlan, apiPlanMatches, apiMatchActivity } from '../../lib/api'
import { activityPayload, planActivityIssues, workflowDate } from '../../lib/workflow'
import { confirmActivityAndLink } from '../../lib/activityReview'
import { QueryStatus, MutationStatus, ReviewHistory, useWorkflowQuery, useWorkflowMutation } from '../../components/WorkflowUI'
import { EvidenceDetail } from './WorkspaceGallery'
import { Field, STATUS, EvidencePhoto, dateTime, button } from './WorkspaceShared'
import WorkspaceAssessment from './WorkspaceAssessment'

const api = { getActivity: apiFarmingActivity, getPlan: apiFarmingPlan, getMatches: apiPlanMatches, confirm: apiReviewActivity, link: apiMatchActivity }
function RecordForm({ workspace: w }) {
  const [title, setTitle] = useState(w.editing?.title || (w.plan ? `${w.plan.title} 수행` : '')), [description, setDescription] = useState(w.editing?.description || ''), [error, setError] = useState('')
  const mutation = useWorkflowMutation()
  const available = useWorkflowQuery(signal => apiAvailableEvidence(w.plantId, w.editing?.event_id, signal), [w.plantId, w.editing?.event_id, w.version])
  return <section className="fw-panel" aria-label="수행 내용 작성"><h2>{w.editing ? '반려된 수행 기록 보완' : '계획 단계별 수행 기록'}</h2><p className="fw-muted">선택한 작업 계획과 확정 사진을 연결해 검토를 요청합니다. 작업일은 사진의 촬영 시각을 기준으로 저장됩니다.</p>
    <QueryStatus state={available} /><form className="fw-form" onSubmit={e => {
      e.preventDefault(); setError('')
      let payload
      try {
        if (!w.plan || w.plan.status !== 'scheduled') throw new Error('취소되지 않은 작업 계획을 선택해 주세요.')
        const photos = w.selection.map(id => available.data?.find(a => a.analysis_id === id))
        if (photos.some(p => !p)) throw new Error('사용할 수 없는 사진이 있습니다. 사진을 새로 조회하고 선택을 확인해 주세요.')
        const earliest = photos.map(p => p.captured_at || p.analyzed_at).sort((a, b) => new Date(a) - new Date(b))[0]
        const issues = planActivityIssues(w.plan, { plant_id: w.plantId, activity_type: w.plan.activity_type, started_at: earliest })
        if (issues.length) throw new Error(issues.join('\n'))
        payload = activityPayload({ title, description, activity_type: w.plan.activity_type }, w.selection, w.editing ? null : w.plantId)
      } catch (err) { setError(err.message); return }
      mutation.run(() => w.editing ? apiResubmitActivity(w.editing.event_id, payload) : apiCreateActivity(payload), activity => {
        w.setEditing(null); w.setSelection([]); w.changed(); w.navigate({ activity: activity.event_id, tab: 'records' })
      })
    }}><fieldset className="fw-live-fieldset" disabled={mutation.busy || available.loading || !!available.error}>
      <p className="fw-guide-note">연결 기준: {w.plan?.title || '계획을 선택해 주세요.'}{w.plan && ` · ${w.plan.planned_start_date} ~ ${w.plan.planned_end_date}`}</p>
      <Field label="수행 기록 제목"><input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></Field><Field label="수행 내용"><textarea required rows={4} maxLength={4000} value={description} onChange={e => setDescription(e.target.value)} /></Field>
      <h3>확정된 사진 선택 · {w.selection.length}장</h3><div className="fw-live-evidence-options">{available.data?.map(p => <label className="fw-check" key={p.analysis_id}><input type="checkbox" aria-label={`수행 증빙 ${p.analysis_id}`} checked={w.selection.includes(p.analysis_id)} onChange={() => w.setSelection(previous => previous.includes(p.analysis_id) ? previous.filter(id => id !== p.analysis_id) : [...previous, p.analysis_id])} />{dateTime(p.captured_at || p.analyzed_at)} · 확정 사진</label>)}</div>
      <div className="fw-thumbnails">{w.selection.map(id => <EvidencePhoto id={id} key={id} />)}</div>
      <div className="fw-actions"><button type="button" className={button()} onClick={() => w.go('gallery')}>갤러리에서 사진 선택</button><button type="submit" className={button(true)} disabled={!w.selection.length || !w.plan}>{w.editing ? '보완 후 다시 제출' : '수행 기록 제출'}</button>{w.editing && <button type="button" className={button()} onClick={() => { w.setEditing(null); w.setSelection([]) }}>보완 작성 취소</button>}</div>
    </fieldset></form>{error && <p className="fw-error" role="alert">{error}</p>}<MutationStatus state={mutation} />
  </section>
}

function RecordDetail({ id, workspace: w }) {
  const state = useWorkflowQuery(async signal => {
    const data = await apiFarmingActivity(id, signal)
    if (data.plant_id !== w.plantId) throw new Error('현재 발전소의 수행 기록이 아닙니다.')
    return data
  }, [id, w.version])
  const reviews = useWorkflowQuery(signal => apiActivityReviews(id, signal), [id, w.version])
  const [decision, setDecision] = useState('confirmed'), [comment, setComment] = useState(''), [evidence, setEvidence] = useState('')
  const mutation = useWorkflowMutation()
  const activity = state.data, matches = w.context.data?.matches.filter(m => m.event_id === id) || []
  const canReview = w.hasPermission('farming_activity:review') && activity?.status === 'draft'
  const canLink = w.hasPermission('farming_match:update') && activity?.status === 'confirmed' && !matches.some(m => m.plan_id === w.planId)
  const save = () => mutation.run(async () => {
    try {
      if (decision === 'cancelled' && canReview) {
        if (!comment.trim()) throw new Error('반려 사유를 입력해 주세요.')
        return await apiReviewActivity(id, { status: 'cancelled', comment: comment.trim() })
      }
      return await confirmActivityAndLink({ eventId: id, planId: w.hasPermission('farming_match:update') ? w.planId || null : null, comment }, api)
    } catch (e) { if (e.activityConfirmed) w.changed(); throw e }
  }, () => { setComment(''); w.changed() })
  return <section className="fw-panel" aria-label="운영 수행 기록 상세"><QueryStatus state={state} />{activity && <>
    <div className="fw-panel-head"><h2>{activity.title}</h2><span className="fw-tag">{STATUS[activity.status] || activity.status}</span></div><p>{dateTime(activity.started_at)}</p><p className="fw-prewrap">{activity.description}</p><p>연결된 계획: {matches.map(m => m.plan.title).join(', ') || (w.context.loading ? '조회 중…' : '미연결')}</p>
    {w.hasPermission('vision:read') ? <div className="fw-gallery">{activity.evidence.map(p => <article className="fw-photo-card" key={p.analysis_id}><button className="fw-photo-open" onClick={() => setEvidence(p.analysis_id)}><EvidencePhoto id={p.analysis_id} /></button><div className="fw-photo-body"><p>{STATUS[p.vision_status] || p.vision_status} · {dateTime(p.evidence_at)}</p><button className={button()} onClick={() => setEvidence(p.analysis_id)}>이 사진 검토·이력</button></div></article>)}</div> : <p>사진을 확인하려면 증빙 조회 권한이 필요합니다.</p>}
    {evidence && <EvidenceDetail key={evidence} id={evidence} workspace={w} />}
    <QueryStatus state={reviews} />{reviews.data && <ReviewHistory items={reviews.data} />}
    {activity.status === 'cancelled' && w.hasPermission('farming_activity:update') && <button className={button(true)} onClick={() => { w.setEditing(activity); w.setSelection(activity.evidence.map(p => p.analysis_id)); w.navigate({ activity: id }) }}>수행 기록 보완·재제출</button>}
    {(canReview || canLink) && <form className="fw-form" onSubmit={e => { e.preventDefault(); save() }}><fieldset className="fw-live-fieldset" disabled={mutation.busy}>
      <p className="fw-guide-note">확정 후 연결할 계획: {w.plan?.title || '계획 연결 없이 활동만 확정'} · 검토 대상 사진과 활동 내용을 함께 확인하세요.</p>
      {canReview && <Field label="수행 기록 검토 결과"><select value={decision} onChange={e => setDecision(e.target.value)}><option value="confirmed">확정</option><option value="cancelled">반려</option></select></Field>}
      <Field label="수행 기록 검토 의견"><textarea maxLength={2000} rows={3} required={canReview && decision === 'cancelled'} value={comment} onChange={e => setComment(e.target.value)} /></Field>
      <button className={button(true)} disabled={canLink && !w.planId}>{canReview ? '수행 기록 검토 저장' : '계획 연결 다시 시도'}</button>
    </fieldset></form>}
    <MutationStatus state={mutation} /><button className={button()} onClick={() => w.go('reports')}>보고서로 이어가기</button>
  </>}</section>
}

export default function WorkspaceRecords({ workspace: w }) {
  const [filter, setFilter] = useState(w.hasPermission('farming_activity:review') ? 'draft' : '')
  const canCreate = (w.hasPermission('farming_activity:create') || w.editing && w.hasPermission('farming_activity:update')) && w.hasPermission('vision:read') && w.hasPermission('farming_plan:read')
  const visible = w.events.data?.filter(e => !filter || e.status === filter)
  return <div className="fw-live-stack">
    {canCreate && <RecordForm key={w.editing?.event_id || 'new'} workspace={w} />}
    <section className="fw-panel"><div className="fw-panel-head"><h2>{w.hasPermission('farming_activity:review') ? '제출된 수행 기록 검토' : '제출한 수행 기록'}</h2><button className={button()} onClick={w.changed}>수행 기록 새로고침</button></div><Field label="수행 기록 상태"><select value={filter} onChange={e => setFilter(e.target.value)}><option value="">전체</option><option value="draft">검토 대기</option><option value="confirmed">확정</option><option value="cancelled">반려</option></select></Field><QueryStatus state={w.events} /><QueryStatus state={w.context} />
      {visible?.length === 0 && <p>조건에 맞는 수행 기록이 없습니다.</p>}{visible?.map(a => <article className="fw-record" key={a.event_id}><span className="fw-tag">{STATUS[a.status]}</span><h3>{a.title}</h3><p>{dateTime(a.started_at)} · 증빙 {a.evidence_count}장</p><p className="fw-muted">{w.context.data?.matches.filter(m => m.event_id === a.event_id).map(m => m.plan.title).join(', ') || '계획 미연결'}</p><button className={button()} onClick={() => w.navigate({ activity: a.event_id })}>수행 기록 상세·검토</button></article>)}
    </section>
    {w.params.get('activity') && <RecordDetail key={w.params.get('activity')} id={w.params.get('activity')} workspace={w} />}
    {w.plan && w.hasPermission('farming_assessment:read') && <WorkspaceAssessment key={w.planId} workspace={w} />}
  </div>
}
