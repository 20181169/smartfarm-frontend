import { useEffect, useState, useId, Children, isValidElement, cloneElement } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Sprout, Images, NotebookPen, FileCheck2, ShieldAlert, ArrowRight, Check, Printer, RefreshCw } from 'lucide-react'
import { useApp } from '../context/useApp'
import {
  PHASES, REPORT_STATUS, today, uid, emptyWorkspace, workspaceKey, loadWorkspace, commitWorkspace,
  makePlan, recordError, reportDraft, transitionReport, fetchLocalPhotos, localPhotoUrl, GALLERY_CATEGORIES, photoCategory, matchesPhotoCategory, photoInspectionDraft,
} from '../lib/localFarming'
import './FarmingWorkspaceView.css'

const TABS = [
  ['plan', '영농계획', Sprout], ['gallery', '사진 갤러리', Images],
  ['records', '수행 기록', NotebookPen], ['reports', '보고서', FileCheck2], ['issues', '현장 확인', ShieldAlert],
]
const phaseName = (code) => PHASES.find((p) => p.code === code)?.name || code
const dateTime = (value) => value ? new Date(value).toLocaleString('ko-KR') : '미등록'
const freshRecord = (phase = 'SOWING') => ({ id: uid(), phase, date: today(), title: '', content: '', evidence: [], before: '', after: '' })
const btn = (primary = false) => `fw-button${primary ? ' fw-primary' : ''}`

function Photo({ photo, annotated = false, ...props }) {
  if (!photo) return <div className="fw-no-photo">사진을 선택해 주세요</div>
  return <img {...props} src={localPhotoUrl(annotated && photo.annotated ? photo.annotated : photo.image)}
    alt={photo.title} onError={(e) => { e.currentTarget.alt = `${photo.title} · 이미지 파일을 불러오지 못했습니다` }} />
}
function Field({ label, children }) {
  const id = useId()
  return <div className="fw-field"><label htmlFor={id}>{label}</label>{Children.map(children, (child) =>
    isValidElement(child) && ['input', 'select', 'textarea'].includes(child.type) ? cloneElement(child, { id }) : child,
  )}</div>
}
function Empty({ children, action }) {
  return <div className="fw-empty"><Sprout size={28} /><p>{children}</p>{action}</div>
}

export default function FarmingWorkspaceView() {
  const { user, plant, plantId } = useApp()
  const scope = workspaceKey(user?.userId || user?.email, plantId)
  return <Workspace key={scope} scope={scope} plantName={plant?.name || '선택 발전소'} />
}

