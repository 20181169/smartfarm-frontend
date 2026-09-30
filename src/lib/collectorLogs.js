// 백엔드 overview(collector_health·data_status) → 장애·경보 이력 행 변환 (에러정보 화면용)

export const fmtTime = (t) => {
  try {
    return t ? new Date(t).toLocaleString('ko-KR') : '-'
  } catch {
    return '-'
  }
}

// 수집기 예외 원문(SQL·스택 포함)을 읽을 수 있는 요약으로. 원문은 화면에서 툴팁(title)으로 보존한다.
export function summarizeCollectorError(text) {
  if (!text) return null
  const col = /Unknown column '([^']+)'/.exec(text)
  const table = /\bFROM\s+(\w+)/i.exec(text)
  if (col) {
    return `MRT DB 조회 실패 — ${table ? `${table[1]} 테이블에 ` : ''}'${col[1]}' 컬럼이 없습니다(스키마 불일치). 수집기 쿼리 또는 MRT DB 스키마 확인 필요`
  }
  const first = text.split('\n')[0].replace(/^\w+(\.\w+)*Error:\s*/, '')
  return first.length > 140 ? `${first.slice(0, 140)}…` : first
}

const streamSeq = (text) => /'external_seq':\s*(\d+)/.exec(text || '')?.[1]

// data: apiPlantsWithOverview() 결과 [{ plant, overview }]
// collector_health 는 발전소와 무관한 MRT 수집기 전체 상태(백엔드가 모든 발전소 응답에 같은 값을 줌)라
// 한 번만 넣는다. 스트림 상태값: HEALTHY | ERROR | DOWN | UNKNOWN.
export function buildRealLogs(data) {
  const logs = []
  const streams = data.find((d) => d.overview?.collector_health)?.overview.collector_health.streams || []
  for (const s of streams) {
    const seq = streamSeq(s.last_error)
    const device = `${s.stream_name || '수집기'}${seq ? ` · seq ${seq}` : ''}`
    if (s.status === 'HEALTHY') {
      // 정상 수집 중. 이전 오류가 있었으면 '복구됨' 이력으로만 남긴다.
      if (s.last_error_at) {
        logs.push({
          _sort: s.last_error_at,
          time: fmtTime(s.last_error_at),
          plant: 'MRT 수집기(공통)',
          device,
          type: '수집기 스트림 오류',
          status: 'resolved',
          statusText: '정상',
          desc: `이후 정상 수집 중 · 마지막 성공 ${fmtTime(s.last_success_at)}`,
          stateText: '복구됨',
        })
      }
      continue
    }
    logs.push({
      _sort: s.last_error_at || s.last_checked_at || '',
      time: fmtTime(s.last_error_at || s.last_checked_at),
      plant: 'MRT 수집기(공통)',
      device,
      type: s.status === 'DOWN' ? '수집기 응답 없음' : '수집기 스트림 오류',
      status: 'warning',
      statusText: s.status || 'UNKNOWN',
      desc:
        summarizeCollectorError(s.last_error) ||
        (s.status === 'DOWN' ? '수집기가 3분 넘게 상태를 갱신하지 않았습니다.' : '수집기 스트림 상태를 확인할 수 없습니다.'),
      raw: s.last_error || undefined,
      stateText: '확인 필요',
    })
  }

  for (const { plant, overview } of data) {
    const ds = overview?.data_status
    if (ds && ds.is_stale) {
      logs.push({
        _sort: ds.last_updated_at || '',
        time: fmtTime(ds.last_updated_at),
        plant: plant.name,
        device: `${ds.stale_devices ?? 0}/${ds.total_devices ?? 0} 장비`,
        type: '데이터 수신 지연(STALE)',
        status: 'warning',
        statusText: 'STALE',
        // last_updated_at 은 발전소 전체 장비 중 가장 최근 수신 시각(지연 장비의 마지막 수신이 아님)
        desc: `${ds.stale_devices ?? 0}개 장비 데이터 수신 지연 (전체 ${ds.total_devices ?? 0}대) · 발전소 최근 수신 ${fmtTime(ds.last_updated_at)}`,
        stateText: '지연',
      })
    }
  }
  logs.sort((a, b) => (a._sort < b._sort ? 1 : -1))
  return logs
}
