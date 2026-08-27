import { FileDown, FileText } from 'lucide-react'
import { useApp } from '../context/useApp'
import { efficiency, genRatio } from '../lib/format'

export default function ReportView() {
  const { plant } = useApp()
  const summary = [
    { label: '종합 성능지수(PR)', value: '84.2 %', color: 'var(--sage-strong)' },
    { label: '발전 효율', value: `${efficiency(plant)} %`, color: 'var(--blue)' },
    { label: '목표 대비', value: `${genRatio(plant)} %`, color: 'var(--terracotta)' },
    { label: '월 예상 수익', value: plant.smpMonthly, color: 'var(--violet)' },
  ]

  return (
    <div className="view stack">
      <div>
        <div className="view-title">정기 발전 · AI 수익 분석 보고서</div>
        <div className="view-sub">{plant.name} · 2026년 7월 기준</div>
      </div>

      <div className="grid grid-4">
        {summary.map((s) => (
          <div className="kpi" key={s.label}>
            <span className="kpi-label">{s.label}</span>
            <div className="kpi-value" style={{ color: s.color, fontSize: 24 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><FileText /> 월간 종합 분석</span>
          <button className="btn-terracotta" onClick={() => alert('보고서 PDF 다운로드 시작')}><FileDown /> PDF 다운로드</button>
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.8 }}>
          2026년 7월 종합 발전 성능 지수(PR)는 <b className="text-sage">84.2%</b>로 우수 수준을 유지하고 있습니다.
          AI 고장 진단 엔진에 의해 <b>{plant.aiSubject}</b>가 감지되었으며, 접속반 3번 세척 작업을 완료하면
          월간 약 <b className="text-terra">+25만원</b>의 추가 수익 개선이 예상됩니다.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8, marginTop: 4 }}>
          하부 작물({plant.cropType}) 생육 지수는 <b className="text-sage">{plant.cropGrowthIndex}</b>로 양호하며,
          차광률 {plant.shadingRatio} 조건에서 영농·발전 병행 효율이 안정적으로 확보되고 있습니다.
        </p>
      </div>
    </div>
  )
}
