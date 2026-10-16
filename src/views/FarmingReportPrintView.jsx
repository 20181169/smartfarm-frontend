import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  useSearchParams,
} from 'react-router-dom'

import {
  apiFarmingReportData, apiGetMe,
} from '../lib/api'

import './FarmingReportPrintView.css'
import { currentUser, hasPermission } from '../lib/permissions'


const ASSESSMENT_LABEL = {
  fulfilled: '이행',
  not_fulfilled: '미이행',
  unable_to_determine: '판단 불가',
}

const PHASE_LABEL = {
  waiting: '대기',
  monitoring: '모니터링',
  review_required: '검토 필요',
  excluded: '제외',
}

const EVENT_STATUS_LABEL = {
  draft: '검토 전',
  confirmed: '확정',
  cancelled: '취소',
}

const VISION_STATUS_LABEL = {
  candidate: '후보',
  pending: '검토 대기',
  confirmed: '사람 확인',
  rejected: '반려',
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


function confidenceText(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return '-'
  }

  return `${(number * 100).toFixed(1)}%`
}


function textOrDash(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '-'
  }

  return String(value)
}


function metadataText(
  value,
  suffix = '',
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '데이터 미등록'
  }

  return `${value}${suffix}`
}


function shortId(value) {
  if (!value) {
    return '-'
  }

  const text = String(value)

  return text.length > 16
    ? `${text.slice(0, 8)}…`
    : text
}


function PageHeader({
  page,
  title,
  eyebrow,
}) {
  return (
    <header className="report-page-header">
      <div>
        <div className="report-page-eyebrow">
          {eyebrow}
        </div>

        <h1>{title}</h1>
      </div>

      <div className="report-page-number">
        {String(page).padStart(2, '0')}
      </div>
    </header>
  )
}


function PageFooter({
  report,
  note,
}) {
  return (
    <footer className="report-page-footer">
      <span>
        생성시각{' '}
        {dateTimeText(
          report.generated_at,
        )}
      </span>

      <span>
        {note ||
          'Backend canonical report data 기준'}
      </span>
    </footer>
  )
}


function Field({
  label,
  value,
}) {
  return (
    <div className="report-field">
      <span>{label}</span>
      <strong>{value ?? '-'}</strong>
    </div>
  )
}


function StatCard({
  label,
  value,
  subtext,
}) {
  return (
    <div className="report-stat-card">
      <span>{label}</span>

      <strong>{value ?? 0}</strong>

      {subtext && (
        <small>{subtext}</small>
      )}
    </div>
  )
}


