import { guideTasks } from './localFarmingGuide.js'

// Workflow demonstration calendar. Dates are sample planning defaults, not a
// regional/varietal recommendation or an AI prediction.
export const RICE_GUIDE_MONTHS = [
  { month: '5월', title: '육묘·논 준비', detail: '모 준비, 논 정지와 용배수 점검' },
  { month: '5월 말~6월 초', title: '모내기', detail: '이앙 작업과 초기 상태 확인' },
  { month: '6~7월', title: '생육 관리', detail: '활착 관찰, 물관리와 관리 작업 기록' },
  { month: '8~9월', title: '출수·개화·등숙', detail: '이삭 관찰, 기상 확인과 후속 관리' },
  { month: '10월', title: '수확·마무리', detail: '수확·반출 및 보고서 준비' },
]
const STAGE_DATES = { SOWING: '05-01', VEGETATIVE: '06-10', FLOWERING: '08-15', HARVEST: '10-01' }
const TASK_DATES = {
  seedling: '05-01', 'field-preparation': '05-20', transplanting: '06-05',
  establishment: '06-10', 'water-management': '06-15', 'field-care': '07-01',
  heading: '08-15', 'weather-check': '08-20', 'ripening-observation': '09-01',
  'harvest-preparation': '10-01', harvesting: '10-10', 'season-close': '10-20',
}
export function defaultGuideYear(now = new Date()) {
  return now.getFullYear() + (now.getMonth() >= 10 ? 1 : 0)
}
export function scheduleDates(plan) {
  return Object.fromEntries([
    ['start', plan.start],
    ...plan.stages.flatMap(stage => [
      [`stage:${stage.code}`, stage.date],
      ...(stage.tasks || []).map(task => [`task:${stage.code}:${task.id}`, task.date || '']),
    ]),
  ])
}
export function applyGuideSchedule(plan, year) {
  if (!Number.isInteger(Number(year)) || Number(year) < 2000 || Number(year) > 2100) throw new Error('재배 연도를 확인해 주세요.')
  const next = { ...structuredClone(plan), start: `${year}-05-01`, scheduleReason: '',
    stages: plan.stages.map(stage => ({ ...structuredClone(stage), date: `${year}-${STAGE_DATES[stage.code]}`,
      tasks: guideTasks(stage).map(task => ({ ...task, date: TASK_DATES[task.id] ? `${year}-${TASK_DATES[task.id]}` : task.date })),
    })),
  }
  next.guideSchedule = { id: 'rice-transplanting-demo-v1', year: Number(year), source: 'example', dates: scheduleDates(next) }
  return next
}
export function scheduleChanges(plan, baseline = plan.guideSchedule?.dates) {
  if (!baseline) return []
  return Object.entries(scheduleDates(plan)).filter(([key, value]) => value !== (baseline[key] || ''))
}
export function guidePlanError(plan, baseline) {
  if (!plan.title.trim()) return '계획명을 입력해 주세요.'
  if (!plan.start || plan.stages.some((s, i) => !s.date || s.date < plan.start || (i && s.date < plan.stages[i - 1].date))) return '단계별 날짜는 재배 시작일 이후 순서대로 입력해 주세요.'
  if (plan.stages.some(s => (s.tasks || []).some(t => t.date && t.date < plan.start))) return '세부 작업 예정일은 재배 시작일 이후로 지정해 주세요.'
  if (scheduleChanges(plan, baseline).length && !plan.scheduleReason?.trim()) return '가이드 일정과 다르게 진행하는 이유를 입력해 주세요.'
  return ''
}
