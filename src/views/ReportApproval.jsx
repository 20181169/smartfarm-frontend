import { useState } from 'react'
import { useApp } from '../context/useApp'
import { apiReportApproval, apiApproveReport } from '../lib/api'
import { useWorkflowQuery, useWorkflowMutation, QueryStatus, MutationStatus } from '../components/WorkflowUI'
import { workflowTime, workflowStates } from '../lib/workflow'

export default function ReportApproval({ reportId }) {
  const [open, setOpen] = useState(false)
  return <details className="report-approval-detail" onToggle={e => setOpen(e.currentTarget.open)}><summary>승인 · 서명 확인</summary>{open && <ApprovalPanel reportId={reportId} />}</details>
}
function ApprovalPanel({ reportId }) {
  const { hasPermission } = useApp()
  const state = useWorkflowQuery(signal => apiReportApproval(reportId, signal), [reportId])
  const mutation = useWorkflowMutation()
  const [decision, setDecision] = useState(''), [comment, setComment] = useState('')
  function submit(e) {
    e.preventDefault()
    if (!hasPermission('report:approve') || !decision || (decision === 'rejected' && !comment.trim())) return
    mutation.run(() => apiApproveReport(reportId, { decision, comment: comment.trim() || null }), () => { setDecision(''); setComment(''); state.reload() })
  }
  const latest = state.data?.latest
  return <section aria-label="보고서 승인 및 서명" className="stack">
    <div className="workflow-actions"><h3>보고서 승인 · 서명</h3><button className="icon-btn" disabled={mutation.busy} onClick={state.reload}>승인 이력 새로고침</button></div>
    <QueryStatus state={state} />
    {state.data && <>
      <dl className="workflow-summary"><div><dt>최종 승인 상태</dt><dd>{latest ? workflowStates[latest.decision] : '승인 대기'}</dd></div>
        <div><dt>최종 검토자</dt><dd>{latest ? `${latest.reviewer_name} · ${latest.reviewer_role_name}` : '미등록'}</dd></div><div><dt>서명 시각</dt><dd>{workflowTime(latest?.signed_at)}</dd></div></dl>
      {latest?.comment && <p className="workflow-copy">최종 의견: {latest.comment}</p>}
      <p className="text-muted">승인·반려 시 현재 로그인 사용자의 이름과 역할, 서명 시각이 기록됩니다. 보관된 PDF 내용은 생성 당시 상태를 유지합니다.</p>
      {hasPermission('report:approve') && <form onSubmit={submit} className="workflow-form"><fieldset disabled={mutation.busy}>
        <label>최종 검토 의견<textarea aria-label="보고서 최종 검토 의견" maxLength={2000} rows={3} value={comment} onChange={e => setComment(e.target.value)} required={decision === 'rejected'} /></label>
        <div className="workflow-actions"><button type="button" className="icon-btn" onClick={() => setDecision('approved')}>보고서 승인</button><button type="button" className="icon-btn" onClick={() => setDecision('rejected')}>보고서 반려</button></div>
        {decision && <div><p>{decision === 'approved' ? '이 보고서를 승인하고 서명 기록을 남깁니다.' : '반려 사유를 입력해 주세요. 반려 기록은 이력에 남습니다.'}</p><button className="btn-primary" type="submit" disabled={decision === 'rejected' && !comment.trim()}>{mutation.busy ? '처리 중…' : decision === 'approved' ? '승인 확정' : '반려 확정'}</button></div>}
      </fieldset></form>}
      <h4>승인 · 서명 이력 ({state.data.total}건)</h4>
      {state.data.items.length ? <ol className="workflow-history">{state.data.items.map(r => <li key={r.approval_id}><b>{workflowStates[r.decision]} · {r.reviewer_name} / {r.reviewer_role_name}</b><p>{r.comment || '의견 없음'}</p><time>{workflowTime(r.signed_at)}</time></li>)}</ol> : <p>아직 승인·서명 기록이 없습니다.</p>}
    </>}
    <MutationStatus state={mutation} />
  </section>
}
