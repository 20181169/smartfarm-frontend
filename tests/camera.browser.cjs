// Built frontend + in-memory API fixtures. All external network requests are blocked.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../dist')
const plant = { plant_id: 'p1', name: '카메라 검증 발전소', capacity_kw: 100, status: 'ACTIVE' }
const plan = { plan_id: 'plan1', plant_id: 'p1', title: '검증 계획', status: 'scheduled', activity_type: 'machinery_work', planned_start_date: '2026-11-01', planned_end_date: '2026-11-30' }
const common = ['plant:read', 'vision:read', 'farming_activity:read', 'farming_plan:read', 'farming_assessment:read']
const admin = [...common, 'device:read', 'device:create', 'camera_runtime:read', 'camera_runtime:update', 'camera_capture:read', 'camera_capture:create', 'camera_capture:update']
const readonly = [...common, 'device:read', 'camera_runtime:read', 'camera_capture:read']
const dummyUrl = 'rtsp://fixture:fake-password@camera/main?token=fake-secret'

;(async () => {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://local').pathname
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end() }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream')
    res.end(fs.readFileSync(file))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) })
  const results = []
  async function session(role, permissions) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage()
    page.setDefaultTimeout(12000)
    const writes = [], errors = [], reads = []
    const devices = [{ device_id: 'c1', plant_id: 'p1', name: '시험 카메라', device_type: 'camera', status: 'active' }]
    const policies = []
    const runtimes = new Map()
    let runtimeFailure = 0
    const analysis = { analysis_id: 'a1', plant_id: 'p1', camera_id: 'c1', source_type: 'camera', status: 'candidate', captured_at: '2026-11-20T00:00:00Z', analyzed_at: '2026-11-20T00:00:01Z', model_id: 'fixture-model', detection_count: 1, detections: [{ detection_id: 'd1', label: 'tractor', confidence: .88 }], counts: { tractor: 1 } }
    const reviews = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => localStorage.setItem('dongyang_token', 'camera-fixture'))
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url())
      if (url.origin !== base) return route.abort()
      if (!url.pathname.startsWith('/api/v1/')) return route.continue()
      const api = url.pathname.slice('/api/v1'.length), method = req.method(), body = req.postDataJSON()
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
      const list = items => json({ items, total: items.length, skip: 0, limit: 100 })
      if (method === 'GET') reads.push({ api, query: Object.fromEntries(url.searchParams) })
      else writes.push({ api, method, body })
      if (api === '/auth/me') return json({ user_id: role, email: `${role}@fixture.local`, name: '검증 계정', role_code: role, role_name: role, permissions })
      if (api === '/plants') return list([plant, { ...plant, plant_id: 'p2', name: '빈 발전소' }])
      if (api === '/devices' && method === 'POST') { const device = { ...body, device_id: 'c2' }; devices.push(device); return json(device, 201) }
      if (api === '/devices') return list(devices.filter(d => d.plant_id === url.searchParams.get('plant_id')))
      if (api.startsWith('/camera-runtime-configs/')) {
        const id = api.split('/').pop()
        if (method === 'PUT') {
          if (runtimeFailure) { const status = runtimeFailure; runtimeFailure = 0; return json({ detail: dummyUrl }, status) }
          await new Promise(resolve => setTimeout(resolve, 100))
          const { main_rtsp_url, sub_rtsp_url, ...safe } = body
          const data = { ...safe, camera_device_id: id, plant_id: 'p1', camera_name: '시험 카메라', main_rtsp_configured: true, sub_rtsp_configured: !!sub_rtsp_url,
            masked_main_rtsp_url: 'rtsp://***:***@camera/main', masked_sub_rtsp_url: sub_rtsp_url ? 'rtsp://***:***@camera/sub' : null, updated_at: new Date().toISOString() }
          runtimes.set(id, data); return json(data)
        }
        return runtimes.has(id) ? json(runtimes.get(id)) : json({ detail: 'Not configured' }, 404)
      }
      if (api === '/camera-capture-policies' && method === 'POST') { const item = { ...body, policy_id: 'policy1', updated_at: new Date().toISOString() }; policies.push(item); return json(item, 201) }
      if (api === '/camera-capture-policies') return list(policies.filter(p => p.plant_id === url.searchParams.get('plant_id')))
      if (api.startsWith('/camera-capture-policies/')) {
        const item = policies.find(p => p.policy_id === api.split('/').pop())
        if (!item) return json({ detail: 'Not found' }, 404)
        if (method === 'PATCH') Object.assign(item, body, { updated_at: new Date().toISOString() })
        return json(item)
      }
      if (api === '/farming-plans') return list([plan])
      if (api === '/vision/cameras') return list([])
      if (api === '/vision/analyses') return list(!url.searchParams.get('status') || url.searchParams.get('status') === analysis.status ? [analysis] : [])
      if (api === '/vision/analyses/a1') return json(analysis)
      if (api === '/vision/analyses/a1/reviews') return list(reviews)
      if (api === '/vision/analyses/a1/review') {
        const review = { review_id: 'r1', previous_status: analysis.status, new_status: body.status, comment: body.comment, reviewed_at: '2026-11-25T00:00:00Z', reviewer_user_id: role }
        analysis.status = body.status; reviews.push(review); return json(review)
      }
      if (api.includes('/image/')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180"><rect width="300" height="180" fill="#dae8df"/></svg>' })
      if (api === '/farming-activities') return list([])
      if (api.endsWith('/matches')) return list([])
      return list([])
    })
    async function go(hash) { await page.goto(`${base}/#/${hash}`); await page.getByRole('button', { name: '로그아웃', exact: true }).waitFor() }
    async function close() { assert.deepEqual(errors, []); await context.close() }
    return { page, go, close, writes, reads, runtimes, policies, failRuntime: status => { runtimeFailure = status } }
  }
  try {
    {
      const s = await session('SYS_ADMIN', admin), { page: p } = s
      await s.go('camera-settings?plant=p1&camera=c1')
      await p.getByRole('form', { name: '카메라 접속 설정' }).waitFor()
      await p.getByLabel('메인 RTSP 주소', { exact: true }).fill(dummyUrl)
      await p.getByLabel('보조 RTSP 주소', { exact: true }).fill('rtsp://fixture:fake-password@camera/sub')
      await p.getByLabel('스트림 식별자', { exact: true }).fill('cam-1')
      if (process.env.TASK_SCREENSHOTS) { fs.mkdirSync(process.env.TASK_SCREENSHOTS, { recursive: true }); await p.screenshot({ path: path.join(process.env.TASK_SCREENSHOTS, 'camera-settings-desktop.png'), fullPage: true }) }
      await p.getByRole('button', { name: '접속 설정 저장', exact: true }).click()
      await p.getByText('현재 설정: 사용 · 메인 설정됨 · 보조 설정됨', { exact: true }).waitFor()
      assert.equal(await p.getByLabel('메인 RTSP 주소', { exact: true }).inputValue(), '')
      assert.equal(await p.getByLabel('보조 RTSP 주소', { exact: true }).inputValue(), '')
      assert.equal(s.writes.length, 1)
      assert.equal(await p.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }).includes('fake-password')), false)
      await p.getByLabel('메인 RTSP 주소', { exact: true }).fill(dummyUrl)
      await p.getByRole('button', { name: '접속 설정 저장', exact: true }).click()
      await p.getByText('기존 보조 스트림 주소를 다시 입력하거나 보조 스트림 제거를 선택해 주세요.', { exact: true }).waitFor()
      assert.equal(s.writes.length, 1)
      await p.getByLabel('기존 보조 스트림 제거', { exact: true }).check()
      s.failRuntime(409)
      await p.getByRole('button', { name: '접속 설정 저장', exact: true }).click()
      await p.getByText('설정이 충돌합니다. 스트림 식별자 중복과 최신 설정을 확인해 주세요.', { exact: true }).waitFor()
      assert.equal((await p.locator('body').innerText()).includes('fake-password'), false)
      assert.equal(await p.getByLabel('메인 RTSP 주소', { exact: true }).inputValue(), '')
      await p.getByRole('button', { name: '카메라 장비 등록', exact: true }).click()
      await p.getByRole('form', { name: '카메라 장비 등록' }).getByLabel('카메라 이름').fill('두 번째 카메라')
      await p.getByRole('button', { name: '카메라 등록', exact: true }).click()
      await p.getByRole('region', { name: '선택 카메라 설정' }).getByRole('heading', { name: '두 번째 카메라' }).waitFor()
      assert.equal(s.writes.at(-1).body.device_type, 'camera')
      await p.getByLabel('카메라 관리 발전소').selectOption('p2')
      await p.getByText('등록된 카메라가 없습니다. 카메라 장비를 먼저 등록해 주세요.', { exact: true }).waitFor()
      await s.close(); results.push('admin: runtime create, secret clearing/redaction, substream preservation, 409, device registration, plant scope')
    }
    {
      const s = await session('SYS_ADMIN', admin), { page: p } = s
      await s.go('capture-policies?plant=p1&plan=plan1&create=1')
      const form = p.getByRole('form', { name: '촬영 정책 설정' })
      await form.waitFor()
      assert.equal(await p.getByLabel('정책명', { exact: true }).inputValue(), '검증 계획 자동 촬영')
      assert.equal(await p.getByLabel('촬영 정책 영농계획', { exact: true }).inputValue(), 'plan1')
      assert.equal(await p.getByLabel('정책 사용', { exact: true }).isChecked(), false)
      await p.getByRole('button', { name: '촬영 카메라 추가', exact: true }).click()
      await p.getByLabel('촬영 카메라 1', { exact: true }).selectOption('c1')
      await p.getByText('접속 미설정 · 자동 촬영 전에 설정이 필요합니다.', { exact: true }).waitFor()
      await p.getByLabel('이벤트 자동 감지', { exact: true }).check()
      await p.getByLabel('규칙 일치 조건', { exact: true }).selectOption('all')
      await p.getByRole('button', { name: '탐지 규칙 추가', exact: true }).click()
      await p.getByLabel('규칙 2 탐지 대상', { exact: true }).fill('person')
      await p.getByRole('button', { name: '촬영 시간대 추가', exact: true }).click()
      await p.getByRole('button', { name: '촬영 정책 등록', exact: true }).click()
      await p.getByText('촬영 시간대는 서로 겹칠 수 없습니다.', { exact: true }).waitFor()
      assert.equal(s.writes.length, 0)
      await p.getByLabel('시간대 2 시작', { exact: true }).fill('18:00:00')
      await p.getByLabel('시간대 2 종료', { exact: true }).fill('19:00:00')
      await p.getByLabel('규칙 1 사용', { exact: true }).uncheck()
      await p.getByLabel('규칙 2 사용', { exact: true }).uncheck()
      await p.getByRole('button', { name: '촬영 정책 등록', exact: true }).click()
      await p.getByText('이벤트 자동 감지에는 활성 탐지 규칙이 최소 1개 필요합니다.', { exact: true }).waitFor()
      assert.equal(s.writes.length, 0)
      await p.getByLabel('규칙 1 사용', { exact: true }).check()
      await p.getByLabel('규칙 2 사용', { exact: true }).check()
      await p.getByRole('button', { name: '촬영 정책 등록', exact: true }).click()
      await p.getByRole('button', { name: '촬영 정책 저장', exact: true }).waitFor()
      assert.equal(s.writes[0].body.event_match_mode, 'all')
      assert.equal(s.writes[0].body.farming_plan_id, 'plan1')
      assert.equal(s.writes[0].body.windows.length, 2)
      assert.equal(s.writes[0].body.event_rules.length, 2)
      await p.getByRole('button', { name: '저장된 정책 활성화', exact: true }).click()
      await p.getByRole('button', { name: '정책 비활성화', exact: true }).waitFor()
      assert.deepEqual(s.writes.at(-1).body, { enabled: true })
      await p.getByRole('button', { name: '정책 비활성화', exact: true }).click()
      await p.getByRole('button', { name: '저장된 정책 활성화', exact: true }).waitFor()
      assert.deepEqual(s.writes.at(-1).body, { enabled: false })
      await p.getByLabel('정책명', { exact: true }).fill('수정한 촬영 정책')
      await p.getByRole('button', { name: '촬영 정책 저장', exact: true }).click()
      await p.getByText('촬영 정책을 저장했습니다.', { exact: true }).waitFor()
      await p.getByRole('button', { name: '촬영 정책 저장', exact: true }).waitFor()
      assert.equal(s.writes.at(-1).body.name, '수정한 촬영 정책')
      assert.equal('plant_id' in s.writes.at(-1).body, false)
      if (process.env.TASK_SCREENSHOTS) { fs.mkdirSync(process.env.TASK_SCREENSHOTS, { recursive: true }); await p.screenshot({ path: path.join(process.env.TASK_SCREENSHOTS, 'capture-policy-desktop.png'), fullPage: true }) }
      await p.setViewportSize({ width: 390, height: 844 })
      await p.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 1)
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true)
      if (process.env.TASK_SCREENSHOTS) { fs.mkdirSync(process.env.TASK_SCREENSHOTS, { recursive: true }); await p.screenshot({ path: path.join(process.env.TASK_SCREENSHOTS, 'capture-policy-mobile.png'), fullPage: true }) }
      await s.close(); results.push('admin: plan-prefilled policy, overlapping-window/rule validation, create/update, enable/disable, mobile layout')
    }
    {
      const s = await session('VIEWER', readonly), { page: p } = s
      await s.go('camera-settings?plant=p1&camera=c1')
      await p.getByRole('form', { name: '카메라 접속 설정' }).waitFor()
      assert.equal(await p.getByLabel('메인 RTSP 주소', { exact: true }).isDisabled(), true)
      assert.equal(await p.getByRole('button', { name: '접속 설정 저장', exact: true }).count(), 0)
      assert.equal(await p.getByRole('button', { name: '카메라 장비 등록', exact: true }).count(), 0)
      await s.go('capture-policies?plant=p1')
      await p.getByText('등록된 촬영 정책이 없습니다.', { exact: true }).waitFor()
      assert.equal(await p.getByRole('button', { name: '새 촬영 정책', exact: true }).count(), 0)
      assert.equal(s.writes.length, 0)
      await s.close(); results.push('read-only permissions: runtime readable but editing/registration/policy creation unavailable')
    }
    for (const role of ['INSPECTOR', 'PLANT_OPERATOR']) {
      const s = await session(role, [...common, ...(role === 'INSPECTOR' ? ['vision:review'] : ['vision:run', 'farming_activity:create'])]), { page: p } = s
      await s.go('camera-settings')
      await p.getByRole('heading', { name: '접근 권한이 없습니다', exact: true }).waitFor()
      assert.equal(await p.locator('.sidebar').getByRole('link', { name: '카메라 설정', exact: true }).count(), 0)
      await s.go('capture-policies')
      await p.getByRole('heading', { name: '접근 권한이 없습니다', exact: true }).waitFor()
      await s.go('cctv?plant=p1&evidence=a1')
      await p.getByRole('region', { name: '저장된 분석 상세' }).getByText('카메라 촬영 · 카메라 ID: c1', { exact: true }).waitFor()
      await p.getByLabel('증빙 촬영 시작일', { exact: true }).fill('2026-11-19')
      await p.getByLabel('증빙 촬영 종료일', { exact: true }).fill('2026-11-21')
      await p.getByLabel('증빙 검토 상태', { exact: true }).selectOption('candidate')
      await p.getByLabel('증빙 탐지 대상', { exact: true }).fill('tractor')
      await p.getByRole('button', { name: '증빙 검색', exact: true }).click()
      await p.getByRole('button', { name: '결과 확인', exact: true }).waitFor()
      const query = s.reads.filter(r => r.api === '/vision/analyses').at(-1).query
      assert.equal(query.from, '2026-11-19T00:00:00+09:00')
      assert.equal(query.status, 'candidate')
      assert.equal(query.label, 'tractor')
      await p.getByRole('button', { name: '결과 확인', exact: true }).click()
      if (role === 'INSPECTOR') {
        await p.getByLabel('영상 검토 결과', { exact: true }).selectOption('confirmed')
        await p.getByLabel('영상 검토 의견', { exact: true }).fill('자동 촬영 증빙 확인')
        await p.getByRole('button', { name: '검토 결과 저장', exact: true }).click()
        await p.getByText('자동 촬영 증빙 확인', { exact: true }).waitFor()
        assert.deepEqual(s.writes.at(-1).body, { status: 'confirmed', comment: '자동 촬영 증빙 확인' })
      } else {
        assert.equal(await p.getByRole('button', { name: '검토 결과 저장', exact: true }).count(), 0)
        assert.equal(s.writes.length, 0)
      }
      assert.equal(s.reads.some(r => r.api === '/devices'), false)
      await s.close(); results.push(`${role}: configuration denied, evidence metadata/date filters, permission-aware review`)
    }
    console.log(JSON.stringify({ scenarios: results.length, results, externalBusinessWrites: 0 }, null, 2))
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
})().catch(error => { console.error(error); process.exitCode = 1 })
