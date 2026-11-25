import test from 'node:test'
import assert from 'node:assert/strict'
import { cameraError, capturePolicyPayload, newCapturePolicy, runtimePayload, visionFilters } from '../src/lib/camera.js'

const device = { device_id: 'camera', plant_id: 'plant', device_type: 'camera', status: 'active' }
const plan = { plan_id: 'plan', plant_id: 'plant', title: '작업 계획', activity_type: 'machinery_work', status: 'scheduled', planned_start_date: '2026-11-01', planned_end_date: '2026-11-30' }
const context = { plantId: 'plant', devices: [device], plans: [plan], creating: true }
const form = () => ({ ...newCapturePolicy(plan), cameras: [{ camera_device_id: 'camera', priority: 1, enabled: true }] })
const runtime = () => ({ main_rtsp_url: 'rtsp://test:secret@camera/main?token=secret', sub_rtsp_url: '', stream_key: 'cam-1', rtsp_transport: 'tcp', enabled: true, ptz_supported: false, onvif_host: '', onvif_port: 80, remove_sub: false })

test('capture policy preserves plan context and strips response and UI fields from nested updates', () => {
  const f = form(); f.windows[0].window_id = 'server-only'; f.cameras[0].policy_camera_id = 'server-only'; f.event_rules[0].rule_id = 'server-only'
  const payload = capturePolicyPayload(f, context)
  assert.equal(payload.enabled, false)
  assert.equal(payload.farming_plan_id, 'plan')
  assert.equal(payload.valid_from, plan.planned_start_date)
  assert.equal(payload.cooldown_seconds, 900)
  assert.equal(payload.windows[0].start_time, '09:00:00')
  assert.equal(payload.windows[0].display_order, 1)
  assert.equal(JSON.stringify(payload).includes('server-only'), false)
  assert.equal('plant_id' in capturePolicyPayload(f, { ...context, creating: false }), false)
})
test('overlapping and overnight windows fail while adjacent windows and event-only configuration are allowed', () => {
  const f = form(); f.windows.push({ start_time: '17:00', end_time: '19:00', target_count: 2, enabled: true })
  assert.throws(() => capturePolicyPayload(f, context), /겹칠/)
  f.windows[1].start_time = '18:00'
  assert.equal(capturePolicyPayload(f, context).windows.length, 2)
  f.windows[0].end_time = '08:00'
  assert.throws(() => capturePolicyPayload(f, context), /종료 시간/)
  f.windows = [{ start_time: '09:00', end_time: '18:00', target_count: 1, enabled: false }]
  f.event_check_enabled = true
  assert.equal(capturePolicyPayload(f, context).windows[0].enabled, false)
})
test('foreign, inactive, non-camera and duplicate devices are rejected before writes', () => {
  for (const change of [{ plant_id: 'other' }, { status: 'inactive' }, { device_type: 'inverter' }]) assert.throws(() => capturePolicyPayload(form(), { ...context, devices: [{ ...device, ...change }] }), /활성 카메라/)
  const f = form(); f.cameras.push({ ...f.cameras[0] })
  assert.throws(() => capturePolicyPayload(f, context), /중복/)
  f.cameras = []
  assert.throws(() => capturePolicyPayload(f, context), /최소 1대/)
})
test('foreign and cancelled plans cannot be attached to a camera policy', () => {
  for (const change of [{ plant_id: 'other' }, { status: 'cancelled' }]) assert.throws(() => capturePolicyPayload(form(), { ...context, plans: [{ ...plan, ...change }] }), /취소되지 않은 계획/)
})
test('event detection requires an enabled rule and unique case-insensitive class names', () => {
  const f = form(); f.event_check_enabled = true; f.event_rules[0].enabled = false
  assert.throws(() => capturePolicyPayload(f, context), /활성 탐지 규칙/)
  f.event_rules[0].enabled = true; f.event_rules.push({ class_name: ' TRACTOR ', min_confidence: .8, enabled: false })
  assert.throws(() => capturePolicyPayload(f, context), /중복 규칙/)
  f.event_rules[1].class_name = 'person'; f.event_match_mode = 'all'
  assert.equal(capturePolicyPayload(f, context).event_match_mode, 'all')
})
test('capture policy enforces server bounds, real dates and nonblank numeric fields', () => {
  for (const [key, value] of [['scout_interval_seconds', 4], ['cooldown_seconds', -1], ['cooldown_seconds', ''], ['event_match_mode', 'invalid']]) assert.throws(() => capturePolicyPayload({ ...form(), [key]: value }, context))
  const f = form(); f.event_rules[0].min_confidence = 1.01
  assert.throws(() => capturePolicyPayload(f, context), /신뢰도/)
  f.event_rules[0].min_confidence = .7; f.valid_to = '2026-10-01'
  assert.throws(() => capturePolicyPayload(f, context), /종료일/)
  f.valid_to = '2026-02-30'
  assert.throws(() => capturePolicyPayload(f, context))
})
test('runtime requires raw RTSP, rejects masked values and never silently deletes an existing substream', () => {
  assert.equal(runtimePayload(runtime()).main_rtsp_url, runtime().main_rtsp_url)
  assert.throws(() => runtimePayload({ ...runtime(), main_rtsp_url: 'rtsp://***:***@camera/main' }), /마스킹/)
  assert.throws(() => runtimePayload({ ...runtime(), main_rtsp_url: 'https://camera/main' }), /접속 주소/)
  assert.throws(() => runtimePayload(runtime(), { sub_rtsp_configured: true }), /보조 스트림/)
  assert.equal(runtimePayload({ ...runtime(), remove_sub: true }, { sub_rtsp_configured: true }).sub_rtsp_url, null)
})
test('runtime PTZ metadata and port must agree and sensitive errors never echo credentials', () => {
  assert.throws(() => runtimePayload({ ...runtime(), ptz_supported: true }), /ONVIF 호스트/)
  assert.throws(() => runtimePayload({ ...runtime(), ptz_supported: true, onvif_host: 'camera', onvif_port: 0 }), /ONVIF 포트/)
  const payload = runtimePayload({ ...runtime(), ptz_supported: true, onvif_host: 'camera' })
  assert.equal(payload.ptz_protocol, 'onvif')
  for (const status of [0, 400, 401, 403, 404, 409, 422, 500, 503, 504]) assert.equal(cameraError({ status, message: runtime().main_rtsp_url }, true).includes('secret'), false)
})
test('evidence filters use inclusive Korean calendar dates and reject reversed periods', () => {
  assert.deepEqual(visionFilters({ from: '2026-11-01', to: '2026-11-02', status: 'candidate', label: ' tractor ' }), { from: '2026-11-01T00:00:00+09:00', to: '2026-11-02T23:59:59.999999+09:00', status: 'candidate', label: 'tractor' })
  assert.throws(() => visionFilters({ from: '2026-11-02', to: '2026-11-01', status: '', label: '' }), /종료일/)
  assert.deepEqual(visionFilters({ from: '', to: '', status: '', label: '' }), {})
})
