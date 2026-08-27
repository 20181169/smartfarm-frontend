/* ==========================================================================
   시장 시세 · 연간 실적 · 에러 로그 · 발전소 비교 데이터
   ========================================================================== */

export const YEARLY_RECORDS = [
  { month: '1월', genKwh: 10640, avgHours: 2.72 },
  { month: '2월', genKwh: 17466, avgHours: 3.71 },
  { month: '3월', genKwh: 24883, avgHours: 4.01 },
  { month: '4월', genKwh: 27664, avgHours: 4.61 },
  { month: '5월', genKwh: 32681, avgHours: 5.26 },
  { month: '6월', genKwh: 32433, avgHours: 5.4 },
  { month: '7월', genKwh: 14953, avgHours: 3.56 },
]

export const ERROR_LOGS = [
  { time: '2026-07-21 16:40', plant: '온누리3,4', device: '인버터-2 / 스트링3', type: 'DC 전압 미세 강하', status: 'warning', statusText: '주의', desc: '인버터-2 DC 전압 613V (정상 대비 -2.5%). 모듈 surface 세척 및 접속반 커넥터 조임 권장', stateText: '진단 완료' },
  { time: '2026-07-20 14:15', plant: '온누리1,2', device: '인버터-4', type: '내부 온도 과열 주의', status: 'resolved', statusText: '해제', desc: '인버터 내부 온도 49.2°C 도달. 방열 팬 필터 청소 후 정상 복구 완료', stateText: '해제 완료' },
  { time: '2026-07-18 09:30', plant: '청정영농형1호', device: '통신 게이트웨이', type: 'RS-485 통신 일시 지연', status: 'resolved', statusText: '해제', desc: '순간 통신 패킷 재전송 성공. 자동 동기화 복구됨', stateText: '해제 완료' },
  { time: '2026-07-15 11:20', plant: '소양강 영농', device: '토양 센서 노드 #2', type: '토양 수분 측정값 편차', status: 'resolved', statusText: '해제', desc: '배터리 전압 정상. 관수 작업 후 측정값 정상 자동 회귀', stateText: '해제 완료' },
  { time: '2026-07-12 15:10', plant: '온누리5,6', device: '인버터-1 / MPPT 2', type: '계통 전압 일시 미세 변동', status: 'resolved', statusText: '해제', desc: '한전 계통 전압 382.5V 안정화. 인버터 자동 재투입 가동', stateText: '해제 완료' },
  { time: '2026-07-10 13:45', plant: '온누리3,4', device: '접속반 3번', type: '커넥터 오염 경림 알람', status: 'resolved', statusText: '해제', desc: '현장 안전관리자 오염물질 세척 및 볼트 조임 작업 완료', stateText: '해제 완료' },
  { time: '2026-07-08 10:20', plant: '청정영농형1호', device: '인버터-3', type: '방열 팬 구동 릴레이 과부하', status: 'resolved', statusText: '해제', desc: '팬 모듈 클리닝 후 내부 온도 39.5°C 안착 완료', stateText: '해제 완료' },
  { time: '2026-07-05 17:05', plant: '소양강 영농', device: '인버터-2', type: 'AC 차단기 일시 트립', status: 'resolved', statusText: '해제', desc: '낙뢰 보호 서지 방지기 작동 후 차단기 수동 복구 정상화', stateText: '해제 완료' },
  { time: '2026-07-03 14:30', plant: '온누리1,2', device: '스트링 모듈 #8', type: '어레이 국소 음영 감지', status: 'resolved', statusText: '해제', desc: '하부 작물 성장 수목 가지치기 완료 후 일사량 회복', stateText: '해제 완료' },
  { time: '2026-07-01 08:50', plant: '온누리5,6', device: '기상관측 센서', type: '일사계 통신 일시 끊김', status: 'resolved', statusText: '해제', desc: '센서 보드 리셋 및 펌웨어 자동 업그레이드 완료', stateText: '해제 완료' },
  { time: '2026-06-28 16:15', plant: '청정영농형1호', device: '인버터-5', type: '입력 전력 불균형', status: 'resolved', statusText: '해제', desc: '모듈 퓨즈 교체 및 스트링 밸런싱 작업 완료', stateText: '해제 완료' },
  { time: '2026-06-25 11:40', plant: '소양강 영농', device: '토양 수분 센서 #1', type: '전원 전압 저하', status: 'resolved', statusText: '해제', desc: '태양광 소형 보조 모듈 청소 후 수광 전력 자급 복구', stateText: '해제 완료' },
  { time: '2026-06-20 09:10', plant: '온누리3,4', device: '인버터-4', type: '출력 주파수 미세 미동', status: 'resolved', statusText: '해제', desc: '주파수 60.0Hz 정주파수 자동 동기화 가동 완료', stateText: '해제 완료' },
]

