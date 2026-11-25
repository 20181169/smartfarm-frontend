import { useState } from 'react'
import { apiCropGuide, apiCropGuides, apiCreatePlanSubmission, apiUpdatePlan, apiPlanMatches } from '../../lib/api'
import { guideForm, planSubmissionPayload } from '../../lib/farmingWorkspace'
import { defaultGuideYear } from '../../lib/riceGuideSchedule'
import { activityTypeLabel, planActivityIssues } from '../../lib/workflow'
import { QueryStatus, MutationStatus, useWorkflowQuery, useWorkflowMutation } from '../../components/WorkflowUI'
import WorkspaceCameras from './WorkspaceCameras'
import { Field, button } from './WorkspaceShared'

function SubmissionEditor({ guide, workspace }) {
  const { plantId, submissions, changed, navigate, hasPermission } = workspace
  const [year, setYear] = useState(defaultGuideYear())
  const [form, setForm] = useState(() => guideForm(guide, defaultGuideYear()))
  const [editableDates, setEditableDates] = useState(false)
  const [error, setError] = useState('')
  const mutation = useWorkflowMutation()
  const duplicate = submissions.data?.find(s => s.plan_year === Number(year) && s.crop_name === guide.crop_name)
  const updateTask = (id, key, value) => setForm(f => ({ ...f, tasks: f.tasks.map(t => t.task_id === id ? { ...t, [key]: value } : t) }))
  return <form className="fw-form" aria-label="운영 연간계획 작성" onSubmit={e => {
    e.preventDefault(); setError('')
    if (year !== form.year) { setError('선택한 재배 연도의 가이드 일정을 먼저 적용해 주세요.'); return }
    if (duplicate) { setError('같은 연도·작물의 계획이 이미 있습니다. 등록된 계획을 선택해 주세요.'); return }
    let payload
    try { payload = planSubmissionPayload(form, guide, plantId) } catch (err) { setError(err.message); return }
    mutation.run(() => apiCreatePlanSubmission(payload), submission => { changed(); navigate({ plan: submission.plans[0]?.plan_id, tab: 'plan' }) })
  }}>
    <fieldset disabled={mutation.busy} className="fw-live-fieldset">
      <div className="fw-guide-calendar"><h3>{form.year}년 {guide.crop_name} 재배 가이드 · v{guide.current_version.version_number}</h3><p>서버에 등록된 가이드의 일정과 작업 내용을 사용합니다.</p><ol>{guide.current_version.tasks.map(t => <li key={t.task_id}><span>{t.start_month}월{t.end_month !== t.start_month ? `~${t.end_month}월` : ''}</span><strong>{t.title}</strong><small>{activityTypeLabel(t.activity_type)}</small></li>)}</ol></div>
      <div className="fw-schedule-controls"><Field label="재배 연도"><select value={year} onChange={e => setYear(Number(e.target.value))}>{Array.from(new Set([year, ...Array.from({ length: 5 }, (_, i) => defaultGuideYear() - 2 + i)])).sort().map(y => <option key={y} value={y}>{y}년</option>)}</select></Field>
        <button type="button" className={button()} onClick={() => { const next = guideForm(guide, year); setForm(f => ({ ...f, year, tasks: next.tasks.map(t => ({ ...t, title: f.tasks.find(o => o.task_id === t.task_id)?.title || t.title, description: f.tasks.find(o => o.task_id === t.task_id)?.description ?? t.description })), scheduleReason: '' })); setEditableDates(false); setError('') }}>{year}년 가이드 일정 적용</button>
        <button type="button" className={button()} aria-expanded={editableDates} onClick={() => setEditableDates(v => !v)}>현장 사정으로 일정 조정</button>
      </div>
      <div className="fw-form-row"><Field label="가용 인력"><input type="number" min={0} value={form.available_manpower} onChange={e => setForm(f => ({ ...f, available_manpower: e.target.value }))} /></Field><Field label="사용 장비"><input maxLength={4000} value={form.equipment} onChange={e => setForm(f => ({ ...f, equipment: e.target.value }))} /></Field></div>
      <Field label="계획 설명·재배구역"><textarea rows={3} maxLength={4000} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
      {form.tasks.map(t => <details className="fw-guide-task" key={t.task_id}><summary><strong>{t.title}</strong><span className="fw-muted">{t.planned_start_date} ~ {t.planned_end_date}</span></summary><div className="fw-guide-body">
        <Field label={`${t.title} 작업명`}><input required maxLength={200} value={t.title} onChange={e => updateTask(t.task_id, 'title', e.target.value)} /></Field>
        <div className="fw-form-row"><Field label={`${t.title} 시작일`}><input required type="date" readOnly={!editableDates} value={t.planned_start_date} onChange={e => updateTask(t.task_id, 'planned_start_date', e.target.value)} /></Field><Field label={`${t.title} 종료일`}><input required type="date" readOnly={!editableDates} value={t.planned_end_date} onChange={e => updateTask(t.task_id, 'planned_end_date', e.target.value)} /></Field></div>
        <Field label={`${t.title} 작업 설명`}><textarea rows={3} maxLength={4000} value={t.description || ''} onChange={e => updateTask(t.task_id, 'description', e.target.value)} /></Field>
      </div></details>)}
      {editableDates && <Field label="일정 조정 사유"><textarea rows={2} maxLength={1000} value={form.scheduleReason} onChange={e => setForm(f => ({ ...f, scheduleReason: e.target.value }))} /></Field>}
      {duplicate && <div className="fw-notice">같은 연도·작물의 계획이 등록돼 있습니다. <button type="button" className={button()} onClick={() => navigate({ plan: duplicate.plans[0]?.plan_id })}>기존 계획 선택</button></div>}
      {hasPermission('farming_plan:create') && <button className={button(true)} type="submit" disabled={!!duplicate || submissions.loading || !!submissions.error}>가이드 일정으로 영농계획 등록</button>}
    </fieldset>{error && <p className="fw-error" role="alert">{error}</p>}<MutationStatus state={mutation} />
  </form>
}

