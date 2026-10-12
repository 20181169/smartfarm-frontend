import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  useSearchParams,
} from 'react-router-dom'

import {
  apiFarmingReportData,
} from '../lib/api'

import './FarmingReportPrintView.css'


const ASSESSMENT_LABEL = {
  fulfilled: '이행',
  not_fulfilled: '미이행',
  unable_to_determine: '판단 불가',
}


function dictionaryText(value) {
  const entries = Object.entries(
    value || {},
  )

  if (!entries.length) {
    return '-'
  }

  return entries
    .map(
      ([key, count]) =>
        `${key} ${count}건`,
    )
    .join(' · ')
}


function dateTimeText(value) {
  if (!value) {
    return '-'
  }

  try {
    return new Date(value).toLocaleString(
      'ko-KR',
      {
        timeZone: 'Asia/Seoul',
      },
    )
  } catch {
    return String(value)
  }
}


function InfoCard({
  label,
  value,
}) {
  return (
    <div className="report-info-card">
      <span>{label}</span>
      <strong>{value ?? '-'}</strong>
    </div>
  )
}


function KpiCard({
  label,
  value,
}) {
  return (
    <div className="report-kpi-card">
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </div>
  )
}


export default function FarmingReportPrintView() {
  const [params] = useSearchParams()

  const [report, setReport] =
    useState(null)

  const [error, setError] =
    useState(null)

  const plantId =
    params.get('plant_id')

  const fromDate =
    params.get('from_date')

  const toDate =
    params.get('to_date')

  const activityType =
    params.get('activity_type')

  useEffect(() => {
    let active = true

    async function load() {
      /*
       * Playwright 단계에서는 Backend가
       * canonical data를 직접 주입할 수 있다.
       * 이 경우 PDF 브라우저에 사용자 JWT를
       * 전달할 필요가 없다.
       */
      if (
        window.__FARMING_REPORT_DATA__
      ) {
        if (active) {
          setReport(
            window.__FARMING_REPORT_DATA__,
          )
        }

        return
      }

      if (
        !plantId ||
        !fromDate ||
        !toDate
      ) {
        if (active) {
          setError(
            'plant_id, from_date, to_date가 필요합니다.',
          )
        }

        return
      }

      try {
        const data =
          await apiFarmingReportData({
            plantId,
            fromDate,
            toDate,
            activityType,
          })

        if (active) {
          setReport(data)
        }
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
              '보고서 데이터를 불러오지 못했습니다.',
          )
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [
    plantId,
    fromDate,
    toDate,
    activityType,
  ])

  useEffect(() => {
    if (!report) {
      return
    }

    window.__FARMING_REPORT_READY__ =
      true

    document.documentElement.dataset
      .reportReady = 'true'
  }, [report])

  useEffect(() => {
    if (!error) {
      return
    }

    window.__FARMING_REPORT_ERROR__ =
      error

    document.documentElement.dataset
      .reportError = 'true'
  }, [error])

  const plans = useMemo(
    () =>
      Array.isArray(report?.plans)
        ? report.plans
        : [],
    [report],
  )

  if (error) {
    return (
      <main className="report-print-state">
        <strong>
          보고서를 표시할 수 없습니다.
        </strong>

        <div>{error}</div>
      </main>
    )
  }

  if (!report) {
    return (
      <main className="report-print-state">
        보고서 데이터를 불러오는 중입니다.
      </main>
    )
  }

  const activity =
    report.activity_summary || {}

  const plant =
    report.plant || {}

  const visiblePlans =
    plans.slice(0, 5)

  return (
    <main className="report-print-page">
      <header className="report-print-header">
        <div>
          <div className="report-print-eyebrow">
            AGRIVOLTAIC COMPLIANCE REPORT
          </div>

          <h1>
            AI 기반 영농형 태양광
            <br />
            영농이행 정기점검 보고서
          </h1>

          <p className="report-print-subtitle">
            시스템 canonical report data
            기반 영농활동 검토 보고서
          </p>
        </div>

        <div className="report-print-page-no">
          01
        </div>
      </header>

      <section className="report-period-card">
        <div className="report-period-label">
          REPORTING PERIOD
        </div>

        <div className="report-period-value">
          {report.from_date}
          {' ~ '}
          {report.to_date}
        </div>

        <div className="report-period-plant">
          {plant.name || report.plant_id}
        </div>

        <div className="report-period-id">
          Plant ID: {report.plant_id}
        </div>
      </section>

      <section className="report-info-grid">
        <InfoCard
          label="사업장"
          value={plant.name}
        />

        <InfoCard
          label="주소"
          value={plant.address}
        />

        <InfoCard
          label="설비용량"
          value={
            plant.capacity_kw != null
              ? `${plant.capacity_kw} kW`
              : '-'
          }
        />

        <InfoCard
          label="면적"
          value={
            plant.area_m2 != null
              ? `${plant.area_m2} m²`
              : '-'
          }
        />
      </section>

      <section>
        <h2>영농활동 요약</h2>

        <div className="report-kpi-grid">
          <KpiCard
            label="영농계획"
            value={report.total_plans}
          />

          <KpiCard
            label="확정 활동"
            value={
              activity.confirmed_event_count
            }
          />

          <KpiCard
            label="무효화 활동"
            value={
              activity.invalidated_event_count
            }
          />

          <KpiCard
            label="Vision 증빙"
            value={
              activity.vision_evidence_count
            }
          />
        </div>
      </section>

      <section className="report-summary-box">
        <div className="report-summary-row">
          <span>확정 활동 유형</span>

          <strong>
            {dictionaryText(
              activity
                .confirmed_activity_type_counts,
            )}
          </strong>
        </div>

        <div className="report-summary-row">
          <span>확정 Vision 탐지</span>

          <strong>
            {dictionaryText(
              activity
                .confirmed_detection_counts,
            )}
          </strong>
        </div>
      </section>

      <section>
        <div className="report-plan-heading">
          <h2>
            영농계획 및 최종 평가
          </h2>

          <span>
            총 {plans.length}건
          </span>
        </div>

        <div className="report-plan-list">
          {!plans.length && (
            <div className="report-empty">
              해당 기간의 영농계획이
              없습니다.
            </div>
          )}

          {visiblePlans.map((plan) => (
            <article
              className="report-plan-row"
              key={plan.plan_id}
            >
              <div className="report-plan-main">
                <strong>
                  {plan.title}
                </strong>

                <span>
                  {plan.planned_start_date}
                  {' ~ '}
                  {plan.planned_end_date}
                </span>
              </div>

              <div className="report-plan-meta">
                <span>
                  {plan.activity_type}
                </span>

                <span>
                  확정 Event{' '}
                  {plan.valid_event_count}건
                </span>

                <b>
                  {ASSESSMENT_LABEL[
                    plan.final_assessment
                  ] ||
                    '최종 평가 전'}
                </b>
              </div>
            </article>
          ))}

          {plans.length >
            visiblePlans.length && (
            <div className="report-more-plans">
              외{' '}
              {plans.length -
                visiblePlans.length}
              건의 계획은 상세 페이지에서
              표시됩니다.
            </div>
          )}
        </div>
      </section>

      <footer className="report-print-footer">
        <span>
          생성시각:{' '}
          {dateTimeText(
            report.generated_at,
          )}
        </span>

        <span>
          이 페이지는 Backend의 canonical
          report data를 표시하며 별도의
          자동 이행판정을 수행하지 않습니다.
        </span>
      </footer>
    </main>
  )
}
