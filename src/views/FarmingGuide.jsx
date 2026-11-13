import { useId } from 'react'
import { GUIDE_FIELDS, guideTasks } from '../lib/localFarmingGuide'

export default function FarmingGuide({ stage, onChange, scheduleEditable = false }) {
  const prefix = useId()
  const tasks = guideTasks(stage)
  const update = (index, key, value) => onChange(tasks.map((task, i) => i === index ? { ...task, [key]: value } : task))
  return <div className="fw-guide">
    <div className="fw-guide-heading"><strong>세부 작업 가이드</strong><span>{tasks.length}개 작업 · 벼 이앙재배 예시</span></div>
    {tasks.map((task, index) => <details key={task.id} className="fw-guide-task">
      <summary><span className="fw-guide-order">{index + 1}</span><span><strong>{task.title}</strong><small>{task.date ? `예정일 ${task.date}` : task.timing}</small></span><span className="fw-guide-expand">상세 보기</span></summary>
      {onChange ? <div className="fw-guide-body">
        <div className="fw-form-row">
          <label className="fw-field" htmlFor={`${prefix}-${index}-title`}>세부 작업명<input id={`${prefix}-${index}-title`} required maxLength={120} value={task.title} onChange={e => update(index, 'title', e.target.value)} /></label>
          <label className="fw-field" htmlFor={`${prefix}-${index}-date`}>작업 예정일<input id={`${prefix}-${index}-date`} type="date" readOnly={!scheduleEditable} value={task.date || ''} onChange={e => update(index, 'date', e.target.value)} /></label>
        </div>
        <label className="fw-field" htmlFor={`${prefix}-${index}-timing`}>작업 시점·일정 조정 기준<input id={`${prefix}-${index}-timing`} maxLength={300} value={task.timing} onChange={e => update(index, 'timing', e.target.value)} /></label>
        <div className="fw-guide-grid">{GUIDE_FIELDS.map(([key, label]) => <div key={key} className={`fw-field fw-guide-${key}`}><label htmlFor={`${prefix}-${index}-${key}`}>{label}</label><textarea id={`${prefix}-${index}-${key}`} rows={key === 'purpose' ? 2 : 4} maxLength={2000} value={task[key]} onChange={e => update(index, key, e.target.value)} /></div>)}</div>
      </div> : <div className="fw-guide-body"><p className="fw-muted">작업 시점: {task.timing}</p><dl className="fw-guide-grid">{GUIDE_FIELDS.map(([key, label]) => <div key={key} className={`fw-guide-${key}`}><dt>{label}</dt><dd>{task[key] || '미입력'}</dd></div>)}</dl></div>}
    </details>)}
  </div>
}