function StatusBadge({
  children,
  tone = 'neutral',
}) {
  return (
    <span
      className={
        `report-status report-status-${tone}`
      }
    >
      {children}
    </span>
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
       * Playwright PDF 생성에서는 Backend가
       * canonical report payload를 직접 주입한다.
       *
       * 사용자 JWT를 PDF Chromium에 전달하지 않는다.
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
        const user = currentUser(await apiGetMe())
        if (!hasPermission(user, 'report:read')) throw new Error('보고서 조회 권한이 없습니다.')
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

  /*
   * Vision 증빙 이미지가 실제 DOM에서
   * load/error 상태까지 완료된 후에만
   * Playwright Renderer에 READY를 알린다.
   */
  useEffect(() => {
    if (!report) {
      return undefined
    }

    let cancelled = false

    async function waitForImages() {
      await new Promise((resolve) => {
        requestAnimationFrame(resolve)
      })

      const images = Array.from(
        document.querySelectorAll(
          'img[data-report-evidence-image="true"]',
        ),
      )

      await Promise.all(
        images.map(
          (image) =>
            new Promise((resolve) => {
              if (image.complete) {
                resolve()
                return
              }

              image.addEventListener(
                'load',
                resolve,
                { once: true },
              )

              image.addEventListener(
                'error',
                resolve,
                { once: true },
              )
            }),
        ),
      )

      if (cancelled) {
        return
      }

      window.__FARMING_REPORT_READY__ =
        true

      document.documentElement.dataset
        .reportReady = 'true'
    }

    waitForImages()

    return () => {
      cancelled = true
    }
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

  const events = useMemo(
    () =>
      plans.flatMap((plan) =>
        (
          Array.isArray(
            plan.matched_events,
          )
            ? plan.matched_events
            : []
        ).map((event) => ({
          ...event,
          plan_id: plan.plan_id,
          plan_title: plan.title,
        })),
      ),
    [plans],
  )

  const evidence = useMemo(
    () =>
      events.flatMap((event) =>
        (
          Array.isArray(
            event.vision_evidence,
          )
            ? event.vision_evidence
            : []
        ).map((item) => ({
          ...item,
          parent_event_id:
            event.event_id,
          parent_event_title:
            event.title,
          parent_event_valid:
            event.is_valid_evidence,
        })),
      ),
    [events],
  )

  const reportImages = useMemo(
    () =>
      evidence.filter(
        (item) =>
          item.report_image_data_url,
      ),
    [evidence],
  )

  const assessmentCounts = useMemo(
    () => {
      const counts = {
        fulfilled: 0,
        not_fulfilled: 0,
        unable_to_determine: 0,
        pending: 0,
      }

      plans.forEach((plan) => {
        if (
          plan.final_assessment &&
          Object.prototype.hasOwnProperty.call(
            counts,
            plan.final_assessment,
          )
        ) {
          counts[
            plan.final_assessment
          ] += 1
        } else {
          counts.pending += 1
        }
      })

      return counts
    },
    [plans],
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

  const plant =
    report.plant || {}

  const activity =
    report.activity_summary || {}

  const visiblePlans =
    plans.slice(0, 8)

  const visibleEvidence =
    reportImages.slice(0, 4)

  const visibleEvents =
    events.slice(0, 6)

  const reviewedEvidence =
    evidence
      .filter(
        (item) =>
          item.latest_review,
      )
      .slice(0, 5)

  return (
    <main className="report-document">
      {/* PAGE 1 */}
      <section className="report-sheet report-cover">
        <div className="report-cover-top">
          <div className="report-cover-brand">
            AGRIVOLTAIC
            <br />
            COMPLIANCE REPORT
          </div>

          <div className="report-cover-page">
            01
          </div>
        </div>

        <div className="report-cover-title">
          <div className="report-cover-kicker">
            AI-BASED FARMING
            MONITORING
          </div>

          <h1>
            AI 기반 영농형 태양광
            <br />
            영농이행 정기점검 보고서
          </h1>

          <p>
            영농계획, 확인된 영농활동,
            Vision 증빙 및 사람의 최종
            평가 결과를 기반으로 작성된
            정기점검 보고서입니다.
          </p>
        </div>

        <div className="report-cover-period">
          <span>
            REPORTING PERIOD
          </span>

          <strong>
            {report.from_date}
            {' ~ '}
            {report.to_date}
          </strong>
        </div>

        <div className="report-cover-plant">
          <Field
            label="사업장"
            value={
              plant.name ||
              report.plant_id
            }
          />

          <Field
            label="주소"
            value={plant.address}
          />

          <Field
            label="설비용량"
            value={metadataText(
              plant.capacity_kw,
              ' kW',
            )}
          />

          <Field
            label="사업장 면적"
            value={metadataText(
              plant.area_m2,
              ' m²',
            )}
          />
        </div>

        <div className="report-cover-summary">
          <StatCard
            label="영농계획"
            value={report.total_plans}
          />

          <StatCard
            label="확정 영농활동"
            value={
              activity.confirmed_event_count
            }
          />

          <StatCard
            label="Vision 증빙"
            value={
              activity.vision_evidence_count
            }
          />

          <StatCard
            label="사람 최종평가 완료"
            value={
              plans.length -
              assessmentCounts.pending
            }
          />
        </div>

        <div className="report-cover-notice">
          본 보고서는 AI 탐지 결과만으로
          이행 여부를 자동 판정하지 않습니다.
          영농활동 확정과 최종 이행 평가는
          사람의 검토 결과를 기준으로 표시합니다.
        </div>

        <PageFooter
          report={report}
          note="1 / 6"
        />
      </section>


      {/* PAGE 2 */}
      <section className="report-sheet">
        <PageHeader
          page={2}
          eyebrow="FARMING PLAN STATUS"
          title="영농계획 및 이행 현황"
        />

        <div className="report-section-lead">
          보고기간 내 등록된 영농계획과
          현재 확인된 Event 및 사람의
          최종 평가 결과입니다.
        </div>

        <div className="report-stat-grid">
          <StatCard
            label="전체 계획"
            value={plans.length}
          />

          <StatCard
            label="이행"
            value={
              assessmentCounts.fulfilled
            }
          />

          <StatCard
            label="미이행"
            value={
              assessmentCounts.not_fulfilled
            }
          />

          <StatCard
            label="평가 전 / 판단 불가"
            value={
              assessmentCounts.pending +
              assessmentCounts
                .unable_to_determine
            }
          />
        </div>

        <div className="report-table-card">
          <div className="report-plan-table-head">
            <span>영농계획</span>
            <span>기간</span>
            <span>확정 Event</span>
            <span>단계</span>
            <span>최종 평가</span>
          </div>

          {visiblePlans.length === 0 && (
            <div className="report-empty">
              해당 기간의 영농계획이 없습니다.
            </div>
          )}

          {visiblePlans.map((plan) => (
            <div
              className="report-plan-table-row"
              key={plan.plan_id}
            >
              <div>
                <strong>
                  {textOrDash(
                    plan.title,
                  )}
                </strong>

                <small>
                  {textOrDash(
                    plan.activity_type,
                  )}
                </small>
              </div>

              <span>
                {plan.planned_start_date}
                <br />
                ~ {plan.planned_end_date}
              </span>

              <span>
                {plan.valid_event_count || 0}건
              </span>

              <span>
                {PHASE_LABEL[
                  plan.phase
                ] ||
                  textOrDash(
                    plan.phase,
                  )}
              </span>

              <div>
                <StatusBadge
                  tone={
                    plan.final_assessment ===
                    'fulfilled'
                      ? 'positive'
                      : plan.final_assessment ===
                          'not_fulfilled'
                        ? 'negative'
                        : 'neutral'
                  }
                >
                  {ASSESSMENT_LABEL[
                    plan.final_assessment
                  ] ||
                    '최종 평가 전'}
                </StatusBadge>
              </div>
            </div>
          ))}
        </div>

        {plans.length >
          visiblePlans.length && (
          <div className="report-continuation-note">
            추가 계획{' '}
            {plans.length -
              visiblePlans.length}
            건은 시스템 원본 데이터에서
            확인할 수 있습니다.
          </div>
        )}

        <div className="report-policy-callout">
          <strong>
            판정 원칙
          </strong>

          <p>
            AI 객체 탐지는 후보 증거이며
            자동 이행 판정에 사용되지 않습니다.
            최종 이행 여부는 등록된 영농활동과
            사람의 평가 결과를 기준으로 합니다.
          </p>
        </div>

        <PageFooter
          report={report}
          note="2 / 6"
        />
      </section>


      {/* PAGE 3 */}
      <section className="report-sheet">
        <PageHeader
          page={3}
          eyebrow="AI VISION EVIDENCE"
          title="AI 영상 증빙"
        />

        <div className="report-section-lead">
          사람 검토가 완료된 유효 영농활동에
          연결된 Vision 증빙 중 PDF용으로
          검증된 이미지를 표시합니다.
        </div>

        <div className="report-evidence-summary">
          <Field
            label="전체 Vision 증빙"
            value={
              `${activity.vision_evidence_count || 0}건`
            }
          />

          <Field
            label="PDF 포함 이미지"
            value={
              `${reportImages.length}건`
            }
          />

          <Field
            label="확정 탐지 객체"
            value={dictionaryText(
              activity
                .confirmed_detection_counts,
            )}
          />
        </div>

        <div className="report-evidence-grid">
          {visibleEvidence.length === 0 && (
            <div className="report-empty report-evidence-empty">
              PDF에 포함할 수 있는
              확인 완료 Vision 이미지가 없습니다.
            </div>
          )}

          {visibleEvidence.map(
            (item, index) => (
              <article
                className="report-evidence-card"
                key={
                  `${item.analysis_id}-${index}`
                }
              >
                <div className="report-image-frame">
                  <img
                    src={
                      item.report_image_data_url
                    }
                    alt="AI 영농활동 증빙"
                    data-report-evidence-image="true"
                  />
                </div>

                <div className="report-evidence-meta">
                  <div className="report-evidence-title">
                    <strong>
                      증빙 {index + 1}
                    </strong>

                    <StatusBadge tone="positive">
                      {VISION_STATUS_LABEL[
                        item.status
                      ] ||
                        textOrDash(
                          item.status,
                        )}
                    </StatusBadge>
                  </div>

                  <div>
                    Event:{' '}
                    {textOrDash(
                      item.parent_event_title,
                    )}
                  </div>

                  <div>
                    촬영/분석시각:{' '}
                    {dateTimeText(
                      item.evidence_at,
                    )}
                  </div>

                  <div>
                    분석 ID:{' '}
                    {shortId(
                      item.analysis_id,
                    )}
                  </div>

                  <div>
                    이미지:{' '}
                    {item.report_image_type ===
                    'annotated'
                      ? '탐지 표시 이미지'
                      : '원본 이미지'}
                  </div>

                  <div className="report-detection-tags">
                    {(
                      item.detections || []
                    )
                      .slice(0, 6)
                      .map((detection) => (
                        <span
                          key={
                            detection.detection_id
                          }
                        >
                          {detection.label}
                          {' '}
                          {confidenceText(
                            detection.confidence,
                          )}
                        </span>
                      ))}
                  </div>
                </div>
              </article>
            ),
          )}
        </div>

        {reportImages.length >
          visibleEvidence.length && (
          <div className="report-continuation-note">
            추가 이미지{' '}
            {reportImages.length -
              visibleEvidence.length}
            건은 시스템 증빙 기록에 보존됩니다.
          </div>
        )}

        <PageFooter
          report={report}
          note="3 / 6 · Vision 증빙"
        />
      </section>


      {/* PAGE 4 */}
      <section className="report-sheet">
        <PageHeader
          page={4}
          eyebrow="ACTIVITY EVENT LOG"
          title="영농활동 상세 기록"
        />

        <div className="report-section-lead">
          영농계획과 연결된 Farming Activity
          Event 및 해당 Event에 포함된
          Vision 증빙 현황입니다.
        </div>

        <div className="report-event-list">
          {visibleEvents.length === 0 && (
            <div className="report-empty">
              연결된 영농활동 Event가 없습니다.
            </div>
          )}

          {visibleEvents.map(
            (event, index) => (
              <article
                className="report-event-card"
                key={event.event_id}
              >
                <div className="report-event-index">
                  {String(
                    index + 1,
                  ).padStart(2, '0')}
                </div>

                <div className="report-event-body">
                  <div className="report-event-title">
                    <div>
                      <strong>
                        {textOrDash(
                          event.title,
                        )}
                      </strong>

                      <small>
                        계획:{' '}
                        {textOrDash(
                          event.plan_title,
                        )}
                      </small>
                    </div>

                    <StatusBadge
                      tone={
                        event.is_valid_evidence
                          ? 'positive'
                          : 'neutral'
                      }
                    >
                      {EVENT_STATUS_LABEL[
                        event.event_status
                      ] ||
                        textOrDash(
                          event.event_status,
                        )}
                    </StatusBadge>
                  </div>

                  <div className="report-event-detail-grid">
                    <Field
                      label="활동유형"
                      value={
                        event.activity_type
                      }
                    />

                    <Field
                      label="시작"
                      value={dateTimeText(
                        event.started_at,
                      )}
                    />

                    <Field
                      label="종료"
                      value={dateTimeText(
                        event.ended_at,
                      )}
                    />

                    <Field
                      label="Vision 증빙"
                      value={
                        `${
                          event
                            .vision_evidence_count ||
                          0
                        }건`
                      }
                    />
                  </div>

                  <div className="report-event-description">
                    {event.description ||
                      '등록된 설명이 없습니다.'}
                  </div>
                </div>
              </article>
            ),
          )}
        </div>

        {events.length >
          visibleEvents.length && (
          <div className="report-continuation-note">
            추가 Event{' '}
            {events.length -
              visibleEvents.length}
            건은 시스템 원본 기록에 보존됩니다.
          </div>
        )}

        <PageFooter
          report={report}
          note="4 / 6 · Farming Activity Event"
        />
      </section>


      {/* PAGE 5 */}
      <section className="report-sheet">
        <PageHeader
          page={5}
          eyebrow="HUMAN REVIEW & ASSESSMENT"
          title="검토 결과 및 최종 평가"
        />

        <div className="report-section-lead">
          AI 결과와 최종 판단을 분리하여
          표시합니다. 아래 최종 평가는
          시스템에 저장된 사람의 평가 결과만
          나타냅니다.
        </div>

        <div className="report-assessment-grid">
          <StatCard
            label="이행"
            value={
              assessmentCounts.fulfilled
            }
          />

          <StatCard
            label="미이행"
            value={
              assessmentCounts.not_fulfilled
            }
          />

          <StatCard
            label="판단 불가"
            value={
              assessmentCounts
                .unable_to_determine
            }
          />

          <StatCard
            label="최종 평가 전"
            value={
              assessmentCounts.pending
            }
          />
        </div>

        <h2 className="report-subheading">
          계획별 사람 최종 평가
        </h2>

        <div className="report-assessment-list">
          {visiblePlans.map((plan) => (
            <article
              className="report-assessment-row"
              key={plan.plan_id}
            >
              <div>
                <strong>
                  {textOrDash(
                    plan.title,
                  )}
                </strong>

                <small>
                  {plan.planned_start_date}
                  {' ~ '}
                  {plan.planned_end_date}
                </small>
              </div>

              <span>
                유효 Event{' '}
                {plan.valid_event_count || 0}건
              </span>

              <span>
                {plan.latest_assessed_at
                  ? dateTimeText(
                      plan.latest_assessed_at,
                    )
                  : '평가 기록 없음'}
              </span>

              <StatusBadge
                tone={
                  plan.final_assessment ===
                  'fulfilled'
                    ? 'positive'
                    : plan.final_assessment ===
                        'not_fulfilled'
                      ? 'negative'
                      : 'neutral'
                }
              >
                {ASSESSMENT_LABEL[
                  plan.final_assessment
                ] ||
                  '최종 평가 전'}
              </StatusBadge>
            </article>
          ))}
        </div>

        <h2 className="report-subheading">
          Vision 사람 검토 이력
        </h2>

        <div className="report-review-list">
          {reviewedEvidence.length === 0 && (
            <div className="report-empty">
              표시할 Vision 검토 이력이 없습니다.
            </div>
          )}

          {reviewedEvidence.map(
            (item) => (
              <div
                className="report-review-row"
                key={item.analysis_id}
              >
                <div>
                  <strong>
                    Analysis{' '}
                    {shortId(
                      item.analysis_id,
                    )}
                  </strong>

                  <small>
                    {dateTimeText(
                      item.latest_review
                        ?.reviewed_at,
                    )}
                  </small>
                </div>

                <StatusBadge tone="positive">
                  {VISION_STATUS_LABEL[
                    item.latest_review
                      ?.new_status
                  ] ||
                    textOrDash(
                      item.latest_review
                        ?.new_status,
                    )}
                </StatusBadge>

                <p>
                  {item.latest_review
                    ?.comment ||
                    '검토 의견 없음'}
                </p>
              </div>
            ),
          )}
        </div>

        <div className="report-policy-callout">
          <strong>
            자동 판단 없음
          </strong>

          <p>
            객체 탐지 수, confidence,
            Vision 증빙 건수만으로
            영농이행 여부를 계산하지 않습니다.
          </p>
        </div>

        <PageFooter
          report={report}
          note="5 / 6 · Human assessment"
        />
      </section>


      {/* PAGE 6 */}
      <section className="report-sheet">
        <PageHeader
          page={6}
          eyebrow="REPORT DATA & NOTES"
          title="보고서 정보 및 확인사항"
        />

        <div className="report-final-panel">
          <div className="report-final-title">
            보고서 데이터 기준
          </div>

          <div className="report-final-grid">
            <Field
              label="사업장 ID"
              value={report.plant_id}
            />

            <Field
              label="보고기간"
              value={
                `${report.from_date} ~ ${report.to_date}`
              }
            />

            <Field
              label="기준일"
              value={
                report.as_of_date
              }
            />

            <Field
              label="활동유형 필터"
              value={
                report.activity_type ||
                '전체'
              }
            />

            <Field
              label="위도"
              value={metadataText(
                plant.lat,
              )}
            />

            <Field
              label="경도"
              value={metadataText(
                plant.lng,
              )}
            />
          </div>
        </div>

        <h2 className="report-subheading">
          확인된 활동 요약
        </h2>

        <div className="report-summary-table">
          <div>
            <span>매칭 Event</span>
            <strong>
              {activity.matched_event_count ||
                0}
              건
            </strong>
          </div>

          <div>
            <span>확정 Event</span>
            <strong>
              {activity.confirmed_event_count ||
                0}
              건
            </strong>
          </div>

          <div>
            <span>무효화 Event</span>
            <strong>
              {activity.invalidated_event_count ||
                0}
              건
            </strong>
          </div>

          <div>
            <span>확정 활동유형</span>
            <strong>
              {dictionaryText(
                activity
                  .confirmed_activity_type_counts,
              )}
            </strong>
          </div>

          <div>
            <span>확정 탐지 객체</span>
            <strong>
              {dictionaryText(
                activity
                  .confirmed_detection_counts,
              )}
            </strong>
          </div>
        </div>

        <h2 className="report-subheading">
          현재 데이터 미연계 항목
        </h2>

        <div className="report-unavailable-grid">
          <Field
            label="허가번호"
            value="데이터 미연계"
          />

          <Field
            label="관리기관"
            value="데이터 미연계"
          />

          <Field
            label="신고 재배작물"
            value="데이터 미연계"
          />

          <Field
            label="실제 재배작물"
            value="데이터 미연계"
          />

          <Field
            label="실경작 면적"
            value="데이터 미연계"
          />

          <Field
            label="행정 최종조치"
            value="데이터 미연계"
          />
        </div>

        <div className="report-final-notes">
          <h2>
            보고서 해석 시 유의사항
          </h2>

          <p>
            본 보고서의 AI 탐지 정보는
            영농활동을 확인하기 위한 증빙
            자료이며 행정·법률상 적합 여부를
            AI가 자동 판단한 결과가 아닙니다.
          </p>

          <p>
            시스템에 연결되지 않은 항목은
            임의 값으로 보완하지 않고
            데이터 미연계로 표시합니다.
          </p>

          <p>
            보고서 파일은 서버에 보관되며
            생성 시점의 PDF에 대해 SHA-256
            무결성 검증값이 별도로 관리됩니다.
          </p>
        </div>

        <div className="report-signature-area">
          <div>
            <span>검토자</span>
            <strong>시스템 검토 기록 참조</strong>
          </div>

          <div>
            <span>비고</span>
            <strong>
              추가 확인사항은 원본 시스템 기록 참조
            </strong>
          </div>
        </div>

        <PageFooter
          report={report}
          note="6 / 6 · End of report"
        />
      </section>
    </main>
  )
}