function Workspace({ scope, plantName }) {
  const [initial] = useState(() => {
    try { return { data: loadWorkspace(localStorage, scope), error: '' } }
    catch { return { data: emptyWorkspace(), error: '브라우저의 로컬 자료를 읽을 수 없습니다. 저장소 설정을 확인해 주세요.' } }
  })
  const [data, setData] = useState(initial.data)
  const [storageError, setStorageError] = useState(initial.error)
  const [photos, setPhotos] = useState([])
  const [photoStatus, setPhotoStatus] = useState('loading')
  const [photoError, setPhotoError] = useState('')
  const [reload, setReload] = useState(0)
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'plan'
  const selectedPhase = PHASES.some((p) => p.code === params.get('phase')) ? params.get('phase') : 'SOWING'
  const category = GALLERY_CATEGORIES.some((c) => c.code === params.get('category')) ? params.get('category') : 'all'
  const [role, setRole] = useState('operator')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(() => freshRecord(selectedPhase))
  const [activeReport, setActiveReport] = useState(null)
  const [editPlan, setEditPlan] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setPhotoStatus('loading'); setPhotoError('')
    fetchLocalPhotos(controller.signal).then((items) => { setPhotos(items); setPhotoStatus('ready') })
      .catch((e) => { if (e.name !== 'AbortError') { setPhotoStatus('error'); setPhotoError(e.message) } })
    return () => controller.abort()
  }, [reload])
  useEffect(() => {
    const sync = (e) => {
      if (e.key && e.key !== scope) return
      try { setData(loadWorkspace(localStorage, scope)); setStorageError('') }
      catch { setStorageError('다른 창에서 변경한 자료를 읽을 수 없습니다.') }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [scope])
  useEffect(() => {
    setDraft((previous) => previous.phase === selectedPhase ? previous : { ...previous, phase: selectedPhase })
  }, [selectedPhase])
  const navigate = (changes) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      Object.entries(changes).forEach(([key, value]) => next.set(key, value))
      return next
    })
    setNotice(''); setError('')
  }
  const go = (next) => navigate({ tab: next })
  const choosePhase = (phase) => {
    setDraft((previous) => ({ ...previous, phase }))
    navigate({ phase })
  }
  const openStageGallery = (phase) => {
    setDraft((previous) => ({ ...previous, phase }))
    navigate({ tab: 'gallery', category: phase, phase })
  }
  const save = (update, message) => {
    if (storageError) { setError(storageError); return false }
    try {
      setData(commitWorkspace(localStorage, scope, update))
      setNotice(message); setError(''); return true
    } catch (e) { setError(e.name === 'QuotaExceededError' ? '브라우저 저장 공간이 부족합니다. 내용을 저장하지 못했습니다.' : e.message); return false }
  }
  const selectEvidence = (id) => setDraft((previous) => ({ ...previous,
    evidence: previous.evidence.includes(id) ? previous.evidence.filter((x) => x !== id) : [...previous.evidence, id],
  }))
  const report = data.reports.find((r) => r.id === activeReport) || data.reports[0]
  const phasesRecorded = new Set(data.records.map((r) => r.phase)).size
  const inspectionPhoto = photos.find((p) => p.id === params.get('issuePhoto'))
  const inspectPhoto = (photo) => navigate({ tab: 'issues', issuePhoto: photo.id })

  return <div className="farming-workspace">
    <div className="fw-screen">
      <div className="fw-heading">
        <div><span className="fw-eyebrow">FARMING WORKSPACE</span><h1>사진으로 기록하는 영농관리</h1><p>{plantName} · 재배계획부터 보고서 검토까지 한곳에서 관리합니다.</p></div>
        <Field label="시연 역할"><select value={role} onChange={(e) => { setRole(e.target.value); setNotice(''); setError('') }}>
          <option value="operator">발전소 담당자 화면</option><option value="inspector">검토자 화면</option>
        </select></Field>
      </div>
      <div className="fw-local-note"><span className="fw-tag">로컬 시연</span><span>사진은 실제 AI 분석 샘플입니다. 입력·제출·승인은 이 브라우저에만 저장되며 운영 DB에 반영되지 않습니다.</span></div>
      <div className="fw-summary">
        <div><span>현재 재배계획</span><strong>{data.plan?.title || '계획을 작성해 주세요'}</strong></div>
        <div><span>기록한 작업 단계</span><strong>{phasesRecorded}<small> / 4단계</small></strong></div>
        <div><span>수행 기록</span><strong>{data.records.length}<small>건</small></strong></div>
        <div><span>검토 대기 보고서</span><strong>{data.reports.filter((r) => r.status === 'submitted').length}<small>건</small></strong></div>
      </div>
      <nav className="fw-tabs" aria-label="영농관리 단계">{TABS.map(([key, label, Icon], i) => <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => go(key)} className={tab === key ? 'active' : ''}><Icon size={18} /><span>{i + 1}. {label}</span></button>)}</nav>
      {notice && <div className="fw-notice" role="status"><Check size={17} />{notice}</div>}
      {(error || storageError) && <div className="fw-error" role="alert">{error || storageError}</div>}
      {photoError && <div className="fw-error" role="alert">{photoError}<button className={btn()} onClick={() => setReload((n) => n + 1)}>사진 다시 불러오기</button></div>}

      {tab === 'plan' && <section className="fw-panel">
        <div className="fw-panel-head"><div><h2>작물별 전체 영농계획</h2><p>작물과 시작일을 정하고, 파종·모내기부터 수확까지의 일정을 조정하세요.</p></div>
          {data.plan && role === 'operator' && <button className={btn()} onClick={() => setEditPlan(!editPlan)}>{editPlan ? '수정 닫기' : '계획 수정'}</button>}</div>
        {role === 'operator' && (!data.plan || editPlan) ? <PlanEditor key={data.plan?.id || 'new'} plan={data.plan} onSave={(plan) => {
          if (save((s) => ({ ...s, plan }), '계획을 이 브라우저에 저장했습니다.')) setEditPlan(false)
        }} /> : data.plan ? <>
          <div className="fw-plan-intro"><div><span className="fw-tag">{data.plan.crop}</span><h3>{data.plan.title}</h3><p>{data.plan.plot || '재배구역 미입력'} · 재배 시작 {data.plan.start}</p></div>
            <button className={btn(true)} onClick={() => navigate({ tab: 'gallery', category: 'all' })}>사진 갤러리로 <ArrowRight size={16} /></button></div>
          <div className="fw-timeline">{data.plan.stages.map((stage, i) => <div key={stage.code} className="fw-stage"><span className="fw-stage-number">0{i + 1}</span><div><h3>{phaseName(stage.code)}</h3><p>{stage.date} · 장비 {stage.equipment || '미입력'} · 인력 {stage.people || '미입력'}</p><p>{stage.guide}</p></div><div className="fw-stage-actions"><span className="fw-tag">기록 {data.records.filter((r) => r.phase === stage.code).length}건 · 사진 {photos.filter((p) => photoCategory(p) === stage.code).length}장</span><button className={btn()} aria-label={`${phaseName(stage.code)} 해당 단계 사진 보기`} onClick={() => openStageGallery(stage.code)}>해당 단계 사진 보기 <ArrowRight size={15} /></button></div></div>)}</div>
        </> : <Empty>발전소 담당자 화면에서 먼저 영농계획을 작성해 주세요.</Empty>}
      </section>}

      {tab === 'gallery' && <Gallery photos={photos} loading={photoStatus === 'loading'} draft={draft} selectEvidence={selectEvidence} editable={role === 'operator'} onNext={() => go('records')} category={category} onCategory={(category) => navigate({ category })} onPhase={choosePhase} plan={data.plan} issues={data.issues} onInspect={inspectPhoto} />}

      {tab === 'records' && <div className="fw-two-col">
        <section className="fw-panel"><div className="fw-panel-head"><div><h2>계획 단계별 수행 기록</h2><p>수행한 작업과 증빙·전후 사진을 연결합니다.</p></div></div>
          {role !== 'operator' ? <Empty>검토자는 아래 수행 기록을 보고서와 함께 확인합니다.</Empty> : !data.plan ? <Empty action={<button className={btn(true)} onClick={() => go('plan')}>계획 작성으로</button>}>먼저 재배계획을 작성해 주세요.</Empty> : <form className="fw-form" onSubmit={(e) => {
            e.preventDefault()
            const problem = recordError(draft, data.plan, photos)
            if (problem) { setError(problem); return }
            const ok = save((s) => ({ ...s, records: [...s.records, { ...draft, id: uid(), planId: s.plan.id }] }), '수행 기록을 이 브라우저에 저장했습니다.')
            if (ok) setDraft(freshRecord(draft.phase))
          }}>
            <div className="fw-form-row"><Field label="계획 단계"><select value={draft.phase} onChange={(e) => choosePhase(e.target.value)}>{PHASES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></Field><Field label="작업일"><input type="date" required value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></Field></div>
            <Field label="작업 제목"><input required maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="예: 1구역 모내기 작업" /></Field>
            <Field label="수행 내용"><textarea required maxLength={3000} rows={4} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="작업 구역·내용·장비 사용 내역을 작성하세요." /></Field>
            <div className="fw-inline"><strong>작업 증빙 {draft.evidence.length}장 선택</strong><button type="button" className={btn()} onClick={() => openStageGallery(draft.phase)}>갤러리에서 선택</button></div>
            <div className="fw-thumbnails">{draft.evidence.map((id) => <Photo key={id} photo={photos.find((p) => p.id === id)} />)}</div>
            <div className="fw-form-row">{[['before', '작업 전 논 전경'], ['after', '작업 후 논 전경']].map(([key, label]) => <Field key={key} label={label}><select value={draft[key]} required onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}><option value="">사진 선택</option>{photos.filter((p) => p.kind === 'rice_stage').map((p) => <option key={p.id} value={p.id}>{p.title} · {p.analysis.rice_stage.stage_name}</option>)}</select><Photo photo={photos.find((p) => p.id === draft[key])} /></Field>)}</div>
            <p className="fw-muted">샘플은 서로 다른 장소의 사진을 포함합니다. 전·후 배치는 화면 시연용이며, 실제 작업에서는 같은 구역과 촬영일을 확인해 선택해야 합니다.</p>
            <button className={btn(true)} disabled={photoStatus !== 'ready' || !!storageError}>수행 기록 저장</button>
          </form>}
        </section>
        <section className="fw-panel"><div className="fw-panel-head"><h2>저장된 수행 기록 <span className="fw-count">{data.records.length}</span></h2></div>
          {!data.records.length ? <Empty>아직 저장된 수행 기록이 없습니다.</Empty> : data.records.map((record) => <article className="fw-record" key={record.id}><span className="fw-tag">{phaseName(record.phase)}</span><h3>{record.title}</h3><p className="fw-muted">{record.date} · 증빙 {record.evidence.length}장</p><p className="fw-prewrap">{record.content}</p><div className="fw-thumbnails">{record.evidence.map((id) => <Photo key={id} photo={photos.find((p) => p.id === id)} />)}</div></article>)}
          {!!data.records.length && <button className={btn(true)} onClick={() => go('reports')}>보고서 작성으로 <ArrowRight size={16} /></button>}
        </section>
      </div>}

      {tab === 'reports' && <Reports data={data} report={report} photos={photos} role={role} save={save} setError={setError} setActiveReport={setActiveReport} />}
      {tab === 'issues' && <Issues key={inspectionPhoto?.id || 'manual'} data={data} role={role} save={save} photos={photos} initialPhoto={inspectionPhoto} clearPhoto={() => navigate({ issuePhoto: '' })} onGallery={() => navigate({ tab: 'gallery', category: 'anomaly' })} />}
      <footer className="fw-footer"><span>사진 {photos.length}장 · 원본과 AI 분석 결과를 함께 보관합니다.</span><Link to="/compliance-report">기존 운영 이행리포트 열기 <ArrowRight size={14} /></Link></footer>
    </div>
    {tab === 'reports' && report && <div className="fw-print-only"><ReportDocument report={report} photos={photos} /></div>}
  </div>
}

