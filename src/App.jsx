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
import RequireSupervisor from './components/RequireSupervisor'

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
            <Route path="cctv" element={<RequireSupervisor><CctvEvidenceView /></RequireSupervisor>} />
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
