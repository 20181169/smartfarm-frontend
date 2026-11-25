import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/useApp'
import { apiVisionAnalyses, apiAssessmentAnalysis, apiReportEvidenceImage, apiVisionReviews, apiReviewVision, apiEvidenceUsage, apiCameraDevices } from '../lib/api'
import { Link } from 'react-router-dom'
import { workflowPath } from '../lib/workflow'
import { visionFilters } from '../lib/camera'

import { useWorkflowQuery, QueryStatus, ReviewHistory } from '../components/WorkflowUI'

const STATUS = { candidate: '후보', pending: '검토 대기', confirmed: '확정', rejected: '반려' }
const message = e => e.status === 403 ? '분석 이력 조회 또는 검토 권한이 없습니다.' : e.message
const time = value => value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '시각 미등록'

const sourceLabel = value => ({ camera: '카메라 촬영', upload: '직접 업로드' }[value] || value || '출처 미제공')
const cameraLabel = (id, devices) => !id ? '카메라 미지정' : devices?.find(d => d.device_id === id)?.name || `카메라 ID: ${id}`

function SavedAnalysis({ id, plantId, planId, refresh, onReviewed, devices }) {
  const { hasPermission } = useApp()
  const [state, setState] = useState({ loading: true })
  const [image, setImage] = useState(null)
  const [imageError, setImageError] = useState('')
  const [reload, setReload] = useState(0)
  const canReadActivities = hasPermission('farming_activity:read')
  const usage = useWorkflowQuery(signal => canReadActivities ? apiEvidenceUsage(plantId, signal) : Promise.resolve(new Map()), [plantId, id, reload, refresh, canReadActivities])
  const [imageType, setImageType] = useState('annotated')
  const reviews = useWorkflowQuery(signal => apiVisionReviews(id, signal), [id, reload, refresh])
  const [result, setResult] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const pending = useRef(false)
  const alive = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const abort = new AbortController()
    setState({ loading: true })
    apiAssessmentAnalysis(id, abort.signal).then(data => {
      if (data.plant_id !== plantId) throw new Error('선택한 발전소의 증빙이 아닙니다.')
      if (!abort.signal.aborted) setState({ data })
    }).catch(e => { if (!abort.signal.aborted) setState({ error: message(e) }) })
    return () => abort.abort()
  }, [id, reload, refresh])
  useEffect(() => {
    const abort = new AbortController()
    let url
    setImage(null); setImageError('')
    apiReportEvidenceImage(id, imageType, abort.signal).then(blob => {
      if (!abort.signal.aborted) { url = URL.createObjectURL(blob); setImage(url) }
    }).catch(e => { if (!abort.signal.aborted) setImageError(e.status === 404 ? '저장된 증빙 이미지가 없습니다.' : message(e)) })
    return () => { abort.abort(); if (url) URL.revokeObjectURL(url) }
  }, [id, imageType])
  async function review(event) {
    event.preventDefault()
    if (pending.current || !result || (result === 'rejected' && !comment.trim()) || !hasPermission('vision:review')) return
    pending.current = true; setSaving(true); setError(''); setNotice('')
    try {
      await apiReviewVision(id, { status: result, comment: comment.trim() || null })
      if (!alive.current) return
      setNotice('검토 결과를 저장했습니다.'); setResult(''); setComment(''); setReload(v => v + 1); onReviewed()
    } catch (e) { if (alive.current) setError(e.status === 0 ? '저장 결과를 확인하지 못했습니다. 새로 조회한 후 다시 시도해 주세요.' : message(e)) }
    finally { pending.current = false; if (alive.current) setSaving(false) }
  }
  return <section className="stack" aria-label="저장된 분석 상세" style={{ marginTop: 16 }}>
    {state.loading ? <p role="status">분석 결과를 불러오는 중입니다.</p> : state.error ? <div role="alert">{state.error}<button onClick={() => setReload(v => v + 1)}>다시 조회</button></div> : <>
      <h3>분석 결과 · {STATUS[state.data.status] || state.data.status}</h3>
      {usage.error && <QueryStatus state={usage} />}
      <div className="workflow-next">{usage.data?.get(id) ? <>이 증빙은 <b>{usage.data.get(id).title}</b> 활동에 사용되었습니다. <Link to={workflowPath('/my-compliance', { plantId, planId, eventId: usage.data.get(id).event_id })}>활동 · 검토 결과 보기</Link></> : usage.data && state.data.status === 'confirmed' ? hasPermission('farming_activity:create') ? <Link className="btn-primary" to={workflowPath('/my-compliance', { plantId, planId, analysisId: id, create: true })}>이 증빙으로 활동 등록</Link> : <Link to={workflowPath('/my-compliance', { plantId, planId })}>영농활동 검토로 이동</Link> : state.data.status === 'confirmed' ? '증빙 사용 현황을 확인한 뒤 활동을 등록할 수 있습니다.' : '검수자가 증빙을 확정하면 담당자가 활동에 첨부할 수 있습니다.'}</div>
      <div className="text-muted">{time(state.data.analyzed_at)} · {state.data.model_id}</div>
      <p>촬영: {time(state.data.captured_at)}</p>
      <p>{sourceLabel(state.data.source_type)} · {cameraLabel(state.data.camera_id, devices)}</p>
      <p>탐지 {state.data.detection_count ?? state.data.detections?.length ?? 0}개 · 최대 탐지 신뢰도 {state.data.detections?.some(d => Number.isFinite(d.confidence)) ? Math.max(...state.data.detections.filter(d => Number.isFinite(d.confidence)).map(d => d.confidence)).toFixed(2) : '미제공'}</p>
      <div className="workflow-actions"><button type="button" className="icon-btn" onClick={() => setImageType('source')}>원본 이미지</button><button type="button" className="icon-btn" onClick={() => setImageType('annotated')}>AI 결과 이미지</button></div>
      {image ? <img src={image} alt="저장된 분석 증빙" style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }} /> : <p>{imageError || '이미지를 불러오는 중입니다.'}</p>}
      <div className="table-wrap"><table className="data"><thead><tr><th>탐지 대상</th><th>탐지 점수</th></tr></thead><tbody>{state.data.detections?.map((d,i) => <tr key={d.detection_id || i}><td>{{ tractor: '트랙터', person: '사람', car: '승용차', truck: '트럭' }[d.label] || d.label}</td><td>{Number.isFinite(d.confidence) ? d.confidence.toFixed(2) : '—'}</td></tr>)}</tbody></table></div>
      {!state.data.detections?.length && <p>탐지된 객체가 없습니다.</p>}
      <QueryStatus state={reviews} />{reviews.data && <ReviewHistory items={reviews.data} />}
      {hasPermission('vision:review') && <form onSubmit={review} className="stack vision-review-form">
        <label className="field">검토 결과<select aria-label="영상 검토 결과" required value={result} disabled={saving} onChange={e => setResult(e.target.value)}><option value="">선택하세요</option>{['confirmed','rejected','pending'].map(value => <option key={value} value={value} disabled={state.data.status === value}>{STATUS[value]}</option>)}</select></label>
        <label className="field">검토 의견<textarea aria-label="영상 검토 의견" required={result === 'rejected'} value={comment} disabled={saving} maxLength={2000} rows={3} onChange={e => setComment(e.target.value)} /></label>
        <button className="btn-primary" disabled={saving || !result || (result === 'rejected' && !comment.trim())} type="submit">{saving ? '저장 중…' : '검토 결과 저장'}</button>
      </form>}
    </>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </section>
}

