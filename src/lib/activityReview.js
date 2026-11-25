import { planActivityIssues } from './workflow.js'

// Existing endpoints commit separately. Re-read uncertain writes instead of blindly
// repeating approval; an already confirmed activity can retry only its plan link.
export async function confirmActivityAndLink({ eventId, planId, comment }, api) {
  let activity = await api.getActivity(eventId)
  if (!['draft', 'confirmed'].includes(activity.status)) throw new Error('활동 상태가 변경되었습니다. 새로 조회해 주세요.')
  if (activity.evidence?.some(evidence => evidence.vision_status !== 'confirmed')) throw new Error('현재 확정되지 않은 AI 증빙이 있습니다. 증빙 검토 상태를 먼저 확인해 주세요.')
  if (planId) {
    const plan = await api.getPlan(planId)
    const issues = planActivityIssues(plan, activity)
    if (issues.length) throw new Error(issues.join('\n'))
  }
  if (activity.status === 'draft') {
    try {
      await api.confirm(eventId, { status: 'confirmed', comment: comment || null })
      activity = { ...activity, status: 'confirmed' }
    } catch (error) {
      // A timeout can occur after the server committed. Verify before continuing.
      let latest
      try { latest = await api.getActivity(eventId) } catch { throw error }
      if (latest.status !== 'confirmed') throw error
      activity = latest
    }
  }
  if (!planId) return { activity, linked: false }
  try {
    const existing = await api.getMatches(planId)
    if (!existing.some(m => m.event_id === eventId)) {
      try { await api.link(planId, { event_id: eventId, comment: comment || null }) }
      catch (error) {
        // The link may also have committed before the response was lost.
        const latest = await api.getMatches(planId)
        if (!latest.some(m => m.event_id === eventId)) throw error
      }
    }
    return { activity, linked: true, planId }
  } catch (cause) {
    const error = new Error(`활동 확정은 완료되었습니다. 계획 연결 결과를 확인한 뒤 ‘계획 연결 다시 시도’를 눌러 주세요.\n${cause.message || ''}`)
    error.activityConfirmed = true
    throw error
  }
}
