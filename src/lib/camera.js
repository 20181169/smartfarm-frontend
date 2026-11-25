// Public API contracts only. Runtime credentials must never be persisted or logged.
export const DEVICE_STATES = { active: '활성', inactive: '비활성', maintenance: '점검', fault: '고장' }
const integer = (value, min, max, label) => {
  const n = Number(value)
  if (String(value).trim() === '' || !Number.isInteger(n) || n < min || n > max) throw new Error(`${label}: ${min}~${max} 사이의 정수를 입력해 주세요.`)
  return n
}
const dateValue = value => {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('적용 날짜를 확인해 주세요.')
  return value
}
export function newCapturePolicy(plan) {
  return {
    name: plan ? `${plan.title} 자동 촬영` : '', farming_plan_id: plan?.plan_id || '', activity_type: plan?.activity_type || '',
    valid_from: plan?.planned_start_date || '', valid_to: plan?.planned_end_date || '', enabled: false,
    event_check_enabled: false, event_match_mode: 'any', scout_interval_seconds: 60, cooldown_seconds: 900,
    windows: [{ start_time: '09:00', end_time: '18:00', target_count: 3, enabled: true }],
    cameras: [], event_rules: [{ class_name: 'tractor', min_confidence: 0.7, enabled: true }],
  }
}
export function capturePolicyPayload(form, { plantId, devices, plans, creating = false }) {
  const name = form.name.trim()
  if (!name || name.length > 150) throw new Error('정책명은 1~150자로 입력해 주세요.')
  const activity_type = form.activity_type?.trim() || null
  if (activity_type?.length > 50) throw new Error('작업 유형은 50자 이내로 입력해 주세요.')
  const valid_from = dateValue(form.valid_from), valid_to = dateValue(form.valid_to)
  if (valid_from && valid_to && valid_to < valid_from) throw new Error('적용 종료일은 시작일보다 빠를 수 없습니다.')
  const farming_plan_id = form.farming_plan_id || null
  if (farming_plan_id && plans) {
    const plan = plans.find(p => p.plan_id === farming_plan_id)
    if (!plan || plan.plant_id !== plantId || plan.status !== 'scheduled') throw new Error('선택한 발전소의 취소되지 않은 계획을 선택해 주세요.')
  }
  if (!form.windows.length) throw new Error('촬영 시간대를 최소 1개 등록해 주세요.')
  const clock = value => {
    if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) throw new Error('촬영 시간을 확인해 주세요.')
    return value.length === 5 ? `${value}:00` : value
  }
  const windows = form.windows.map((w, i) => {
    const start_time = clock(w.start_time), end_time = clock(w.end_time)
    if (end_time <= start_time) throw new Error('촬영 종료 시간은 시작 시간보다 늦어야 합니다. 자정을 넘는 시간대는 나눠 입력해 주세요.')
    return { start_time, end_time, target_count: integer(w.target_count, 1, 100, '촬영 횟수'), display_order: i + 1, enabled: !!w.enabled }
  })
  const ordered = [...windows].sort((a, b) => a.start_time.localeCompare(b.start_time))
  if (ordered.some((w, i) => i && w.start_time < ordered[i - 1].end_time)) throw new Error('촬영 시간대는 서로 겹칠 수 없습니다.')
  if (!form.cameras.length) throw new Error('촬영 카메라를 최소 1대 선택해 주세요.')
  const seenCameras = new Set()
  const cameras = form.cameras.map(c => {
    if (!c.camera_device_id || seenCameras.has(c.camera_device_id)) throw new Error('카메라를 선택하고 중복 등록을 해제해 주세요.')
    seenCameras.add(c.camera_device_id)
    const device = devices.find(d => d.device_id === c.camera_device_id)
    if (!device || device.plant_id !== plantId || device.device_type !== 'camera' || device.status !== 'active') throw new Error('선택한 발전소의 활성 카메라를 선택해 주세요.')
    return { camera_device_id: c.camera_device_id, priority: integer(c.priority, 1, 1000, '카메라 우선순위'), enabled: !!c.enabled }
  })
  if (form.enabled && !cameras.some(c => c.enabled)) throw new Error('정책을 사용하려면 카메라를 최소 1대 사용으로 설정해 주세요.')
  if (!['any', 'all'].includes(form.event_match_mode)) throw new Error('이벤트 일치 조건을 선택해 주세요.')
  const seenRules = new Set()
  const event_rules = form.event_rules.map(r => {
    const class_name = r.class_name.trim().replace(/\s+/g, ' '), key = class_name.toLowerCase()
    if (!class_name || class_name.length > 100 || seenRules.has(key)) throw new Error('탐지 대상은 1~100자로 입력하고 중복 규칙을 제거해 주세요.')
    seenRules.add(key)
    const min_confidence = Number(r.min_confidence)
    if (String(r.min_confidence).trim() === '' || !Number.isFinite(min_confidence) || min_confidence < 0 || min_confidence > 1) throw new Error('최소 탐지 신뢰도는 0~1 사이로 입력해 주세요.')
    return { class_name, min_confidence, enabled: !!r.enabled }
  })
  if (form.event_check_enabled && !event_rules.some(r => r.enabled)) throw new Error('이벤트 자동 감지에는 활성 탐지 규칙이 최소 1개 필요합니다.')
  return { ...(creating ? { plant_id: plantId } : {}), name, farming_plan_id, activity_type, valid_from, valid_to, enabled: !!form.enabled,
    event_check_enabled: !!form.event_check_enabled, event_match_mode: form.event_match_mode,
    scout_interval_seconds: integer(form.scout_interval_seconds, 5, 86400, '감지 주기'), cooldown_seconds: integer(form.cooldown_seconds, 0, 86400, '중복 촬영 방지 시간'),
    windows, cameras, event_rules }
}
export function runtimePayload(form, existing) {
  const rtsp = (value, required) => {
    value = value.trim()
    if (!value && !required) return null
    try {
      const url = new URL(value)
      if (!['rtsp:', 'rtsps:'].includes(url.protocol) || !url.hostname || value.includes('***') || value.length > 2048) throw new Error()
    } catch { throw new Error('카메라 접속 주소를 확인해 주세요. 마스킹된 주소는 저장할 수 없습니다.') }
    return value
  }
  if (existing?.sub_rtsp_configured && !form.sub_rtsp_url.trim() && !form.remove_sub) throw new Error('기존 보조 스트림 주소를 다시 입력하거나 보조 스트림 제거를 선택해 주세요.')
  const stream_key = form.stream_key.trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(stream_key)) throw new Error('스트림 식별자는 영문·숫자로 시작하는 1~100자의 영문·숫자·점·밑줄·하이픈으로 입력해 주세요.')
  if (!['tcp', 'udp'].includes(form.rtsp_transport)) throw new Error('전송 방식을 선택해 주세요.')
  const ptz_supported = !!form.ptz_supported
  const onvif_host = ptz_supported ? form.onvif_host.trim() : null
  if (ptz_supported && (!onvif_host || onvif_host.length > 255)) throw new Error('ONVIF 호스트를 입력해 주세요.')
  return { main_rtsp_url: rtsp(form.main_rtsp_url, true), sub_rtsp_url: form.remove_sub ? null : rtsp(form.sub_rtsp_url, false), stream_key,
    rtsp_transport: form.rtsp_transport, ptz_supported, ptz_protocol: ptz_supported ? 'onvif' : 'none',
    onvif_host, onvif_port: ptz_supported ? integer(form.onvif_port, 1, 65535, 'ONVIF 포트') : null, enabled: !!form.enabled }
}
export function cameraError(error, sensitive = false) {
  const messages = { 0: '서버 응답을 확인하지 못했습니다. 저장 요청이었다면 다시 저장하기 전에 최신 설정을 조회해 주세요.', 400: '설정값을 확인해 주세요.',
    401: '로그인이 만료되었습니다. 다시 로그인해 주세요.', 403: '이 발전소 또는 카메라 설정에 접근할 권한이 없습니다.', 404: '대상 정보를 찾을 수 없습니다. 목록을 새로 조회해 주세요.',
    409: '설정이 충돌합니다. 스트림 식별자 중복과 최신 설정을 확인해 주세요.', 413: '전송 가능한 파일 크기를 초과했습니다.', 422: '입력 형식과 필수 항목을 확인해 주세요.',
    429: '분석 서버가 사용 중입니다. 잠시 후 다시 시도해 주세요.', 503: '카메라 또는 분석 서비스에 연결할 수 없습니다.', 504: '카메라 또는 분석 서비스의 응답 시간이 초과되었습니다.' }
  if (sensitive) return messages[error?.status] || '카메라 설정을 처리하지 못했습니다. 최신 설정을 조회한 후 다시 시도해 주세요.'
  return [400, 422].includes(error?.status) ? error.message || messages[error.status] : messages[error?.status] || error.message || '요청을 처리하지 못했습니다.'
}
export function visionFilters(values) {
  if (values.from && values.to && values.from > values.to) throw new Error('조회 종료일은 시작일보다 빠를 수 없습니다.')
  return { ...(values.from ? { from: `${values.from}T00:00:00+09:00` } : {}), ...(values.to ? { to: `${values.to}T23:59:59.999999+09:00` } : {}),
    ...(values.status ? { status: values.status } : {}), ...(values.label.trim() ? { label: values.label.trim() } : {}) }
}
