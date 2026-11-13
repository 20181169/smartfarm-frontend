import test from 'node:test'
import assert from 'node:assert/strict'
import { applyGuideSchedule, defaultGuideYear, scheduleDates, scheduleChanges, guidePlanError } from '../src/lib/riceGuideSchedule.js'
import { makePlan } from '../src/lib/localFarming.js'

test('November defaults to next season, not November planting', () => {
  assert.equal(defaultGuideYear(new Date(2026, 10, 13)), 2027)
  assert.equal(defaultGuideYear(new Date(2026, 0, 2)), 2026)
  assert.equal(defaultGuideYear(new Date(2026, 9, 20)), 2026)
})
test('applying year fills every example date but preserves user content and plan identity', () => {
  const plan = makePlan()
  plan.stages[0].equipment = '현장 이앙기'
  plan.stages[0].tasks[0].purpose = '사용자 목적'
  const before = structuredClone(plan), next = applyGuideSchedule(plan, 2028)
  assert.deepEqual(plan, before)
  assert.equal(next.id, plan.id)
  assert.equal(next.stages[0].equipment, '현장 이앙기')
  assert.equal(next.stages[0].tasks[0].purpose, '사용자 목적')
  assert.equal(next.stages[0].tasks.find(t => t.id === 'transplanting').date, '2028-06-05')
  assert.equal(next.stages[3].tasks.find(t => t.id === 'harvesting').date, '2028-10-10')
  assert.ok(Object.values(scheduleDates(next)).every(d => /^2028-\d\d-\d\d$/.test(d)))
  assert.equal(next.guideSchedule.source, 'example')
  assert.deepEqual(scheduleChanges(next), [])
  assert.throws(() => applyGuideSchedule(plan, 0))
})
test('deviating from schedule requires a reason; returning to guide clears differences', () => {
  let plan = applyGuideSchedule(makePlan(), 2027)
  assert.equal(guidePlanError(plan), '')
  plan.stages[0].tasks[2].date = '2027-06-06'
  assert.equal(scheduleChanges(plan).length, 1)
  assert.match(guidePlanError(plan), /이유/)
  plan.scheduleReason = '장비 배차에 맞춰 하루 조정'
  assert.equal(guidePlanError(plan), '')
  plan = applyGuideSchedule(plan, 2027)
  assert.equal(plan.scheduleReason, '')
  assert.equal(guidePlanError(plan), '')
})
test('legacy unchanged dates need no adoption; changed dates and chronology are validated', () => {
  const plan = makePlan()
  delete plan.guideSchedule
  const baseline = scheduleDates(plan)
  assert.equal(guidePlanError(plan, baseline), '')
  plan.stages[0].tasks[0].date = `${plan.start.slice(0,4)}-05-02`
  assert.match(guidePlanError(plan, baseline), /이유/)
  plan.stages[0].tasks[0].date = '2000-01-01'
  assert.match(guidePlanError(plan, baseline), /재배 시작일/)
})