function PlanEdit({ plan, changed }) {
  const [open, setOpen] = useState(false), [error, setError] = useState('')
  const mutation = useWorkflowMutation()
  return <><button className={button()} onClick={() => setOpen(v => !v)}>{open ? '작업 계획 수정 닫기' : '작업 계획 수정'}</button>{open && <form className="fw-form" onSubmit={e => {
    e.preventDefault(); setError(''); const values = Object.fromEntries(new FormData(e.currentTarget))
    const payload = { title: values.title.trim(), description: values.description.trim() || null, planned_start_date: values.start, planned_end_date: values.end }
    if (values.end < values.start) { setError('종료일은 시작일보다 빠를 수 없습니다.'); return }
    mutation.run(async () => {
      const matches = await apiPlanMatches(plan.plan_id)
      const issues = matches.filter(m => m.event_status === 'confirmed').flatMap(m => planActivityIssues({ ...plan, ...payload }, { plant_id: plan.plant_id, activity_type: m.activity_type, started_at: m.event_started_at }))
      if (issues.length) throw new Error(`연결된 활동과 맞지 않는 수정입니다. ${issues[0]}`)
      return apiUpdatePlan(plan.plan_id, payload)
    }, () => { setOpen(false); changed() })
  }}><fieldset className="fw-live-fieldset" disabled={mutation.busy}><Field label="작업 계획명"><input name="title" required maxLength={200} defaultValue={plan.title} /></Field><div className="fw-form-row"><Field label="작업 시작일"><input name="start" type="date" required defaultValue={plan.planned_start_date} /></Field><Field label="작업 종료일"><input name="end" type="date" required defaultValue={plan.planned_end_date} /></Field></div><Field label="작업 계획 설명"><textarea name="description" rows={3} maxLength={4000} defaultValue={plan.description || ''} /></Field><button className={button(true)}>작업 계획 저장</button></fieldset></form>}{error && <p role="alert">{error}</p>}<MutationStatus state={mutation} /></>
}

