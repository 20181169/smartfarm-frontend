import { Chart as ChartJS, registerables } from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import { useApp } from '../../context/useApp'
import {
  REC_MARKET, SMP_MARKET, YEARLY_TREND,
  MPPT_LOG_LABELS, MPPT_LOG_SERIES,
} from '../../data/market'

ChartJS.register(...registerables)

function useAxis() {
  const { theme } = useApp()
  const tick = theme === 'dark' ? '#97a89d' : '#8a9c90'
  const grid = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(20,40,26,0.06)'
  return { tick, grid }
}

const tooltip = {
  padding: 10,
  backgroundColor: 'rgba(15, 23, 20, 0.92)',
  titleColor: '#ffffff',
  bodyColor: '#a7f3d0',
  titleFont: { size: 12, weight: 'bold' },
  bodyFont: { size: 12.5, weight: 'bold' },
  cornerRadius: 8,
  usePointStyle: true,
}

const baseOpts = (axis, legend = false) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: legend ? { position: 'top', labels: { color: axis.tick, font: { size: 10, weight: '700' }, boxWidth: 10 } } : { display: false }, tooltip },
  scales: {
    x: { grid: { display: false }, ticks: { color: axis.tick, font: { size: 10, weight: '700' } } },
    y: { grid: { color: axis.grid }, ticks: { color: axis.tick, font: { size: 10, weight: '700' } } },
  },
})

function fill(ctx, color, a = 0.32) {
  const { ctx: c, chartArea } = ctx.chart
  if (!chartArea) return color
  const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
  g.addColorStop(0, color.replace('ALPHA', a))
  g.addColorStop(1, color.replace('ALPHA', '0'))
  return g
}

export function HourlyGenChart({ hourly = [0, 15, 65, 110, 75, 26, 0, 0], predict = [0, 20, 75, 130, 95, 40, 5, 0] }) {
  const axis = useAxis()
  const data = {
    labels: ['06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h'],
    datasets: [
      {
        label: '실시간 (kWh)', data: hourly,
        borderColor: '#4b6b55', borderWidth: 3, fill: true, tension: 0.45,
        backgroundColor: (c) => fill(c, 'rgba(75,107,85,ALPHA)'),
        pointRadius: 4, pointHoverRadius: 8, pointBackgroundColor: '#4b6b55', pointBorderColor: '#fff', pointBorderWidth: 2,
      },
      {
        label: 'AI 예측 (kWh)', data: predict,
        borderColor: '#e07a5f', borderWidth: 2, borderDash: [5, 5], fill: false, tension: 0.45,
        pointRadius: 3, pointHoverRadius: 7, pointBackgroundColor: '#e07a5f',
      },
    ],
  }
  return <Line data={data} options={baseOpts(axis)} />
}

export function MonthlyTrendChart({ trend = [] }) {
  const axis = useAxis()
  const t = trend.length ? trend : [510, 680, 550, 320, 710, 650, 490, 580, 610, 390, 750, 690, 520, 480, 640, 720, 590, 310, 670, 740, 291]
  const data = {
    labels: t.map((_, i) => `${i + 1}일`),
    datasets: [{
      label: '발전량 (kWh)', data: t,
      borderColor: '#4b6b55', borderWidth: 2.5, fill: true, tension: 0.3,
      backgroundColor: (c) => fill(c, 'rgba(75,107,85,ALPHA)', 0.28),
      pointRadius: 3, pointHoverRadius: 7, pointBackgroundColor: '#4b6b55', pointBorderColor: '#fff', pointBorderWidth: 1.5,
    }],
  }
  return <Line data={data} options={baseOpts(axis)} />
}

export function YearlyGenChart() {
  const axis = useAxis()
  const data = {
    labels: YEARLY_TREND.labels,
    datasets: [
      {
        label: '금년 발전량 (kWh)', data: YEARLY_TREND.current,
        borderColor: '#84cc16', borderWidth: 3, fill: true, tension: 0.4,
        backgroundColor: (c) => fill(c, 'rgba(132,204,22,ALPHA)', 0.3),
        pointRadius: 4, pointHoverRadius: 8, pointBackgroundColor: '#84cc16', pointBorderColor: '#fff', pointBorderWidth: 2,
      },
      {
        label: '전년 발전량 (kWh)', data: YEARLY_TREND.previous,
        borderColor: '#94a3b8', borderWidth: 2, borderDash: [3, 3], fill: false, tension: 0.4,
        pointRadius: 3, pointHoverRadius: 7, pointBackgroundColor: '#94a3b8',
      },
    ],
  }
  return <Line data={data} options={baseOpts(axis)} />
}

