import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardList, Camera, FileCheck2, Sprout } from 'lucide-react'
import { useApp } from '../context/useApp'
import { ACTIVITY_TYPES, activityTypeLabel, workflowPath } from '../lib/workflow'
import './Workflow.css'

export function ActivityTypeSelect({ value, defaultValue, ...props }) {
  const selected = value ?? defaultValue
  return <select {...props} {...(value !== undefined ? { value } : { defaultValue })}>
    {selected && !ACTIVITY_TYPES[selected] && <option value={selected}>{selected} (기존 작업 유형)</option>}
    {Object.entries(ACTIVITY_TYPES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
  </select>
}

export function PlanSummary({ plan, children }) {
  if (!plan) return null
  return <div className="workflow-plan-context">
    <div><span className="workflow-eyebrow">작업 기준 계획</span><strong>{plan.title}</strong><p>{activityTypeLabel(plan.activity_type)} · {plan.planned_start_date} ~ {plan.planned_end_date}{plan.status === 'cancelled' ? ' · 취소됨' : ''}</p></div>
    <div className="workflow-actions">{children}<Link className="icon-btn" to={workflowPath('/plan-assessment', { plantId: plan.plant_id, planId: plan.plan_id })}>계획 상세 <ArrowRight size={14} /></Link></div>
  </div>
}

export default function FarmingWorkflow({ current, context = {} }) {
  const { hasPermission } = useApp()
  const steps = [
    { key: 'plan', label: '계획 · 이행평가', path: '/plan-assessment', permission: 'farming_assessment:read', icon: ClipboardList },
    { key: 'capture', label: '자동 촬영 정책', path: '/capture-policies', permission: 'camera_capture:read', icon: Camera },
    { key: 'evidence', label: 'AI 증빙', path: '/cctv', permission: 'vision:read', icon: Camera },
    { key: 'activity', label: hasPermission('farming_activity:review') ? '영농활동 검토' : '활동 제출 · 검토', path: '/my-compliance', permission: 'farming_activity:read', review: hasPermission('farming_activity:review'), icon: Sprout },
    { key: 'report', label: hasPermission('report:approve') ? '보고서 검토·서명' : '보고서 · 승인', path: '/compliance-report', permission: 'report:read', review: hasPermission('report:approve'), icon: FileCheck2 },
  ]
  return <section className="workflow-guide" aria-label="영농 업무 흐름">
    <p>계획 작성 <ArrowRight size={12} /> 증빙 검토 <ArrowRight size={12} /> 활동 제출·확정 <ArrowRight size={12} /> 계획 연결·최종 평가 <ArrowRight size={12} /> 보고서 생성·승인</p>
    <nav aria-label="영농 업무 메뉴">{steps.filter(s => hasPermission(s.permission)).map(({ key, label, path, review, icon: Icon }) => <Link key={key} className={current === key ? 'is-current' : ''} aria-current={current === key ? 'page' : undefined} to={workflowPath(path, { ...context, review })}><Icon size={16} />{label}</Link>)}</nav>
  </section>
}
