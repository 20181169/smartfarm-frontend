import { useEffect, useState, useId, Children, isValidElement, cloneElement } from 'react'
import { apiReportEvidenceImage } from '../../lib/api'
export const button = (primary = false) => `fw-button${primary ? ' fw-primary' : ''}`
export const dateTime = value => value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '미등록'
export const STATUS = { candidate: '후보', pending: '검토 대기', confirmed: '확정', rejected: '반려', draft: '검토 대기', cancelled: '반려' }
export function Field({ label, children }) {
  const id = useId()
  return <div className="fw-field"><label htmlFor={id}>{label}</label>{Children.map(children, child => isValidElement(child) && ['input', 'select', 'textarea'].includes(child.type) ? cloneElement(child, { id }) : child)}</div>
}
export function EvidencePhoto({ id, type = 'annotated' }) {
  const [state, setState] = useState({})
  useEffect(() => {
    const abort = new AbortController(); let url
    setState({})
    apiReportEvidenceImage(id, type, abort.signal).then(blob => {
      if (!abort.signal.aborted) { url = URL.createObjectURL(blob); setState({ url }) }
    }).catch(e => { if (!abort.signal.aborted) setState({ error: e.status === 404 ? '저장된 이미지가 없습니다.' : '이미지를 불러오지 못했습니다.' }) })
    return () => { abort.abort(); if (url) URL.revokeObjectURL(url) }
  }, [id, type])
  return state.url ? <img className="fw-live-photo" src={state.url} alt="서버에 저장된 영농 증빙" /> : <div className="fw-no-photo">{state.error || '증빙 이미지 불러오는 중…'}</div>
}
