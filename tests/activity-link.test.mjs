import test from 'node:test'
import assert from 'node:assert/strict'
import { confirmActivityAndLink } from '../src/lib/activityReview.js'
import { planActivityIssues, planPeriod, workflowDate } from '../src/lib/workflow.js'

const plan = { plan_id: 'p', plant_id: 'plant', status: 'scheduled', activity_type: 'machinery_work', planned_start_date: '2026-11-01', planned_end_date: '2026-11-01' }
function fixture() {
  const activity = { event_id: 'event', plant_id: 'plant', status: 'draft', activity_type: 'machinery_work', started_at: '2026-11-01T17:00:00+09:00' }
  const matches = [], calls = []
  const api = {
    getActivity: async () => ({ ...activity }), getPlan: async () => ({ ...plan }),
    getMatches: async () => [...matches],
    confirm: async () => { calls.push('confirm'); activity.status = 'confirmed' },
    link: async () => { calls.push('link'); matches.push({ event_id: activity.event_id }) },
  }
  return { activity, matches, calls, api }
}
const request = { eventId: 'event', planId: 'p', comment: '검토 완료' }

test('activity approval and plan link are persisted in order', async () => {
  const f = fixture()
  assert.equal((await confirmActivityAndLink(request, f.api)).linked, true)
  assert.deepEqual(f.calls, ['confirm', 'link'])
})
test('incompatible plan is rejected before any approval is saved', async () => {
  const f = fixture(); f.activity.started_at = '2026-10-31T23:59:00+09:00'
  await assert.rejects(confirmActivityAndLink(request, f.api), /계획 기간/)
  assert.deepEqual(f.calls, [])
})
test('retry after a link failure does not repeat activity approval', async () => {
  const f = fixture(), realLink = f.api.link
  f.api.link = async () => { throw new Error('연결 일시 실패') }
  await assert.rejects(confirmActivityAndLink(request, f.api), e => e.activityConfirmed === true)
  assert.equal(f.activity.status, 'confirmed')
  f.api.link = realLink
  await confirmActivityAndLink(request, f.api)
  assert.deepEqual(f.calls, ['confirm', 'link'])
})
test('lost approval response is verified before linking', async () => {
  const f = fixture(), confirm = f.api.confirm
  f.api.confirm = async () => { await confirm(); throw new Error('응답 유실') }
  assert.equal((await confirmActivityAndLink(request, f.api)).linked, true)
  assert.deepEqual(f.calls, ['confirm', 'link'])
})
test('lost link response and an already linked activity do not duplicate writes', async () => {
  const f = fixture(), link = f.api.link
  f.api.link = async () => { await link(); throw new Error('응답 유실') }
  await confirmActivityAndLink(request, f.api)
  await confirmActivityAndLink(request, f.api)
  assert.deepEqual(f.calls, ['confirm', 'link'])
})
test('a failed approval never attempts plan linking', async () => {
  const f = fixture(); f.api.confirm = async () => { throw new Error('검토 권한 없음') }
  await assert.rejects(confirmActivityAndLink(request, f.api), /검토 권한/)
  assert.deepEqual(f.calls, [])
})
test('a subsequently rejected evidence blocks approval before any write', async () => {
  const f = fixture(); f.activity.evidence = [{ vision_status: 'rejected' }]
  await assert.rejects(confirmActivityAndLink(request, f.api), /증빙 검토/)
  assert.deepEqual(f.calls, [])
})
test('date matching uses Korea calendar days and reports type mismatch', () => {
  assert.equal(workflowDate('2026-10-31T15:00:00Z'), '2026-11-01')
  assert.deepEqual(planActivityIssues(plan, { ...fixture().activity, started_at: '2026-10-31T15:00:00Z' }), [])
  assert.match(planActivityIssues(plan, { ...fixture().activity, activity_type: 'sowing' })[0], /작업 유형/)
  assert.deepEqual(planPeriod('week', '2026-11-01'), { start: '2026-10-26', end: '2026-11-01' })
  assert.deepEqual(planPeriod('month', '2026-02-20'), { start: '2026-02-01', end: '2026-02-28' })
})
