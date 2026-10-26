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
