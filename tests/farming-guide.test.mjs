import test from 'node:test'
import assert from 'node:assert/strict'
import { withDetailedGuide, guideTasks } from '../src/lib/localFarmingGuide.js'
import { makePlan, reportDraft, emptyWorkspace, commitWorkspace, loadWorkspace } from '../src/lib/localFarming.js'

test('legacy plans keep IDs, notes and dates; detailed examples do not mutate storage', () => {
  const old = { id: 'legacy', title: '기존 계획', stages: [{ code: 'SOWING', date: '2026-05-01', guide: '직접 작성한 메모', equipment: '기존 장비' }] }
  const before = structuredClone(old), edited = withDetailedGuide(old)
  assert.deepEqual(old, before)
  assert.equal(edited.id, old.id)
  assert.equal(edited.stages[0].guide, '직접 작성한 메모')
  assert.equal(edited.stages[0].date, '2026-05-01')
  assert.equal(edited.stages[0].tasks.length, 3)
  edited.stages[0].tasks[0].purpose = '현장용 수정'
  assert.notEqual(guideTasks(old.stages[0])[0].purpose, '현장용 수정')
})

test('editable guide survives save/reload, blank fields are not replaced, report stays frozen', () => {
  const entries = new Map(), storage = { getItem: k => entries.get(k) || null, setItem: (k,v) => entries.set(k,v) }
  const plan = makePlan()
  plan.stages[0].tasks[0].date = '2027-04-15'
  plan.stages[0].tasks[0].purpose = ''
  plan.stages[0].tasks[0].evidence = '화성 1구역 고정 카메라 전후 비교'
  commitWorkspace(storage, 'guide', w => ({ ...w, plan }))
  const loaded = withDetailedGuide(loadWorkspace(storage, 'guide').plan)
  assert.deepEqual(loaded, plan)
  const workspace = { ...emptyWorkspace(), plan: loaded, records: [{ date: '2027-04-15' }] }
  const report = reportDraft(workspace, '2027-04-01', '2027-04-30', 'r', 'now')
  loaded.stages[0].tasks[0].evidence = '나중에 수정'
  assert.equal(report.plan.stages[0].tasks[0].evidence, '화성 1구역 고정 카메라 전후 비교')
})

test('new plans contain 12 independent tasks with explicit example schedule dates', () => {
  const a = makePlan(), b = makePlan()
  assert.equal(a.stages.flatMap(s => s.tasks).length, 12)
  assert.ok(a.stages.flatMap(s => s.tasks).every(t => /^\d{4}-\d{2}-\d{2}$/.test(t.date)))
  a.stages[0].tasks[0].title = '수정'
  assert.notEqual(b.stages[0].tasks[0].title, '수정')
})
