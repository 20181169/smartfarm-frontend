import {
  LayoutDashboard, Cpu, CalendarDays, FileText,
  Factory, AlertTriangle, Settings, BarChart3,
} from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/', label: '현재상태', icon: LayoutDashboard, end: true },
  { to: '/equipment', label: '설비', icon: Cpu },
  { to: '/calendar', label: '달력보기', icon: CalendarDays },
  { to: '/report', label: '보고서', icon: FileText },
  { to: '/overview', label: '발전소현황', icon: Factory },
  { to: '/errors', label: '에러정보', icon: AlertTriangle },
  { to: '/settings', label: '설정', icon: Settings },
  { to: '/comparison', label: '발전소비교', icon: BarChart3 },
]
