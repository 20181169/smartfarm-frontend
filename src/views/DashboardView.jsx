import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Sun, Coins, Leaf, Activity, Cpu, Sprout,
  BrainCircuit, TrendingUp, Info,
} from 'lucide-react'
import { useApp } from '../context/useApp'
import { efficiency, genRatio, co2Kg, assetRevenue, nf } from '../lib/format'
import { YEARLY_RECORDS, REC_MARKET, SMP_MARKET } from '../data/market'
import {
  HourlyGenChart, MonthlyTrendChart, YearlyGenChart, RecMarketChart, SmpMarketChart,
} from '../components/charts'

const yearlyTotal = YEARLY_RECORDS.reduce((s, r) => s + r.genKwh, 0)

function Meter({ pct, gradient }) {
  return (
    <div className="meter">
      <span style={{ width: `${Math.min(100, Math.max(8, pct))}%`, background: gradient }} />
    </div>
  )
}

function GenCard({ title, color, value, unit, chart, tableHead, tableRows, foot }) {
  const [mode, setMode] = useState('chart')
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
        <div className="segmented">
          <button className={mode === 'chart' ? 'active' : ''} onClick={() => setMode('chart')}>차트</button>
          <button className={mode === 'table' ? 'active' : ''} onClick={() => setMode('table')}>표</button>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 800, color }}>{value}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>{unit}</span>
      </div>
      {mode === 'chart' ? (
        <div className="chart-box" style={{ height: 140 }}>{chart}</div>
      ) : (
        <div className="table-wrap" style={{ maxHeight: 140, overflowY: 'auto' }}>
          <table className="data">
            <thead><tr>{tableHead.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{tableRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 8, marginTop: 10 }}>
        {foot.map(([k, v], i) => (
          <div className="info-row" key={i} style={{ fontSize: 12 }}>
            <span>{k}</span><b>{v}</b>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardView() {
  const { plant, weather, isLive } = useApp()
  const navigate = useNavigate()
  const eff = efficiency(plant)
  const ratio = genRatio(plant)
  const asset = assetRevenue(plant)

  const kpis = [
    {
      label: '실시간 현재 출력', icon: Zap, tint: 'var(--sage)', bg: 'var(--sage-soft)',
      value: plant.currentPowerKw.toFixed(1), unit: 'kW', color: 'var(--sage-strong)',
      meterLabel: '발전 효율', meterVal: `${eff}%`,
      meterPct: eff * 3, gradient: 'linear-gradient(90deg,#10b981,#f59e0b,#ef4444)',
    },
    {
      label: '금일 발전량', icon: Sun, tint: 'var(--blue)', bg: 'color-mix(in srgb, var(--blue) 14%, transparent)',
      value: nf(plant.todayGenKwh), unit: 'kWh', color: 'var(--blue)',
      meterLabel: `목표(${plant.targetGenKwh}kWh) 대비`, meterVal: `${ratio}%`,
      meterPct: +ratio, gradient: 'linear-gradient(90deg,#3b82f6,#10b981)',
    },
    {
      label: '금일 예상 수익', icon: Coins, tint: 'var(--terracotta)', bg: 'var(--terracotta-soft)',
      value: plant.todayRevenueMan.toFixed(1), unit: '만원', color: 'var(--terracotta)',
      meterLabel: 'SMP+REC 연산', meterVal: '정상',
      meterPct: 82, gradient: 'linear-gradient(90deg,#f59e0b,#10b981)',
    },
    {
      label: '온실가스 감축량', icon: Leaf, tint: 'var(--emerald)', bg: 'color-mix(in srgb, var(--emerald) 14%, transparent)',
      value: plant.co2ReducedTon.toFixed(2), unit: 'Ton', color: 'var(--sage-strong)',
      meterLabel: '금일 감축량', meterVal: `${co2Kg(plant)} kgCO₂`,
      meterPct: 70, gradient: 'linear-gradient(90deg,#10b981,#059669)',
    },
  ]

  const assetTiles = [
    { label: '금일 발전 수익', value: asset.today, co2: asset.todayCo2, color: 'var(--terracotta)' },
    { label: '금월 발전 수익', value: asset.monthly, co2: asset.monthlyCo2, color: 'var(--sage-strong)' },
    { label: '금년 발전 수익', value: asset.yearly, co2: asset.yearlyCo2, color: 'var(--blue)' },
    { label: '누적 발전 수익', value: asset.total, co2: asset.totalCo2, color: 'var(--violet)' },
  ]

  return (
    <div className="view stack">
      <div>
        <div className="view-title" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {plant.name} 발전소 현황
          {isLive && <span className="badge badge-active" style={{ fontSize: 11 }}>🛰️ 백엔드 실시간</span>}
        </div>
        <div className="view-sub">
          {isLive
            ? '인버터·환경센서 실시간 텔레메트리 (백엔드 연동) · 시세/이력은 데모'
            : '실시간 발전 · 수익 · AI 진단 통합 모니터링'}
        </div>
      </div>

      {/* 날씨 스트립 */}
      <div className="weather-strip">
        <div className="weather-strip-top">
          <span style={{ fontWeight: 800 }}>{plant.name} 기상 관측</span>
          <span className="badge badge-sync">
            {weather?.source === 'sensor' ? '🛰️ 백엔드 센서 실시간' : '🟢 기상청 실시간 동기화'}
            {weather ? ` (${weather.syncedAt})` : ''}
          </span>
        </div>
        <div className="weather-metrics">
          <span>날씨 <b>{weather?.cond ?? '☀️ 맑음'}</b></span>
          <span>기온 <b>{weather?.temp ?? plant.cardTemp}</b></span>
          <span>습도 <b>{weather?.humidity ?? '62%'}</b></span>
          <span>풍속 <b>{weather?.wind ?? '1.2m/s'}</b></span>
          <span>일출 <b>{weather?.sunrise ?? '05:28'}</b></span>
          <span>일몰 <b>{weather?.sunset ?? '19:51'}</b></span>
          <span>경사일사량 <b className="text-terra">{weather?.inclinedIrr ?? '485 W/m²'}</b></span>
          <span>수평일사량 <b className="text-sage">{weather?.horizontalIrr ?? '460 W/m²'}</b></span>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-kpi">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="kpi-top">
              <span className="kpi-label">{k.label}</span>
              <span className="kpi-chip" style={{ background: k.bg, color: k.tint }}><k.icon /></span>
            </div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}<small>{k.unit}</small></div>
            <div>
              <div className="kpi-meter-row"><span className="text-muted">{k.meterLabel}</span><span style={{ color: k.tint }}>{k.meterVal}</span></div>
              <Meter pct={k.meterPct} gradient={k.gradient} />
            </div>
          </div>
        ))}
      </div>

      {/* AI 배너 */}
      <div className="ai-banner">
        <div>
          <span className="ai-banner-tag"><BrainCircuit /> AI 고장 자동 진단 엔진</span>
          <span className="badge badge-warning" style={{ marginLeft: 8 }}>AI 진단 완료</span>
          <div className="ai-subject">{plant.aiSubject}</div>
          <div className="ai-desc">{plant.aiDesc}</div>
        </div>
        <button className="btn-terracotta" onClick={() => navigate('/report')}><TrendingUp /> AI 진단 리포트</button>
      </div>

      {/* 자산 수익 */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Coins /> 발전 자산 수익 현황 [SMP + (REC × 가중치 1.5)] & 친환경 ESG</span>
          <span className="text-muted hide-sm" style={{ fontSize: 12 }}>
            SMP <b className="text-terra">141.04원</b> · REC <b className="text-sage">71,800원</b> (×1.5)
          </span>
        </div>
        <div className="grid grid-4">
          {assetTiles.map((t) => (
            <div key={t.label} style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)' }}>{t.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.color, margin: '5px 0' }}>{t.value}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>CO₂ {t.co2}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 위젯 그리드 */}
      <div className="grid grid-3">
        {/* 변환효율 & 계측 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Activity /> 변환효율 & 계측 상태</span>
            <span className="badge badge-active">정상</span>
          </div>
          <div className="info-list">
            <div className="info-row"><span>인버터 변환효율</span><b className="text-terra" style={{ fontSize: 20 }}>99.9 <small style={{ fontSize: 12 }}>%</small></b></div>
            <div className="info-row"><span>DC 입력전력</span><b className="text-sage">{plant.dcPower}</b></div>
            <div className="info-row"><span>AC 출력전력</span><b>{plant.acPower}</b></div>
            <div className="info-row"><span>계통 주파수</span><b>{plant.acFreq}</b></div>
          </div>
        </div>

        {/* 인버터 관제 mini table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Cpu /> 인버터 관제 상태</span>
            <button className="icon-btn" onClick={() => navigate('/equipment')}>+ 더 보기</button>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>번호</th><th>출력(kW)</th><th>발전시간</th><th>일발전량</th><th>상태</th><th>통신</th></tr></thead>
              <tbody>
                {plant.inverters.map((inv) => (
                  <tr key={inv.id}>
                    <td>#{inv.id}</td>
                    <td><strong>{inv.powerKw}</strong></td>
                    <td>{inv.runHours}</td>
                    <td><strong>{inv.todayGenKwh}</strong></td>
                    <td><span className="badge badge-active">가동</span></td>
                    <td className="text-muted" style={{ fontSize: 11 }}>{inv.comm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 작물·토양 센서 (영농형 특화) */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Sprout /> 작물 · 토양 센서</span>
            <span className="badge badge-active">생육 양호</span>
          </div>
          <div className="info-list">
            <div className="info-row"><span>재배 작물</span><b>{plant.cropType}</b></div>
            <div className="info-row"><span>차광률</span><b>{plant.shadingRatio}</b></div>
            <div className="info-row"><span>토양 수분</span><b className="text-blue">{plant.soilMoisture}</b></div>
            <div className="info-row"><span>토양 온도</span><b>{plant.soilTemp}</b></div>
            <div className="info-row"><span>작물 생육 지수</span><b className="text-sage">{plant.cropGrowthIndex}</b></div>
          </div>
        </div>

        {/* 일 발전량 */}
        <GenCard
          title="일 발전량" color="var(--blue)" value={nf(plant.todayGenKwh)} unit="kWh"
          chart={<HourlyGenChart hourly={plant.hourly} predict={plant.hourlyPredict} />}
          tableHead={['시간', '금일(kWh)', '전일(kWh)']}
          tableRows={['06h', '08h', '10h', '12h', '14h', '16h', '18h'].map((h, i) => [h, `${plant.hourly[i] ?? 0}`, `${Math.round((plant.hourly[i] ?? 0) * 0.9)}`])}
          foot={[['전일 발전량', `${nf(plant.yesterdayGenKwh)} kWh`], ['금일 발전시간', `${plant.todayGenHours} 시간`]]}
        />

        {/* 월 발전량 */}
        <GenCard
          title="월 발전량" color="var(--teal)" value={plant.monthlyGenKwh?.replace(' kWh', '') ?? '-'} unit="kWh"
          chart={<MonthlyTrendChart trend={plant.monthlyTrend} />}
          tableHead={['일자', '금월(kWh)', '전월(kWh)']}
          tableRows={[0, 4, 9, 14, 19].map((i) => [`${i + 1}일`, `${plant.monthlyTrend?.[i] ?? '-'}`, `${Math.round((plant.monthlyTrend?.[i] ?? 0) * 0.92)}`])}
          foot={[['월 SMP 수익', plant.smpMonthly], ['누적 REC', plant.recAcc]]}
        />

        {/* 연 발전량 */}
        <GenCard
          title="연 발전량" color="var(--lime)" value={nf(yearlyTotal)} unit="kWh"
          chart={<YearlyGenChart />}
          tableHead={['월별', '발전량(kWh)', '일평균시간']}
          tableRows={YEARLY_RECORDS.map((r) => [r.month, nf(r.genKwh), `${r.avgHours} h`])}
          foot={[['금년 누적', `${nf(yearlyTotal)} kWh`], ['월 평균', `${nf(Math.round(yearlyTotal / YEARLY_RECORDS.length))} kWh`]]}
        />

        {/* RPS 예상 금액 */}
        <div className="card">
          <div className="card-header"><span className="card-title"><Coins /> 예상 발전 금액 (RPS)</span></div>
          <div className="info-list">
            <div style={{ fontWeight: 800, color: 'var(--sage-strong)' }}>SMP (전력계통 한계가격)</div>
            <div className="info-row"><span>일 발전금액</span><b className="text-sage">{plant.smpDaily}</b></div>
            <div className="info-row"><span>월 발전금액</span><b className="text-sage">{plant.smpMonthly}</b></div>
            <hr style={{ border: 'none', borderTop: '1px dashed var(--border)', margin: '2px 0' }} />
            <div style={{ fontWeight: 800, color: 'var(--sage-strong)' }}>REC (신재생에너지 인증서)</div>
            <div className="info-row"><span>발전금액</span><b className="text-terra">{plant.recRevenue}</b></div>
            <div className="info-row"><span>누적 REC</span><b className="text-sage">{plant.recAcc}</b></div>
          </div>
        </div>

        {/* REC 시장 */}
        <div className="card">
          <div className="card-header"><span className="card-title"><TrendingUp /> REC 시장 동향</span><span className="badge badge-sync">🟢 KPX 시세</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: 10, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700 }}>현물시장 종가</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--terracotta)' }}>{nf(REC_MARKET.price)} <small style={{ fontSize: 11 }}>원/REC</small></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="text-emerald" style={{ fontWeight: 800, fontSize: 11.5 }}>▲ {nf(REC_MARKET.change)}원 ({REC_MARKET.pct})</span>
              <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700 }}>거래량 {REC_MARKET.volume}</div>
            </div>
          </div>
          <div className="chart-box" style={{ height: 140 }}><RecMarketChart /></div>
        </div>

        {/* SMP 시장 */}
        <div className="card">
          <div className="card-header"><span className="card-title"><TrendingUp /> 실시간 SMP 전력시장</span><span className="badge badge-sync">🟢 KPX 시세</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: 10, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700 }}>육지 SMP 단가</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--terracotta)' }}>{SMP_MARKET.landPrice} <small style={{ fontSize: 11 }}>원/kWh</small></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="text-emerald" style={{ fontWeight: 800, fontSize: 11.5 }}>{SMP_MARKET.change}</span>
              <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700 }}>제주 SMP {SMP_MARKET.jejuPrice}원</div>
            </div>
          </div>
          <div className="chart-box" style={{ height: 140 }}><SmpMarketChart /></div>
        </div>

        {/* DC/AC 계측 */}
        <div className="card">
          <div className="card-header"><span className="card-title"><Zap /> 인버터 DC & AC 계측</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            <div>
              <div style={{ fontWeight: 800, color: 'var(--sage-strong)', marginBottom: 6 }}>DC 입력</div>
              <div className="info-row"><span>전력</span><b>{plant.dcPower}</b></div>
              <div className="info-row"><span>전압</span><b>{plant.dcVolt}</b></div>
              <div className="info-row"><span>전류</span><b>{plant.dcCurr}</b></div>
            </div>
            <div>
              <div style={{ fontWeight: 800, color: 'var(--sage-strong)', marginBottom: 6 }}>AC 출력</div>
              <div className="info-row"><span>출력</span><b>{plant.acPower}</b></div>
              <div className="info-row"><span>전압</span><b>{plant.acVolt}</b></div>
              <div className="info-row"><span>주파수</span><b>{plant.acFreq}</b></div>
            </div>
          </div>
        </div>

        {/* 발전소 정보 */}
        <div className="card">
          <div className="card-header"><span className="card-title"><Info /> 발전소 정보</span></div>
          <div className="info-list" style={{ lineHeight: 1.5 }}>
            <div className="info-row"><span>사업주</span><b>{plant.owner}</b></div>
            <div className="info-row"><span>안전관리자</span><b>{plant.manager}</b></div>
            <div className="info-row"><span>시공사</span><b>{plant.contractor}</b></div>
            <div className="info-row"><span>소재지</span><b>{plant.location}</b></div>
            <div className="info-row"><span>인버터</span><b>{plant.inverterModel}</b></div>
          </div>
        </div>
      </div>
    </div>
  )
}
