// Local workflow adapter. Nothing in this module calls the backend.
export const PHASES = [
  { code: 'SOWING', name: '파종·모내기', hint: '파종·이앙 일정과 필요한 장비·인력을 정리하세요.', offset: 0 },
  { code: 'VEGETATIVE', name: '영양생장', hint: '관수·시비 등 수행할 작업과 관찰 내용을 정리하세요.', offset: 30 },
  { code: 'FLOWERING', name: '출수·개화', hint: '논 상태를 관찰하고 단계별 관리 작업을 기록하세요.', offset: 70 },
  { code: 'HARVEST', name: '수확기', hint: '수확 일정과 작업 장비·인력을 정리하세요.', offset: 120 },
]
export const REPORT_STATUS = { draft: '작성 중', submitted: '검토 대기', changes_requested: '보완 요청', approved: '승인 완료' }
export const GALLERY_CATEGORIES = [
  { code: 'all', name: '전체 사진' }, ...PHASES,
  { code: 'work', name: '작업 증빙' }, { code: 'anomaly', name: '이상징후 후보' }, { code: 'unclassified', name: '미분류' },
]
export function photoCategory(photo) {
  if (photo.kind === 'object_detection') return 'work'
  const stage = photo.analysis?.rice_stage?.stage
  return photo.kind === 'rice_stage' && PHASES.some((p) => p.code === stage) ? stage : 'unclassified'
}
export function matchesPhotoCategory(photo, category) {
  if (category === 'all') return true
  if (category === 'anomaly') return !!photo.anomalyCandidate?.reason
  return photoCategory(photo) === category
}
export function photoInspectionDraft(photo) {
  if (!photo) return { title: '', phase: 'VEGETATIVE', detail: '', photoIds: [] }
  const stage = photoCategory(photo)
  return { title: `${photo.title} 현장 확인`, phase: PHASES.some((p) => p.code === stage) ? stage : 'VEGETATIVE',
    detail: photo.anomalyCandidate?.reason || '', photoIds: [photo.id], candidateSource: photo.anomalyCandidate?.source || 'manual' }
}
export const today = () => new Date().toLocaleDateString('en-CA')
// randomUUID requires HTTPS; getRandomValues also works on the existing HTTP site.
export function uid(provider = globalThis.crypto) {
  if (typeof provider.randomUUID === 'function') return provider.randomUUID()
  const bytes = provider.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
export const emptyWorkspace = () => ({ version: 1, revision: 0, plan: null, records: [], reports: [], issues: [] })
export const workspaceKey = (userId, plantId) => `farming-local-v1:${encodeURIComponent(userId || 'preview')}:${encodeURIComponent(plantId)}`
export function loadWorkspace(storage, key) {
  const raw = storage.getItem(key)
  if (!raw) return emptyWorkspace()
  const value = JSON.parse(raw)
  if (value.version !== 1 || !Number.isInteger(value.revision) || !['records', 'reports', 'issues'].every((k) => Array.isArray(value[k]))) {
    throw new Error('저장된 로컬 자료 형식을 읽을 수 없습니다. 브라우저 자료를 확인해 주세요.')
  }
  return value
}
export function commitWorkspace(storage, key, update) {
  const previous = loadWorkspace(storage, key)
  const next = { ...update(previous), version: 1, revision: previous.revision + 1 }
  storage.setItem(key, JSON.stringify(next))
  return next
}
export function makePlan() {
  const start = today()
  return { id: uid(), title: '벼 재배 계획', crop: '벼', plot: '', start,
    stages: PHASES.map((p) => {
      const date = new Date(`${start}T12:00:00`)
      date.setDate(date.getDate() + p.offset)
      return { code: p.code, date: date.toLocaleDateString('en-CA'), equipment: '', people: '', guide: p.hint }
    }) }
}
export function recordError(record, plan, photos) {
  if (!plan) return '먼저 영농계획을 저장해 주세요.'
  if (!PHASES.some((p) => p.code === record.phase)) return '계획의 작업 단계를 선택해 주세요.'
  if (!record.title.trim() || !record.content.trim() || !record.date) return '작업일·제목·수행 내용을 입력해 주세요.'
  if (!record.evidence.length) return '작업 증빙 사진을 한 장 이상 선택해 주세요.'
  if (!record.before || !record.after) return '논 전경 전·후 사진을 선택해 주세요.'
  if (record.before === record.after) return '전·후 사진은 서로 다른 사진을 선택해 주세요.'
  const selected = [...record.evidence, record.before, record.after]
  if (selected.some((id) => !photos.some((p) => p.id === id))) return '선택한 사진을 찾을 수 없습니다. 다시 선택해 주세요.'
  if ([record.before, record.after].some((id) => photos.find((p) => p.id === id)?.kind !== 'rice_stage')) return '전·후 비교에는 논 전경 사진을 선택해 주세요.'
  return ''
}
export function reportDraft(workspace, from, to, id, at) {
  if (!workspace.plan || !from || !to || from > to) throw new Error('계획과 보고서 조회 기간을 확인해 주세요.')
  const records = workspace.records.filter((r) => r.date >= from && r.date <= to)
  if (!records.length) throw new Error('선택한 기간에 수행 기록이 없습니다.')
  return { id, title: `${workspace.plan.crop} 영농이행 보고서`, from, to, status: 'draft', summary: '',
    createdAt: at, plan: structuredClone(workspace.plan), records: structuredClone(records),
    issues: structuredClone(workspace.issues), history: [] }
}
export function transitionReport(report, action, role, comment, at) {
  const transitions = {
    submit: { role: 'operator', from: ['draft'], to: 'submitted' },
    request: { role: 'inspector', from: ['submitted'], to: 'changes_requested' },
    approve: { role: 'inspector', from: ['submitted'], to: 'approved' },
    revise: { role: 'operator', from: ['changes_requested'], to: 'draft' },
  }
  const rule = transitions[action]
  if (!rule || rule.role !== role || !rule.from.includes(report.status)) throw new Error('현재 역할이나 상태에서는 처리할 수 없습니다.')
  if (['approve', 'request'].includes(action) && !comment.trim()) throw new Error('검토 의견을 입력해 주세요.')
  return { ...report, status: rule.to, history: [...report.history, {
    from: report.status, to: rule.to, role, comment: comment.trim(), at,
  }] }
}
export async function fetchLocalPhotos(signal) {
  const response = await fetch(`${import.meta.env.BASE_URL}demo/farming/analyses.json`, { signal })
  if (!response.ok) throw new Error('로컬 사진 목록을 불러오지 못했습니다.')
  const data = await response.json()
  if (data.version !== 1 || !Array.isArray(data.items)) throw new Error('사진 목록 형식이 올바르지 않습니다.')
  return data.items
}
export const localPhotoUrl = (path) => `${import.meta.env.BASE_URL}demo/farming/${path}`
