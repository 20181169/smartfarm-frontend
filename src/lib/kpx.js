/* ==========================================================================
   전력거래소(KPX) 시세 — 공공데이터포털 OpenAPI 를 브라우저에서 직접 호출
   - SMP: 한국전력거래소_계통한계가격 및 수요예측(하루전 발전계획용)  B552115/SmpWithForecastDemand
          일자별 1~24시(각 시간은 '끝나는 시각' 기준: 6시 = 05~06시) 육지·제주 SMP.
          날짜 없이 부르면 최신 날짜부터 내려온다. 게시가 며칠 늦을 수 있어(10/6 실측: 최신 10/1, 오늘 날짜로는 0건)
          '오늘'이 아니라 가장 최근 게시일 값을 쓰고 화면에 그 날짜를 표시한다.
   - REC: 한국전력거래소_REC 현물시장 정보  B552115/RecMarketInfo2
          현물시장 거래일(주 2회)별 육지 평균가·종가(육지+제주 체결 기준)·거래물량. 과거(2017)부터 오름차순.
   - apis.data.go.kr 는 요청 Origin 을 그대로 허용(CORS)해서 백엔드 없이 호출할 수 있다.
   - 인증키 VITE_DATA_GO_KR_KEY 는 빌드 결과물에 들어가므로 공개 키로 취급(일일 호출 한도 → 응답을 캐시).
   - 키가 없거나 조회에 실패하면 null → 화면은 데모 단가를 유지하고 '데모 시세'로 표시한다.
   ========================================================================== */

const BASE = import.meta.env.VITE_KPX_API_BASE || 'https://apis.data.go.kr/B552115'
const RAW_KEY = (import.meta.env.VITE_DATA_GO_KR_KEY || '').trim()

export const hasKpxKey = () => !!RAW_KEY

// 포털의 'Encoding' 키(%2B 등)를 넣어도 이중 인코딩되지 않게 한 번 풀어서 URLSearchParams 로 다시 인코딩한다.
function serviceKey() {
  try {
    return RAW_KEY.includes('%') ? decodeURIComponent(RAW_KEY) : RAW_KEY
  } catch {
    return RAW_KEY
  }
}

