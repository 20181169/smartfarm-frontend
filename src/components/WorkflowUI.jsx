import { useEffect, useRef, useState } from 'react'
import { workflowError, workflowStates, workflowTime } from '../lib/workflow'
import './Workflow.css'

// Callers provide stable query keys; aborted or older requests never replace a new selection.
export function useWorkflowQuery(load, keys) {
  const [state, setState] = useState({ loading: true })
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setState({ loading: true })
    Promise.resolve().then(() => load(controller.signal)).then(data => {
      if (!controller.signal.aborted) setState({ data })
    }).catch(e => { if (!controller.signal.aborted) setState({ error: workflowError(e) }) })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...keys, version])
  return { ...state, reload: () => setVersion(v => v + 1) }
}
export function useWorkflowMutation() {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const pending = useRef(false), alive = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  async function run(action, success) {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(''); setNotice('')
    try { const result = await action(); if (alive.current) { setNotice('처리했습니다. 최신 결과를 다시 조회합니다.'); success?.(result) } }
    catch (e) { if (alive.current) setError(workflowError(e, true)) }
    finally { pending.current = false; if (alive.current) setBusy(false) }
  }
  return { busy, error, notice, run }
}
export function QueryStatus({ state }) {
  return state.loading ? <p role="status">불러오는 중입니다.</p> : state.error ? <div role="alert" className="workflow-error">{state.error} <button type="button" className="icon-btn" onClick={state.reload}>다시 조회</button></div> : null
}
export function MutationStatus({ state }) {
  return <>{state.error && <p role="alert" className="workflow-error">{state.error}</p>}{state.notice && <p role="status">{state.notice}</p>}</>
}
export function ReviewHistory({ items }) {
  return <section aria-label="검토 이력"><h4>검토 이력</h4>{items.length ? <ol className="workflow-history">{items.map(r => <li key={r.review_id}>
    <b>{workflowStates[r.previous_status] || r.previous_status} → {workflowStates[r.new_status] || r.new_status}</b>
    <p>{r.comment || '의견 없음'}</p><small>{workflowTime(r.reviewed_at)} · 검토자 ID: {r.reviewer_user_id || '미등록'}</small>
  </li>)}</ol> : <p>검토 이력이 없습니다.</p>}</section>
}
