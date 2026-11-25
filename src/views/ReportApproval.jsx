import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { apiReportApproval, apiApproveReport, apiDownloadFarmingReport } from '../lib/api'
import { useWorkflowQuery, useWorkflowMutation, QueryStatus, MutationStatus } from '../components/WorkflowUI'
import { workflowTime, workflowStates, workflowPath, workflowError } from '../lib/workflow'

function ArchivedPdf({ report }) {
  const [open, setOpen] = useState(false), [version, setVersion] = useState(0)
  const [state, setState] = useState({})
  useEffect(() => {
    if (!open) return undefined
    const controller = new AbortController()
    let url
    setState({ loading: true })
    apiDownloadFarmingReport(report.report_id, controller.signal).then(blob => {
      if (!controller.signal.aborted) { url = URL.createObjectURL(blob); setState({ url }) }
    }).catch(error => { if (!controller.signal.aborted) setState({ error: workflowError(error) }) })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [open, report.report_id, version])
  return <div><button type="button" className="icon-btn" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? 'PDF 미리보기 닫기' : '승인 대상 PDF 미리보기'}</button>{open && <>
    {state.loading && <p role="status">보관된 PDF를 불러오는 중입니다.</p>}
    {state.error && <p role="alert">{state.error} <button type="button" onClick={() => setVersion(v => v + 1)}>다시 조회</button></p>}
    {state.url && <><p className="text-muted">브라우저에서 PDF가 표시되지 않으면 ‘PDF 다운로드’로 확인해 주세요.</p><iframe title={`승인 대상 PDF: ${report.period}`} src={state.url} style={{ width: '100%', height: 560, border: '1px solid var(--border)', borderRadius: 8 }} /></>}
  </>}</div>
}

export default function ReportApproval({ reportId, report = {} }) {
  const { hasPermission } = useApp()
  const [open, setOpen] = useState(false)
  const state = useWorkflowQuery(signal => apiReportApproval(reportId, signal), [reportId])
  const latest = state.data?.latest
  return <div className="report-approval-detail">
    <div className="workflow-actions" role="group" aria-label="보고서 승인 상태"><span className={`badge ${latest?.decision === 'approved' ? 'badge-active' : 'badge-neutral'}`}>{state.loading ? '승인 상태 조회 중…' : state.error ? '승인 상태 확인 필요' : latest ? workflowStates[latest.decision] : '승인 대기'}</span>{latest && <small>{latest.reviewer_name} · {workflowTime(latest.signed_at)}</small>}</div>
    {state.error && <QueryStatus state={state} />}
    <button type="button" className={hasPermission('report:approve') ? 'btn-primary' : 'icon-btn'} style={{ marginTop: 12 }} aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? '검토 창 닫기' : hasPermission('report:approve') ? '보고서 검토·서명' : '승인 · 서명 확인'}</button>
    {open && <ApprovalPanel report={{ ...report, report_id: reportId }} state={state} />}
  </div>
}

function ApprovalPanel({ report, state }) {
  const { hasPermission } = useApp()
  const panel = useRef(null)
  useEffect(() => { panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [])
  const mutation = useWorkflowMutation()
  const [decision, setDecision] = useState(''), [comment, setComment] = useState('')
  function submit(e) {
    e.preventDefault()
    if (!hasPermission('report:approve') || !decision || (decision === 'rejected' && !comment.trim())) return
    mutation.run(() => apiApproveReport(report.report_id, { decision, comment: comment.trim() || null }), () => { setDecision(''); setComment(''); state.reload() })
  }
  const latest = state.data?.latest
  return <section ref={panel} aria-label="보고서 승인 및 서명" className="stack workflow-review-panel" style={{ marginTop: 16 }}>
    <div className="workflow-actions"><h3>보고서 승인 · 서명</h3><button className="icon-btn" disabled={mutation.busy} onClick={state.reload}>승인 이력 새로고침</button></div>
    <div className="workflow-plan-context"><div><span className="workflow-eyebrow">이번에 검토하는 보관 보고서</span><strong>{report.period || '기간 확인 필요'}</strong><p>{report.file_name || report.report_id}</p><small>발행 {workflowTime(report.issued_at)}</small></div></div>
    <p className="text-muted">아래 승인·반려는 이 PDF에 적용됩니다. 상단 보고서 조회 조건과 별도로 보관된 파일입니다.</p>
    {hasPermission('report:approve') && <div className="workflow-next"><b>검토 순서: PDF 확인 → 검토 의견 입력 → 보고서 승인 → 승인 확정</b><p>승인을 확정하면 로그인한 검토자의 이름·역할·시각이 서명 기록으로 저장됩니다.</p></div>}
    {hasPermission('report:download') && <ArchivedPdf report={report} />}
    <QueryStatus state={state} />
    {state.data && <>
      <dl className="workflow-summary"><div><dt>최종 승인 상태</dt><dd>{latest ? workflowStates[latest.decision] : '승인 대기'}</dd></div>
        <div><dt>최종 검토자</dt><dd>{latest ? `${latest.reviewer_name} · ${latest.reviewer_role_name}` : '미등록'}</dd></div><div><dt>서명 시각</dt><dd>{workflowTime(latest?.signed_at)}</dd></div></dl>
      {latest?.comment && <p className="workflow-copy">최종 의견: {latest.comment}</p>}
      {latest?.decision === 'rejected' && <div className="workflow-warning"><b>반려된 보고서입니다.</b><p>반려 의견에 따라 계획·활동·증빙을 확인해 주세요. 원본 내용이 바뀌었다면 담당자가 새 PDF를 생성해 다시 검토받아야 합니다.</p><Link to={workflowPath('/plan-assessment', { plantId: report.plant_id })}>계획 · 활동 확인</Link></div>}
      <p className="text-muted">승인·반려 시 현재 로그인 사용자의 이름과 역할, 서명 시각이 기록됩니다. 보관된 PDF 원문은 변경되지 않으며, 웹 승인 기록은 이 화면에서 확인합니다.</p>
      {hasPermission('report:approve') && <form onSubmit={submit} className="workflow-form"><fieldset disabled={mutation.busy}>
        <label>최종 검토 의견<textarea aria-label="보고서 최종 검토 의견" maxLength={2000} rows={3} value={comment} onChange={e => setComment(e.target.value)} required={decision === 'rejected'} /></label>
        <div className="workflow-actions"><button type="button" className="icon-btn" onClick={() => setDecision('approved')}>보고서 승인</button><button type="button" className="icon-btn" onClick={() => setDecision('rejected')}>보고서 반려</button></div>
        {decision && <div><p>{decision === 'approved' ? '위 PDF의 검토 결과를 승인하고 서명 기록을 남깁니다.' : '반려 사유를 입력해 주세요. 반려 기록은 이력에 남습니다.'}</p><button className="btn-primary" type="submit" disabled={decision === 'rejected' && !comment.trim()}>{mutation.busy ? '처리 중…' : decision === 'approved' ? '승인 확정' : '반려 확정'}</button></div>}
      </fieldset></form>}
      <h4>승인 · 서명 이력 ({state.data.total}건)</h4>
      {state.data.items.length ? <ol className="workflow-history">{state.data.items.map(r => <li key={r.approval_id}><b>{workflowStates[r.decision]} · {r.reviewer_name} / {r.reviewer_role_name}</b><p>{r.comment || '의견 없음'}</p><time>{workflowTime(r.signed_at)}</time></li>)}</ol> : <p>아직 승인·서명 기록이 없습니다.</p>}
    </>}
    <MutationStatus state={mutation} />
  </section>
}
