import { useState } from 'react'
import { apiFarmingReport, apiGenerateFarmingReport, apiReportArchive } from '../../lib/api'
import { workflowDate } from '../../lib/workflow'
import { QueryStatus, MutationStatus, useWorkflowQuery, useWorkflowMutation } from '../../components/WorkflowUI'
import ReportApproval from '../ReportApproval'
import { Download } from '../ReportCenterView'
import { Field, button } from './WorkspaceShared'

export default function WorkspaceReports({ workspace: w }) {
  const [from, setFrom] = useState(w.plan?.planned_start_date || workflowDate().slice(0, 7) + '-01'), [to, setTo] = useState(w.plan?.planned_end_date || workflowDate())
  const [query, setQuery] = useState({ plant_id: w.plantId, from_date: from, to_date: to }), [skip, setSkip] = useState(0), [selected, setSelected] = useState(''), [error, setError] = useState('')
  const report = useWorkflowQuery(signal => apiFarmingReport(query, signal), [query, w.version])
  const archive = useWorkflowQuery(signal => apiReportArchive(w.plantId, skip, signal), [w.plantId, skip, w.version])
  const mutation = useWorkflowMutation()
  return <div className="fw-live-stack"><section className="fw-panel"><h2>영농이행 보고서</h2><p className="fw-muted">계획·확정된 수행 기록·사진을 조회하고 보고서를 생성합니다.</p><form className="fw-filters" onSubmit={e => { e.preventDefault(); if (to < from) { setError('보고서 종료일은 시작일보다 빠를 수 없습니다.'); return } setError(''); setQuery({ plant_id: w.plantId, from_date: from, to_date: to }) }}><Field label="운영 보고서 시작일"><input required type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field><Field label="운영 보고서 종료일"><input required type="date" value={to} onChange={e => setTo(e.target.value)} /></Field><button className={button()}>보고서 조회</button></form>
    {error && <p role="alert">{error}</p>}<QueryStatus state={report} />{report.data && <><p className="fw-guide-note">조회 기간: {query.from_date} ~ {query.to_date} · 계획 {report.data.total_plans ?? report.data.plans?.length ?? 0}건 · 확정 활동 {report.data.activity_summary?.confirmed_event_count ?? 0}건</p>
      {report.data.plans?.map(p => <article className="fw-record" key={p.plan_id}><h3>{p.title}</h3><p>{p.planned_start_date} ~ {p.planned_end_date}</p>{p.matched_events?.map(a => <button key={a.event_id} className={button()} onClick={() => w.navigate({ tab: 'records', plan: p.plan_id, activity: a.event_id })}>{a.title || a.event_title || '수행 기록'} · 사진·검토 확인</button>)}</article>)}
      {w.hasPermission('report:generate') && <button className={button(true)} disabled={mutation.busy} onClick={() => mutation.run(() => apiGenerateFarmingReport(query), result => { setSelected(result.report_id); setSkip(0); w.changed() })}>{mutation.busy ? 'PDF 생성 중…' : '운영 PDF 보고서 생성'}</button>}
    </>}<MutationStatus state={mutation} /></section>
    <section className="fw-panel" aria-label="운영 보고서 보관함"><div className="fw-panel-head"><h2>보고서 검토·서명·다운로드</h2><button className={button()} onClick={() => { setSkip(0); archive.reload() }}>보고서 보관함 새로고침</button></div><p className="fw-muted">현재 발전소의 전체 기간 보고서입니다. 파일별 기간을 확인한 뒤 해당 PDF를 검토하세요.</p><QueryStatus state={archive} />
      {archive.data?.items.length === 0 && <p>보관된 보고서가 없습니다.</p>}{archive.data?.items.map(item => <article className="fw-record" key={item.report_id} aria-label={`보관 보고서 ${item.report_id}`}><span className="fw-tag">{item.period}</span><h3>{item.file_name}</h3>{selected === item.report_id && <p className="fw-notice">생성한 보고서입니다. 검토·서명 기록을 확인하세요.</p>}<Download report={item} /><ReportApproval reportId={item.report_id} report={item} onOpenPlan={() => w.go('records')} /></article>)}
      {(archive.data?.total || 0) > 20 && <div className="fw-actions"><button className={button()} disabled={!skip} onClick={() => setSkip(v => Math.max(0, v - 20))}>이전 보고서</button><span>{Math.floor(skip / 20) + 1} 페이지</span><button className={button()} disabled={skip + 20 >= archive.data.total} onClick={() => setSkip(v => v + 20)}>다음 보고서</button></div>}
    </section></div>
}
