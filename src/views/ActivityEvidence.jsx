import { useEffect, useState } from 'react'
import { apiAssessmentAnalysis, apiReportEvidenceImage, apiVisionReviews } from '../lib/api'
import { useWorkflowQuery, QueryStatus, ReviewHistory } from '../components/WorkflowUI'
import { workflowTime, workflowStates, workflowError } from '../lib/workflow'

export default function ActivityEvidence({ id }) {
  const [open, setOpen] = useState(false), [kind, setKind] = useState('annotated')
  return <div><button type="button" className="icon-btn" onClick={() => setOpen(v => !v)} aria-expanded={open}>{open ? '증빙 닫기' : '증빙 상세 보기'}</button>
    {open && <EvidenceDetails id={id} kind={kind} setKind={setKind} />}</div>
}
function EvidenceDetails({ id, kind, setKind }) {
  const state = useWorkflowQuery(async signal => {
    const [detail, reviews] = await Promise.all([apiAssessmentAnalysis(id, signal), apiVisionReviews(id, signal)])
    return { detail, reviews }
  }, [id])
  const [image, setImage] = useState({})
  useEffect(() => {
    const controller = new AbortController(); let url
    setImage({ loading: true })
    apiReportEvidenceImage(id, kind, controller.signal).then(blob => {
      if (!controller.signal.aborted) { url = URL.createObjectURL(blob); setImage({ url }) }
    }).catch(e => { if (!controller.signal.aborted) setImage({ error: e.status === 404 ? '저장된 이미지가 없습니다.' : workflowError(e) }) })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [id, kind])
  return <section className="stack"><QueryStatus state={state} />{state.data && <>
    <p>촬영 {workflowTime(state.data.detail.captured_at)} · 분석 {workflowTime(state.data.detail.analyzed_at)} · {workflowStates[state.data.detail.status]}</p>
    <div className="workflow-actions"><button type="button" className="icon-btn" aria-pressed={kind === 'source'} onClick={() => setKind('source')}>원본 이미지</button><button type="button" className="icon-btn" aria-pressed={kind === 'annotated'} onClick={() => setKind('annotated')}>AI 결과 이미지</button></div>
    {image.url ? <img className="workflow-preview" src={image.url} alt={kind === 'source' ? '원본 증빙' : 'AI 탐지 결과'} /> : <p>{image.error || '이미지를 불러오는 중입니다.'}</p>}
    <p>{state.data.detail.detections?.map(d => `${d.label} ${Number.isFinite(d.confidence) ? (d.confidence * 100).toFixed(1) + '%' : ''}`).join(' · ') || '탐지 객체 없음'}</p>
    <ReviewHistory items={state.data.reviews} />
  </>}</section>
}
