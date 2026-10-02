// 백엔드 알람(/alerts — MRT 오류 이벤트 기반) → 장애·경보 이력 행 변환 (에러정보 화면용)
// trigger_type: communication_lost(통신 두절 발생) | communication_restored(해제) | mrt_event(강우 경보 등 MRT 경보)
// 백엔드는 해제 이벤트를 따로 저장하고, 앞선 통신 두절 알람의 resolved_at 에 해제 이벤트 시각을 넣는다.
// MRT 해제 메시지는 두 종류라 구분해서 보여준다.
//   "통신 두절이 해제되었습니다"             → 실제 통신 복구
//   "야간이므로 통신 두절 알람을 해제합니다" → MRT 가 저녁마다 알람을 끄는 것(장비 복구 아님, 아침에 다시 발생)
import { fmtTime } from './collectorLogs'

const SEVERITY_LABEL = { critical: '위험', warning: '주의', info: '정보' }

export const isNightRelease = (msg) => /야간|알람을?\s*해제/.test(msg || '')

export function elapsedLabel(ms) {
  const m = Math.max(0, Math.round(ms / 60000))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  if (d) return h ? `${d}일 ${h}시간` : `${d}일`
  return h ? `${h}시간 ${m % 60}분` : `${m}분`
}

const deviceKey = (a) => a.device_id || `seq:${a.external_seq ?? ''}`
const deviceLabel = (a) =>
  `${a.device_name || '장비 미매핑'}${a.external_seq != null && a.external_seq !== '' ? ` · seq ${a.external_seq}` : ''}`

// MRT 원문은 "인버터1: 통신 두절이 발생하였습니다." 처럼 장비명이 앞에 붙어 설비 열과 겹치므로 뗀다
function messageBody(a) {
  const msg = (a.message || '').trim()
  const prefix = a.device_name ? `${a.device_name}:` : null
  return prefix && msg.startsWith(prefix) ? msg.slice(prefix.length).trim() : msg
}

const ms = (t) => Date.parse(t) || 0

// plantAlerts: [{ plant: { name }, items: AlertResponse[] }]
export function buildAlertLogs(plantAlerts, now = new Date()) {
  const logs = []
  for (const { plant, items } of plantAlerts) {
    if (!items?.length) continue
    const releases = items.filter((a) => a.trigger_type === 'communication_restored')
    const used = new Set()
    // 해제 이벤트 하나가 같은 장비의 통신 두절 알람 여러 건을 닫을 수 있다(해제 없이 '발생'이 반복된 경우).
    const releaseOf = (a) => {
      const r = releases.find((x) => deviceKey(x) === deviceKey(a) && Math.abs(ms(x.triggered_at) - ms(a.resolved_at)) < 5000)
      if (r) used.add(r.alert_id)
      return r
    }

    for (const a of items) {
      if (a.trigger_type === 'communication_restored') continue
      const active = a.is_active ?? !a.resolved_at
      const row = {
        _sort: a.triggered_at,
        time: fmtTime(a.triggered_at),
        plant: plant.name,
        device: deviceLabel(a),
        raw: a.message || undefined,
      }
      const severity = SEVERITY_LABEL[a.severity] || '주의'

      if (a.trigger_type === 'communication_lost') {
        row.type = '통신 두절'
        if (active) {
          Object.assign(row, {
            status: 'warning',
            statusText: severity,
            badge: a.severity === 'critical' ? 'badge-danger' : undefined,
            desc: `${elapsedLabel(+now - ms(a.triggered_at))}째 응답 없음`,
            stateText: '미해결',
          })
        } else {
          const r = a.resolved_at ? releaseOf(a) : null
          const night = isNightRelease(r?.message)
          const took = a.resolved_at ? elapsedLabel(ms(a.resolved_at) - ms(a.triggered_at)) : null
          Object.assign(row, {
            status: 'resolved',
            statusText: '해제',
            badge: night ? 'badge-neutral' : undefined,
            desc: night
              ? `${fmtTime(a.resolved_at)} 야간 알람 해제 (${took} 지속) · MRT가 저녁에 알람을 끈 것으로, 장비 복구는 아닙니다`
              : r
                ? `${fmtTime(a.resolved_at)} 통신 복구 (${took} 만에 해제)`
                : `${a.resolved_at ? `${fmtTime(a.resolved_at)} ` : ''}해제${took ? ` (${took} 지속)` : ''}`,
            stateText: night ? '야간 해제' : '해제 완료',
            raw: r ? `${a.message}\n${r.message}` : row.raw,
          })
        }
      } else {
        // mrt_event: "[강우 경보] 33.5 mm (기준 10.0 mm)" → 유형 '강우 경보', 내용 '33.5 mm (기준 10.0 mm)'
        const text = messageBody(a)
        const label = /^\[([^\]]+)\]\s*/.exec(text)
        const detail = (label ? text.slice(label[0].length) : text) || '-'
        row.type = label ? label[1] : a.trigger_type === 'mrt_event' ? 'MRT 경보' : a.trigger_type
        Object.assign(
          row,
          active
            ? {
                status: 'warning',
                statusText: severity,
                badge: a.severity === 'critical' ? 'badge-danger' : undefined,
                // 백엔드는 이 경보를 닫는 해제 이벤트가 오기 전까지 미해결로 둔다
                desc: `${detail} · 발생 후 ${elapsedLabel(+now - ms(a.triggered_at))} 경과, 해제 이벤트 없음`,
                stateText: '미해결',
              }
            : {
                status: 'resolved',
                statusText: '해제',
                desc: a.resolved_at ? `${detail} · ${fmtTime(a.resolved_at)} 해제` : detail,
                stateText: '해제 완료',
              }
        )
      }
      logs.push(row)
    }

    // 짝(통신 두절 알람)을 못 찾은 해제 이벤트 — 앞선 알람이 조회 범위 밖이거나 이미 닫힌 경우
    for (const r of releases) {
      if (used.has(r.alert_id)) continue
      const night = isNightRelease(r.message)
      logs.push({
        _sort: r.triggered_at,
        time: fmtTime(r.triggered_at),
        plant: plant.name,
        device: deviceLabel(r),
        type: night ? '야간 알람 해제' : '통신 복구',
        status: 'resolved',
        statusText: '해제',
        badge: night ? 'badge-neutral' : undefined,
        desc: night ? `${messageBody(r)} (장비 복구 아님)` : messageBody(r),
        raw: r.message || undefined,
        stateText: night ? '야간 해제' : '해제 완료',
      })
    }
  }
  return logs
}

// 에러정보 표 정렬: 미해결(주의)을 위로, 그 안에서는 최신순
export function mergeLogs(...lists) {
  const urgent = (l) => (l.status === 'warning' ? 0 : 1)
  return lists.flat().sort((a, b) => urgent(a) - urgent(b) || ms(b._sort) - ms(a._sort))
}
