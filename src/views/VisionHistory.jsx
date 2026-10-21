import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/useApp'
import { apiVisionAnalyses, apiAssessmentAnalysis, apiAssessmentImage, apiReviewVision } from '../lib/api'

const STATUS = { candidate: '후보', pending: '검토 대기', confirmed: '확정', rejected: '반려' }
const message = e => e.status === 403 ? '분석 이력 조회 또는 검토 권한이 없습니다.' : e.message
const time = value => value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '시각 미등록'

function SavedAnalysis({ id, refresh, onReviewed }) {
  const { hasPermission } = useApp()
  const [state, setState] = useState({ loading: true })
  const [image, setImage] = useState(null)
  const [imageError, setImageError] = useState('')
  const [reload, setReload] = useState(0)
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
      if (!abort.signal.aborted) setState({ data })
    }).catch(e => { if (!abort.signal.aborted) setState({ error: message(e) }) })
    return () => abort.abort()
  }, [id, reload, refresh])
  useEffect(() => {
    const abort = new AbortController()
    let url
    setImage(null); setImageError('')
    apiAssessmentImage(id, abort.signal).then(blob => {
      if (!abort.signal.aborted) { url = URL.createObjectURL(blob); setImage(url) }
    }).catch(e => { if (!abort.signal.aborted) setImageError(e.status === 404 ? '저장된 증빙 이미지가 없습니다.' : message(e)) })
    return () => { abort.abort(); if (url) URL.revokeObjectURL(url) }
  }, [id])
  async function review(event) {
    event.preventDefault()
    if (pending.current || !result || !hasPermission('vision:review')) return
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
      <div className="text-muted">{time(state.data.analyzed_at)} · {state.data.model_id}</div>
      {image ? <img src={image} alt="저장된 분석 증빙" style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }} /> : <p>{imageError || '이미지를 불러오는 중입니다.'}</p>}
      <div className="table-wrap"><table className="data"><thead><tr><th>탐지 대상</th><th>탐지 점수</th></tr></thead><tbody>{state.data.detections?.map((d,i) => <tr key={d.detection_id || i}><td>{{ tractor: '트랙터', person: '사람', car: '승용차', truck: '트럭' }[d.label] || d.label}</td><td>{Number.isFinite(d.confidence) ? d.confidence.toFixed(2) : '—'}</td></tr>)}</tbody></table></div>
      {!state.data.detections?.length && <p>탐지된 객체가 없습니다.</p>}
      {hasPermission('vision:review') && <form onSubmit={review} className="stack vision-review-form">
        <label className="field">검토 결과<select aria-label="영상 검토 결과" required value={result} disabled={saving} onChange={e => setResult(e.target.value)}><option value="">선택하세요</option>{['confirmed','rejected','pending'].map(value => <option key={value} value={value} disabled={state.data.status === value}>{STATUS[value]}</option>)}</select></label>
        <label className="field">검토 의견<textarea aria-label="영상 검토 의견" value={comment} disabled={saving} maxLength={2000} rows={3} onChange={e => setComment(e.target.value)} /></label>
        <button className="btn-primary" disabled={saving || !result} type="submit">{saving ? '저장 중…' : '검토 결과 저장'}</button>
      </form>}
    </>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </section>
}

export default function VisionHistory({ plantId, refresh }) {
  const [state, setState] = useState({ loading: true })
  const [skip, setSkip] = useState(0)
  const [selected, setSelected] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const abort = new AbortController()
    setState({ loading: true })
    apiVisionAnalyses(plantId, skip, abort.signal).then(data => {
      if (!abort.signal.aborted) setState({ data })
    }).catch(e => { if (!abort.signal.aborted) setState({ error: message(e) }) })
    return () => abort.abort()
  }, [plantId, skip, reload, refresh])
  return <section className="card" aria-label="저장된 분석 이력">
    <div className="tractor-header"><h3>저장된 분석 이력</h3><button className="icon-btn" onClick={() => setReload(v => v + 1)}>이력 새로고침</button></div>
    {state.loading ? <p role="status">저장 이력을 불러오는 중입니다.</p> : state.error ? <p role="alert">{state.error}</p> : <>
      {state.data.items?.length ? <div className="table-wrap"><table className="data"><thead><tr><th>분석 시각</th><th>상태</th><th>탐지 객체</th><th>결과</th></tr></thead><tbody>
        {state.data.items.map(row => <tr key={row.analysis_id}><td>{time(row.analyzed_at)}</td><td>{STATUS[row.status] || row.status}</td><td>{row.detection_count ?? '—'}</td><td><button className="icon-btn" aria-pressed={selected === row.analysis_id} onClick={() => setSelected(row.analysis_id)}>결과 확인</button></td></tr>)}
      </tbody></table></div> : <p>저장된 분석 이력이 없습니다.</p>}
    </>}
    <div className="tractor-buttons"><button className="icon-btn" disabled={skip === 0 || state.loading} onClick={() => { setSelected(''); setSkip(v => Math.max(0,v-20)) }}>이전</button><span>{Math.floor(skip/20)+1} 페이지</span><button className="icon-btn" disabled={!state.data || skip + 20 >= state.data.total || state.loading} onClick={() => { setSelected(''); setSkip(v => v+20) }}>다음</button></div>
    {selected && <SavedAnalysis key={selected} id={selected} refresh={reload} onReviewed={() => setReload(v => v + 1)} />}
  </section>
}