function PlanEditor({ plan, onSave }) {
  const [form, setForm] = useState(() => plan ? structuredClone(plan) : makePlan())
  const [problem, setProblem] = useState('')
  const changeStage = (i, key, value) => setForm((f) => ({ ...f, stages: f.stages.map((s, n) => n === i ? { ...s, [key]: value } : s) }))
  return <form className="fw-form" onSubmit={(e) => {
    e.preventDefault()
    if (!form.title.trim()) { setProblem('계획명을 입력해 주세요.'); return }
    if (form.stages.some((s, i) => s.date < form.start || (i && s.date < form.stages[i - 1].date))) { setProblem('단계별 날짜는 재배 시작일 이후 순서대로 입력해 주세요.'); return }
    setProblem(''); onSave(form)
  }}>
    <div className="fw-form-row"><Field label="계획명"><input required value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field><Field label="작물"><input value="벼" readOnly /></Field><Field label="재배 시작일"><input required type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field></div>
    <Field label="재배구역"><input value={form.plot} maxLength={120} onChange={(e) => setForm({ ...form, plot: e.target.value })} placeholder="예: 화성 1구역" /></Field>
    <div className="fw-subhead"><h3>생육 단계별 일정과 작업 가이드</h3><span className="fw-muted">초기 일정은 예시입니다. 현장 일정에 맞게 수정하세요.</span></div>
    {form.stages.map((stage, i) => <div className="fw-stage-editor" key={stage.code}><h3><span className="fw-stage-number">0{i + 1}</span>{phaseName(stage.code)}</h3><div className="fw-form-row"><Field label={`${phaseName(stage.code)} 예정일`}><input type="date" required value={stage.date} onChange={(e) => changeStage(i, 'date', e.target.value)} /></Field><Field label={`${phaseName(stage.code)} 장비`}><input value={stage.equipment} maxLength={120} onChange={(e) => changeStage(i, 'equipment', e.target.value)} placeholder="장비명" /></Field><Field label={`${phaseName(stage.code)} 인력`}><input value={stage.people} maxLength={80} onChange={(e) => changeStage(i, 'people', e.target.value)} placeholder="예: 2명" /></Field></div><Field label={`${phaseName(stage.code)} 작업 가이드`}><textarea rows={2} maxLength={1500} value={stage.guide} onChange={(e) => changeStage(i, 'guide', e.target.value)} /></Field></div>)}
    {problem && <p className="fw-error" role="alert">{problem}</p>}<div className="fw-actions"><button className={btn(true)}>영농계획 저장</button></div>
  </form>
}

