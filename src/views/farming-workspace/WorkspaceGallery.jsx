import { useEffect, useRef, useState } from 'react'
import { apiVisionAnalyses, apiAssessmentAnalysis, apiVisionReviews, apiReviewVision, apiDetectTractor } from '../../lib/api'
import { canRunVision } from '../../lib/uiPolicy'
import { usableWorkspaceEvidence } from '../../lib/farmingWorkspace'
import { visionFilters } from '../../lib/camera'
import { QueryStatus, MutationStatus, ReviewHistory, useWorkflowQuery, useWorkflowMutation } from '../../components/WorkflowUI'
import { Field, EvidencePhoto, STATUS, dateTime, button } from './WorkspaceShared'

function PhotoUpload({ workspace: w }) {
  const [files, setFiles] = useState([]), [messages, setMessages] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const active = useRef(null), alive = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current?.abort() } }, [])
  async function upload() {
    if (active.current || !files.length || !canRunVision(w.user)) return
    if (files.length > 20 || files.some(f => !f.type.startsWith('image/') || f.size > 8 * 1024 * 1024)) { setError('이미지 파일을 최대 20장, 각 8MB 이하로 선택해 주세요.'); return }
    const abort = new AbortController(); active.current = abort; setBusy(true); setError(''); setMessages([])
    try {
      for (const file of files) {
        if (abort.signal.aborted) break
        await apiDetectTractor({ plantId: w.plantId, blob: file, threshold: .35, signal: abort.signal })
        if (alive.current) setMessages(previous => [...previous, `${file.name} · 분석 저장 완료`])
      }
      if (alive.current) setFiles([])
    } catch (e) { if (alive.current) setError(e.name === 'AbortError' || e.status === 0 ? '처리가 중단되었거나 저장 결과를 확인하지 못했습니다. 갤러리를 새로 조회한 뒤 미처리 사진만 다시 선택하세요.' : e.message) }
    finally { active.current = null; if (alive.current) { setBusy(false); w.changed() } }
  }
  return <details className="fw-guide-task"><summary>사진 업로드 · AI 분석</summary><div className="fw-guide-body"><p className="fw-muted">선택한 사진을 한 장씩 분석해 서버에 저장합니다. 검수자가 확정한 사진을 수행 기록에 첨부할 수 있습니다.</p><Field label="분석할 사진"><input type="file" multiple accept="image/*" disabled={busy} onChange={e => { setFiles([...e.target.files]); e.target.value = ''; setError('') }} /></Field><p>{files.length}장 선택</p><button className={button(true)} disabled={busy || !files.length} onClick={upload}>{busy ? '사진 분석 중…' : '선택한 사진 분석'}</button>{messages.map(text => <p key={text} role="status">{text}</p>)}{error && <p role="alert" className="fw-error">{error}</p>}</div></details>
}

export function EvidenceDetail({ id, workspace: w }) {
  const [version, setVersion] = useState(0), [imageType, setImageType] = useState('annotated'), [decision, setDecision] = useState(''), [comment, setComment] = useState('')
  const state = useWorkflowQuery(async signal => {
    const result = await apiAssessmentAnalysis(id, signal)
    if (result.plant_id !== w.plantId) throw new Error('현재 발전소의 사진이 아닙니다.')
    return result
  }, [id, version, w.version])
  const reviews = useWorkflowQuery(signal => apiVisionReviews(id, signal), [id, version])
  const mutation = useWorkflowMutation()
  return <section className="fw-photo-detail" aria-label="운영 사진 상세"><QueryStatus state={state} />{state.data && <>
    <h3>사진 상세 · {STATUS[state.data.status] || state.data.status}</h3><div className="fw-actions"><button className={button(imageType === 'source')} onClick={() => setImageType('source')}>원본 사진</button><button className={button(imageType === 'annotated')} onClick={() => setImageType('annotated')}>AI 결과 사진</button></div>
    <EvidencePhoto id={id} type={imageType} /><p>촬영 {dateTime(state.data.captured_at)} · 분석 {dateTime(state.data.analyzed_at)}</p><p>{state.data.detections?.length ? state.data.detections.map(d => `${d.label} ${Number.isFinite(d.confidence) ? (d.confidence * 100).toFixed(1) + '%' : ''}`).join(' · ') : '탐지된 객체 없음'}</p>
    <QueryStatus state={reviews} />{reviews.data && <ReviewHistory items={reviews.data} />}
    {w.hasPermission('vision:review') && <form className="fw-form" onSubmit={e => { e.preventDefault(); if (!decision || decision === 'rejected' && !comment.trim()) return; mutation.run(() => apiReviewVision(id, { status: decision, comment: comment.trim() || null }), () => { setVersion(v => v + 1); setComment(''); setDecision(''); w.changed() }) }}><fieldset className="fw-live-fieldset" disabled={mutation.busy}><Field label="사진 검토 결과"><select required value={decision} onChange={e => setDecision(e.target.value)}><option value="">검토 결과 선택</option><option value="confirmed" disabled={state.data.status === 'confirmed'}>확정</option><option value="rejected" disabled={state.data.status === 'rejected'}>반려</option></select></Field><Field label="사진 검토 의견"><textarea rows={3} required={decision === 'rejected'} maxLength={2000} value={comment} onChange={e => setComment(e.target.value)} /></Field><button className={button(true)}>사진 검토 저장</button></fieldset></form>}
    <MutationStatus state={mutation} />
    <button className={button()} onClick={() => w.navigate({ tab: 'issues', issueEvidence: id })}>이 사진의 현장 확인 메모</button>
  </>}</section>
}

