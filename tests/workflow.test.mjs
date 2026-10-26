import test from 'node:test'
import assert from 'node:assert/strict'
import { activityPayload, availableEvidence, canResubmitActivity, canReviewActivity, workflowError } from '../src/lib/workflow.js'

test('resubmission payload preserves the existing event and excludes server-owned fields', () => {
  const values = { title: ' 정정 작업 ', activity_type: ' machinery_work ', description: '  ', plant_id: 'forbidden', status: 'confirmed', confirmed_by_user_id: 'forbidden' }
  const payload = activityPayload(values, ['a', 'a', 'b'])
  assert.deepEqual(payload, { title: '정정 작업', activity_type: 'machinery_work', description: null, analysis_ids: ['a', 'b'] })
  assert.equal(activityPayload(values, ['a'], 'plant1').plant_id, 'plant1')
})
test('activity submission requires a title and 1 to 100 evidence IDs', () => {
  const v = { title:'작업', activity_type:'machinery_work', description:'' }
  assert.throws(() => activityPayload(v, []))
  assert.throws(() => activityPayload(v, Array.from({ length:101 }, (_,i) => String(i))))
  assert.throws(() => activityPayload({ ...v, title:'  ' }, ['a']))
})
test('only confirmed, same-plant, unoccupied evidence can be selected', () => {
  const rows = [
    { analysis_id:'ok', plant_id:'p1', status:'confirmed' },
    { analysis_id:'occupied', plant_id:'p1', status:'confirmed' },
    { analysis_id:'other', plant_id:'p2', status:'confirmed' },
    { analysis_id:'pending', plant_id:'p1', status:'pending' },
    { analysis_id:'rejected', plant_id:'p1', status:'rejected' },
  ]
  assert.deepEqual(availableEvidence(rows, new Set(['occupied']), 'p1').map(r => r.analysis_id), ['ok'])
})
test('write permissions and current activity state are both required', () => {
  const update = p => p === 'farming_activity:update', review = p => p === 'farming_activity:review'
  for (const status of ['draft','confirmed','cancelled']) {
    assert.equal(canResubmitActivity(update,{status}), status === 'cancelled')
    assert.equal(canReviewActivity(review,{status}), status === 'draft')
    assert.equal(canResubmitActivity(review,{status}), false)
    assert.equal(canReviewActivity(update,{status}), false)
  }
})
test('unknown write outcomes must not imply failed persistence or automatic retry', () => {
  assert.match(workflowError({status:0},true), /다시 제출하기 전에 이력/)
  assert.match(workflowError({status:503},true), /처리 결과를 확인하지 못/)
  assert.equal(workflowError({status:409,message:'증빙이 이미 사용 중입니다.'},true),'증빙이 이미 사용 중입니다.')
})