function Gallery({ photos, loading, draft, selectEvidence, editable, onNext, category, onCategory, onPhase, plan, issues, onInspect }) {
  const [query, setQuery] = useState('')
  const [analysisDate, setAnalysisDate] = useState('')
  const [detailId, setDetailId] = useState(null)
  const [boxes, setBoxes] = useState(false)
  const filtered = photos.filter((p) => matchesPhotoCategory(p, category)
    && (!query || `${p.title} ${p.sourceName} ${p.analysis.rice_stage?.stage_name || ''}`.includes(query))
    && (!analysisDate || p.analyzedAt?.slice(0, 10) === analysisDate))
  const detail = filtered.find((p) => p.id === detailId)
  const categories = GALLERY_CATEGORIES.filter((c) => c.code !== 'unclassified' || photos.some((p) => photoCategory(p) === 'unclassified') || category === 'unclassified')
  const categoryName = GALLERY_CATEGORIES.find((c) => c.code === category)?.name
  return <section className="fw-panel"><div className="fw-panel-head"><div><h2>영농 사진 갤러리</h2><p>AI 분석을 참고해 담당자가 보고서에 사용할 사진을 선택합니다.</p></div><span className="fw-tag">{photos.length}장 보관</span></div>
    {editable && plan && <div className="fw-gallery-context"><div><strong>{plan.title}</strong><p>사진 분류를 바꿔도 연결할 계획 단계는 유지됩니다.</p></div><Field label="연결할 계획 단계"><select value={draft.phase} onChange={(e) => onPhase(e.target.value)}>{PHASES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></Field></div>}
    <div className="fw-gallery-categories" role="group" aria-label="사진 분류">{categories.map((c) => <button key={c.code} type="button" aria-label={c.name} aria-pressed={category === c.code} className={category === c.code ? 'active' : ''} onClick={() => { onCategory(c.code); setDetailId(null); setBoxes(false) }}><span>{c.name}</span><strong>{loading ? '…' : photos.filter((p) => matchesPhotoCategory(p, c.code)).length}<small>장</small></strong></button>)}</div>
    <p className="fw-muted">논 사진은 AI가 판독한 생육 단계로 자동 분류합니다. 농기계 탐지 사진은 작업 증빙에서 확인하세요. 신뢰도가 낮은 사진에는 확인 필요 표시가 붙습니다.</p>
    {category === 'anomaly' && <div className="fw-local-note"><ShieldAlert size={20} /><span>현재 이상징후 후보는 현장 확인 흐름을 위한 시연 예시입니다. 실제 AI 이상 탐지 결과가 아니며, 생육 단계 분류에도 함께 표시됩니다. 분류 신뢰도가 낮다는 이유로 이상징후 후보가 되지는 않습니다.</span></div>}
    <div className="fw-filters"><Field label="사진 검색"><input placeholder="사진 이름 검색" value={query} onChange={(e) => setQuery(e.target.value)} /></Field><Field label="분석일"><input type="date" value={analysisDate} onChange={(e) => setAnalysisDate(e.target.value)} /></Field><button className={btn()} aria-label="갤러리 필터 초기화" onClick={() => { setQuery(''); setAnalysisDate(''); setDetailId(null) }}><RefreshCw size={16} />검색 초기화</button></div>
    <p className="fw-muted">날짜 필터는 분석일 기준입니다. 출처에 촬영일이 기록된 사진은 상세에서 확인할 수 있습니다.</p>
    <div className="fw-subhead"><h3>{categoryName}</h3><span className="fw-muted" role="status">{loading ? '사진 확인 중' : `${filtered.length}장 표시`}</span></div>
    {loading ? <div className="fw-empty" role="status">사진을 불러오는 중입니다…</div> : !filtered.length ? <Empty>{query || analysisDate ? '조건에 맞는 사진이 없습니다. 검색어나 분석일을 변경해 주세요.' : `${categoryName} 분류에 사진이 없습니다. 다른 분류에서 사진을 확인할 수 있습니다.`}</Empty> : <div className="fw-gallery">{filtered.map((p) => <article key={p.id} className={`fw-photo-card ${draft.evidence.includes(p.id) ? 'selected' : ''}`}>
      <button className="fw-photo-open" aria-label={`${p.title} 상세 보기`} onClick={() => { setDetailId(p.id); setBoxes(false) }}><Photo photo={p} /><span className="fw-photo-type">{p.kind === 'rice_stage' ? '논 전경' : '작업 증빙'}</span></button>
      <div className="fw-photo-body"><h3>{p.title}</h3><p>{p.analysis.rice_stage ? `${p.analysis.rice_stage.stage_name} · ${(p.analysis.rice_stage.confidence * 100).toFixed(1)}%` : `트랙터 ${p.analysis.counts?.tractor || 0}대 탐지`}</p><span className={p.analysis.rice_stage?.needs_review ? 'fw-tag fw-review-needed' : 'fw-muted'}>{p.analysis.rice_stage?.needs_review ? '확인 필요 · 분류 신뢰도 낮음' : 'AI 분석 참고 결과'}</span>
        {p.anomalyCandidate && <CandidateNotice photo={p} issues={issues} reviewer={!editable} onInspect={onInspect} />}
        {editable && <label className="fw-check"><input type="checkbox" checked={draft.evidence.includes(p.id)} onChange={() => selectEvidence(p.id)} />작업 증빙으로 선택</label>}</div>
    </article>)}</div>}
    {detail && <div className="fw-photo-detail"><div className="fw-panel-head"><h3>{detail.title} · 분석 상세</h3><button className={btn()} onClick={() => setDetailId(null)}>상세 닫기</button></div><div className="fw-two-col"><div><Photo photo={detail} annotated={boxes} />{detail.annotated && <label className="fw-check"><input type="checkbox" checked={boxes} onChange={(e) => setBoxes(e.target.checked)} />탐지 박스 표시</label>}</div><div><p>{detail.sourceNote}</p><p>촬영일: {detail.capturedDate || (detail.capturedAt ? dateTime(detail.capturedAt) : '미등록')}<br />분석일: {dateTime(detail.analyzedAt)}</p>{detail.analysis.rice_stage ? <ul className="fw-probabilities">{Object.entries(detail.analysis.rice_stage.probabilities).map(([code, prob]) => <li key={code}><span>{phaseName(code)}</span><meter min="0" max="1" value={prob} /><strong>{(prob * 100).toFixed(1)}%</strong></li>)}</ul> : <div>{Object.entries(detail.analysis.counts).filter(([, count]) => count > 0).map(([label, count]) => <span className="fw-tag" key={label}>{({ tractor: '트랙터', person: '사람', truck: '트럭', car: '자동차', bus: '버스' })[label] || label} {count}</span>)}</div>}<details><summary>분석 모델 정보</summary><p className="fw-break">{detail.analysis.model_id}<br />{detail.analysis.model_revision}</p><p>{detail.sourceName}</p><p>관측지: {detail.sourceGroup}</p></details>{detail.anomalyCandidate && <CandidateNotice photo={detail} issues={issues} reviewer={!editable} onInspect={onInspect} />}</div></div></div>}
    {editable && <div className="fw-selected-photos"><h3>선택한 작업 증빙 · {draft.evidence.length}장</h3><p className="fw-muted">분류를 이동해도 선택한 사진은 유지됩니다.{plan && ` ${phaseName(draft.phase)} 단계의 수행 기록에 연결합니다.`}</p><div className="fw-photo-choices">{draft.evidence.map((id) => <button type="button" key={id} className={btn()} aria-label={`${photos.find((p) => p.id === id)?.title || id} 선택 해제`} onClick={() => selectEvidence(id)}>{photos.find((p) => p.id === id)?.title || id} <span aria-hidden="true">×</span></button>)}</div><div className="fw-selection-bar"><span>{plan ? `연결 단계: ${phaseName(draft.phase)}` : '수행 기록 작성 전 영농계획을 저장해 주세요.'}</span><button className={btn(true)} disabled={!draft.evidence.length} onClick={onNext}>수행 내용 작성 <ArrowRight size={16} /></button></div></div>}
  </section>
}

function Reports({ data, report, photos, role, save, setError, setActiveReport }) {
  const [from, setFrom] = useState(data.records[0]?.date || today())
  const [to, setTo] = useState(today())
  return <div className="fw-two-col fw-report-layout"><section className="fw-panel"><h2>영농이행 보고서</h2><p className="fw-muted">수행 기록을 묶어 보고서를 작성하고 검토를 요청합니다.</p>
    {role === 'operator' && <form className="fw-form" onSubmit={(e) => {
      e.preventDefault(); const id = uid()
      const ok = save((s) => ({ ...s, reports: [reportDraft(s, from, to, id, new Date().toISOString()), ...s.reports] }), '보고서 초안을 이 브라우저에 생성했습니다.')
      if (ok) setActiveReport(id)
    }}><Field label="보고서 시작일"><input required type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="보고서 종료일"><input required type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field><button className={btn(true)} disabled={!data.records.length}>보고서 초안 생성</button></form>}
    <div className="fw-report-list">{data.reports.map((r) => <button key={r.id} className={r.id === report?.id ? 'active' : ''} onClick={() => setActiveReport(r.id)}><strong>{r.title}</strong><span>{r.from} ~ {r.to}</span><span className={`fw-tag fw-status-${r.status}`}>{REPORT_STATUS[r.status]}</span></button>)}</div>
    {!data.reports.length && <Empty>수행 기록을 저장한 뒤 초안을 생성해 주세요.</Empty>}
  </section><section className="fw-panel">{report ? <ReportEditor key={`${report.id}:${report.status}`} report={report} data={data} photos={photos} role={role} save={save} setError={setError} /> : <Empty>보고서를 선택하면 미리보기와 검토 이력이 표시됩니다.</Empty>}</section></div>
}

function ReportEditor({ report, data, photos, role, save, setError }) {
  const [summary, setSummary] = useState(report.summary)
  const [comment, setComment] = useState('')
  const [preview, setPreview] = useState(false)
  const [records, setRecords] = useState(report.records)
  const updateReport = (fn, message) => save((s) => ({ ...s, reports: s.reports.map((r) => r.id === report.id ? fn(r) : r) }), message)
  const editable = role === 'operator' && report.status === 'draft'
  const act = (action) => {
    if (action === 'submit' && !summary.trim()) { setError('보고서 종합 의견을 입력해 주세요.'); return }
    updateReport((r) => transitionReport({ ...r, ...(action === 'submit' ? { summary, records } : {}) }, action, role, comment, new Date().toISOString()), {
      submit: '로컬 검토 대기로 변경했습니다. 시연 역할을 검토자로 전환해 확인하세요.',
      request: '보완 요청을 기록했습니다.', approve: '로컬 시연 승인을 기록했습니다. PDF로 인쇄할 수 있습니다.',
      revise: '보완 작성을 시작했습니다. 내용과 사진을 수정해 다시 제출하세요.',
    }[action])
  }
  return <>
    <div className="fw-panel-head"><div><h2>{report.title}</h2><p>{report.from} ~ {report.to}</p></div><span className={`fw-tag fw-status-${report.status}`}>{REPORT_STATUS[report.status]}</span></div>
    {report.status === 'changes_requested' && <div className="fw-error"><strong>보완 요청</strong><p>{[...report.history].reverse().find((h) => h.to === 'changes_requested')?.comment}</p>{role === 'operator' && <button className={btn()} onClick={() => act('revise')}>내용·사진 보완하기</button>}</div>}
    <div className="fw-form"><Field label="보고서 종합 의견"><textarea rows={4} maxLength={3000} value={summary} readOnly={!editable} onChange={(e) => setSummary(e.target.value)} placeholder="해당 기간에 수행한 작업과 논 상태를 정리하세요." /></Field>
      <div className="fw-subhead"><h3>포함된 수행 기록 · {records.length}건</h3></div>
      {records.map((record, index) => <div className="fw-report-record" key={record.id}><h3>{record.title}</h3><p>{record.date} · {phaseName(record.phase)}</p>{editable ? <>
        <Field label={`${record.title} 수행 내용 보완`}><textarea rows={3} maxLength={3000} required value={record.content} onChange={(e) => setRecords(records.map((r, n) => n === index ? { ...r, content: e.target.value } : r))} /></Field>
        <details><summary>보고서 사진 변경</summary><div className="fw-photo-choices">{photos.map((p) => <label className="fw-check" key={p.id}><input type="checkbox" checked={record.evidence.includes(p.id)} onChange={() => setRecords(records.map((r, n) => n === index ? { ...r, evidence: r.evidence.includes(p.id) ? r.evidence.filter((id) => id !== p.id) : [...r.evidence, p.id] } : r))} />{p.title}</label>)}</div>
          <div className="fw-form-row">{[['before', '전 사진'], ['after', '후 사진']].map(([key, label]) => <Field key={key} label={`${record.title} ${label}`}><select value={record[key]} onChange={(e) => setRecords(records.map((r, n) => n === index ? { ...r, [key]: e.target.value } : r))}>{photos.filter((p) => p.kind === 'rice_stage').map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>)}</div>
        </details></> : <p className="fw-prewrap">{record.content}</p>}<div className="fw-thumbnails">{record.evidence.map((id) => <Photo key={id} photo={photos.find((p) => p.id === id)} />)}</div></div>)}
      {editable && <div className="fw-actions"><button className={btn()} onClick={() => updateReport((r) => {
        if (r.status !== 'draft') throw new Error('보고서 상태가 변경되었습니다. 새로고침해 주세요.')
        return { ...r, summary, records }
      }, '초안을 이 브라우저에 저장했습니다.')}>초안 저장</button><button className={btn(true)} onClick={() => {
        const problem = records.map((r) => recordError(r, report.plan, photos)).find(Boolean)
        if (problem) setError(problem); else act('submit')
      }}>검토 요청</button></div>}
      {role === 'inspector' && report.status === 'submitted' && <div className="fw-review"><h3>보고서 단위 검토</h3><p>작업 내용·증빙·전후 사진을 함께 확인한 뒤 의견을 남기세요.</p><Field label="검토 의견"><textarea value={comment} rows={3} maxLength={2000} onChange={(e) => setComment(e.target.value)} placeholder="보완할 내용 또는 승인 의견" /></Field><div className="fw-actions"><button className={btn()} onClick={() => act('request')}>보완 요청</button><button className={btn(true)} onClick={() => act('approve')}>승인·서명 시연</button></div></div>}
      <div className="fw-actions"><button className={btn()} onClick={() => setPreview(!preview)}>{preview ? '보고서 미리보기 닫기' : '보고서 미리보기'}</button><button className={btn(true)} disabled={report.status !== 'approved'} onClick={() => window.print()}><Printer size={16} />최종 PDF 인쇄</button></div>
      {report.status === 'approved' && <p className="fw-notice">로컬 승인 완료 · {dateTime(report.history.at(-1)?.at)} · 실제 전자서명은 API 연동 후 적용됩니다.</p>}
      {!!report.history.length && <div className="fw-history"><h3>제출·검토 이력</h3>{[...report.history].reverse().map((h, i) => <div key={i}><strong>{REPORT_STATUS[h.from]} → {REPORT_STATUS[h.to]}</strong><span>{h.role === 'inspector' ? '검토자' : '발전소 담당자'} · {dateTime(h.at)}</span><p>{h.comment || '상태 변경'}</p></div>)}</div>}
      {preview && <ReportDocument report={{ ...report, summary, records }} photos={photos} />}
    </div>
  </>
}

function CandidateNotice({ photo, issues, reviewer, onInspect }) {
  const issue = issues.find((i) => i.photoIds?.includes(photo.id))
  return <div className="fw-candidate"><span className="fw-tag fw-review-needed">이상징후 후보{photo.anomalyCandidate.source === 'demo' ? ' · 시연' : ''}</span><p>{photo.anomalyCandidate.reason}</p><p className="fw-muted">후보 등록: {dateTime(photo.anomalyCandidate.createdAt)}<br />{issue ? issue.resolved ? '조치 기록 완료' : '현장 확인 요청됨' : '현장 확인 미요청'}</p>
    {reviewer || issue ? <button type="button" className={btn()} onClick={() => onInspect(photo)}>{issue ? '현장 확인 보기' : '현장 확인 요청'}</button> : <p className="fw-muted">시연 역할을 검토자로 바꾸면 현장 확인을 요청할 수 있습니다.</p>}
  </div>
}

function Issues({ data, role, save, photos, initialPhoto, clearPhoto, onGallery }) {
  const [form, setForm] = useState(() => photoInspectionDraft(initialPhoto))
  const linkedIssues = initialPhoto ? data.issues.filter((i) => i.photoIds?.includes(initialPhoto.id)) : data.issues
  const alreadyRequested = !!initialPhoto && linkedIssues.length > 0
  return <section className="fw-panel"><div className="fw-panel-head"><div><h2>이상 상황·현장 확인</h2><p>생육 이상이나 활동 부족을 확인하고, 필요한 점검·시정 내용을 기록합니다.</p></div><span className="fw-tag">수동 기록</span></div>
    <div className="fw-local-note">기상·환경센서와 자동 이상 판정은 아직 연결되지 않았습니다. 확인한 내용을 직접 기록해 주세요.</div>
    <div className="fw-actions"><button type="button" className={btn()} onClick={onGallery}>이상징후 후보 갤러리</button>{initialPhoto && <button type="button" className={btn()} onClick={clearPhoto}>전체 현장 확인 보기</button>}</div>
    {initialPhoto && <div className="fw-issue-photo"><Photo photo={initialPhoto} /><div><h3>{initialPhoto.title}</h3><p>{initialPhoto.anomalyCandidate?.reason}</p><p className="fw-muted">선택한 사진과 요청 내용이 함께 저장됩니다.</p>{alreadyRequested && <p className="fw-notice">이 사진의 현장 확인 요청이 아래에 있습니다.</p>}</div></div>}
    {role === 'inspector' && !alreadyRequested && <form className="fw-form" onSubmit={(e) => {
      e.preventDefault()
      if (!form.title.trim() || !form.detail.trim()) return
      if (save((s) => {
        if (initialPhoto && s.issues.some((i) => i.photoIds?.includes(initialPhoto.id))) throw new Error('이미 요청한 사진입니다. 기존 현장 확인 내용을 확인해 주세요.')
        return { ...s, issues: [{ ...form, id: uid(), at: new Date().toISOString(), resolved: false, response: '' }, ...s.issues] }
      }, '현장 확인 요청을 이 브라우저에 기록했습니다.')) setForm(photoInspectionDraft(initialPhoto))
    }}><div className="fw-form-row"><Field label="현장 확인 제목"><input value={form.title} required maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field><Field label="관련 작업 단계"><select value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>{PHASES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></Field></div><Field label="점검·시정 요청 내용"><textarea value={form.detail} required rows={3} maxLength={2000} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></Field><button className={btn(true)}>현장 확인 요청 기록</button></form>}
    {!linkedIssues.length ? <Empty>기록된 현장 확인 요청이 없습니다.</Empty> : linkedIssues.map((issue) => <Issue key={issue.id} issue={issue} role={role} save={save} photos={photos} />)}
  </section>
}
function Issue({ issue, role, save, photos }) {
  const [response, setResponse] = useState(issue.response)
  return <article className="fw-record"><span className="fw-tag">{phaseName(issue.phase)} · {issue.resolved ? '조치 기록 완료' : '확인 필요'}</span><h3>{issue.title}</h3><p className="fw-prewrap">{issue.detail}</p><p className="fw-muted">{dateTime(issue.at)}{issue.candidateSource === 'demo' && ' · 시연 후보에서 작성한 요청'}</p><div className="fw-thumbnails">{(issue.photoIds || []).map((id) => <Photo key={id} photo={photos.find((p) => p.id === id)} />)}</div>{role === 'operator' && !issue.resolved ? <form className="fw-form" onSubmit={(e) => { e.preventDefault(); if (response.trim()) save((s) => ({ ...s, issues: s.issues.map((i) => i.id === issue.id ? { ...i, response, resolved: true } : i) }), '조치 내용을 기록했습니다.') }}><Field label="조치 내용"><textarea required rows={2} maxLength={2000} value={response} onChange={(e) => setResponse(e.target.value)} /></Field><button className={btn()}>조치 내용 기록</button></form> : <p className="fw-prewrap">{issue.response || '담당자 조치 대기'}</p>}</article>
}

function ReportDocument({ report, photos }) {
  const photo = (id) => photos.find((p) => p.id === id)
  const approval = [...report.history].reverse().find((h) => h.to === 'approved')
  return <article className="fw-document">
    <header><div><strong>동양연합 엔지니어링</strong><p>영농형 태양광 · 영농이행 보고서</p></div><div className="fw-approval-box"><strong>보고서 검토</strong><span>{approval ? '로컬 시연 승인' : '미승인'}</span><span>{approval ? dateTime(approval.at) : '—'}</span></div></header>
    <h1>영농이행 점검 보고서</h1><p className="fw-document-period">{report.from} ~ {report.to}</p>
    <p className="fw-sample-stamp">로컬 시연 자료 · 실제 발전소 실적 및 전자서명 아님</p>
    <section><h2>01. 재배계획</h2><table><tbody><tr><th>계획명</th><td>{report.plan.title}</td><th>작물</th><td>{report.plan.crop}</td></tr><tr><th>재배구역</th><td>{report.plan.plot || '미입력'}</td><th>재배 시작</th><td>{report.plan.start}</td></tr></tbody></table><table><thead><tr><th>작업 단계</th><th>예정일</th><th>장비</th><th>인력</th></tr></thead><tbody>{report.plan.stages.map((s) => <tr key={s.code}><td>{phaseName(s.code)}</td><td>{s.date}</td><td>{s.equipment || '—'}</td><td>{s.people || '—'}</td></tr>)}</tbody></table></section>
    <section><h2>02. 수행 내용 및 사진 증빙</h2>{report.records.map((r) => <div className="fw-document-record" key={r.id}><h3>{r.title}</h3><p>{r.date} · {phaseName(r.phase)}</p><p className="fw-prewrap">{r.content}</p><div className="fw-document-photos">{r.evidence.map((id) => <figure key={id}><Photo photo={photo(id)} /><figcaption>{photo(id)?.title} · {photo(id)?.analysis.rice_stage?.stage_name || '농기계 탐지'}</figcaption></figure>)}</div><h4>논 전경 전·후 비교 배치</h4><div className="fw-document-photos"><figure><Photo photo={photo(r.before)} /><figcaption>전 · {photo(r.before)?.title}</figcaption></figure><figure><Photo photo={photo(r.after)} /><figcaption>후 · {photo(r.after)?.title}</figcaption></figure></div><p className="fw-muted">외부 관측지 시연 사진 · 실제 발전소 작업의 전후 증빙으로 해석하지 않습니다.</p></div>)}</section>
    {!!report.issues.length && <section><h2>03. 현장 확인 및 조치</h2>{report.issues.map((i) => <div key={i.id}><h3>{i.title}</h3><p>{i.detail}</p><p>조치: {i.response || '확인 중'}</p>{i.candidateSource === 'demo' && <p className="fw-muted">시연 후보에 대한 현장 확인 기록</p>}<div className="fw-document-photos">{(i.photoIds || []).map((id) => <figure key={id}><Photo photo={photo(id)} /><figcaption>{photo(id)?.title}</figcaption></figure>)}</div></div>)}</section>}
    <section><h2>종합 의견 및 검토</h2><p className="fw-prewrap">{report.summary || '의견 미입력'}</p>{approval && <p>검토자 시연 의견: {approval.comment}</p>}</section>
    <footer>사진 분류·탐지값은 AI 분석 결과이며 영농 이행 자동 판정이 아닙니다.</footer>
  </article>
}
