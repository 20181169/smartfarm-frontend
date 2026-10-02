// 숫자/파생 지표 포맷 헬퍼
import { RPS_PRICE } from '../data/market'

export const nf = (n) => Number(n).toLocaleString('ko-KR')

// 발전량(kWh) → SMP·REC 수익(원). REC 는 1MWh 당 가격이라 /1000.
// price: { smp, rec, weight } — KPX 시세가 있으면 그 값(AppContext market.price), 없으면 데모 단가.
export const smpWon = (kwh, price = RPS_PRICE) => kwh * price.smp
export const recWon = (kwh, price = RPS_PRICE) => (kwh / 1000) * price.rec * price.weight

// 발전 효율 (%) = 현재출력 / 설비용량. 현재출력을 알 수 없으면(통신 두절 등) '-'
export function efficiency(plant) {
  if (plant.currentPowerKw == null) return '-'
  return ((plant.currentPowerKw / plant.capacityKw) * 100).toFixed(1)
}

// 목표 대비 발전 비율 (%). 금일 발전량을 알 수 없으면 '-'
export function genRatio(plant) {
  if (plant.todayGenKwh == null) return '-'
  return ((plant.todayGenKwh / plant.targetGenKwh) * 100).toFixed(1)
}

// 금일 CO₂ 감축 (kg). 금일 발전량을 알 수 없으면 '-'
export function co2Kg(plant) {
  if (plant.todayGenKwh == null) return '-'
  return Math.round(plant.todayGenKwh * 0.48)
}

// 자산 수익 파생값
export function assetRevenue(plant) {
  if (plant._live) {
    // 실연동: 금일은 실측 발전량 기반. 월·연·누적은 발전 이력 API 가 없어 금일값으로 외삽하지 않는다.
    const kg = co2Kg(plant)
    return {
      today: plant.todayRevenueMan == null ? '-' : `${plant.todayRevenueMan.toFixed(1)} 만원`,
      monthly: '-',
      yearly: '-',
      total: '-',
      todayCo2: kg === '-' ? '-' : `${kg} kgCO₂`,
      monthlyCo2: '-',
      yearlyCo2: '-',
      totalCo2: '-',
    }
  }
  return {
    today: `${plant.todayRevenueMan.toFixed(1)} 만원`,
    monthly: plant.smpMonthly || `${(plant.todayRevenueMan * 30).toFixed(0)} 만원`,
    yearly: `${(plant.todayRevenueMan * 365).toFixed(0)} 만원`,
    total: `${(plant.capacityKw * 0.74).toFixed(2)} 억원`,
    todayCo2: `${co2Kg(plant)} kgCO₂`,
    monthlyCo2: `${(plant.co2ReducedTon * 30).toFixed(1)} tCO₂`,
    yearlyCo2: `${(plant.co2ReducedTon * 365).toFixed(1)} tCO₂`,
    totalCo2: `${(plant.co2ReducedTon * 2600).toFixed(1)} tCO₂`,
  }
}

export function nowStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  )
}

// 테이블 → CSV 다운로드 (엑셀 내보내기)
export function exportTableToCsv(tableEl, filename = '태양광_모니터링_보고서') {
  if (!tableEl) return
  const rows = [...tableEl.querySelectorAll('tr')].map((tr) =>
    [...tr.querySelectorAll('th,td')]
      .map((c) => `"${c.innerText.replace(/"/g, '""').trim()}"`)
      .join(',')
  )
  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${filename}.csv`
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