export default function WorkspaceGallery({ workspace: w }) {
  const [values, setValues] = useState({ from: '', to: '', status: '', label: '' }), [filters, setFilters] = useState({}), [filterError, setFilterError] = useState('')
  const [skip, setSkip] = useState(0), [selected, setSelected] = useState(w.params.get('evidence') || '')
  const rows = useWorkflowQuery(signal => apiVisionAnalyses(w.plantId, skip, signal, filters), [w.plantId, skip, filters, w.version])
  const eligible = w.usage.data ? usableWorkspaceEvidence(rows.data?.items || [], w.usage.data, w.plantId, w.editing?.event_id) : []
  const canChoose = w.hasPermission('farming_activity:create') || !!w.editing && w.hasPermission('farming_activity:update')
  const toggle = id => w.setSelection(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id])
  return <section className="fw-panel"><div className="fw-panel-head"><div><h2>영농 사진 갤러리</h2><p>카메라 자동 촬영과 업로드 분석 결과를 확인하고, 확정된 사진을 수행 기록으로 연결합니다.</p></div><button className={button()} onClick={() => { rows.reload(); w.usage.reload() }}>사진 목록 새로고침</button></div>
    {canRunVision(w.user) && <PhotoUpload workspace={w} />}
    <form className="fw-filters" onSubmit={e => { e.preventDefault(); setFilterError(''); try { setFilters(visionFilters(values)); setSkip(0); setSelected('') } catch (error) { setFilterError(error.message) } }}>
      <Field label="사진 시작일"><input type="date" value={values.from} onChange={e => setValues(v => ({ ...v, from: e.target.value }))} /></Field><Field label="사진 종료일"><input type="date" value={values.to} onChange={e => setValues(v => ({ ...v, to: e.target.value }))} /></Field><Field label="사진 검토 상태"><select value={values.status} onChange={e => setValues(v => ({ ...v, status: e.target.value }))}><option value="">전체</option>{['candidate', 'pending', 'confirmed', 'rejected'].map(s => <option key={s} value={s}>{STATUS[s]}</option>)}</select></Field><Field label="사진 탐지 대상"><input value={values.label} maxLength={100} placeholder="tractor, person" onChange={e => setValues(v => ({ ...v, label: e.target.value }))} /></Field><button className={button()}>사진 검색</button>
    </form>
    <p className="fw-muted">촬영일이 없는 사진은 분석일로 검색합니다. 생육 단계가 제공되지 않은 사진은 임의로 분류하지 않습니다.</p>{filterError && <p role="alert">{filterError}</p>}<QueryStatus state={rows} /><QueryStatus state={w.usage} />
    <div className="fw-gallery">{rows.data?.items.map(photo => {
      const available = eligible.some(p => p.analysis_id === photo.analysis_id), occupied = w.usage.data?.get(photo.analysis_id)
      return <article key={photo.analysis_id} className={`fw-photo-card ${w.selection.includes(photo.analysis_id) ? 'selected' : ''}`}><button className="fw-photo-open" aria-label={`사진 ${photo.analysis_id} 상세`} onClick={() => setSelected(photo.analysis_id)}><EvidencePhoto id={photo.analysis_id} /><span className="fw-photo-type">{photo.source_type === 'camera' ? '카메라 촬영' : '업로드'}</span></button><div className="fw-photo-body"><span className="fw-tag">{STATUS[photo.status] || photo.status}</span><p>{dateTime(photo.captured_at || photo.analyzed_at)} · 탐지 {photo.detection_count}개</p>{canChoose && <label className="fw-check"><input type="checkbox" aria-label={`운영 증빙 ${photo.analysis_id}`} checked={w.selection.includes(photo.analysis_id)} disabled={w.usage.loading || !!w.usage.error || !available || w.selection.length >= 100 && !w.selection.includes(photo.analysis_id)} onChange={() => toggle(photo.analysis_id)} />수행 기록에 연결</label>}{occupied && <p className="fw-muted">사용된 활동: {occupied.title}</p>}{photo.status !== 'confirmed' && <p className="fw-muted">검수자 확정 후 첨부할 수 있습니다.</p>}</div></article>
    })}</div>
    {rows.data?.items.length === 0 && <div className="fw-empty">조건에 맞는 사진이 없습니다.</div>}
    <div className="fw-actions"><button className={button()} disabled={skip === 0 || rows.loading} onClick={() => setSkip(v => Math.max(0, v - 20))}>이전 사진</button><span>{Math.floor(skip / 20) + 1} 페이지</span><button className={button()} disabled={rows.loading || !rows.data || skip + 20 >= rows.data.total} onClick={() => setSkip(v => v + 20)}>다음 사진</button></div>
    {selected && <EvidenceDetail key={selected} id={selected} workspace={w} />}
    {canChoose && <div className="fw-selection-bar"><span>선택한 사진 {w.selection.length}장 · {w.plan?.title || '연결할 계획을 선택해 주세요.'}</span><button className={button(true)} disabled={!w.selection.length || !w.plan || w.plan.status === 'cancelled'} onClick={() => w.go('records')}>수행 내용 작성</button></div>}
  </section>
}
