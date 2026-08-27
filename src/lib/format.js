// 숫자/파생 지표 포맷 헬퍼

export const nf = (n) => Number(n).toLocaleString('ko-KR')

// 발전 효율 (%) = 현재출력 / 설비용량
export function efficiency(plant) {
  return ((plant.currentPowerKw / plant.capacityKw) * 100).toFixed(1)
}

// 목표 대비 발전 비율 (%)
export function genRatio(plant) {
  return ((plant.todayGenKwh / plant.targetGenKwh) * 100).toFixed(1)
}

// 금일 CO₂ 감축 (kg)
export function co2Kg(plant) {
  return Math.round(plant.todayGenKwh * 0.48)
}

// 자산 수익 파생값
export function assetRevenue(plant) {
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
