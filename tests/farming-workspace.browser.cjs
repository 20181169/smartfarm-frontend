// All five main tabs, shared fixture state across real-role browser contexts.
// Requests outside this temporary frontend server are blocked; no production writes.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../dist'), at = '2026-11-20T03:00:00Z'
const common = ['plant:read', 'crop_guide:read', 'vision:read', 'farming_plan:read', 'farming_activity:read', 'farming_match:read', 'farming_assessment:read', 'report:read', 'report:download']
const roles = { PLANT_OPERATOR: [...common, 'vision:run', 'farming_plan:create', 'farming_plan:update', 'farming_activity:create', 'farming_activity:update', 'report:generate'], INSPECTOR: [...common, 'vision:review', 'farming_activity:review', 'farming_match:update', 'farming_assessment:update', 'report:approve'], SYS_ADMIN: [...common, 'vision:run', 'vision:review', 'device:read', 'device:create', 'camera_runtime:read', 'camera_runtime:update', 'camera_capture:read', 'camera_capture:create', 'camera_capture:update', 'report:approve'], VIEWER: common }
const plant = { plant_id: 'p1', name: '메인 흐름 검증 발전소', capacity_kw: 100, status: 'ACTIVE' }
const tasks = [{ task_id: 't1', activity_type: 'machinery_work', title: '11월 농기계 작업', description: '가이드 작업 설명', start_month: 11, end_month: 11, display_order: 1 }, { task_id: 't2', activity_type: 'irrigation', title: '12월 용배수 점검', description: '용배수 확인', start_month: 12, end_month: 12, display_order: 2 }]
const guide = { guide_id: 'g1', crop_name: '벼', status: 'active', current_guide_version_id: 'gv1', current_version_number: 1, current_version: { guide_version_id: 'gv1', version_number: 1, tasks } }
const store = { submissions: [], plans: [], analyses: [], events: [], eventReviews: [], visionReviews: [], matches: [], reports: [], approvals: [], devices: [], policies: [], runtimes: new Map(), failMatch: true }
const analysis = id => ({ analysis_id: id, plant_id: 'p1', camera_id: null, source_type: 'upload', status: 'candidate', captured_at: at, analyzed_at: at, model_id: 'fixture', detection_count: 1, counts: { tractor: 1 }, detections: [{ detection_id: 'd1', label: 'tractor', confidence: .9 }] })
;(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://local'), file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end() }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file))
  }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) })
  const sessions = [], writes = [], results = []
  async function session(role) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } }), page = await context.newPage(), errors = []
    sessions.push(context); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(role => {
      localStorage.setItem('dongyang_token', role)
      localStorage.setItem(`farming-local-v1:${role}:p1`, JSON.stringify({ version: 1, revision: 3, plan: { id: 'legacy-sample', title: '이전 로컬 계획', crop: '벼', start: '2026-05-01', stages: [] }, records: [], reports: [], issues: [] }))
    }, role)
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url()), method = request.method()
      if (url.origin !== base) return route.abort()
      if (!url.pathname.startsWith('/api/v1/')) return route.continue()
      const api = url.pathname.slice('/api/v1'.length), body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null
      const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
      const list = items => json({ items, total: items.length, skip: 0, limit: 100 })
      if (method !== 'GET') writes.push({ role, api, method, body })
      if (api === '/auth/me') return json({ user_id: role, email: `${role}@fixture.local`, name: role === 'INSPECTOR' ? '검수 담당자' : '검증 계정', role_code: role, role_name: role, permissions: roles[role] })
      if (api === '/plants') return list([plant])
      if (api === '/crop-guides') return list([guide])
      if (api === '/crop-guides/g1') return json(guide)
      if (api === '/farming-plan-submissions' && method === 'POST') {
        assert.equal(role, 'PLANT_OPERATOR'); assert.equal(body.guide_version_id, 'gv1')
        const plans = body.task_adjustments.map((t, i) => ({ ...t, plan_id: `plan${i + 1}`, submission_id: 'submission1', plant_id: body.plant_id, activity_type: tasks[i].activity_type, plan_granularity: 'period', status: 'scheduled' }))
        store.plans.push(...plans); const item = { ...body, submission_id: 'submission1', crop_name: '벼', guide_version_number: 1, plans }; store.submissions.push(item); return json(item, 201)
      }
      if (api === '/farming-plan-submissions') return list(store.submissions)
      if (api === '/farming-plans') return list(store.plans)
      if (/^\/farming-plans\/plan\d+$/.test(api)) return json(store.plans.find(p => p.plan_id === api.split('/').pop()))
      if (api.endsWith('/matches')) {
        const planId = api.split('/')[2]
        if (method === 'POST') { if (store.failMatch) { store.failMatch = false; return json({ message: '연결 일시 실패' }, 503) } const event = store.events.find(e => e.event_id === body.event_id); store.matches.push({ match_id: 'm1', plan_id: planId, event_id: body.event_id, event_title: event.title, event_status: event.status, event_started_at: event.started_at, activity_type: event.activity_type }); return json(store.matches.at(-1), 201) }
        return list(store.matches.filter(m => m.plan_id === planId))
      }
      if (api.endsWith('/assessment-preview')) return json({ valid_event_count: store.matches.length, final_assessment: null })
      if (api.endsWith('/assessments')) return list([])
      if (api === '/vision/detect') { const item = analysis(`a${store.analyses.length + 1}`); store.analyses.push(item); return json({ ...item, analysis_id: item.analysis_id }) }
      if (api === '/vision/analyses') return list(store.analyses.filter(a => !url.searchParams.get('status') || a.status === url.searchParams.get('status')))
      if (api.includes('/image/')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180"><rect width="300" height="180" fill="#d5e8da"/></svg>' })
      if (/^\/vision\/analyses\/a\d+\/reviews$/.test(api)) return list(store.visionReviews.filter(r => r.analysis_id === api.split('/')[3]))
      if (/^\/vision\/analyses\/a\d+\/review$/.test(api)) {
        assert.equal(role, 'INSPECTOR'); const item = store.analyses.find(a => a.analysis_id === api.split('/')[3]); const review = { review_id: 'vr' + writes.length, analysis_id: item.analysis_id, previous_status: item.status, new_status: body.status, comment: body.comment, reviewed_at: at, reviewer_user_id: role }; item.status = body.status; store.visionReviews.push(review); return json(review)
      }
      if (/^\/vision\/analyses\/a\d+$/.test(api)) return json(store.analyses.find(a => a.analysis_id === api.split('/').pop()))
      if (api === '/farming-activities' && method === 'POST') {
        assert.equal(role, 'PLANT_OPERATOR'); assert.equal(body.analysis_ids.length, 2)
        const item = { ...body, event_id: 'event1', status: 'draft', started_at: at, evidence_count: body.analysis_ids.length, evidence: body.analysis_ids.map(id => ({ analysis_id: id, vision_status: 'confirmed', evidence_at: at })), created_by_user_id: role }; store.events.push(item); return json(item, 201)
      }
      if (api === '/farming-activities') return list(store.events)
      if (api === '/farming-activities/event1/reviews') return list(store.eventReviews)
      if (api === '/farming-activities/event1/review') { const item = store.events[0]; store.eventReviews.push({ review_id: 'ar' + writes.length, previous_status: item.status, new_status: body.status, comment: body.comment, reviewed_at: at, reviewer_user_id: role }); item.status = body.status; return json(store.eventReviews.at(-1)) }
      if (api === '/farming-activities/event1') { if (method === 'PATCH') { assert.equal('plant_id' in body, false); Object.assign(store.events[0], body, { status: 'draft' }) } return json(store.events[0]) }
      if (api === '/farming-plans/reports/data') return json({ plant, total_plans: store.plans.length, summary: {}, activity_summary: { confirmed_event_count: store.matches.length }, plans: store.plans.map(p => ({ ...p, matched_events: store.events.filter(e => store.matches.some(m => m.plan_id === p.plan_id && m.event_id === e.event_id)) })) })
      if (api === '/farming-plans/reports/generate') { const item = { report_id: 'report1', plant_id: 'p1', file_name: 'workflow-report.pdf', period: '2026-11-01 ~ 2026-11-30', issued_at: at }; store.reports.push(item); return json(item, 201) }
      if (api === '/farming-plans/reports/archive') return list(store.reports)
      if (api.endsWith('/download')) return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n% fixture\n%%EOF' })
      if (api.endsWith('/approval')) { if (method === 'POST') { assert.equal(role, 'INSPECTOR'); const item = { ...body, approval_id: 'approval1', reviewer_name: '검수 담당자', reviewer_role_name: role, signed_at: at }; store.approvals.unshift(item); return json(item, 201) } return json({ latest: store.approvals[0] || null, items: store.approvals, total: store.approvals.length }) }
      if (api === '/devices' && method === 'POST') { const item = { ...body, device_id: 'camera1' }; store.devices.push(item); return json(item, 201) }
      if (api === '/devices') return list(store.devices)
      if (api.startsWith('/camera-runtime-configs/')) { if (method === 'PUT') { const { main_rtsp_url, sub_rtsp_url, ...safe } = body; const item = { ...safe, camera_device_id: 'camera1', main_rtsp_configured: true, sub_rtsp_configured: false, masked_main_rtsp_url: 'rtsp://***:***@camera/main', updated_at: at }; store.runtimes.set('camera1', item); return json(item) } return store.runtimes.has('camera1') ? json(store.runtimes.get('camera1')) : json({ detail: 'Not configured' }, 404) }
      if (api === '/camera-capture-policies' && method === 'POST') { const item = { ...body, policy_id: 'policy1' }; store.policies.push(item); return json(item, 201) }
      if (api === '/camera-capture-policies') return list(store.policies)
      if (api === '/camera-capture-policies/policy1') return json(store.policies[0])
      return list([])
    })
    const go = async tab => { await page.goto(`${base}/#/farming-workspace?tab=${tab}${store.plans.length ? '&plan=plan1' : ''}`); await page.reload(); await page.getByRole('button', { name: '로그아웃', exact: true }).waitFor(); await page.getByRole('navigation', { name: '영농관리 단계', exact: true }).waitFor() }
    const check = () => { assert.ok(new URL(page.url()).hash.startsWith('#/farming-workspace')); assert.deepEqual(errors, []) }
    return { page, go, check, context }
  }
  try {
    const op = await session('PLANT_OPERATOR'), p = op.page
    await op.go('plan'); await p.getByRole('form', { name: '운영 연간계획 작성', exact: true }).waitFor()
    await p.getByLabel('가용 인력', { exact: true }).fill('3'); await p.getByLabel('사용 장비', { exact: true }).fill('트랙터 1대')
    await p.getByLabel('재배 연도', { exact: true }).selectOption('2026'); await p.getByRole('button', { name: '2026년 가이드 일정 적용', exact: true }).click()
    assert.equal(await p.getByLabel('사용 장비', { exact: true }).inputValue(), '트랙터 1대')
    await p.getByRole('button', { name: '가이드 일정으로 영농계획 등록', exact: true }).click()
    await p.getByLabel('작업 계획 선택', { exact: true }).waitFor(); assert.equal(store.submissions.length, 1); assert.equal(store.plans.length, 2); op.check()
    await p.getByRole('button', { name: '이 계획의 사진 확인', exact: true }).click()
    await p.getByText('사진 업로드 · AI 분석', { exact: true }).click()
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=', 'base64')
    await p.getByLabel('분석할 사진', { exact: true }).setInputFiles([{ name: 'one.png', mimeType: 'image/png', buffer: image }, { name: 'two.png', mimeType: 'image/png', buffer: image }])
    await p.getByRole('button', { name: '선택한 사진 분석', exact: true }).click()
    await p.getByLabel('운영 증빙 a2', { exact: true }).waitFor(); assert.equal(await p.getByLabel('운영 증빙 a1', { exact: true }).isDisabled(), true); op.check()
    const inspector = await session('INSPECTOR'), ip = inspector.page; await inspector.go('gallery')
    assert.equal(await ip.getByLabel('시연 역할', { exact: true }).count(), 0)
    for (const id of ['a1', 'a2']) { await ip.getByRole('button', { name: `사진 ${id} 상세`, exact: true }).click(); await ip.getByLabel('사진 검토 결과', { exact: true }).selectOption('confirmed'); await ip.getByLabel('사진 검토 의견', { exact: true }).fill('작업 사진 확인'); await ip.getByRole('button', { name: '사진 검토 저장', exact: true }).click(); await ip.getByRole('region', { name: '운영 사진 상세', exact: true }).getByRole('heading', { name: '사진 상세 · 확정', exact: true }).waitFor() }
    await p.getByRole('button', { name: '사진 목록 새로고침', exact: true }).click(); await p.getByLabel('운영 증빙 a1', { exact: true }).check(); await p.getByLabel('운영 증빙 a2', { exact: true }).check(); await p.getByRole('button', { name: '수행 내용 작성', exact: true }).click()
    await p.getByLabel('수행 내용', { exact: true }).fill('사진 두 장을 묶어 작업 내용을 제출합니다.'); await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.getByRole('button', { name: '수행 기록 제출', exact: true }).waitFor(); assert.equal(await p.getByLabel('수행 내용', { exact: true }).inputValue(), '사진 두 장을 묶어 작업 내용을 제출합니다.'); await p.getByRole('button', { name: '수행 기록 제출', exact: true }).click(); await p.getByRole('region', { name: '운영 수행 기록 상세', exact: true }).waitFor(); assert.equal(store.events[0].evidence.length, 2); op.check()
    await inspector.go('records'); await ip.getByRole('button', { name: '수행 기록 상세·검토', exact: true }).click(); await ip.getByLabel('수행 기록 검토 결과', { exact: true }).selectOption('cancelled'); await ip.getByLabel('수행 기록 검토 의견', { exact: true }).fill('작업 내용을 보완해 주세요.'); await ip.getByRole('button', { name: '수행 기록 검토 저장', exact: true }).click(); await ip.getByRole('region', { name: '운영 수행 기록 상세' }).locator('.fw-panel-head .fw-tag').filter({ hasText: '반려' }).waitFor(); assert.equal(store.events[0].status, 'cancelled')
    await p.reload(); await p.getByRole('button', { name: '수행 기록 보완·재제출', exact: true }).click(); await p.getByLabel('수행 내용', { exact: true }).fill('작업 내용을 상세히 보완했습니다.'); await p.getByRole('button', { name: '보완 후 다시 제출', exact: true }).click(); await p.getByRole('button', { name: '수행 기록 보완·재제출', exact: true }).waitFor({ state: 'hidden' }); assert.equal(store.events.length, 1); assert.equal(store.events[0].status, 'draft')
    await inspector.go('records'); await ip.getByRole('button', { name: '수행 기록 상세·검토', exact: true }).click(); await ip.getByLabel('수행 기록 검토 의견', { exact: true }).fill('보완 내용 확인'); await ip.getByRole('button', { name: '수행 기록 검토 저장', exact: true }).click(); await ip.getByRole('button', { name: '계획 연결 다시 시도', exact: true }).waitFor(); const confirmations = writes.filter(w => w.api.endsWith('/event1/review') && w.body.status === 'confirmed').length; await ip.getByRole('button', { name: '계획 연결 다시 시도', exact: true }).click(); await ip.getByRole('region', { name: '운영 수행 기록 상세' }).getByText('연결된 계획: 11월 농기계 작업', { exact: true }).waitFor(); assert.equal(writes.filter(w => w.api.endsWith('/event1/review') && w.body.status === 'confirmed').length, confirmations); inspector.check()
    await op.go('reports'); await p.getByRole('button', { name: '운영 PDF 보고서 생성', exact: true }).click(); await p.getByRole('article', { name: '보관 보고서 report1', exact: true }).waitFor()
    await inspector.go('reports'); await ip.getByRole('button', { name: '보고서 검토·서명', exact: true }).click(); await ip.getByRole('button', { name: '승인 대상 PDF 미리보기', exact: true }).click(); await ip.getByTitle('승인 대상 PDF: 2026-11-01 ~ 2026-11-30').waitFor(); await ip.getByLabel('보고서 최종 검토 의견', { exact: true }).fill('보고서 확인'); await ip.getByRole('button', { name: '보고서 승인', exact: true }).click(); await ip.getByRole('button', { name: '승인 확정', exact: true }).click(); await ip.getByText('승인 완료 · 검수 담당자 / INSPECTOR', { exact: true }).waitFor(); inspector.check()
    await op.go('reports'); const download = p.waitForEvent('download'); await p.getByRole('button', { name: 'PDF 다운로드', exact: true }).click(); assert.equal((await download).suggestedFilename(), 'workflow-report.pdf')
    await op.go('issues'); await p.getByLabel('현장 확인 메모 제목', { exact: true }).fill('개인 메모'); await p.getByLabel('현장 확인 메모 내용', { exact: true }).fill('현장 특이 사항을 기록합니다.'); const beforeNotes = writes.length; await p.getByRole('button', { name: '개인 현장 메모 저장', exact: true }).click(); await p.getByRole('heading', { name: '개인 메모', exact: true }).waitFor(); assert.equal(writes.length, beforeNotes)
    await p.getByRole('button', { name: '샘플 시연', exact: true }).click(); await p.getByRole('heading', { name: '이전 로컬 계획', exact: true }).waitFor(); assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('farming-local-v1:PLANT_OPERATOR:p1')).revision), 3)
    results.push('main five tabs: server guide/year/annual submission, batch upload, inspector photo confirmation, two-photo activity, rejection/resubmission, link-only retry, report approval/download, local-only field notes, sample preservation')
    const admin = await session('SYS_ADMIN'), ap = admin.page; await admin.go('plan'); await ap.getByRole('button', { name: '카메라 · 자동 촬영 설정', exact: true }).click(); await ap.getByRole('button', { name: '카메라 장비 등록', exact: true }).click(); await ap.getByRole('form', { name: '카메라 장비 등록', exact: true }).getByLabel('카메라 이름').fill('메인 화면 카메라'); await ap.getByRole('button', { name: '카메라 등록', exact: true }).click(); await ap.getByLabel('메인 RTSP 주소', { exact: true }).fill('rtsp://fixture:fake-password@camera/main'); await ap.getByLabel('스트림 식별자', { exact: true }).fill('main-cam'); await ap.getByRole('button', { name: '접속 설정 저장', exact: true }).click(); await ap.getByText('카메라 접속 설정을 저장했습니다.', { exact: true }).waitFor(); await ap.getByRole('button', { name: '다음: 자동 촬영 정책 설정', exact: true }).click(); await ap.getByRole('button', { name: '새 촬영 정책', exact: true }).click(); await ap.getByRole('button', { name: '촬영 카메라 추가', exact: true }).click(); await ap.getByRole('combobox', { name: '촬영 카메라 1', exact: true }).selectOption('camera1'); await ap.getByLabel('이벤트 자동 감지', { exact: true }).check(); await ap.getByRole('button', { name: '촬영 정책 등록', exact: true }).click(); await ap.getByRole('button', { name: '촬영 정책 저장', exact: true }).waitFor(); assert.equal(store.policies[0].farming_plan_id, 'plan1'); admin.check()
    assert.equal(await ap.locator('.farming-workspace a[href]').count(), 0)
    if (process.env.TASK_SCREENSHOTS) { fs.mkdirSync(process.env.TASK_SCREENSHOTS, { recursive: true }); await ap.screenshot({ path: path.join(process.env.TASK_SCREENSHOTS, 'main-plan-camera.png'), fullPage: true }) }
    await ap.setViewportSize({ width: 390, height: 844 }); await ap.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 1); assert.equal(await ap.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true)
    if (process.env.TASK_SCREENSHOTS) await ap.screenshot({ path: path.join(process.env.TASK_SCREENSHOTS, 'main-mobile.png'), fullPage: true })
    results.push('admin configures camera runtime and plan-linked event policy entirely within the main page; desktop/mobile remain usable')
    const viewer = await session('VIEWER'), vp = viewer.page; await viewer.go('plan'); assert.equal(await vp.getByRole('button', { name: '새 연간계획 작성', exact: true }).count(), 0); assert.equal(await vp.getByRole('button', { name: '카메라 · 자동 촬영 설정', exact: true }).count(), 0); await viewer.go('gallery'); assert.equal(await vp.getByLabel('운영 증빙 a1', { exact: true }).count(), 0); assert.equal(await vp.getByLabel('사진 검토 결과', { exact: true }).count(), 0); viewer.check()
    results.push('read-only account sees operational data without registration/review controls')
    console.log(JSON.stringify({ passed: results, externalBusinessWrites: 0 }, null, 2))
  } catch (error) {
    if (process.env.TASK_SCREENSHOTS) {
      fs.mkdirSync(process.env.TASK_SCREENSHOTS, { recursive: true })
      for (let i = 0; i < sessions.length; i++) for (const page of sessions[i].pages()) {
        await page.screenshot({ path: path.join(process.env.TASK_SCREENSHOTS, `workspace-failure-${i}.png`), fullPage: true }).catch(() => {})
        fs.writeFileSync(path.join(process.env.TASK_SCREENSHOTS, `workspace-failure-${i}.txt`), await page.locator('body').innerText().catch(() => 'Page unavailable'))
      }
    }
    throw error
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
})().catch(e => { console.error(e); process.exitCode = 1 })
