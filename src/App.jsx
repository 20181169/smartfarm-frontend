import {
  HashRouter,
  Routes,
  Route,
} from 'react-router-dom'

import { AppProvider } from './context/AppContext'

import DemoBoundary from './components/DemoBoundary'
import Layout from './components/layout/Layout'
import RequirePermission from './components/RequirePermission'
import { ROUTE_PERMISSIONS } from './lib/permissions'

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
import PlanAssessmentView from './views/PlanAssessmentView'
import FarmingReportPrintView from './views/FarmingReportPrintView'


// '/' 는 모든 역할에서 현재상태(발전 대시보드).
export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/*
          PDF/인쇄 전용 화면.
          Layout과 AppProvider에서 분리하여
          사이드바 및 대시보드 polling이
          PDF 렌더링에 개입하지 않게 한다.
        */}
        <Route
          path="compliance-report/print"
          element={
            <FarmingReportPrintView />
          }
        />

        <Route
          element={
            <AppProvider>
              <Layout />
            </AppProvider>
          }
        >
          <Route
            index
            element={<DashboardView />}
          />

          <Route
            path="equipment"
            element={<EquipmentView />}
          />

          <Route
            path="calendar"
            element={<CalendarView />}
          />

          <Route
            path="report"
            element={<ReportView />}
          />

          <Route
            path="overview"
            element={<OverviewView />}
          />

          <Route
            path="my-compliance"
            element={<DemoBoundary title="영농이행"><OwnerAgriStatusView /></DemoBoundary>}
          />

          <Route
            path="plan-assessment"
            element={<RequirePermission permissions={ROUTE_PERMISSIONS['/plan-assessment']}><PlanAssessmentView /></RequirePermission>}
          />

          <Route
            path="oversight"
            element={<RequirePermission permissions={ROUTE_PERMISSIONS['/oversight']}><OversightView /></RequirePermission>}
          />

          <Route
            path="site-detail"
            element={
              <RequirePermission permissions={ROUTE_PERMISSIONS['/site-detail']}><DemoBoundary title="사업장 상세"><SiteDetailView /></DemoBoundary></RequirePermission>
            }
          />

          <Route
            path="anomalies"
            element={
              <RequirePermission permissions={ROUTE_PERMISSIONS['/anomalies']}><DemoBoundary title="이상징후"><RiskCenterView /></DemoBoundary></RequirePermission>
            }
          />

          <Route
            path="cctv"
            element={<RequirePermission permissions={ROUTE_PERMISSIONS['/cctv']}><CctvEvidenceView /></RequirePermission>}
          />

          <Route
            path="compliance-report"
            element={
              <RequirePermission permissions={ROUTE_PERMISSIONS['/compliance-report']}><ReportCenterView /></RequirePermission>
            }
          />

          <Route
            path="inspection"
            element={
              <RequirePermission permissions={ROUTE_PERMISSIONS['/inspection']}><InspectionView /></RequirePermission>
            }
          />

          <Route
            path="errors"
            element={<ErrorsView />}
          />

          <Route
            path="settings"
            element={<SettingsView />}
          />

          <Route
            path="comparison"
            element={<ComparisonView />}
          />
        </Route>
      </Routes>
    </HashRouter>
  )
}
