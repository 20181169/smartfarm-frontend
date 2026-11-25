export function guideTaskDates(task, year) {
  const start = `${year}-${String(task.start_month).padStart(2, '0')}-01`
  const end = new Date(Date.UTC(year, task.end_month, 0)).toISOString().slice(0, 10)
  return { planned_start_date: start, planned_end_date: end }
}
export function guideForm(guide, year) {
  return { year, available_manpower: '', equipment: '', description: '', scheduleReason: '',
    tasks: [...guide.current_version.tasks].sort((a, b) => a.display_order - b.display_order).map(task => ({ ...task, ...guideTaskDates(task, year) })) }
}
export function planSubmissionPayload(form, guide, plantId) {
  const year = Number(form.year)
  if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new Error('재배 연도를 확인해 주세요.')
  const original = new Map(guide.current_version.tasks.map(t => [t.task_id, t]))
  let adjusted = false
  if (form.tasks.length !== original.size || new Set(form.tasks.map(t => t.task_id)).size !== original.size) throw new Error('선택한 가이드의 모든 작업을 확인해 주세요.')
  const task_adjustments = form.tasks.map(task => {
    const baseline = original.get(task.task_id)
    if (!baseline) throw new Error('선택한 가이드에 없는 작업입니다.')
    const dates = guideTaskDates(baseline, year)
    for (const key of ['planned_start_date', 'planned_end_date']) {
      const value = task[key], date = new Date(`${value}T00:00:00Z`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || Number(value.slice(0, 4)) !== year) throw new Error('작업 날짜는 선택한 재배 연도의 유효한 날짜여야 합니다.')
    }
    if (task.planned_end_date < task.planned_start_date) throw new Error('작업 종료일은 시작일보다 빠를 수 없습니다.')
    adjusted ||= task.planned_start_date !== dates.planned_start_date || task.planned_end_date !== dates.planned_end_date
    const title = task.title.trim(), description = task.description?.trim() || null
    if (!title || title.length > 200 || description?.length > 4000) throw new Error('작업명은 1~200자, 설명은 4,000자 이내로 입력해 주세요.')
    return { guide_task_id: task.task_id, planned_start_date: task.planned_start_date, planned_end_date: task.planned_end_date, title, description }
  })
  if (adjusted && !form.scheduleReason.trim()) throw new Error('가이드 일정과 다른 날짜에는 일정 조정 사유를 입력해 주세요.')
  const available_manpower = form.available_manpower === '' ? null : Number(form.available_manpower)
  if (available_manpower !== null && (!Number.isInteger(available_manpower) || available_manpower < 0)) throw new Error('가용 인력은 0 이상의 정수로 입력해 주세요.')
  const equipment = form.equipment.trim() || null
  const description = [form.description.trim(), adjusted ? `일정 조정 사유: ${form.scheduleReason.trim()}` : ''].filter(Boolean).join('\n') || null
  if (equipment?.length > 4000 || description?.length > 4000) throw new Error('장비와 계획 설명은 각각 4,000자 이내로 입력해 주세요.')
  return { plant_id: plantId, plan_year: year, guide_version_id: guide.current_version.guide_version_id, available_manpower, equipment, description, task_adjustments }
}
export function usableWorkspaceEvidence(rows, usage, plantId, ownEventId) {
  return rows.filter(row => row.plant_id === plantId && row.status === 'confirmed' && (!usage.has(row.analysis_id) || usage.get(row.analysis_id).event_id === ownEventId))
}
