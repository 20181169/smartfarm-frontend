import { useEffect, useRef, useState } from 'react'
import { apiCreateFarmingPlan } from '../lib/api'
import { useApp } from '../context/useApp'

export default function PlanCreateForm({ plantId, onCreated, onBusy, disabled }) {
  const { hasPermission } = useApp()
  const [open, setOpen] = useState(false)
  const [granularity, setGranularity] = useState('period')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const alive = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  if (!hasPermission('farming_plan:create')) return null
  const save = async event => {
    event.preventDefault()
    if (disabled || pending.current || !plantId || !hasPermission('farming_plan:create')) return
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    const body = { plant_id: plantId, activity_type: values.activity_type.trim(), title: values.title.trim(),
      description: values.description.trim() || null, plan_granularity: granularity,
      planned_start_date: values.start, ...(granularity === 'period' ? { planned_end_date: values.end } : {}) }
    if (!body.title || !body.activity_type) { setError('계획명과 활동유형을 입력해 주세요.'); return }
    if (granularity === 'period' && values.end < values.start) { setError('종료일은 시작일 이후여야 합니다.'); return }
    pending.current = true; setSaving(true); onBusy(true); setError('')
    try {
      const plan = await apiCreateFarmingPlan(body)
      if (!alive.current) return
      setOpen(false)
      onCreated(plan)
    } catch (e) {
      if (!alive.current) return
      setError(e.status === 403 ? '이 발전소의 계획을 등록할 권한이 없습니다.' : e.status === 0 ? '저장 결과를 확인하지 못했습니다. 계획 목록을 새로 조회한 후 다시 시도해 주세요.' : e.message)
    } finally { pending.current = false; if (alive.current) { setSaving(false); onBusy(false) } }
  }
  return <section className="card">
    <button type="button" className="icon-btn" disabled={saving || disabled} aria-expanded={open} onClick={() => { setOpen(!open); setError('') }}>{open ? '계획 작성 닫기' : '영농계획 작성'}</button>
    {open && <form onSubmit={save} className="stack" style={{ marginTop: 16 }}>
      <fieldset disabled={saving || disabled} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="field"><label htmlFor="plan-title">계획명</label><input id="plan-title" name="title" required maxLength={200} /></div>
        <div className="field"><label htmlFor="plan-activity">활동유형</label><select id="plan-activity" name="activity_type" required defaultValue="machinery_work">
          <option value="machinery_work">농기계 작업</option><option value="sowing">파종</option><option value="transplanting">이식</option><option value="irrigation">관수</option><option value="fertilization">시비</option><option value="weeding">제초</option><option value="pest_control">병해충 방제</option><option value="harvesting">수확</option>
        </select></div>
        <div className="field"><label htmlFor="plan-granularity">계획 단위</label><select id="plan-granularity" value={granularity} onChange={e => setGranularity(e.target.value)}><option value="period">기간 지정</option><option value="day">일간</option><option value="week">주간</option><option value="month">월간</option></select></div>
        <div className="grid grid-2">
          <div className="field"><label htmlFor="plan-start">{granularity === 'period' ? '시작일' : '기준일'}</label><input id="plan-start" name="start" type="date" required /></div>
          {granularity === 'period' && <div className="field"><label htmlFor="plan-end">종료일</label><input id="plan-end" name="end" type="date" required /></div>}
        </div>
        {granularity !== 'period' && <p className="text-muted">선택한 기준일이 속한 {granularity === 'day' ? '날짜' : granularity === 'week' ? '주' : '월'}의 기간으로 등록됩니다.</p>}
        <div className="field"><label htmlFor="plan-description">계획 설명</label><textarea id="plan-description" name="description" maxLength={4000} rows={4} /></div>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <button className="btn-primary" disabled={saving || disabled} type="submit">{saving ? '등록 중…' : '계획 등록'}</button>
    </form>}
  </section>
}
