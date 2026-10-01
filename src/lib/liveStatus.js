// 실연동 발전소의 현재 상태 요약(규칙 기반) — 대시보드 상태 배너·계측 상태 배지용.
// 데모 템플릿의 'AI 진단' 문구(가상의 인버터-2 등)를 실발전소에 보여주지 않도록 실측값으로만 판단한다.

// 인버터 상태(AppContext) → 배지 색
export const INV_STATE_BADGE = {
  가동: 'badge-active',
  대기: 'badge-neutral',
  정지: 'badge-neutral',
  지연: 'badge-warning',
  '통신 두절': 'badge-warning',
}

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
const pad = (x) => String(x).padStart(2, '0')
const timeLabel = (d, now) =>
  d.toDateString() === now.toDateString()
    ? `${pad(d.getHours())}:${pad(d.getMinutes())}`
    : `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
const durationLabel = (ms) => {
  const m = Math.max(0, Math.round(ms / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`
}

// plant: AppContext 가 실시간 계측을 병합한 발전소(_live) / weather: AppContext 날씨(source 'sensor'|'meteo')
// → { level: 'ok'|'warn', badge, subject, desc }
export function liveStatus(plant, weather, now = new Date()) {
  const invs = plant.inverters || []
  const delayed = invs.filter((iv) => iv.state === '지연')
  const lost = invs.filter((iv) => iv.state === '통신 두절')
  const stopped = invs.filter((iv) => iv.state === '정지')
  const standby = invs.filter((iv) => iv.state === '대기')
  // 응답 없는 환경센서(seq). AppContext 날씨의 staleSeqs — 전부/일부 무응답 모두 포함
  const envDown = weather?.source === 'sensor' ? weather.staleSeqs || [] : []
  const envStale = envDown.length > 0
  const envNote = envStale ? ` 환경센서 ${envDown.join('·')}도 응답이 없습니다.` : ''
  const phase = dayPhase(weather?.sunrise, weather?.sunset, now)

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

  // 통신 두절: RTU 요청에 인버터가 응답하지 않음. 값 0 은 측정값이 아니라 '값 없음'.
  if (lost.length) {
    const firstAt = lost
      .map((iv) => iv.lastRecvAt)
      .filter(Boolean)
      .map((t) => new Date(t))
      .sort((a, b) => a - b)[0]
    // 마지막 응답 시각을 알면 그 시각과 경과 시간, 모르면(조회한 이력 내내 무응답) 시각을 추정하지 않는다
    const since = firstAt ? ` (${timeLabel(firstAt, now)} 이후 · ${durationLabel(now - firstAt)}째)` : ''
    const startedPhase = firstAt ? dayPhase(weather?.sunrise, weather?.sunset, firstAt) : null
    // 야간에 끊겨 아직 야간이면 경보하지 않는다(일부 인버터는 야간에 통신을 멈춤 — MRT 도 야간엔 두절 알람 해제).
    // 주간에 끊긴 두절은 저녁·야간이 돼도 계속 경보한다. 시작 시각을 모르면(오늘 내내 무응답) 새벽에만 보류.
    const nightNow = phase === 'night' || phase === 'twilight'
    const nightOnly = firstAt ? nightNow && startedPhase !== 'day' : phase === 'night' && now.getHours() < 12
    return {
      level: nightOnly ? 'ok' : 'warn',
      badge: nightOnly ? '야간 무응답' : '통신 두절',
      subject: `인버터 ${lost.map(invLabel).join(', ')} 응답 없음${since}`,
      desc:
        'RTU는 계속 요청을 보내지만 인버터 응답이 없어 현재 출력·발전량을 알 수 없습니다(0 이 아니라 확인 불가). ' +
        '발전이 멈춘 것인지 통신만 끊긴 것인지는 데이터로 구분되지 않습니다. ' +
        '현장에서 인버터 표시창·계량기로 발전 여부를 확인하고 RS-485 통신선·통신 전원을 점검하세요.' +
        envNote,
    }
  }

  if (stopped.length) {
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

  // 응답은 정상인데 출력 0 — 야간·저일사면 대기, 주간이면 인버터 정지(트립) 의심
  if (standby.length === invs.length) {
    const daytime = phase === 'day'
    return {
      level: daytime || envStale ? 'warn' : 'ok',
      badge: daytime ? '점검 필요' : envStale ? '점검 필요' : phase === 'night' ? '야간 대기' : '대기',
      subject: daytime ? `주간인데 인버터 ${invs.length}대 출력 0` : `인버터 ${invs.length}대 대기 중 (통신 정상)`,
      desc:
        (daytime
          ? '인버터 응답은 정상이지만 발전하지 않습니다. 인버터 정지·트립 여부와 오류 코드를 확인하세요.'
          : '통신은 정상이며 일사가 없어 출력이 0 입니다.') + envNote,
    }
  }

  if (envStale) {
    return {
      level: 'warn',
      badge: '점검 필요',
      subject: `환경센서 ${envDown.join('·')} 응답 없음`,
      desc: `인버터 ${invs.length}대는 정상 가동 중이지만 환경센서 ${envDown.join('·')}가 응답하지 않습니다.`,
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
