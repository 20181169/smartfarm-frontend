import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyWorkspace, workspaceKey, loadWorkspace, commitWorkspace, reportDraft, transitionReport, recordError } from '../src/lib/localFarming.js'

function memoryStorage() {
  const entries = new Map()
  return { getItem: k => entries.get(k) || null, setItem: (k, v) => entries.set(k, v) }
}
const plan = { id: 'plan', crop: '벼', title: '재배계획' }
const record = { id: 'a', phase: 'SOWING', title: '작업', date: '2026-11-11', content: '작업 내용', evidence: ['tractor'], before: 'before', after: 'after' }
const photos = [{ id: 'tractor', kind: 'object_detection' }, { id: 'before', kind: 'rice_stage' }, { id: 'after', kind: 'rice_stage' }]
test('local data is isolated by plant and account; later writes preserve current records', () => {
  const storage = memoryStorage(), a = workspaceKey('one', 'p1'), b = workspaceKey('one', 'p2'), c = workspaceKey('two', 'p1')
  commitWorkspace(storage, a, s => ({ ...s, plan }))
  commitWorkspace(storage, a, s => ({ ...s, records: [record] }))
  assert.equal(loadWorkspace(storage, a).revision, 2)
  assert.equal(loadWorkspace(storage, a).plan.id, 'plan')
  assert.equal(loadWorkspace(storage, b).plan, null)
  assert.equal(loadWorkspace(storage, c).records.length, 0)
})
test('corrupt storage is not silently overwritten', () => {
  const storage = memoryStorage()
  storage.setItem('a', '{broken')
  assert.throws(() => commitWorkspace(storage, 'a', s => s))
  assert.equal(storage.getItem('a'), '{broken')
})
test('records require real selected photo IDs and distinct rice before/after images', () => {
  assert.equal(recordError(record, plan, photos), '')
  for (const invalid of [{ ...record, before: 'after' }, { ...record, before: 'tractor' }, { ...record, evidence: [] }, { ...record, evidence: ['missing'] }, { ...record, content: ' ' }]) {
    assert.ok(recordError(invalid, plan, photos))
  }
})
test('report contains an immutable copy of period records and the plan', () => {
  const workspace = { ...emptyWorkspace(), plan: structuredClone(plan), records: [structuredClone(record), { ...record, id: 'later', date: '2026-12-01' }] }
  const draft = reportDraft(workspace, '2026-11-01', '2026-11-30', 'report', 'now')
  assert.equal(draft.records.length, 1)
  workspace.records[0].content = 'changed'
  workspace.plan.title = 'changed'
  assert.equal(draft.records[0].content, '작업 내용')
  assert.equal(draft.plan.title, '재배계획')
  assert.throws(() => reportDraft(workspace, '2025-01-01', '2025-01-30', 'r', 'now'))
})
test('submit, return, revise, resubmit and approval preserve all review history', () => {
  let r = { status: 'draft', history: [] }
  for (const [action, role] of [['submit', 'operator'], ['request', 'inspector'], ['revise', 'operator'], ['submit', 'operator'], ['approve', 'inspector']]) {
    r = transitionReport(r, action, role, '검토 의견', 'now')
  }
  assert.equal(r.status, 'approved')
  assert.equal(r.history.length, 5)
  assert.equal(r.history[1].to, 'changes_requested')
  assert.throws(() => transitionReport(r, 'revise', 'operator', '', 'now'))
})
test('review requires reviewer, submitted state and a nonempty comment', () => {
  for (const [status, role, comment] of [['draft', 'inspector', 'ok'], ['submitted', 'operator', 'ok'], ['submitted', 'inspector', ' ']]) {
    assert.throws(() => transitionReport({ status, history: [] }, 'approve', role, comment, 'now'))
  }
})

// Photo categories overlap for anomaly candidates, never for low confidence alone.
test('gallery candidates retain their growth category and uncertainty is not an anomaly', async () => {
  const { matchesPhotoCategory, photoInspectionDraft } = await import('../src/lib/localFarming.js')
  const low = { id: 'low', kind: 'rice_stage', analysis: { rice_stage: { stage: 'HARVEST', needs_review: true } } }
  assert.equal(matchesPhotoCategory(low, 'HARVEST'), true)
  assert.equal(matchesPhotoCategory(low, 'anomaly'), false)
  const candidate = { ...low, title: '사진', anomalyCandidate: { source: 'demo', reason: '시연 현장 확인' } }
  assert.equal(matchesPhotoCategory(candidate, 'HARVEST'), true)
  assert.equal(matchesPhotoCategory(candidate, 'anomaly'), true)
  const draft = photoInspectionDraft(candidate)
  assert.deepEqual(draft.photoIds, ['low'])
  assert.equal(draft.phase, 'HARVEST')
  assert.equal(draft.candidateSource, 'demo')
  assert.equal(matchesPhotoCategory({ kind: 'rice_stage', analysis: {} }, 'unclassified'), true)
})
test('expanded static gallery preserves IDs and provides real results for every growth stage', async () => {
  const { readFile, access } = await import('node:fs/promises')
  const { PHASES, photoCategory } = await import('../src/lib/localFarming.js')
  const base = new URL('../public/demo/farming/', import.meta.url)
  const { items } = JSON.parse(await readFile(new URL('analyses.json', base), 'utf8'))
  assert.ok(items.length >= 29)
  assert.equal(new Set(items.map(p => p.id)).size, items.length)
  for (const id of ['rice-01','rice-02','rice-03','rice-04','tractor-01']) assert.ok(items.some(p => p.id === id))
  for (const phase of PHASES) assert.ok(items.some(p => photoCategory(p) === phase.code))
  for (const item of items) {
    await access(new URL(item.image, base))
    if (item.kind === 'rice_stage') {
      assert.ok(item.analysis.model_revision)
      const probabilities = item.analysis.rice_stage.probabilities
      const best = Object.entries(probabilities).sort((a,b) => b[1] - a[1])[0][0]
      assert.equal(item.analysis.rice_stage.stage, best)
    }
    if (item.anomalyCandidate) assert.equal(item.anomalyCandidate.source, 'demo')
  }
})

test('local record IDs work without the HTTPS-only randomUUID API', async () => {
  const { uid } = await import('../src/lib/localFarming.js')
  const httpCrypto = { getRandomValues: bytes => globalThis.crypto.getRandomValues(bytes) }
  const ids = Array.from({ length: 100 }, () => uid(httpCrypto))
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})