// 발전소 성과(PR) 비교 테이블
export const COMPARE_ROWS = [
  { id: '12138', name: '[원주] 온누리1,2', cap: '200 kW', gen: '382 kWh', hrs: '1.91 시간', pr: '86.5 %', rev: '7.1 만원', eff: '201.9 원/kWh', crop: '96.8 %', evalText: '최우수' },
  { id: '12139', name: '[원주] 온누리3,4', cap: '200 kW', gen: '348 kWh', hrs: '1.74 시간', pr: '84.2 %', rev: '5.9 만원', eff: '202.7 원/kWh', crop: '94.2 %', evalText: '우수' },
  { id: '12140', name: '[원주] 온누리5,6', cap: '300 kW', gen: '584 kWh', hrs: '1.95 시간', pr: '85.1 %', rev: '10.6 만원', eff: '203.3 원/kWh', crop: '93.1 %', evalText: '우수' },
  { id: '12141', name: '[횡성] 청정영농형1호', cap: '500 kW', gen: '965 kWh', hrs: '1.93 시간', pr: '87.2 %', rev: '18.2 만원', eff: '202.5 원/kWh', crop: '98.5 %', evalText: '최우수' },
  { id: '12142', name: '[춘천] 소양강 영농태양광', cap: '150 kW', gen: '289 kWh', hrs: '1.93 시간', pr: '85.0 %', rev: '5.1 만원', eff: '204.2 원/kWh', crop: '95.4 %', evalText: '우수' },
]

// REC 현물시장 시세
export const REC_MARKET = {
  price: 74800,
  change: 1200,
  pct: '+1.63%',
  volume: '158,420 REC',
  labels: ['6/11', '6/25', '7/02', '7/09', '7/16', '7/23(실시간)'],
  landClose: [71500, 72300, 73100, 72800, 73600, 74800],
  landAvg: [71000, 72000, 72900, 72500, 73200, 74350],
}

// SMP 전력시장 시세
export const SMP_MARKET = {
  landPrice: 132.5,
  jejuPrice: 134.8,
  change: '▲ 2.4원 (+1.84%)',
  labels: ['6/11', '6/25', '7/02', '7/09', '7/16', '7/23(실시간)'],
  land: [122.1, 124.5, 128.4, 126.0, 130.2, 132.5],
  jeju: [124.0, 126.2, 130.1, 128.5, 132.0, 134.8],
}

// 연간(금년/전년) 발전량 추이
export const YEARLY_TREND = {
  labels: ['1월', '3월', '5월', '7월', '9월', '11월'],
  current: [16000, 22000, 31000, 29000, 18000, 14000],
  previous: [14000, 20000, 34000, 31000, 21000, 16000],
}

