export const workflowStates = { draft: '검토 대기', confirmed: '확정', cancelled: '반려', candidate: '후보', pending: '검토 대기', rejected: '반려', approved: '승인 완료' }
export const workflowTime = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '미등록'
export function workflowError(e, writing = false) {
  if (e.status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  if (e.status === 403) return '이 작업을 수행할 권한이 없습니다. 담당 발전소와 권한을 확인해 주세요.'
  if (e.status === 404) return '대상 정보를 찾을 수 없습니다. 목록을 새로 조회해 주세요.'
  if (writing && (e.status === 0 || e.status >= 500)) return '처리 결과를 확인하지 못했습니다. 다시 제출하기 전에 이력을 새로 조회해 주세요.'
  return e.message || '요청을 처리하지 못했습니다.'
}
export function activityPayload(values, analysisIds, plantId) {
  const title = values.title.trim(), activity_type = values.activity_type.trim()
  if (!title || !activity_type) throw new Error('제목과 작업 유형을 입력해 주세요.')
  const ids = [...new Set(analysisIds)]
  if (!ids.length || ids.length > 100) throw new Error('확정된 AI 증빙을 1~100개 선택해 주세요.')
  return { ...(plantId ? { plant_id: plantId } : {}), title, activity_type, description: values.description.trim() || null, analysis_ids: ids }
}
export function canResubmitActivity(has, activity) { return has('farming_activity:update') && activity.status === 'cancelled' }
export function canReviewActivity(has, activity) { return has('farming_activity:review') && activity.status === 'draft' }
export function availableEvidence(rows, occupied, plantId) {
  return rows.filter(row => row.plant_id === plantId && row.status === 'confirmed' && !occupied.has(row.analysis_id))
}

export const ACTIVITY_TYPES = {
  machinery_work: '농기계 작업', sowing: '파종', transplanting: '이식', irrigation: '관수',
  fertilization: '시비', weeding: '제초', pest_control: '병해충 방제', harvesting: '수확',
}
export const activityTypeLabel = value => ACTIVITY_TYPES[value] || value || '작업 유형 미등록'

export function workflowDate(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return ''
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

// Mirrors the server's calendar periods; no activity timestamps are rewritten.
export function planPeriod(granularity, start, end) {
  if (!start) return { start: '', end: '' }
  const day = new Date(`${start}T00:00:00Z`)
  const iso = date => date.toISOString().slice(0, 10)
  if (granularity === 'day') return { start, end: start }
  if (granularity === 'month') return { start: start.slice(0, 7) + '-01', end: iso(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0))) }
  if (granularity === 'week') {
    day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7)
    const first = iso(day)
    day.setUTCDate(day.getUTCDate() + 6)
    return { start: first, end: iso(day) }
  }
  return { start, end }
}

export function planActivityIssues(plan, activity, requireConfirmed = false) {
  if (!plan || !activity) return ['계획과 활동 정보를 확인해 주세요.']
  const issues = []
  if (plan.status === 'cancelled') issues.push('취소된 계획입니다.')
  if (plan.plant_id !== activity.plant_id) issues.push('발전소가 다릅니다.')
  if (plan.activity_type?.toLowerCase() !== activity.activity_type?.toLowerCase()) issues.push(`작업 유형이 다릅니다. 계획: ${activityTypeLabel(plan.activity_type)}, 활동: ${activityTypeLabel(activity.activity_type)}`)
  const date = workflowDate(activity.started_at)
  if (!date) issues.push('활동일을 확인할 수 없습니다.')
  else if (date < plan.planned_start_date || date > plan.planned_end_date) issues.push(`활동일 ${date}이 계획 기간(${plan.planned_start_date} ~ ${plan.planned_end_date}) 밖입니다.`)
  if (requireConfirmed && activity.status !== 'confirmed') issues.push('활동 검토가 아직 확정되지 않았습니다.')
  return issues
}

export function workflowPath(path, context = {}) {
  const keys = { plantId: 'plant', planId: 'plan', eventId: 'activity', analysisId: 'evidence', create: 'create', review: 'review', from: 'from', to: 'to' }
  const params = new URLSearchParams()
  for (const [key, query] of Object.entries(keys)) if (context[key]) params.set(query, context[key] === true ? '1' : context[key])
  return path + (params.size ? `?${params}` : '')
}
