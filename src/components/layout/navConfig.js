import {
  LayoutDashboard, Cpu, CalendarDays, FileText,
  Factory, AlertTriangle, Settings, BarChart3, ShieldCheck,
  ClipboardList, ShieldAlert, Video, FileCheck2, Sprout,
} from 'lucide-react'

// group: 'owner'(발전사업자) | 'supervisor'(감독관·관리자) | 'both'(공통)
export const NAV_ITEMS = [
  // 발전사업자 메뉴
  { to: '/', label: '현재상태', icon: LayoutDashboard, end: true, group: 'owner' },
  { to: '/equipment', label: '설비', icon: Cpu, group: 'owner' },
  { to: '/calendar', label: '달력보기', icon: CalendarDays, group: 'owner' },
  { to: '/report', label: '보고서', icon: FileText, group: 'owner' },
  { to: '/overview', label: '발전소현황', icon: Factory, group: 'owner' },
  { to: '/comparison', label: '발전소비교', icon: BarChart3, group: 'owner' },
  { to: '/errors', label: '에러정보', icon: AlertTriangle, group: 'owner' },
  { to: '/my-compliance', label: '내 영농이행', icon: Sprout, group: 'owner' },
  // 감독관·관리자 메뉴
  { to: '/oversight', label: '영농이행 감독', icon: ShieldCheck, group: 'supervisor' },
  { to: '/site-detail', label: '사업장상세', icon: ClipboardList, group: 'supervisor' },
  { to: '/anomalies', label: '이상징후', icon: ShieldAlert, group: 'supervisor' },
  { to: '/cctv', label: 'CCTV증빙', icon: Video, group: 'supervisor' },
  { to: '/compliance-report', label: '이행리포트', icon: FileCheck2, group: 'supervisor' },
  // 공통
  { to: '/settings', label: '설정', icon: Settings, group: 'both' },
]