const num = (v) => {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

// 한국 시각 기준 날짜·시 (브라우저 시간대와 무관)
export function kstParts(d = new Date()) {
  const k = new Date(d.getTime() + 9 * 3600 * 1000)
  return { y: k.getUTCFullYear(), m: k.getUTCMonth() + 1, day: k.getUTCDate(), h: k.getUTCHours() }
}
const pad = (n) => String(n).padStart(2, '0')
export const kstYmd = (d = new Date()) => {
  const p = kstParts(d)
  return `${p.y}${pad(p.m)}${pad(p.day)}`
}
// 'YYYYMMDD' → 'M/D'
export const ymdLabel = (ymd) => (/^\d{8}$/.test(ymd || '') ? `${Number(ymd.slice(4, 6))}/${Number(ymd.slice(6, 8))}` : '-')

// data.go.kr 응답 → item 배열. 게이트웨이 오류(키 미등록 등)·기관 오류코드는 사유를 담아 예외로 던진다.
export function itemsOf(json) {
  const gw = json?.OpenAPI_ServiceResponse?.cmmMsgHeader
  if (gw) throw new Error(gw.returnAuthMsg || gw.errMsg || '공공데이터포털 오류')
  const root = json?.response ?? json
  const code = root?.header?.resultCode
  if (code && code !== '00') throw new Error(root.header.resultMsg || `오류 코드 ${code}`)
  const items = root?.body?.items
  const item = items?.item ?? items
  if (!item || typeof item !== 'object') return []
  return Array.isArray(item) ? item : [item]
}
const totalOf = (json) => num((json?.response ?? json)?.body?.totalCount)

/* -------------------------------------------------------------------- SMP */

export function parseSmp(items) {
  const land = []
  const jeju = []
  for (const it of items) {
    const hour = num(it.hour)
    const smp = num(it.smp)
    if (hour == null || smp == null) continue
    ;(String(it.areaName ?? '').includes('제주') ? jeju : land).push({ hour, smp })
  }
  const byHour = (a, b) => a.hour - b.hour
  return { date: items[0]?.date ? String(items[0].date) : null, land: land.sort(byHour), jeju: jeju.sort(byHour) }
}

// 지금 속한 거래시간(h시 = h-1시~h시)의 육지 SMP·직전 시간 대비 변화·제주 SMP, 하루 단순 평균.
// 게시일이 오늘이 아니면(게시 지연) 그 날의 같은 시간대 값이며 isToday=false 로 알린다.
export function smpNow(smp, now = new Date()) {
  if (!smp?.land?.length) return null
  const h = kstParts(now).h + 1
  const at = (list, hour) => list.find((x) => x.hour === hour)?.smp ?? null
  const price = at(smp.land, h) ?? smp.land[smp.land.length - 1].smp
  const prev = at(smp.land, h - 1)
  return {
    date: smp.date,
    isToday: smp.date === kstYmd(now),
    hour: h,
    price,
    change: prev == null ? null : price - prev,
    pct: prev ? ((price - prev) / prev) * 100 : null,
    jeju: at(smp.jeju, h),
    avg: smp.land.reduce((s, x) => s + x.smp, 0) / smp.land.length,
    series: { labels: smp.land.map((x) => `${x.hour}시`), land: smp.land.map((x) => x.smp), jeju: smp.land.map((x) => at(smp.jeju, x.hour)) },
  }
}

/* -------------------------------------------------------------------- REC */

export function parseRec(items) {
  return items
    .map((it) => ({
      date: String(it.bzDd ?? ''),
      close: num(it.clsPrc), // 종가(육지+제주 체결 기준)
      landAvg: num(it.landAvgPrc),
      volume: num(it.totRecValue), // 총 거래물량(REC)
    }))
    .filter((r) => /^\d{8}$/.test(r.date) && (r.close != null || r.landAvg != null))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// 최근 거래일 종가(없으면 육지 평균가)·직전 거래일 대비·최근 6거래일 추이
export function recSummary(rows) {
  if (!rows?.length) return null
  const last = rows[rows.length - 1]
  const prev = rows[rows.length - 2]
  const price = last.close ?? last.landAvg
  const prevPrice = prev ? prev.close ?? prev.landAvg : null
  const recent = rows.slice(-6)
  return {
    date: last.date,
    price,
    landAvg: last.landAvg,
    volume: last.volume,
    change: prevPrice == null ? null : price - prevPrice,
    pct: prevPrice ? ((price - prevPrice) / prevPrice) * 100 : null,
    series: { labels: recent.map((r) => ymdLabel(r.date)), close: recent.map((r) => r.close), avg: recent.map((r) => r.landAvg) },
  }
}

/* ------------------------------------------------------------ 호출·캐시 */

const CACHE = 'kpx:'
function cacheGet(key, maxAgeMs) {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE + key))
    if (v && Date.now() - v.at < maxAgeMs) return v.data
  } catch {
    /* 저장소 사용 불가 */
  }
  return null
}
function cacheSet(key, data) {
  try {
    localStorage.setItem(CACHE + key, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* 저장소 사용 불가 */
  }
}

async function call(path, params) {
  const q = new URLSearchParams({ serviceKey: serviceKey(), pageNo: '1', numOfRows: '100', dataType: 'json', ...params })
  let res
  try {
    res = await fetch(`${BASE}/${path}?${q}`)
  } catch {
    throw new Error('공공데이터포털에 연결할 수 없습니다.')
  }
  try {
    return await res.json()
  } catch {
    throw new Error(`시세 응답을 읽을 수 없습니다 (${res.status})`)
  }
}

// 가장 최근 게시일의 시간별 SMP. 날짜 없이 최신순 첫 페이지(100행 = 이틀 남짓)를 받아 최신 날짜만 쓴다. 3시간 캐시.
export async function fetchSmp() {
  if (!hasKpxKey()) return null
  const cached = cacheGet('smp:latest', 3 * 3600 * 1000)
  if (cached) return cached
  const items = itemsOf(await call('SmpWithForecastDemand/getSmpWithForecastDemand', { numOfRows: '100' }))
  const latest = items.reduce((m, it) => (String(it.date ?? '') > m ? String(it.date) : m), '')
  const smp = parseSmp(items.filter((it) => String(it.date ?? '') === latest))
  if (!smp.land.length) throw new Error('게시된 SMP 가 없습니다.')
  cacheSet('smp:latest', smp)
  return smp
}

// 최근 REC 현물시장 거래일들. 정렬 순서가 명세에 없어 첫 페이지가 과거부터면 마지막 페이지를 다시 받는다. 3시간 캐시.
export async function fetchRec() {
  if (!hasKpxKey()) return null
  const cached = cacheGet('rec', 3 * 3600 * 1000)
  if (cached) return cached
  const PAGE = 10
  const first = await call('RecMarketInfo2/getRecMarketInfo2', { numOfRows: String(PAGE) })
  const raw = itemsOf(first)
  let rows = parseRec(raw)
  const total = totalOf(first) ?? raw.length
  const oldestFirst = raw.length > 1 && String(raw[0].bzDd) < String(raw[raw.length - 1].bzDd)
  if (oldestFirst && total > PAGE) {
    const lastPage = Math.ceil(total / PAGE)
    const pages = [lastPage, lastPage - 1].filter((p) => p > 1)
    const more = await Promise.all(pages.map((p) => call('RecMarketInfo2/getRecMarketInfo2', { numOfRows: String(PAGE), pageNo: String(p) })))
    const byDate = new Map(more.flatMap((j) => parseRec(itemsOf(j))).map((r) => [r.date, r]))
    rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  }
  if (!rows.length) throw new Error('REC 현물시장 거래 정보가 없습니다.')
  cacheSet('rec', rows)
  return rows
}

// 화면용: SMP·REC 를 각각 조회(한쪽이 실패해도 다른 쪽은 사용). 키가 없으면 { status: 'nokey' }.
export async function loadMarket() {
  if (!hasKpxKey()) return { status: 'nokey', smp: null, rec: null, error: null }
  const [s, r] = await Promise.allSettled([fetchSmp(), fetchRec()])
  const errors = [
    s.status === 'rejected' ? `SMP: ${s.reason?.message}` : null,
    r.status === 'rejected' ? `REC: ${r.reason?.message}` : null,
  ].filter(Boolean)
  return {
    status: 'ok',
    smp: s.status === 'fulfilled' ? s.value : null,
    rec: r.status === 'fulfilled' ? r.value : null,
    error: errors.join(' / ') || null,
  }
}
