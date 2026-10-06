import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Sun, Coins, Leaf, Activity, Cpu, Sprout,
  BrainCircuit, TrendingUp, Info, PlugZap,
} from 'lucide-react'
import { useApp } from '../context/useApp'
import { efficiency, genRatio, co2Kg, assetRevenue, nf, smpWon, recWon } from '../lib/format'
import { liveStatus, INV_STATE_BADGE } from '../lib/liveStatus'
import { YEARLY_RECORDS, REC_MARKET, SMP_MARKET, RPS_PRICE } from '../data/market'
import { ymdLabel } from '../lib/kpx'
import {
  HourlyGenChart, MonthlyTrendChart, YearlyGenChart, RecMarketChart, SmpMarketChart,
} from '../components/charts'

const yearlyTotal = YEARLY_RECORDS.reduce((s, r) => s + r.genKwh, 0)

// 시세 변동 표기: ▲ 1,200원 (+1.63%) / 비교 대상이 없으면 '-'
function ChangeText({ change, pct, digits = 0, suffix = '' }) {
  if (change == null) return <span className="text-muted" style={{ fontWeight: 800, fontSize: 11.5 }}>-</span>
  const up = change >= 0
  const abs = Math.abs(change)
  return (
    <span className={up ? 'text-emerald' : 'text-terra'} style={{ fontWeight: 800, fontSize: 11.5 }}>
      {up ? '▲' : '▼'} {digits ? abs.toFixed(digits) : nf(Math.round(abs))}원
      {pct != null && ` (${up ? '+' : '-'}${Math.abs(pct).toFixed(2)}%)`}{suffix}
    </span>
  )
}

// KPX 시세를 못 받았을 때의 배지 — 사유(키 미설정·조회 실패)는 마우스를 올리면 보인다
function DemoMarketBadge({ market }) {
  const why = market.status === 'nokey' ? '공공데이터포털 인증키(VITE_DATA_GO_KR_KEY) 미설정' : market.error || '시세 불러오는 중'
  return <span className="badge badge-neutral" title={why}>데모 시세</span>
}

// '… 발전소' 로 끝나는 이름에 '발전소'가 또 붙지 않게
const titleOf = (name) => `${name}${/발전소$/.test(name) ? '' : ' 발전소'} 현황`

function Meter({ pct, gradient }) {
  return (
    <div className="meter">
      <span style={{ width: `${Math.min(100, Math.max(8, pct))}%`, background: gradient }} />
    </div>
  )
}

