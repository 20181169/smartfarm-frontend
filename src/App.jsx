import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Layout from './components/layout/Layout'
import DashboardView from './views/DashboardView'
import EquipmentView from './views/EquipmentView'
import CalendarView from './views/CalendarView'
import ReportView from './views/ReportView'
import OverviewView from './views/OverviewView'
import OversightView from './views/OversightView'
import SiteDetailView from './views/SiteDetailView'
import RiskCenterView from './views/RiskCenterView'
import CctvEvidenceView from './views/CctvEvidenceView'
import ReportCenterView from './views/ReportCenterView'
import OwnerAgriStatusView from './views/OwnerAgriStatusView'
import ErrorsView from './views/ErrorsView'
import SettingsView from './views/SettingsView'
import ComparisonView from './views/ComparisonView'
import InspectionView from './views/InspectionView'
import RequireSupervisor from './components/RequireSupervisor'

// '/' 는 모든 역할에서 현재상태(발전 대시보드). 관리자·감독관은 로그인 직후에만 종합대시보드(/oversight)로
// 이동하고(AuthOverlay), 통합 버전처럼 메뉴에서 대시보드를 열 수 있도록 '/' 를 리다이렉트하지 않는다.
export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardView />} />
            <Route path="equipment" element={<EquipmentView />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="report" element={<ReportView />} />
            <Route path="overview" element={<OverviewView />} />
            <Route path="my-compliance" element={<OwnerAgriStatusView />} />
            <Route path="oversight" element={<OversightView />} />
            <Route path="site-detail" element={<RequireSupervisor><SiteDetailView /></RequireSupervisor>} />
            <Route path="anomalies" element={<RequireSupervisor><RiskCenterView /></RequireSupervisor>} />
            <Route path="cctv" element={<CctvEvidenceView />} />
            <Route path="compliance-report" element={<RequireSupervisor><ReportCenterView /></RequireSupervisor>} />
            <Route path="inspection" element={<RequireSupervisor><InspectionView /></RequireSupervisor>} />
            <Route path="errors" element={<ErrorsView />} />
            <Route path="settings" element={<SettingsView />} />
            <Route path="comparison" element={<ComparisonView />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  )
}
