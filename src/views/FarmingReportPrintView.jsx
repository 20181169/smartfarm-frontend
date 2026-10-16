import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiFarmingReportData, apiGetMe } from '../lib/api'
import { currentUser, hasPermission } from '../lib/permissions'
import FarmingReportDocument from './FarmingReportDocument'
import './FarmingReportPrintView.css'

export default function FarmingReportPrintView() {
  const [params] = useSearchParams()
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const plantId = params.get('plant_id')
  const fromDate = params.get('from_date')
  const toDate = params.get('to_date')
  const activityType = params.get('activity_type')

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setReport(null)
    setError(null)
    window.__FARMING_REPORT_READY__ = false
    window.__FARMING_REPORT_ERROR__ = null
    delete document.documentElement.dataset.reportReady
    delete document.documentElement.dataset.reportError
    async function load() {
      try {
        // The server PDF renderer injects its authorized report payload without a JWT.
        if (window.__FARMING_REPORT_DATA__) {
          if (active) setReport(window.__FARMING_REPORT_DATA__)
          return
        }
        if (!plantId || !fromDate || !toDate) throw new Error('plant_id, from_date, to_date가 필요합니다.')
        const user = currentUser(await apiGetMe())
        if (!hasPermission(user, 'report:read')) throw new Error('보고서 조회 권한이 없습니다.')
        const data = await apiFarmingReportData({ plantId, fromDate, toDate, activityType, signal: controller.signal })
        if (active) setReport(data)
      } catch (err) {
        if (!active) return
        const message = err?.message || '보고서 데이터를 불러오지 못했습니다.'
        setError(message)
        window.__FARMING_REPORT_ERROR__ = message
        document.documentElement.dataset.reportError = 'true'
      }
    }
    load()
    return () => { active = false; controller.abort() }
  }, [plantId, fromDate, toDate, activityType])

  if (error) return <main className="report-print-state" role="alert"><strong>보고서를 표시할 수 없습니다.</strong><p>{error}</p></main>
  if (!report) return <main className="report-print-state">보고서 데이터를 불러오는 중입니다.</main>
  return <FarmingReportDocument report={report} />
}
