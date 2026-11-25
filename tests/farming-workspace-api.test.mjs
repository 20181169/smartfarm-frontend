import test from 'node:test'
import assert from 'node:assert/strict'
import { guideForm, guideTaskDates, planSubmissionPayload, usableWorkspaceEvidence } from '../src/lib/farmingWorkspace.js'
const guide = { crop_name: '벼', current_version: { guide_version_id: 'version1', version_number: 1, tasks: [
  { task_id: 'task1', activity_type: 'sowing', title: '파종', description: '작업 안내', start_month: 2, end_month: 2, display_order: 1 },
  { task_id: 'task2', activity_type: 'harvesting', title: '수확', description: '수확 안내', start_month: 10, end_month: 11, display_order: 2 },
] } }
test('server guide month ranges include leap days and use real task counts', () => {
  assert.deepEqual(guideTaskDates(guide.current_version.tasks[0], 2028), { planned_start_date: '2028-02-01', planned_end_date: '2028-02-29' })
  assert.equal(guideForm(guide, 2027).tasks.length, 2)
})
test('annual submission uses the selected guide version and whitelisted API fields', () => {
  const form = guideForm(guide, 2027); form.available_manpower = '3'; form.equipment = '트랙터'
  const body = planSubmissionPayload(form, guide, 'plant1')
  assert.equal(body.guide_version_id, 'version1'); assert.equal(body.plant_id, 'plant1'); assert.equal(body.available_manpower, 3)
  assert.deepEqual(Object.keys(body.task_adjustments[0]).sort(), ['description', 'guide_task_id', 'planned_end_date', 'planned_start_date', 'title'])
  assert.equal(body.task_adjustments[1].planned_end_date, '2027-11-30')
})
test('adjusted dates require a reason retained in the server description', () => {
  const form = guideForm(guide, 2027); form.tasks[0].planned_start_date = '2027-02-03'
  assert.throws(() => planSubmissionPayload(form, guide, 'plant1'), /조정 사유/)
  form.scheduleReason = '장비 일정'; assert.match(planSubmissionPayload(form, guide, 'plant1').description, /장비 일정/)
})
test('invalid, reversed and foreign-year dates are rejected without writes', () => {
  for (const date of ['2027-02-30', '2028-02-01', '2027-03-31']) {
    const form = guideForm(guide, 2027); form.tasks[0].planned_start_date = date
    assert.throws(() => planSubmissionPayload(form, guide, 'plant1'))
  }
})
test('foreign, duplicated and missing guide tasks cannot be submitted', () => {
  for (const change of [f => f.tasks.pop(), f => { f.tasks[0].task_id = 'foreign' }, f => { f.tasks[1].task_id = f.tasks[0].task_id }]) {
    const form = guideForm(guide, 2027); change(form); assert.throws(() => planSubmissionPayload(form, guide, 'plant1'))
  }
})
test('operational evidence requires confirmed, same-plant and unused or own-event photos', () => {
  const rows = [{ analysis_id: 'free', plant_id: 'p1', status: 'confirmed' }, { analysis_id: 'used', plant_id: 'p1', status: 'confirmed' }, { analysis_id: 'own', plant_id: 'p1', status: 'confirmed' }, { analysis_id: 'candidate', plant_id: 'p1', status: 'candidate' }, { analysis_id: 'foreign', plant_id: 'p2', status: 'confirmed' }]
  const usage = new Map([['used', { event_id: 'other' }], ['own', { event_id: 'self' }]])
  assert.deepEqual(usableWorkspaceEvidence(rows, usage, 'p1', 'self').map(r => r.analysis_id), ['free', 'own'])
})
