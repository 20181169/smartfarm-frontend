// 실연동 발전소의 현재 상태 요약(규칙 기반) — 대시보드 상태 배너·계측 상태 배지용.
// 데모 템플릿의 'AI 진단' 문구(가상의 인버터-2 등)를 실발전소에 보여주지 않도록 실측값으로만 판단한다.

const toMin = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '')
  return m ? +m[1] * 60 + +m[2] : null
}

// 일출·일몰 기준 시간대. 일출 후/일몰 전 1시간은 저일사라 출력 0 이 정상일 수 있어 'twilight' 로 구분한다.
// 일출·일몰을 모르면 null.
export function dayPhase(sunrise, sunset, now = new Date()) {
  const sr = toMin(sunrise)
  const ss = toMin(sunset)
  if (sr == null || ss == null) return null
  const cur = now.getHours() * 60 + now.getMinutes()
  if (cur < sr || cur >= ss) return 'night'
  if (cur < sr + 60 || cur >= ss - 60) return 'twilight'
  return 'day'
}

const invLabel = (iv) => `#${iv.id}${iv.externalSeq != null ? `(seq ${iv.externalSeq})` : ''}`

// plant: AppContext 가 실시간 계측을 병합한 발전소(_live) / weather: AppContext 날씨(source 'sensor'|'meteo')
// → { level: 'ok'|'warn', badge, subject, desc }
export function liveStatus(plant, weather, now = new Date()) {
  const invs = plant.inverters || []
  const delayed = invs.filter((iv) => iv.state === '지연')
  const stopped = invs.filter((iv) => iv.state === '정지')
  const envStale = weather?.source === 'sensor' && !!weather.stale
  const envNote = envStale ? ` 환경센서도 ${weather.syncedAt} 이후 새 데이터가 없습니다.` : ''

  if (!invs.length) {
    return {
      level: envStale ? 'warn' : 'ok',
      badge: envStale ? '점검 필요' : '인버터 없음',
      subject: '연동된 인버터 데이터 없음',
      desc: `환경센서 데이터만 수신됩니다.${envNote}`,
    }
  }

  if (delayed.length === invs.length) {
    const last = [...new Set(delayed.map((iv) => iv.comm))].join(', ')
    return {
      level: 'warn',
      badge: '수신 지연',
      subject: `인버터 데이터 수신 지연 (${invs.length}대)`,
      desc: `마지막 수신 ${last}. RTU·통신망 상태 점검이 필요합니다.${envNote}`,
    }
  }

  if (stopped.length) {
    const phase = dayPhase(weather?.sunrise, weather?.sunset, now)
    if (phase === 'night' || phase === 'twilight') {
      return {
        level: envStale ? 'warn' : 'ok',
        badge: envStale ? '점검 필요' : phase === 'night' ? '야간 정지' : '저일사 대기',
        subject: phase === 'night' ? `야간 정지 중 (인버터 ${stopped.length}대)` : `저일사 시간대 대기 중 (인버터 ${stopped.length}대)`,
        desc:
          (phase === 'night'
            ? `일출(${weather.sunrise}) 전·일몰(${weather.sunset}) 후 출력 0 은 정상입니다.`
            : '일출·일몰 1시간 이내에는 출력 0 이 정상일 수 있습니다.') + envNote,
      }
    }
    return {
      level: 'warn',
      badge: '점검 필요',
      subject: `인버터 ${stopped.map(invLabel).join(', ')} 계측값 없음`,
      desc:
        `${phase === 'day' ? `주간(일출 ${weather.sunrise} · 일몰 ${weather.sunset})인데 ` : ''}` +
        '전압·주파수·출력이 모두 0 으로 수신됩니다. 인버터 정지 또는 인버터–RTU 통신 무응답이 의심되니 현장 점검을 권장합니다.' +
        envNote,
    }
  }

  if (delayed.length) {
    return {
      level: 'warn',
      badge: '점검 필요',
      subject: `인버터 ${delayed.map(invLabel).join(', ')} 수신 지연`,
      desc: `나머지 ${invs.length - delayed.length}대는 정상 수신 중입니다.${envNote}`,
    }
  }

  if (envStale) {
    return {
      level: 'warn',
      badge: '점검 필요',
      subject: '환경센서 수신 지연',
      desc: `인버터 ${invs.length}대는 정상 가동 중이지만 환경센서는 ${weather.syncedAt} 이후 새 데이터가 없습니다.`,
    }
  }

  const eff = plant.conversionEff != null ? ` · 변환효율 ${plant.conversionEff.toFixed(1)}%` : ''
  return {
    level: 'ok',
    badge: '정상',
    subject: `인버터 ${invs.length}대 정상 가동 중`,
    desc: `현재 출력 ${plant.currentPowerKw} kW${eff}`,
  }
}