function GenCard({ title, badge, color, value, unit, chart, tableHead, tableRows, foot }) {
  const [mode, setMode] = useState('chart')
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          {title}
          {badge && <span className="badge badge-neutral" style={{ marginLeft: 6, fontSize: 10.5 }}>{badge}</span>}
        </span>
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

// 센서 상태 배지: 전부 응답 없음(예보값 표시) / 일부 응답 없음 / 실시간
const NO_COORDS_HINT = '백엔드에 발전소 위도·경도가 등록되지 않아 날씨 예보를 조회하지 않습니다(다른 지역 예보로 대신 채우지 않음).'
// 예보가 어느 좌표 기준인지 그대로 보여준다(좌표가 이상하면 값도 이상하게 보이는 이유를 알 수 있게)
const forecastAtText = (w) => (w?.forecastAt ? `예보 위치: 위도 ${w.forecastAt.lat}, 경도 ${w.forecastAt.lng} (백엔드 등록 좌표)` : null)

function sensorBadge(weather) {
  if (weather?.source === 'none') {
    return weather.noCoords
      ? { cls: 'badge-neutral', text: '📍 발전소 좌표 미등록 · 날씨 예보 없음', title: NO_COORDS_HINT }
      : { cls: 'badge-neutral', text: '날씨 예보 불러오는 중' }
  }
  if (weather?.source !== 'sensor') return { cls: 'badge-sync', text: '🟢 기상청 실시간 동기화' }
  const down = weather.staleSeqs || []
  if (weather.stale) {
    const fc = weather.forecast ? ' · 예보값 표시' : weather.noCoords ? ' · 좌표 미등록(예보 없음)' : ''
    return {
      cls: 'badge-warning',
      text: `🛰️ 환경센서 응답 없음${fc} · 마지막 ${weather.syncedAt}`,
      title: weather.noCoords && !weather.forecast ? NO_COORDS_HINT : undefined,
    }
  }
  if (down.length) {
    return { cls: 'badge-warning', text: `🛰️ 백엔드 센서 · ${down.length}/${weather.sensorCount}대 응답 없음 (${weather.syncedAt})` }
  }
  return { cls: 'badge-sync', text: `🛰️ 백엔드 센서 실시간 (${weather.syncedAt})` }
}

function WeatherStrip({ plant, weather }) {
  const badge = sensorBadge(weather)
  return (
    <div className="weather-strip">
      <div className="weather-strip-top">
        <span style={{ fontWeight: 800 }}>
          {plant.name} 기상 관측
          {weather?.forecastAt && (
            <span className="text-muted" style={{ fontSize: 11, fontWeight: 600, marginLeft: 8 }}>
              예보 좌표 {weather.forecastAt.lat}, {weather.forecastAt.lng}
            </span>
          )}
        </span>
        <span
          className={`badge ${badge.cls}`}
          title={[weather?.staleSeqs?.length ? `응답 없는 센서: seq ${weather.staleSeqs.join(', ')}` : null, badge.title, forecastAtText(weather)].filter(Boolean).join(' / ') || undefined}
        >
          {badge.text}
          {weather?.source === 'meteo' ? ` (${weather.syncedAt})` : ''}
        </span>
      </div>
      <div className="weather-metrics">
        <span>날씨 <b>{weather?.cond ?? '☀️ 맑음'}</b></span>
        <span>기온 <b>{weather?.temp ?? plant.cardTemp}</b></span>
        {weather?.surfaceTemp && <span>모듈온도 <b>{weather.surfaceTemp}</b></span>}
        <span>습도 <b>{weather?.humidity ?? '62%'}</b></span>
        <span>풍속 <b>{weather?.wind ?? '1.2m/s'}</b></span>
        <span>일출 <b>{weather?.sunrise ?? '05:28'}</b></span>
        <span>일몰 <b>{weather?.sunset ?? '19:51'}</b></span>
        <span>경사일사량 <b className="text-terra">{weather?.inclinedIrr ?? '485 W/m²'}</b></span>
        <span>수평일사량 <b className="text-sage">{weather?.horizontalIrr ?? '460 W/m²'}</b></span>
      </div>
    </div>
  )
}

// 사업주·안전관리자·시공사: 백엔드 발전소는 /plants 의 owner_name·safety_manager_name·contractor_name (미등록이면 '-')
function PlantInfoCard({ plant }) {
  const v = (x) => x ?? '-'
  return (
    <div className="card">
      <div className="card-header"><span className="card-title"><Info /> 발전소 정보</span></div>
      <div className="info-list" style={{ lineHeight: 1.5 }}>
        <div className="info-row"><span>사업주</span><b>{v(plant.owner)}</b></div>
        <div className="info-row"><span>안전관리자</span><b>{v(plant.manager)}</b></div>
        <div className="info-row"><span>시공사</span><b>{v(plant.contractor)}</b></div>
        <div className="info-row"><span>소재지</span><b>{v(plant.location)}</b></div>
        {plant._backend && (
          <div className="info-row"><span>설비용량</span><b>{plant.capacityKw != null ? `${plant.capacityKw} kW` : '-'}</b></div>
        )}
        <div className="info-row"><span>인버터</span><b>{v(plant.inverterModel)}</b></div>
      </div>
    </div>
  )
}

const NO_DATA_MSG = {
  loading: '계측 데이터를 불러오는 중…',
  error: '계측 데이터를 불러오지 못했습니다. 30초마다 다시 시도합니다.',
}

// 백엔드 발전소인데 계측 데이터가 없으면(장비 미연동 등) 데모 수치 대신 빈 상태를 보여준다.
function NoDataDashboard({ plant, weather, liveState }) {
  const navigate = useNavigate()
  return (
    <div className="view stack">
      <div>
        <div className="view-title" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {titleOf(plant.name)}
          {liveState !== 'loading' && <span className="badge badge-neutral" style={{ fontSize: 11 }}>계측 데이터 없음</span>}
        </div>
        <div className="view-sub">{NO_DATA_MSG[liveState] || '연동된 인버터·환경센서 계측 데이터가 없습니다.'}</div>
      </div>

      <WeatherStrip plant={plant} weather={weather} />

      {liveState !== 'loading' && (
        <div className="card" style={{ textAlign: 'center', padding: '28px 16px' }}>
          <PlugZap size={28} style={{ color: 'var(--text-3)' }} />
          <div style={{ fontWeight: 800, marginTop: 8 }}>
            {liveState === 'error' ? '계측 데이터 조회 실패' : '이 발전소에는 아직 수신된 계측 데이터가 없습니다'}
          </div>
          <div className="text-muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
            인버터·환경센서 장비 등록과 RTU 수집 설정이 끝나면 실시간 출력·발전량이 이 화면에 표시됩니다.
          </div>
          <button className="icon-btn" style={{ marginTop: 12 }} onClick={() => navigate('/comparison')}>
            발전소별 데이터 상태 보기
          </button>
        </div>
      )}

      <div className="grid grid-3">
        <PlantInfoCard plant={plant} />
      </div>
    </div>
  )
}

export default function DashboardView() {
  const { plant, weather, isLive, liveState, market } = useApp()
  const navigate = useNavigate()

  if (plant._backend && !isLive) {
    return <NoDataDashboard plant={plant} weather={weather} liveState={liveState} />
  }

  const eff = efficiency(plant) // 현재출력을 모르면 '-'
  const ratio = genRatio(plant) // 금일 발전량을 모르면 '-'
  const kg = co2Kg(plant)
  const gen = plant.todayGenKwh // 실연동에서 계산 불가면 null(오늘 내내 통신 두절 등)
  const asset = assetRevenue(plant)
  const status = isLive ? liveStatus(plant, weather) : null
  const statusBadge = status && (status.level === 'ok' ? 'badge-active' : 'badge-warning')
  const hhmm = (iso) => new Date(iso).toTimeString().slice(0, 5)
  const genLabel = !isLive ? '금일 발전량'
    : gen == null ? '금일 발전량 (확인 불가)'
      : plant._todayGenUntil ? `금일 발전량 (${hhmm(plant._todayGenUntil)}까지 수신분)` : '금일 발전량'

  // 수익 단가: 실연동이면 KPX 시세(SMP 최근 게시일 육지 평균·REC 최근 거래일 종가, 못 받은 쪽은 데모 단가),
  // 데모 발전소는 데모 수익값과 맞도록 데모 단가.
  const price = isLive ? market.price : RPS_PRICE
  const kpxSmp = isLive && !!market.smp
  const kpxRec = isLive && !!market.rec
  const priceSource = kpxSmp && kpxRec ? 'KPX 시세' : kpxSmp || kpxRec ? 'KPX 시세·데모 단가' : '데모 단가'

  // RPS 카드: 실연동이면 금일 실측 발전량 × 단가, 이력이 필요한 월·누적 값은 '-'
  const won = (f) => (gen == null ? '-' : `${nf(Math.round(f(gen, price)))} 원`)
  const rps = isLive
    ? {
        smpDaily: won(smpWon),
        smpMonthly: '-',
        recLabel: '일 발전금액',
        recRevenue: won(recWon),
        recAcc: '-',
      }
    : {
        smpDaily: plant.smpDaily,
        smpMonthly: plant.smpMonthly,
        recLabel: '발전금액',
        recRevenue: plant.recRevenue,
        recAcc: plant.recAcc,
      }

  const kpis = [
    {
      label: '실시간 현재 출력', icon: Zap, tint: 'var(--sage)', bg: 'var(--sage-soft)',
      value: plant.currentPowerKw == null ? '-' : plant.currentPowerKw.toFixed(1),
      unit: plant.currentPowerKw == null ? '' : 'kW', color: 'var(--sage-strong)',
      meterLabel: '발전 효율', meterVal: eff === '-' ? '-' : `${eff}%`,
      meterPct: eff === '-' ? 0 : eff * 3, gradient: 'linear-gradient(90deg,#10b981,#f59e0b,#ef4444)',
    },
    {
      // 실연동에서 계산할 수 없으면(오늘 내내 통신 두절 등) '확인 불가' — 0 이나 템플릿 값으로 채우지 않는다
      label: genLabel,
      icon: Sun, tint: 'var(--blue)', bg: 'color-mix(in srgb, var(--blue) 14%, transparent)',
      value: gen == null ? '-' : nf(gen), unit: gen == null ? '' : 'kWh', color: 'var(--blue)',
      meterLabel: `목표(${plant.targetGenKwh}kWh) 대비`, meterVal: ratio === '-' ? '-' : `${ratio}%`,
      meterPct: ratio === '-' ? 0 : +ratio, gradient: 'linear-gradient(90deg,#3b82f6,#10b981)',
    },
    {
      label: '금일 예상 수익', icon: Coins, tint: 'var(--terracotta)', bg: 'var(--terracotta-soft)',
      value: plant.todayRevenueMan == null ? '-' : plant.todayRevenueMan.toFixed(1),
      unit: plant.todayRevenueMan == null ? '' : '만원', color: 'var(--terracotta)',
      meterLabel: 'SMP+REC 연산', meterVal: plant.todayRevenueMan == null ? '-' : '정상',
      meterPct: 82, gradient: 'linear-gradient(90deg,#f59e0b,#10b981)',
    },
    {
      label: '온실가스 감축량', icon: Leaf, tint: 'var(--emerald)', bg: 'color-mix(in srgb, var(--emerald) 14%, transparent)',
      value: plant.co2ReducedTon == null ? '-' : plant.co2ReducedTon.toFixed(2),
      unit: plant.co2ReducedTon == null ? '' : 'Ton', color: 'var(--sage-strong)',
      meterLabel: '금일 감축량', meterVal: kg === '-' ? '-' : `${kg} kgCO₂`,
      meterPct: 70, gradient: 'linear-gradient(90deg,#10b981,#059669)',
    },
  ]

  const assetTiles = [
    { label: '금일 발전 수익', value: asset.today, co2: asset.todayCo2, color: 'var(--terracotta)' },
    { label: '금월 발전 수익', value: asset.monthly, co2: asset.monthlyCo2, color: 'var(--sage-strong)' },
    { label: '금년 발전 수익', value: asset.yearly, co2: asset.yearlyCo2, color: 'var(--blue)' },
    { label: '누적 발전 수익', value: asset.total, co2: asset.totalCo2, color: 'var(--violet)' },
  ]

  // 실발전소 화면에서 데모 값인 카드 표시 (시세·이력·작물은 백엔드 미제공)
  const demoBadge = plant._backend ? '데모' : null

  return (
    <div className="view stack">
      <div>
        <div className="view-title" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {titleOf(plant.name)}
          {isLive && (plant._stale
            ? <span className="badge badge-warning" style={{ fontSize: 11 }}>🛰️ 백엔드 연결됨 · 수신 지연</span>
            : <span className="badge badge-active" style={{ fontSize: 11 }}>🛰️ 백엔드 실시간</span>)}
          {isLive && liveState === 'error' && (
            <span className="badge badge-warning" style={{ fontSize: 11 }}>갱신 실패 · 마지막 수신값 표시</span>
          )}
        </div>
        <div className="view-sub">
          {isLive
            ? plant._stale
              ? `백엔드 연동됨 · 계측 데이터 수신 지연 (마지막 수신: ${plant._lastUpdatedAt ? new Date(plant._lastUpdatedAt).toLocaleString('ko-KR') : '확인 불가'}) · 시세/이력/작물은 데모`
              : `인버터·환경센서 실시간 텔레메트리 (백엔드 연동)${
                  plant._invNoResponse
                    ? ` · 인버터 ${plant._invNoResponse}/${plant._invTotal}대 통신 두절`
                    : plant._invNoData ? ` · 인버터 ${plant._invNoData}/${plant._invTotal}대 계측값 없음(정지 또는 통신 무응답)` : ''
                } · 시세/이력/작물은 데모`
            : '실시간 발전 · 수익 · AI 진단 통합 모니터링'}
        </div>
      </div>

      <WeatherStrip plant={plant} weather={weather} />

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

      {/* 상태 배너: 실연동은 실측 기반 규칙 진단, 데모는 AI 진단 문구 */}
      {status ? (
        <div className="ai-banner">
          <div>
            <span className="ai-banner-tag"><Activity /> 실측 기반 상태 진단</span>
            <span className={`badge ${statusBadge}`} style={{ marginLeft: 8 }}>{status.badge}</span>
            <div className="ai-subject">{status.subject}</div>
            <div className="ai-desc">{status.desc}</div>
          </div>
          <button className="btn-terracotta" onClick={() => navigate('/equipment')}><Cpu /> 설비 현황</button>
        </div>
      ) : (
        <div className="ai-banner">
          <div>
            <span className="ai-banner-tag"><BrainCircuit /> AI 고장 자동 진단 엔진</span>
            <span className="badge badge-warning" style={{ marginLeft: 8 }}>AI 진단 완료</span>
            <div className="ai-subject">{plant.aiSubject}</div>
            <div className="ai-desc">{plant.aiDesc}</div>
          </div>
          <button className="btn-terracotta" onClick={() => navigate('/report')}><TrendingUp /> AI 진단 리포트</button>
        </div>
      )}

      {/* 자산 수익 */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Coins /> 발전 자산 수익 현황 [SMP + (REC × 가중치 {price.weight})] & 친환경 ESG</span>
          <span className="text-muted hide-sm" style={{ fontSize: 12 }}>
            SMP <b className="text-terra">{price.smp.toFixed(2)}원</b>{kpxSmp && ` (${ymdLabel(market.smp.date)} 평균)`}
            {' · '}REC <b className="text-sage">{nf(Math.round(price.rec))}원</b>{kpxRec && ` (${ymdLabel(market.rec.date)} 종가)`} (×{price.weight})
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
        {isLive && (
          <div className="text-muted" style={{ fontSize: 11.5, marginTop: 10 }}>
            금일 수익은 실측 발전량 × 위 단가({priceSource === 'KPX 시세'
              ? `KPX 시세: SMP ${ymdLabel(market.smp.date)} 육지 평균 · REC ${ymdLabel(market.rec.date)} 종가`
              : priceSource})로 계산합니다.
            금월·금년·누적은 발전 이력 API 연동 전이라 표시하지 않습니다.
          </div>
        )}
      </div>

      {/* 위젯 그리드 */}
      <div className="grid grid-3">
        {/* 변환효율 & 계측 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Activity /> 변환효율 & 계측 상태</span>
            {status
              ? <span className={`badge ${statusBadge}`}>{status.badge}</span>
              : <span className="badge badge-active">정상</span>}
          </div>
          <div className="info-list">
            <div className="info-row">
              <span>인버터 변환효율{plant._live ? ' (AC/DC)' : ''}</span>
              <b className="text-terra" style={{ fontSize: 20 }}>
                {plant._live
                  ? plant.conversionEff != null ? plant.conversionEff.toFixed(1) : '-'
                  : '99.9'}
                {' '}<small style={{ fontSize: 12 }}>%</small>
              </b>
            </div>
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
                    <td><strong>{inv.powerKw ?? '-'}</strong></td>
                    <td>{inv.runHours ?? '-'}</td>
                    <td><strong>{inv.todayGenKwh ?? '-'}</strong></td>
                    <td>
                      <span className={`badge ${INV_STATE_BADGE[inv.state] || 'badge-active'}`}>
                        {inv.state || '가동'}
                      </span>
                    </td>
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
            {plant._backend
              ? <span className="badge badge-neutral">데모 · 센서 미연동</span>
              : <span className="badge badge-active">생육 양호</span>}
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
          title="일 발전량" badge={isLive ? '그래프 데모' : null} color="var(--blue)"
          value={gen == null ? '-' : nf(gen)} unit={gen == null ? '' : 'kWh'}
          chart={<HourlyGenChart hourly={plant.hourly} predict={plant.hourlyPredict} />}
          tableHead={['시간', '금일(kWh)', '전일(kWh)']}
          tableRows={['06h', '08h', '10h', '12h', '14h', '16h', '18h'].map((h, i) => [h, `${plant.hourly[i] ?? 0}`, `${Math.round((plant.hourly[i] ?? 0) * 0.9)}`])}
          foot={[
            ['전일 발전량', plant.yesterdayGenKwh == null ? '-' : `${nf(plant.yesterdayGenKwh)} kWh`],
            ['금일 발전시간', plant.todayGenHours == null ? '-' : `${plant.todayGenHours} 시간`],
          ]}
        />

        {/* 월 발전량 */}
        <GenCard
          title="월 발전량" badge={demoBadge} color="var(--teal)" value={plant.monthlyGenKwh?.replace(' kWh', '') ?? '-'} unit="kWh"
          chart={<MonthlyTrendChart trend={plant.monthlyTrend} />}
          tableHead={['일자', '금월(kWh)', '전월(kWh)']}
          tableRows={[0, 4, 9, 14, 19].map((i) => [`${i + 1}일`, `${plant.monthlyTrend?.[i] ?? '-'}`, `${Math.round((plant.monthlyTrend?.[i] ?? 0) * 0.92)}`])}
          foot={[['월 SMP 수익', plant.smpMonthly], ['누적 REC', plant.recAcc]]}
        />

        {/* 연 발전량 */}
        <GenCard
          title="연 발전량" badge={demoBadge} color="var(--lime)" value={nf(yearlyTotal)} unit="kWh"
          chart={<YearlyGenChart />}
          tableHead={['월별', '발전량(kWh)', '일평균시간']}
          tableRows={YEARLY_RECORDS.map((r) => [r.month, nf(r.genKwh), `${r.avgHours} h`])}
          foot={[['금년 누적', `${nf(yearlyTotal)} kWh`], ['월 평균', `${nf(Math.round(yearlyTotal / YEARLY_RECORDS.length))} kWh`]]}
        />

        {/* RPS 예상 금액 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Coins /> 예상 발전 금액 (RPS)</span>
            {isLive && (
              <span className={`badge ${priceSource === 'KPX 시세' ? 'badge-sync' : 'badge-neutral'}`} style={{ fontSize: 10.5 }}>
                금일 실측 × {priceSource}
              </span>
            )}
          </div>
          <div className="info-list">
            <div style={{ fontWeight: 800, color: 'var(--sage-strong)' }}>SMP (전력계통 한계가격)</div>
            <div className="info-row"><span>일 발전금액</span><b className="text-sage">{rps.smpDaily}</b></div>
            <div className="info-row"><span>월 발전금액</span><b className="text-sage">{rps.smpMonthly}</b></div>
            <hr style={{ border: 'none', borderTop: '1px dashed var(--border)', margin: '2px 0' }} />
            <div style={{ fontWeight: 800, color: 'var(--sage-strong)' }}>REC (신재생에너지 인증서)</div>
            <div className="info-row"><span>{rps.recLabel}</span><b className="text-terra">{rps.recRevenue}</b></div>
            <div className="info-row"><span>누적 REC</span><b className="text-sage">{rps.recAcc}</b></div>
          </div>
        </div>

        {/* REC 시장 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><TrendingUp /> REC 시장 동향</span>
            {market.rec ? (
              <span className="badge badge-sync" title="전력거래소 REC 현물시장 — 최근 거래일 종가(육지+제주 체결 기준)">🟢 KPX 시세 ({ymdLabel(market.rec.date)})</span>
            ) : <DemoMarketBadge market={market} />}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: 10, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700 }}>현물시장 종가</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--terracotta)' }}>{nf(Math.round(market.rec ? market.rec.price : REC_MARKET.price))} <small style={{ fontSize: 11 }}>원/REC</small></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {market.rec
                ? <ChangeText change={market.rec.change} pct={market.rec.pct} />
                : <span className="text-emerald" style={{ fontWeight: 800, fontSize: 11.5 }}>▲ {nf(REC_MARKET.change)}원 ({REC_MARKET.pct})</span>}
              <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700 }}>
                거래량 {market.rec ? (market.rec.volume == null ? '-' : `${nf(market.rec.volume)} REC`) : REC_MARKET.volume}
              </div>
            </div>
          </div>
          <div className="chart-box" style={{ height: 140 }}><RecMarketChart series={market.rec?.series} /></div>
        </div>

        {/* SMP 시장 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><TrendingUp /> 실시간 SMP 전력시장</span>
            {market.smp ? (
              <span
                className="badge badge-sync"
                title={`전력거래소 하루전 발전계획용 SMP — h시 = (h-1)시~h시 구간${market.smp.isToday ? '' : ` · 오늘 값이 아직 게시되지 않아 ${ymdLabel(market.smp.date)} 값 표시`}`}
              >
                🟢 KPX 시세 ({market.smp.isToday ? '' : `${ymdLabel(market.smp.date)} `}{market.smp.hour}시)
              </span>
            ) : <DemoMarketBadge market={market} />}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: 10, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700 }}>육지 SMP 단가</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--terracotta)' }}>{market.smp ? market.smp.price.toFixed(2) : SMP_MARKET.landPrice} <small style={{ fontSize: 11 }}>원/kWh</small></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {market.smp
                ? <ChangeText change={market.smp.change} pct={market.smp.pct} digits={2} suffix=" 직전 시간 대비" />
                : <span className="text-emerald" style={{ fontWeight: 800, fontSize: 11.5 }}>{SMP_MARKET.change}</span>}
              <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700 }}>
                제주 SMP {market.smp ? (market.smp.jeju == null ? '-' : `${market.smp.jeju.toFixed(2)}원`) : `${SMP_MARKET.jejuPrice}원`}
              </div>
            </div>
          </div>
          <div className="chart-box" style={{ height: 140 }}><SmpMarketChart series={market.smp?.series} /></div>
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
        <PlantInfoCard plant={plant} />
      </div>
    </div>
  )
}
