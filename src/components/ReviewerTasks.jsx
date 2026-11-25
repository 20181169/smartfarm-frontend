import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardCheck, FileCheck2 } from 'lucide-react'
import { useApp } from '../context/useApp'
import { workflowPath } from '../lib/workflow'
import './Workflow.css'

export default function ReviewerTasks() {
  const { user, plant, plantId, hasPermission } = useApp()
  if (user?.source !== 'api') return null
  const activity = hasPermission('farming_activity:read') && hasPermission('farming_activity:review')
  const report = hasPermission('report:read') && hasPermission('report:approve')
  if (!activity && !report) return null
  const context = { plantId: plant?._backend ? plantId : null, review: true }
  return <section className="card reviewer-tasks" aria-label="현장관리자 검토 업무">
    <h2>검토할 자료 찾기</h2>
    <p className="text-muted">{plant?._backend ? `${plant.name} · ` : ''}담당자가 제출한 활동과 PDF 보고서는 각각 아래에서 검토합니다.</p>
    <div className="reviewer-task-grid">
      {activity && <Link className="reviewer-task" aria-label="영농활동 검토 바로가기" to={workflowPath('/my-compliance', context)}><ClipboardCheck size={24} /><div><strong>영농활동 검토</strong><p>제출된 작업 내용과 첨부 사진·증빙을 확인하고 승인하거나 반려합니다.</p><span>검토 대기 활동 보기 <ArrowRight size={14} /></span></div></Link>}
      {report && <Link className="reviewer-task" aria-label="보고서 검토·서명 바로가기" to={workflowPath('/compliance-report', context)}><FileCheck2 size={24} /><div><strong>보고서 검토·서명</strong><p>보관된 PDF를 확인하고 승인 시 검토자의 이름·역할·시각을 서명 기록으로 남깁니다.</p><span>PDF 보고서 검토하기 <ArrowRight size={14} /></span></div></Link>}
    </div>
  </section>
}
