import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { apiAssessmentPlants, apiFarmingActivities, apiFarmingActivity, apiActivityReviews, apiCreateActivity, apiResubmitActivity, apiReviewActivity, apiAvailableEvidence } from '../lib/api'
import { useWorkflowQuery, useWorkflowMutation, QueryStatus, MutationStatus, ReviewHistory } from '../components/WorkflowUI'
import { workflowTime, workflowStates, activityPayload, canResubmitActivity, canReviewActivity } from '../lib/workflow'
import ActivityEvidence from './ActivityEvidence'

function ActivityForm({ plantId, activity, onDone, onCancel, onBusy }) {
  const { hasPermission } = useApp()
  const canWrite = activity ? canResubmitActivity(hasPermission, activity) : hasPermission('farming_activity:create')
  const allowed = canWrite && hasPermission('vision:read') && hasPermission('farming_activity:read')
  const evidence = useWorkflowQuery(signal => allowed ? apiAvailableEvidence(plantId, activity?.event_id, signal) : Promise.resolve([]), [plantId, activity?.event_id, allowed])
  const [selected, setSelected] = useState(() => activity?.evidence?.map(e => e.analysis_id) || [])
  const mutation = useWorkflowMutation()
  useEffect(() => { onBusy(mutation.busy); return () => onBusy(false) }, [mutation.busy, onBusy])
  function submit(e) {
    e.preventDefault()
    if (!allowed || !evidence.data) return
    const values = Object.fromEntries(new FormData(e.currentTarget))
    const eligible = new Set(evidence.data.map(e => e.analysis_id))
    mutation.run(() => {
      if (selected.some(id => !eligible.has(id))) throw new Error('현재 선택할 수 없는 증빙을 해제하고 다시 선택해 주세요.')
      const body = activityPayload(values, selected, activity ? undefined : plantId)
      return activity ? apiResubmitActivity(activity.event_id, body) : apiCreateActivity(body)
    }, onDone)
  }
  return <section className="card" aria-label={activity ? '영농활동 수정 및 재제출' : '영농활동 등록'}>
    <h3>{activity ? '영농활동 수정 및 재제출' : '영농활동 등록'}</h3>
    {activity?.rejection && <div className="workflow-error"><b>반려 사유</b><p className="workflow-copy">{activity.rejection.comment || '등록된 반려 의견이 없습니다.'}</p><small>{workflowTime(activity.rejection.reviewed_at)}</small></div>}
    {activity && <p>재제출 후 검토 대기 상태가 됩니다. 기존 검토 이력은 유지되며, 다시 확정된 뒤 필요하면 계획에 다시 연결해야 합니다.</p>}
    {!allowed ? <p>활동 작성과 증빙 조회 권한을 확인해 주세요.</p> : <form className="workflow-form" onSubmit={submit}><fieldset disabled={mutation.busy}>
      <label>작업 유형<input aria-label="활동 작업 유형" name="activity_type" maxLength={50} required defaultValue={activity?.activity_type || 'machinery_work'} list="activity-types" /></label>
      <datalist id="activity-types">{['machinery_work','sowing','transplanting','irrigation','fertilization','weeding','pest_control','harvesting'].map(v => <option key={v} value={v} />)}</datalist>
      <label>활동 제목<input aria-label="활동 제목" name="title" required maxLength={200} defaultValue={activity?.title || ''} /></label>
      <label>활동 설명<textarea aria-label="활동 설명" name="description" maxLength={4000} rows={4} defaultValue={activity?.description || ''} /></label>
      <div><h4>확정된 AI 증빙 선택</h4><p>이 발전소의 확정된 분석 중 다른 활동에 사용되지 않은 증빙만 선택할 수 있습니다. 최대 100개입니다.</p>
        <QueryStatus state={evidence} />
        {evidence.data && <><button type="button" className="icon-btn" onClick={evidence.reload}>선택 가능 증빙 새로고침</button>
          {selected.some(id => !evidence.data.some(e => e.analysis_id === id)) && <p role="alert">기존 증빙 중 현재 사용할 수 없는 항목이 있습니다. <button type="button" className="icon-btn" onClick={() => setSelected(v => v.filter(id => evidence.data.some(e => e.analysis_id === id)))}>사용 불가 증빙 해제</button></p>}
          <div className="workflow-evidence">{evidence.data.length ? evidence.data.map(row => <div key={row.analysis_id}>
            <label><input type="checkbox" aria-label={`증빙 ${row.analysis_id}`} checked={selected.includes(row.analysis_id)} onChange={e => setSelected(v => e.target.checked ? [...v, row.analysis_id] : v.filter(id => id !== row.analysis_id))} />{workflowTime(row.captured_at || row.analyzed_at)} · {row.model_id} · 탐지 {row.detection_count}건</label><ActivityEvidence id={row.analysis_id} />
          </div>) : <p>선택 가능한 확정 증빙이 없습니다. CCTV 화면에서 분석 검토 결과를 확인해 주세요.</p>}</div>
        </>}
      </div><div className="workflow-actions"><button className="btn-primary" type="submit" disabled={!evidence.data || !selected.length || selected.length > 100}>{mutation.busy ? '처리 중…' : activity ? '수정 후 재제출' : '활동 제출'}</button><button type="button" className="icon-btn" onClick={onCancel}>닫기</button></div>
    </fieldset></form>}<MutationStatus state={mutation} />
  </section>
}
function ActivityDetail({ id, refresh, onChanged, onEdit, onBusy }) {
  const { hasPermission } = useApp()
  const state = useWorkflowQuery(async signal => {
    const [activity, reviews] = await Promise.all([apiFarmingActivity(id, signal), apiActivityReviews(id, signal)])
    return { activity, reviews }
  }, [id, refresh])
  const mutation = useWorkflowMutation(), [result, setResult] = useState(''), [comment, setComment] = useState('')
  useEffect(() => { onBusy(mutation.busy); return () => onBusy(false) }, [mutation.busy, onBusy])
  const a = state.data?.activity
  function review(e) {
    e.preventDefault()
    if (!a || !canReviewActivity(hasPermission, a) || !result || (result === 'cancelled' && !comment.trim())) return
    mutation.run(() => apiReviewActivity(id, { status: result, comment: comment.trim() || null }), () => { setResult(''); setComment(''); state.reload(); onChanged() })
  }
  const rejection = state.data?.reviews.find(r => r.new_status === 'cancelled')
  return <section className="card" aria-label="영농활동 상세"><QueryStatus state={state} />{a && <>
    <div className="workflow-actions"><h3>{a.title}</h3><span className="badge badge-neutral">{workflowStates[a.status]}</span><button className="icon-btn" disabled={mutation.busy} onClick={state.reload}>활동 상세 새로고침</button></div>
    {a.status === 'cancelled' && <div className="workflow-error"><b>반려 사유</b><p>{rejection?.comment || '등록된 반려 의견이 없습니다.'}</p>{rejection && <small>{workflowTime(rejection.reviewed_at)} · 검토자 ID: {rejection.reviewer_user_id || '미등록'}</small>}</div>}
    <p className="workflow-copy">{a.description || '설명 없음'}</p><p>{a.activity_type} · {workflowTime(a.started_at)} ~ {workflowTime(a.ended_at)}</p>
    <dl className="workflow-summary"><div><dt>등록자 ID</dt><dd>{a.created_by_user_id || '미등록'}</dd></div><div><dt>최종 확정자 ID</dt><dd>{a.confirmed_by_user_id || '미등록'}</dd></div><div><dt>확정 시각</dt><dd>{workflowTime(a.confirmed_at)}</dd></div></dl>
    <h4>AI 증빙 ({a.evidence.length}건)</h4>{a.evidence.map(ev => <div key={ev.analysis_id}><p>{workflowTime(ev.evidence_at)} · {workflowStates[ev.vision_status] || ev.vision_status}</p>{hasPermission('vision:read') && <ActivityEvidence id={ev.analysis_id} />}</div>)}
    {canResubmitActivity(hasPermission, a) && <button className="btn-primary" disabled={mutation.busy} onClick={() => onEdit({ ...a, rejection })}>영농활동 수정 및 재제출</button>}
    {canReviewActivity(hasPermission, a) && <form onSubmit={review} className="workflow-form"><fieldset disabled={mutation.busy}>
      <label>활동 검토 결과<select aria-label="활동 검토 결과" required value={result} onChange={e => setResult(e.target.value)}><option value="">선택하세요</option><option value="confirmed">확인 · 승인</option><option value="cancelled">반려</option></select></label>
      <label>활동 검토 의견<textarea aria-label="활동 검토 의견" required={result === 'cancelled'} maxLength={2000} rows={3} value={comment} onChange={e => setComment(e.target.value)} /></label>
      <button type="submit" className="btn-primary" disabled={!result || (result === 'cancelled' && !comment.trim())}>{mutation.busy ? '처리 중…' : '활동 검토 저장'}</button>
    </fieldset></form>}
    <ReviewHistory items={state.data.reviews} />
  </>}<MutationStatus state={mutation} /></section>
}
function PlantActivities({ plantId, onBusy }) {
  const { hasPermission } = useApp()
  const [selected, setSelected] = useState(''), [form, setForm] = useState(null), [version, setVersion] = useState(0), [notice, setNotice] = useState(''), [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { onBusy(busy); return () => onBusy(false) }, [busy, onBusy])
  const state = useWorkflowQuery(signal => apiFarmingActivities(plantId, signal), [plantId, version])
  const rows = state.data?.filter(a => !filter || a.status === filter)
  return <>
    <section className="card"><div className="workflow-actions"><h2>영농활동</h2>{hasPermission('farming_activity:create') && <button className="btn-primary" disabled={!!form || busy} onClick={() => { setNotice(''); setForm({}) }}>영농활동 등록</button>}<button className="icon-btn" disabled={!!form || busy} onClick={() => setVersion(v => v + 1)}>활동 목록 새로고침</button>
      <label>상태 <select aria-label="활동 상태 필터" value={filter} onChange={e => setFilter(e.target.value)}><option value="">전체</option>{['draft','confirmed','cancelled'].map(s => <option value={s} key={s}>{workflowStates[s]}</option>)}</select></label></div>
      <QueryStatus state={state} />{rows && <ul className="workflow-list">{rows.length ? rows.map(a => <li key={a.event_id}><div className="workflow-actions"><b>{a.title}</b><span className="badge badge-neutral">{workflowStates[a.status]}</span><button className="icon-btn" disabled={!!form || busy} aria-pressed={selected === a.event_id} onClick={() => setSelected(a.event_id)}>활동 상세</button></div><p>{workflowTime(a.started_at)} · 증빙 {a.evidence_count}건</p></li>) : <li>해당하는 영농활동이 없습니다.</li>}</ul>}
    </section>
    {notice && <p role="status">{notice}</p>}
    {form && <ActivityForm onBusy={setBusy} key={form.event_id || 'new'} plantId={plantId} activity={form.event_id ? form : null} onCancel={() => setForm(null)} onDone={a => { setNotice(form.event_id ? '수정 내용이 재제출되었습니다. 검토자의 확인을 기다리고 있습니다.' : '영농활동을 제출했습니다. 검토자의 확인을 기다리고 있습니다.'); setForm(null); setSelected(a.event_id); setFilter(''); setVersion(v => v + 1) }} />}
    {selected && !form && <ActivityDetail onBusy={setBusy} key={selected} id={selected} refresh={version} onChanged={() => setVersion(v => v + 1)} onEdit={setForm} />}
  </>
}
function Workspace({ initialPlantId }) {
  const plants = useWorkflowQuery(apiAssessmentPlants, [])
  const [choice, setChoice] = useState(''), [busy, setBusy] = useState(false)
  const selected = plants.data?.some(p => p.plant_id === choice) ? choice : plants.data?.some(p => p.plant_id === initialPlantId) ? initialPlantId : plants.data?.[0]?.plant_id
  return <><section className="card"><QueryStatus state={plants} />{plants.data && <label>대상 발전소 <select aria-label="영농활동 발전소" disabled={busy} value={selected || ''} onChange={e => setChoice(e.target.value)}>{plants.data.map(p => <option key={p.plant_id} value={p.plant_id}>{p.name}</option>)}</select>{!plants.data.length && <p>조회 가능한 발전소가 없습니다.</p>}</label>}</section>{selected && <PlantActivities onBusy={setBusy} key={selected} plantId={selected} />}</>
}
export default function FarmingActivitiesView() {
  const { user, plantId, hasPermission } = useApp()
  return <div className="view stack"><header><h1 className="view-title">영농이행</h1><p className="view-sub">확정된 AI 증빙으로 활동을 제출하고 검토·반려·재제출 이력을 확인합니다.</p><div className="workflow-actions">{hasPermission('farming_plan:read') && hasPermission('farming_assessment:read') && <Link to="/plan-assessment">계획 · 이행 평가</Link>}{hasPermission('vision:read') && <Link to="/cctv">CCTV · AI 증빙 검토</Link>}{hasPermission('report:read') && <Link to="/compliance-report">이행리포트</Link>}</div></header><Workspace key={user.userId} initialPlantId={plantId} /></div>
}