export default function WorkspacePlans({ workspace: w }) {
  const [create, setCreate] = useState(false), [guideId, setGuideId] = useState(''), [camerasOpen, setCamerasOpen] = useState(false)
  const guides = useWorkflowQuery(signal => w.hasPermission('crop_guide:read') ? apiCropGuides(signal) : Promise.resolve([]), [])
  const selectedGuide = guideId || guides.data?.find(g => g.status === 'active')?.guide_id || ''
  const guide = useWorkflowQuery(signal => selectedGuide ? apiCropGuide(selectedGuide, signal) : Promise.resolve(null), [selectedGuide])
  const canConfigure = w.hasPermission('camera_runtime:read') || w.hasPermission('camera_capture:read')
  return <section className="fw-panel"><div className="fw-panel-head"><div><h2>작물별 전체 영농계획</h2><p>등록된 재배 가이드로 연간 계획을 만들고 작업별 사진과 수행 기록을 연결합니다.</p></div>{w.hasPermission('farming_plan:create') && <button className={button()} onClick={() => setCreate(v => !v)}>{create ? '계획 작성 닫기' : '새 연간계획 작성'}</button>}</div>
    <QueryStatus state={w.submissions} /><QueryStatus state={w.plans} />
    {w.submissions.data?.map(s => <article className="fw-record" key={s.submission_id}><span className="fw-tag">{s.plan_year}년 · {s.crop_name} · 가이드 v{s.guide_version_number}</span><h3>{s.description || `${s.crop_name} 연간 재배계획`}</h3><p>인력 {s.available_manpower ?? '미등록'} · 장비 {s.equipment || '미등록'}</p><div className="fw-live-plan-list">{s.plans.map(p => <button key={p.plan_id} className={button(w.planId === p.plan_id)} onClick={() => w.navigate({ plan: p.plan_id })}>{p.title}<small>{p.planned_start_date} ~ {p.planned_end_date}</small></button>)}</div></article>)}
    {!w.submissions.loading && !w.submissions.error && !w.submissions.data?.length && <p className="fw-guide-note">등록된 연간 재배계획이 없습니다. 아래에서 가이드를 선택해 작성하세요.</p>}
    {w.plan && <article className="fw-record"><Field label="작업 계획 선택"><select value={w.planId} onChange={e => w.navigate({ plan: e.target.value })}>{w.plans.data?.map(p => <option key={p.plan_id} value={p.plan_id}>{p.title} · {p.planned_start_date}~{p.planned_end_date}{p.status === 'cancelled' ? ' · 취소됨' : ''}</option>)}</select></Field><h3>{w.plan.title}</h3><p>{activityTypeLabel(w.plan.activity_type)} · {w.plan.planned_start_date} ~ {w.plan.planned_end_date}</p><p className="fw-prewrap">{w.plan.description}</p><div className="fw-actions"><button className={button(true)} onClick={() => w.go('gallery')}>이 계획의 사진 확인</button><button className={button()} onClick={() => w.go('records')}>수행 기록 · 검토</button><button className={button()} onClick={() => w.go('reports')}>이 기간의 보고서</button></div>{w.hasPermission('farming_plan:update') && w.hasPermission('farming_match:read') && w.plan.status === 'scheduled' && <PlanEdit key={JSON.stringify(w.plan)} plan={w.plan} changed={w.changed} />}</article>}
    {(create || !w.submissions.data?.length) && w.hasPermission('farming_plan:create') && <><QueryStatus state={guides} /><QueryStatus state={guide} /><Field label="재배 가이드"><select value={selectedGuide} onChange={e => setGuideId(e.target.value)}><option value="">가이드 선택</option>{guides.data?.filter(g => g.status === 'active').map(g => <option key={g.guide_id} value={g.guide_id}>{g.crop_name} · v{g.current_version_number}</option>)}</select></Field>{guide.data && <SubmissionEditor key={guide.data.current_version.guide_version_id} guide={guide.data} workspace={w} />}{guides.data?.length === 0 && <p>사용 가능한 재배 가이드가 없습니다. 관리자에게 가이드 등록을 요청해 주세요.</p>}</>}
    {canConfigure && <div className="fw-live-camera-setup"><button className={button()} aria-expanded={camerasOpen} onClick={() => setCamerasOpen(v => !v)}>카메라 · 자동 촬영 설정</button>{camerasOpen && <WorkspaceCameras workspace={w} />}</div>}
  </section>
}
