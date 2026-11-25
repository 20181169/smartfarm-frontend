import { useState } from 'react'
import { uid } from '../../lib/localFarming'
import { Field, EvidencePhoto, dateTime, button } from './WorkspaceShared'

export default function WorkspaceIssues({ workspace: w }) {
  const key = `farming-personal-notes-v1:${w.user.userId}:${w.plantId}`
  const [initial] = useState(() => {
    try { const value = JSON.parse(localStorage.getItem(key) || '[]'); if (!Array.isArray(value)) throw new Error(); return { notes: value, error: '' } }
    catch { return { notes: [], error: '개인 메모를 읽을 수 없습니다. 기존 저장 자료를 확인해 주세요.' } }
  })
  const [notes, setNotes] = useState(initial.notes), [error, setError] = useState(initial.error), [title, setTitle] = useState(''), [detail, setDetail] = useState('')
  const canWrite = w.hasPermission('farming_activity:create') || w.hasPermission('farming_activity:review')
  const evidenceId = w.params.get('issueEvidence')
  return <section className="fw-panel"><h2>현장 확인</h2><p>사진과 수행 기록을 확인하며 현장 특이 사항을 남깁니다.</p><div className="fw-local-note"><span className="fw-tag">개인 메모</span><span>현장 확인 요청·조치를 계정 간 공유하는 기능은 아직 연결되지 않았습니다. 아래 메모는 현재 계정과 발전소 기준으로 이 브라우저에만 저장됩니다.</span></div>
    {evidenceId && w.hasPermission('vision:read') && <EvidencePhoto id={evidenceId} />}
    {canWrite && <form className="fw-form" onSubmit={e => {
      e.preventDefault(); if (initial.error || !title.trim() || !detail.trim()) return
      const next = [{ id: uid(), title: title.trim(), detail: detail.trim(), planId: w.planId || null, planTitle: w.plan?.title || '', evidenceId: evidenceId || null, at: new Date().toISOString() }, ...notes]
      try { localStorage.setItem(key, JSON.stringify(next)); setNotes(next); setTitle(''); setDetail(''); setError('') } catch { setError('브라우저 저장 공간을 확인해 주세요. 메모를 저장하지 못했습니다.') }
    }}><Field label="현장 확인 메모 제목"><input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></Field><Field label="현장 확인 메모 내용"><textarea required maxLength={4000} rows={4} value={detail} onChange={e => setDetail(e.target.value)} /></Field><button className={button(true)} disabled={!!initial.error}>개인 현장 메모 저장</button></form>}
    {error && <p role="alert" className="fw-error">{error}</p>}{notes.length === 0 && <p>저장된 개인 현장 메모가 없습니다.</p>}{notes.map(note => <article className="fw-record" key={note.id}><span className="fw-tag">이 브라우저의 개인 메모</span><h3>{note.title}</h3><p>{note.planTitle} · {dateTime(note.at)}</p><p className="fw-prewrap">{note.detail}</p>{note.evidenceId && w.hasPermission('vision:read') && <button className={button()} onClick={() => w.navigate({ tab: 'gallery', evidence: note.evidenceId })}>관련 사진 보기</button>}</article>)}
  </section>
}
