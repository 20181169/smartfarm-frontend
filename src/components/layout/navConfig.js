import {
  LayoutDashboard, Cpu, CalendarDays, FileText,
  Factory, AlertTriangle, Settings, BarChart3, ShieldCheck,
  ClipboardList, ShieldAlert, Video, FileCheck2, Sprout,
} from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/', label: '현재상태', icon: LayoutDashboard, end: true },
  { to: '/equipment', label: '설비', icon: Cpu },
  { to: '/calendar', label: '달력보기', icon: CalendarDays },
  { to: '/report', label: '보고서', icon: FileText },
  { to: '/overview', label: '발전소현황', icon: Factory },
  { to: '/comparison', label: '발전소비교', icon: BarChart3 },
  { to: '/errors', label: '에러정보', icon: AlertTriangle },
  { to: '/my-compliance', label: '내 영농이행', icon: Sprout },
  { to: '/oversight', label: '영농이행 감독', icon: ShieldCheck, supervisorOnly: true },
  { to: '/site-detail', label: '사업장상세', icon: ClipboardList, supervisorOnly: true },
  { to: '/anomalies', label: '이상징후', icon: ShieldAlert, supervisorOnly: true },
  { to: '/cctv', label: 'CCTV증빙', icon: Video, supervisorOnly: true },
  { to: '/compliance-report', label: '이행리포트', icon: FileCheck2, supervisorOnly: true },
  { to: '/settings', label: '설정', icon: Settings },
]