// 인버터 이력 로그 (샘플)
export const INVERTER_LOG_SAMPLE = [
  { dcV: 595, dcA: 2.7, dcP: 2.2, rstV: '380,382,381', rstA: '3.9,4.4,4.2', acP: 1.7, freq: 60, pf: -85.6, time: '2026-07-22 17:26:03' },
  { dcV: 595, dcA: 3.1, dcP: 2.4, rstV: '383,385,384', rstA: '4.1,4.2,4.3', acP: 1.9, freq: 60, pf: -89.1, time: '2026-07-22 17:21:02' },
  { dcV: 595, dcA: 3.7, dcP: 2.8, rstV: '382,383,383', rstA: '4.6,4.7,4.8', acP: 2.3, freq: 60, pf: -90.8, time: '2026-07-22 17:16:02' },
  { dcV: 590, dcA: 3.8, dcP: 2.9, rstV: '381,383,382', rstA: '4.8,4.8,4.9', acP: 2.4, freq: 60, pf: -91.2, time: '2026-07-22 17:11:02' },
  { dcV: 615, dcA: 6.1, dcP: 4.4, rstV: '381,383,382', rstA: '6.7,6.7,6.8', acP: 3.9, freq: 60, pf: -94.7, time: '2026-07-22 17:06:02' },
  { dcV: 625, dcA: 7.1, dcP: 4.9, rstV: '381,384,382', rstA: '7.4,7.5,7.6', acP: 4.4, freq: 60, pf: -95.4, time: '2026-07-22 17:01:01' },
  { dcV: 630, dcA: 7.3, dcP: 5.2, rstV: '381,383,382', rstA: '7.8,7.8,7.9', acP: 4.7, freq: 60, pf: -95.7, time: '2026-07-22 16:56:02' },
  { dcV: 625, dcA: 7.4, dcP: 5.2, rstV: '380,382,381', rstA: '7.8,7.9,9.8', acP: 4.7, freq: 60, pf: -95.7, time: '2026-07-22 16:51:10' },
  { dcV: 624, dcA: 7.7, dcP: 5.4, rstV: '380,382,381', rstA: '8.2,8.2,8.3', acP: 4.9, freq: 60, pf: -95.8, time: '2026-07-22 16:46:02' },
  { dcV: 610, dcA: 8.1, dcP: 5.3, rstV: '380,382,381', rstA: '8.1,8.1,8.2', acP: 4.8, freq: 60, pf: -95.8, time: '2026-07-22 16:41:02' },
  { dcV: 612, dcA: 9.3, dcP: 6.1, rstV: '381,382,382', rstA: '9.2,9.3,9.4', acP: 5.7, freq: 60, pf: -96.5, time: '2026-07-22 16:36:01' },
  { dcV: 605, dcA: 15.6, dcP: 10.0, rstV: '381,383,382', rstA: '14.9,14.9,15.1', acP: 9.5, freq: 60, pf: -98.1, time: '2026-07-22 16:31:00' },
  { dcV: 600, dcA: 42.7, dcP: 27.4, rstV: '383,385,384', rstA: '40.4,40.4,40.6', acP: 26.9, freq: 60, pf: -99.6, time: '2026-07-22 16:26:00' },
]

// MPPT 스트링 로그 (샘플)
export const MPPT_LOG_LABELS = [
  '07-20 13:00', '07-20 16:00', '07-20 19:00',
  '07-21 00:06', '07-21 06:00', '07-21 11:13', '07-21 16:00', '07-21 22:20',
  '07-22 04:00', '07-22 09:26', '07-22 13:00', '07-22 17:00',
]
export const MPPT_LOG_SERIES = {
  CH1: [2, 12, 1, 0, 1, 10, 4, 0, 0, 8, 14, 2],
  CH2: [1.8, 11.5, 0.8, 0, 0.8, 9.2, 3.5, 0, 0, 7.5, 13.2, 1.8],
  CH3: [2.2, 15.8, 1.2, 0, 1.2, 23.1, 5.8, 0, 0, 16.5, 15.0, 2.2],
  CH4: [0.1, 0.2, 0.1, 0, 0.1, 0.2, 0.1, 0, 0, 0.1, 0.2, 0.1],
}
export const MPPT_LOG_TABLE = [
  { time: '2026-07-22 17:26:03', ch1: '0.9', ch2: '0.8', ch3: '0.9', ch4: '0.0' },
  { time: '2026-07-22 17:21:02', ch1: '1.2', ch2: '1.1', ch3: '1.4', ch4: '0.0' },
  { time: '2026-07-22 17:16:02', ch1: '2.5', ch2: '2.3', ch3: '2.8', ch4: '0.0' },
  { time: '2026-07-22 17:11:02', ch1: '4.8', ch2: '4.5', ch3: '5.2', ch4: '0.1' },
  { time: '2026-07-22 17:06:02', ch1: '8.1', ch2: '7.8', ch3: '9.0', ch4: '0.1' },
  { time: '2026-07-22 17:01:01', ch1: '14.2', ch2: '13.5', ch3: '16.5', ch4: '0.2' },
]
