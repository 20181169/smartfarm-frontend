import {
  LayoutDashboard, Cpu, CalendarDays, FileText,
  Factory, AlertTriangle, Settings, BarChart3, ShieldCheck,
  ClipboardList, ShieldAlert, Video, FileCheck2, Sprout, ClipboardCheck,
} from 'lucide-react'

const ITEM = {
  dashboard: { to: '/', label: '현재상태', icon: LayoutDashboard, end: true },
  equipment: { to: '/equipment', label: '설비', icon: Cpu },
  calendar: { to: '/calendar', label: '달력보기', icon: CalendarDays },
  report: { to: '/report', label: '보고서', icon: FileText },
  overview: { to: '/overview', label: '발전소현황', icon: Factory },
  errors: { to: '/errors', label: '에러정보', icon: AlertTriangle },
  comparison: { to: '/comparison', label: '발전소비교', icon: BarChart3 },
  myCompliance: { to: '/my-compliance', label: '영농이행', icon: Sprout },
  agriDashboard: { to: '/oversight', label: '종합대시보드', icon: ShieldCheck },
  siteDetail: { to: '/site-detail', label: '사업장상세', icon: ClipboardList },
  anomalies: { to: '/anomalies', label: '이상징후', icon: ShieldAlert },
  cctv: { to: '/cctv', label: 'CCTV 트랙터 인식', icon: Video },
  complianceReport: { to: '/compliance-report', label: '이행리포트', icon: FileCheck2 },
  inspection: { to: '/inspection', label: '현장점검', icon: ClipboardCheck },
  settings: { to: '/settings', label: '설정', icon: Settings },
}

// 역할별 메뉴 — 통합 버전과 같은 구성·순서.
//   admin    시스템 관리자: 발전소 운영 화면 + 감독 화면 전체
//   official 지자체 감독관·점검자: 감독 화면 + 현장점검 + 발전현재(대시보드) + 발전소비교
//   owner    발전사업자(운영자·조회 전용): 발전소 운영 화면 + 영농이행
// CCTV(발전사업자)·설정은 통합 버전에 없는 이 앱의 추가 메뉴.
export const NAV_BY_ROLE = {
  admin: [
    ITEM.agriDashboard, ITEM.dashboard, ITEM.equipment, ITEM.calendar, ITEM.report, ITEM.overview,
    ITEM.errors, ITEM.comparison, ITEM.siteDetail, ITEM.anomalies, ITEM.cctv, ITEM.complianceReport,
    ITEM.settings,
  ],
  official: [
    ITEM.agriDashboard, ITEM.siteDetail, ITEM.anomalies, ITEM.cctv, ITEM.complianceReport, ITEM.inspection,
    { ...ITEM.dashboard, label: '발전현재' }, ITEM.comparison, ITEM.settings,
  ],
  owner: [
    ITEM.dashboard, ITEM.equipment, ITEM.calendar, ITEM.report, ITEM.overview, ITEM.errors,
    ITEM.comparison, ITEM.myCompliance, ITEM.cctv, ITEM.settings,
  ],
}
