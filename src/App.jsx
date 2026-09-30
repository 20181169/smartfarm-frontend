import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { useApp } from './context/useApp'
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
import RequireSupervisor from './components/RequireSupervisor'

// 역할별 홈: 감독관·관리자는 영농이행 감독으로, 발전사업자는 현재상태 대시보드로.
function RoleHome() {
  const { menuRole } = useApp()
  return menuRole === 'supervisor' ? <Navigate to="/oversight" replace /> : <DashboardView />
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<RoleHome />} />
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
            <Route path="errors" element={<ErrorsView />} />
            <Route path="settings" element={<SettingsView />} />
            <Route path="comparison" element={<ComparisonView />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  )
}