export default function VisionHistory({ plantId, planId, analysisId, refresh }) {
  const { user, hasPermission } = useApp()
  const [state, setState] = useState({ loading: true })
  const [skip, setSkip] = useState(0)
  const [selected, setSelected] = useState(analysisId || '')
  const [reload, setReload] = useState(0)
  const [filters, setFilters] = useState({ from: '', to: '', status: '', label: '' })
  const [applied, setApplied] = useState({})
  const [filterError, setFilterError] = useState('')
  const deviceState = useWorkflowQuery(signal => hasPermission('device:read') ? apiCameraDevices(plantId, signal) : Promise.resolve([]), [plantId, user?.userId])
  useEffect(() => { if (analysisId) setSelected(analysisId) }, [analysisId])
  useEffect(() => {
    const abort = new AbortController()
    setState({ loading: true })
    apiVisionAnalyses(plantId, skip, abort.signal, applied).then(data => {
      if (!abort.signal.aborted) setState({ data })
    }).catch(e => { if (!abort.signal.aborted) setState({ error: message(e) }) })
    return () => abort.abort()
  }, [plantId, skip, reload, refresh, applied])
  return <section className="card" aria-label="저장된 분석 이력">
    <div className="tractor-header"><h3>저장된 분석 이력</h3><button className="icon-btn" onClick={() => setReload(v => v + 1)}>이력 새로고침</button></div>
    <p className="camera-help">자동 촬영의 최종 증빙과 직접 업로드한 분석 결과를 조회합니다. 촬영일이 없으면 분석일로 검색합니다. 감지용 임시 프레임은 표시하지 않습니다.</p>
    <form className="workflow-form camera-filter" aria-label="증빙 검색" onSubmit={e => {
      e.preventDefault(); setFilterError('')
      try { const next = visionFilters(filters); setApplied(next); setSkip(0); setSelected('') } catch (error) { setFilterError(error.message) }
    }}>
      <label>촬영 시작일<input aria-label="증빙 촬영 시작일" type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} /></label>
      <label>촬영 종료일<input aria-label="증빙 촬영 종료일" type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} /></label>
      <label>검토 상태<select aria-label="증빙 검토 상태" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}><option value="">전체</option>{Object.entries(STATUS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
      <label>탐지 대상<input aria-label="증빙 탐지 대상" value={filters.label} placeholder="tractor, person" maxLength={100} onChange={e => setFilters(f => ({ ...f, label: e.target.value }))} /></label>
      <button type="submit" className="icon-btn">증빙 검색</button><button type="button" className="icon-btn" onClick={() => { setFilters({ from: '', to: '', status: '', label: '' }); setApplied({}); setSkip(0); setSelected(''); setFilterError('') }}>검색 초기화</button>
    </form>
    {filterError && <p role="alert">{filterError}</p>}<QueryStatus state={deviceState} />
    {state.loading ? <p role="status">저장 이력을 불러오는 중입니다.</p> : state.error ? <p role="alert">{state.error}</p> : <>
      {state.data.items?.length ? <div className="table-wrap"><table className="data"><thead><tr><th>촬영 시각</th><th>분석 시각</th><th>카메라 · 출처</th><th>상태</th><th>탐지 객체</th><th>결과</th></tr></thead><tbody>
        {state.data.items.map(row => <tr key={row.analysis_id}><td>{time(row.captured_at)}</td><td>{time(row.analyzed_at)}</td><td>{cameraLabel(row.camera_id, deviceState.data)}<br />{sourceLabel(row.source_type)}</td><td>{STATUS[row.status] || row.status}</td><td>{row.detection_count ?? '—'}</td><td><button className="icon-btn" aria-pressed={selected === row.analysis_id} onClick={() => setSelected(row.analysis_id)}>결과 확인</button></td></tr>)}
      </tbody></table></div> : <p>저장된 분석 이력이 없습니다.</p>}
    </>}
    <div className="tractor-buttons"><button className="icon-btn" disabled={skip === 0 || state.loading} onClick={() => { setSelected(''); setSkip(v => Math.max(0,v-20)) }}>이전</button><span>{Math.floor(skip/20)+1} 페이지</span><button className="icon-btn" disabled={!state.data || skip + 20 >= state.data.total || state.loading} onClick={() => { setSelected(''); setSkip(v => v+20) }}>다음</button></div>
    {selected && <SavedAnalysis key={selected} id={selected} plantId={plantId} planId={planId} refresh={`${reload}:${refresh}`} onReviewed={() => setReload(v => v + 1)} devices={deviceState.data} />}
  </section>
}
