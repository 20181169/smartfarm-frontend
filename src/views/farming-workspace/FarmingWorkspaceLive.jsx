import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Sprout, Images, NotebookPen, FileCheck2, ShieldAlert } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { apiFarmingPlans, apiPlanSubmissions, apiFarmingActivities, apiEvidenceUsage, apiWorkflowContext } from '../../lib/api'
import { QueryStatus, useWorkflowQuery } from '../../components/WorkflowUI'
import WorkspacePlans from './WorkspacePlans'
import WorkspaceGallery from './WorkspaceGallery'
import WorkspaceRecords from './WorkspaceRecords'
import WorkspaceReports from './WorkspaceReports'
import WorkspaceIssues from './WorkspaceIssues'
import { Field } from './WorkspaceShared'

const TABS = [['plan', '영농계획', Sprout], ['gallery', '사진 갤러리', Images], ['records', '수행 기록', NotebookPen], ['reports', '보고서', FileCheck2], ['issues', '현장 확인', ShieldAlert]]
export default function FarmingWorkspaceLive() {
  const { plant, refreshBackend, backendPlants } = useApp()
  if (!plant?._backend) return <div className="farming-workspace"><section className="fw-panel"><p role="status">{backendPlants.length ? '발전소 자료를 준비하고 있습니다.' : '접근 가능한 발전소를 불러오는 중이거나 등록된 발전소가 없습니다.'}</p><button className="fw-button" onClick={refreshBackend}>발전소 다시 조회</button></section></div>
  return <LiveWorkspace />
}
function LiveWorkspace() {
  const { user, plant, plantId, hasPermission } = useApp()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'plan'
  const [selection, setSelection] = useState(() => params.get('evidence') ? [params.get('evidence')] : [])
  const [editing, setEditing] = useState(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setVersion(v => v + 1) }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  const plans = useWorkflowQuery(signal => hasPermission('farming_plan:read') ? apiFarmingPlans(plantId, signal) : Promise.resolve([]), [plantId, version], true)
  const submissions = useWorkflowQuery(signal => hasPermission('farming_plan:read') ? apiPlanSubmissions(plantId, signal) : Promise.resolve([]), [plantId, version], true)
  const events = useWorkflowQuery(signal => hasPermission('farming_activity:read') ? apiFarmingActivities(plantId, signal) : Promise.resolve([]), [plantId, version, tab], true)
  const context = useWorkflowQuery(signal => hasPermission('farming_plan:read') && hasPermission('farming_match:read') ? apiWorkflowContext(plantId, signal) : Promise.resolve({ plans: [], matches: [] }), [plantId, version, tab], true)
  const evidenceActive = ['gallery', 'records'].includes(tab)
  const usage = useWorkflowQuery(signal => evidenceActive && hasPermission('farming_activity:read') ? apiEvidenceUsage(plantId, signal) : Promise.resolve(new Map()), [plantId, version, evidenceActive])
  const planId = params.get('plan') || submissions.data?.[0]?.plans?.[0]?.plan_id || plans.data?.[0]?.plan_id || ''
  const plan = plans.data?.find(p => p.plan_id === planId && p.plant_id === plantId)
  const navigate = changes => setParams(previous => {
    const next = new URLSearchParams(previous)
    Object.entries(changes).forEach(([key, value]) => value == null || value === '' ? next.delete(key) : next.set(key, value))
    return next
  })
  const go = next => navigate({ tab: next, ...(planId ? { plan: planId } : {}) })
  const changed = () => setVersion(v => v + 1)
  const shared = { user, plant, plantId, hasPermission, plans, submissions, events, context, usage, selection, setSelection, editing, setEditing, plan, planId, params, navigate, go, changed, version }
  const readable = { plan: 'farming_plan:read', gallery: 'vision:read', records: 'farming_activity:read', reports: 'report:read', issues: 'plant:read' }
  return <div className="farming-workspace"><div className="fw-screen">
    <header className="fw-heading"><div><span className="fw-eyebrow">FARMING WORKSPACE</span><h1>사진으로 기록하는 영농관리</h1><p>{plant.name} · 재배계획부터 보고서 검토까지 한곳에서 관리합니다.</p></div><div><span className="fw-tag">{user.roleName || user.roleCode}</span><p className="fw-muted">{user.name || user.email}</p></div></header>
    <div className="fw-local-note"><span className="fw-tag">운영 자료</span><span>현재 발전소의 서버 자료를 사용합니다. 제출·검토·승인은 로그인한 계정의 권한에 따라 처리됩니다.</span></div>
    <div className="fw-summary"><div><span>선택한 작업 계획</span><strong>{plan?.title || '계획을 선택해 주세요'}</strong></div><div><span>등록된 작업 계획</span><strong>{plans.data?.length ?? '…'}<small>건</small></strong></div><div><span>수행 기록</span><strong>{events.data?.length ?? '…'}<small>건</small></strong></div><div><span>검토 대기 활동</span><strong>{events.data?.filter(e => e.status === 'draft').length ?? '…'}<small>건</small></strong></div></div>
    <nav className="fw-tabs" aria-label="영농관리 단계">{TABS.map(([key, label, Icon], i) => <button key={key} aria-current={tab === key ? 'page' : undefined} className={tab === key ? 'active' : ''} onClick={() => go(key)}><Icon size={18} /><span>{i + 1}. {label}</span></button>)}</nav>
    {tab !== 'plan' && <section className="fw-panel fw-live-context"><Field label="연결할 작업 계획"><select value={planId} onChange={e => navigate({ plan: e.target.value })}><option value="">계획 선택</option>{plans.data?.map(p => <option key={p.plan_id} value={p.plan_id}>{p.title} · {p.planned_start_date}~{p.planned_end_date}{p.status === 'cancelled' ? ' · 취소됨' : ''}</option>)}</select></Field>{plan && <p className="fw-muted">선택한 계획을 사진 선택·활동 작성·보고서 조회에 이어 사용합니다.</p>}<QueryStatus state={plans} /></section>}
    {params.get('plan') && plans.data && !plan && <div className="fw-error" role="alert">이 발전소의 계획을 다시 선택해 주세요. <button className="fw-button" onClick={() => navigate({ plan: null, activity: null, evidence: null })}>이전 계획 선택 해제</button></div>}
    {!hasPermission(readable[tab]) ? <section className="fw-panel"><p role="status">이 단계의 자료를 조회할 권한이 없습니다.</p></section> : <>
      {tab === 'plan' && <WorkspacePlans workspace={shared} />}
      {tab === 'gallery' && <WorkspaceGallery workspace={shared} />}
      {tab === 'records' && <WorkspaceRecords workspace={shared} />}
      {tab === 'reports' && <WorkspaceReports key={planId} workspace={shared} />}
      {tab === 'issues' && <WorkspaceIssues workspace={shared} />}
    </>}
    <footer className="fw-footer"><span>현재 발전소: {plant.name} · 운영 기록은 서버에서 공유됩니다.</span><button className="fw-button" onClick={changed}>업무 자료 새로고침</button></footer>
  </div></div>
}