export function RecMarketChart() {
  const axis = useAxis()
  const o = baseOpts(axis, true)
  o.scales.y.ticks.callback = (v) => (v / 10000).toFixed(1) + '만'
  const data = {
    labels: REC_MARKET.labels,
    datasets: [
      { label: '육지 종가 (원)', data: REC_MARKET.landClose, borderColor: '#e07a5f', borderWidth: 2.5, fill: true, tension: 0.3,
        backgroundColor: (c) => fill(c, 'rgba(224,122,95,ALPHA)', 0.25), pointRadius: 3, pointHoverRadius: 7, pointBackgroundColor: '#e07a5f' },
      { label: '육지 평균가 (원)', data: REC_MARKET.landAvg, borderColor: '#4b6b55', borderWidth: 1.5, borderDash: [4, 4], fill: false, tension: 0.3, pointRadius: 2, pointHoverRadius: 6 },
    ],
  }
  return <Line data={data} options={o} />
}

export function SmpMarketChart() {
  const axis = useAxis()
  const o = baseOpts(axis, true)
  o.scales.y.ticks.callback = (v) => v + '원'
  const data = {
    labels: SMP_MARKET.labels,
    datasets: [
      { label: '육지 SMP (원)', data: SMP_MARKET.land, borderColor: '#e07a5f', borderWidth: 2.5, fill: true, tension: 0.3,
        backgroundColor: (c) => fill(c, 'rgba(224,122,95,ALPHA)', 0.25), pointRadius: 3, pointHoverRadius: 7, pointBackgroundColor: '#e07a5f' },
      { label: '제주 SMP (원)', data: SMP_MARKET.jeju, borderColor: '#4b6b55', borderWidth: 1.5, borderDash: [4, 4], fill: false, tension: 0.3, pointRadius: 2, pointHoverRadius: 6 },
    ],
  }
  return <Line data={data} options={o} />
}

export function PlantDetailChart() {
  const axis = useAxis()
  const hours = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00']
  const data = {
    labels: hours,
    datasets: [
      { type: 'line', label: '발전량 (kWh)', data: [4, 18, 52, 75, 48, 62, 12, 0],
        borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.15)', borderWidth: 3,
        pointRadius: 4, pointBackgroundColor: '#0284c7', tension: 0.35, yAxisID: 'yGen', order: 1 },
      { type: 'bar', label: '피크치 (kW)', data: [12, 28, 120, 195, 105, 150, 25, 0],
        backgroundColor: '#64748b', borderRadius: 4, barPercentage: 0.5, yAxisID: 'yPeak', order: 2 },
    ],
  }
  const options = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'top', labels: { color: axis.tick, font: { size: 11, weight: '700' } } }, tooltip },
    scales: {
      x: { grid: { color: axis.grid }, ticks: { color: axis.tick } },
      yGen: { type: 'linear', position: 'left', min: 0, max: 100, title: { display: true, text: '발전량 (kWh)', color: '#38bdf8' }, ticks: { color: axis.tick }, grid: { color: axis.grid } },
      yPeak: { type: 'linear', position: 'right', min: 0, max: 200, title: { display: true, text: '피크치 (kW)', color: '#64748b' }, ticks: { color: axis.tick }, grid: { drawOnChartArea: false } },
    },
  }
  return <Bar data={data} options={options} />
}

export function MpptLogChart() {
  const axis = useAxis()
  const colors = { CH1: '#3b82f6', CH2: '#64748b', CH3: '#22c55e', CH4: '#f97316' }
  const data = {
    labels: MPPT_LOG_LABELS,
    datasets: Object.keys(MPPT_LOG_SERIES).map((k) => ({
      label: k, data: MPPT_LOG_SERIES[k], borderColor: colors[k], backgroundColor: 'transparent', tension: 0.3, borderWidth: 2, pointRadius: 2,
    })),
  }
  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { color: axis.tick, font: { size: 11, weight: '700' } } }, tooltip },
    scales: { x: { grid: { color: axis.grid }, ticks: { color: axis.tick } }, y: { beginAtZero: true, max: 25, grid: { color: axis.grid }, ticks: { color: axis.tick } } },
  }
  return <Line data={data} options={options} />
}
