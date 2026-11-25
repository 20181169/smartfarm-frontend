// Run after npm run build. Requires Playwright and a Chromium browser.
// All API responses are fixtures; every non-local/non-fixture request is blocked.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = process.env.TASK_FRONTEND_DIST || path.resolve(__dirname, '../dist');
const date = '2026-10-22T01:00:00Z';
const plant = {plant_id:'p1', name:'검증 발전소', capacity_kw:100, status:'ACTIVE'};
const basePlan = {plan_id:'plan1',plant_id:'p1',title:'검증 계획',activity_type:'machinery_work',description:'계획 설명',plan_granularity:'period',planned_start_date:'2026-10-01',planned_end_date:'2026-10-31',status:'scheduled'};
const vision = id => ({analysis_id:id,plant_id:'p1',status:'confirmed',model_id:'test-model',analyzed_at:date,captured_at:date,detection_count:1,counts:{tractor:1},detections:[{label:'tractor',confidence:.9}]});
const event = (id,status,analysis) => ({event_id:id,plant_id:'p1',title:id==='returned'?'반려된 경운 작업':id==='draft1'?'검토할 작업':'다른 활동',activity_type:'machinery_work',description:'작업 설명',status,started_at:date,ended_at:null,evidence_count:1,created_by_user_id:'operator',confirmed_by_user_id:null,confirmed_at:null,evidence:[{analysis_id:analysis,vision_status:'confirmed',evidence_at:date}]});
const readonly = ['plant:read','vision:read','farming_activity:read','farming_plan:read','farming_assessment:read','farming_match:read','report:read','report:download'];
const roles = {
  PLANT_OPERATOR: [...readonly,'farming_activity:create','farming_activity:update','farming_plan:create','farming_plan:update','farming_plan:cancel','report:generate'],
  INSPECTOR: [...readonly,'vision:review','farming_activity:review','farming_assessment:update','farming_match:update','report:approve'],
  SYS_ADMIN: [...readonly,'vision:review','farming_activity:review','farming_activity:update','farming_activity:create','farming_plan:update','farming_plan:cancel','farming_match:update','farming_assessment:update','report:approve'],
  VIEWER: readonly,
};
(async () => {
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+(new URL(req.url,'http://local').pathname==='/'?'/index.html':new URL(req.url,'http://local').pathname));
  if(!file.startsWith(path.resolve(root)+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end()}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const results=[];
 async function session(role, shared) {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),p=await context.newPage(),writes=[],errors=[];
  p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>localStorage.setItem('dongyang_token','fixture-token'));
  const store=shared||{events:[event('returned','cancelled','own'),event('other','confirmed','used'),event('draft1','draft','review')],reviews:{returned:[{review_id:'old-review',previous_status:'draft',new_status:'cancelled',comment:'제목을 정정해 주세요',reviewed_at:date,reviewer_user_id:'inspector'}],other:[],draft1:[]},plan:{...basePlan},matches:[],approvals:[],reports:[{report_id:'report1',plant_id:'p1',period:'2026-10',file_name:'report.pdf',issued_at:date}]};
  const {events,reviews,plan,matches,approvals,reports}=store;
  let failure=null, activeRole=role;
  function failOnce(url,status){failure={url,status}}
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(!url.pathname.startsWith('/api/v1/'))return url.origin===base?route.continue():route.abort();
   const api=url.pathname.slice(7),method=req.method(),json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   const list=items=>{const skip=Number(url.searchParams.get('skip')||0),limit=Number(url.searchParams.get('limit')||100);return json({items:items.slice(skip,skip+limit),total:items.length,skip,limit})};
   let body;
   if(method!=='GET'){
    body=req.postDataJSON();writes.push({api,method,body});
    if(failure?.url===api){const status=failure.status;failure=null;return json({detail:status===409?'상태가 변경되었습니다. 새로 조회해 주세요.':'작업 권한이 없습니다.'},status)}
    await new Promise(r=>setTimeout(r,120));
   }
   if(api==='/auth/me')return json({user_id:activeRole,name:'검증 사용자',email:activeRole+'@fixture.local',role_code:activeRole,role_name:activeRole,level:activeRole==='PLANT_OPERATOR'?70:10,permissions:roles[activeRole]});
   if(api==='/plants')return list([plant]);
   if(api==='/farming-activities'&&method==='POST'){
    assert.ok(body.analysis_ids.length);const a={...event('new-event','draft',body.analysis_ids[0]),...body};events.push(a);reviews[a.event_id]=[];return json(a,201);
   }
   if(api==='/farming-activities')return list(events);
   const activityMatch=api.match(/^\/farming-activities\/([^/]+)(\/reviews|\/review)?$/);
   if(activityMatch){const [,id,suffix]=activityMatch,a=events.find(e=>e.event_id===id);assert.ok(a,'unknown event');
    if(suffix==='/reviews')return list(reviews[id]);
    if(method==='PATCH'&&suffix==='/review'){reviews[id].unshift({review_id:'review-'+writes.length,previous_status:a.status,new_status:body.status,comment:body.comment,reviewed_at:date,reviewer_user_id:role});a.status=body.status;return json(reviews[id][0]);}
    if(method==='PATCH'){assert.equal(a.status,'cancelled');assert.ok(!('plant_id'in body));assert.ok(!('status'in body));Object.assign(a,body,{status:'draft',confirmed_by_user_id:null,confirmed_at:null});return json(a)}
    return json(a);
   }
   if(api==='/vision/analyses')return list(['own','used','free','review','wrong','pending'].map(vision).map(a=>a.analysis_id==='wrong'?{...a,plant_id:'p2'}:a.analysis_id==='pending'?{...a,status:'pending'}:a));
   if(api.endsWith('/image/annotated')||api.endsWith('/image/source'))return route.fulfill({status:404});
   if(api.match(/^\/vision\/analyses\/[^/]+\/reviews$/))return list([{review_id:'vr1',previous_status:'candidate',new_status:'confirmed',comment:'AI 증빙 검토 완료',reviewed_at:date,reviewer_user_id:'inspector'}]);
   if(api.startsWith('/vision/analyses/'))return json(vision(api.split('/')[3]));
   if(api==='/farming-plans/reports/generate'&&method==='POST')return json(reports[0],201);
   if(api==='/farming-plans/reports/archive')return list(reports);
   if(api==='/farming-plans/reports/archive/report1/download')return route.fulfill({status:200,contentType:'application/pdf',body:'%PDF-1.4\n% fixture report\n%%EOF'});
   if(api==='/farming-plans/reports/archive/report1/approval'){
    if(method==='POST'){assert.deepEqual(Object.keys(body).sort(),['comment','decision']);const r={approval_id:'ap'+writes.length,report_id:'report1',reviewer_name:'실제 검토자',reviewer_role_name:'점검자',reviewer_role_code:role,signed_at:date,decision:body.decision,comment:body.comment};approvals.unshift(r);return json(r,201)}
    return json({report_id:'report1',latest:approvals[0]||null,items:approvals,total:approvals.length});
   }
   if(api==='/farming-plans/reports/data')return json({plant,plant_id:'p1',summary:{},activity_summary:{confirmed_event_count:matches.length,vision_evidence_count:matches.length},plans:matches.length?[{...plan,plan_status:plan.status,phase:'review_required',valid_event_count:matches.length,invalidated_event_count:0,matched_events:matches.map(m=>{const a=events.find(e=>e.event_id===m.event_id);return {...a,event_status:a.status,is_valid_evidence:true,vision_evidence:a.evidence.map(e=>({...e,status:'confirmed',detections:[]}))}})}]:[],total_plans:matches.length?1:0,from_date:url.searchParams.get('from_date'),to_date:url.searchParams.get('to_date'),generated_at:date});
   if(api==='/farming-plans')return list([plan]);
   if(api==='/farming-plans/plan1'&&method==='PATCH'){Object.assign(plan,body);return json(plan)}
   if(api==='/farming-plans/plan1')return json(plan);
   if(api.endsWith('/cancel')){plan.status='cancelled';return json(plan)}
   if(api.endsWith('/match-candidates'))return list(events.filter(e=>e.status==='confirmed'));
   if(api.endsWith('/matches')){if(method==='POST'){matches.push({match_id:'m1',plan_id:'plan1',event_id:body.event_id,event_title:'다른 활동',event_status:'confirmed',event_started_at:date,activity_type:'machinery_work'});return json(matches[0],201)}return list(matches)}
   if(api.endsWith('/assessment-preview'))return json({phase:'monitoring',valid_event_count:matches.length,invalidated_event_count:0,valid_event_ids:matches.map(m=>m.event_id),final_assessment:null});
   if(api.endsWith('/assessments'))return list([]);
   return list([]);
  });
  async function go(where){await p.goto(base+'/#/'+where);await p.getByRole('button',{name:'로그아웃'}).waitFor()}
  async function detail(title){await p.locator('.workflow-list > li').filter({hasText:title}).getByRole('button',{name:/^(활동 상세|검토하기)$/}).click();await p.getByRole('region',{name:'영농활동 상세',exact:true}).getByRole('heading',{name:title,exact:true}).waitFor()}
  async function close(){assert.deepEqual(errors,[]);await context.close()}
  return {p,writes,go,detail,close,failOnce,store,context,setRole:value=>{activeRole=value}};
 }
 try {
  {
   const s=await session('PLANT_OPERATOR'),{p}=s;await s.go('my-compliance');
   await p.getByRole('button',{name:'영농활동 등록',exact:true}).click();await p.getByLabel('활동 제목',{exact:true}).fill('새 경운 작업');
   await p.getByLabel('증빙 free',{exact:true}).waitFor();
   for(const id of ['used','own','wrong','pending','review'])assert.equal(await p.getByLabel('증빙 '+id,{exact:true}).count(),0);
   await p.getByLabel('증빙 free',{exact:true}).check();await p.getByRole('button',{name:'활동 제출',exact:true}).click();
   await p.getByText('영농활동을 제출했습니다. 검수자가 증빙과 활동을 검토하고 계획에 연결할 수 있습니다.',{exact:true}).waitFor();
   assert.equal(s.writes.filter(w=>w.api==='/farming-activities').length,1);
   assert.equal(await p.getByRole('button',{name:'활동 검토 저장',exact:true}).count(),0);
   await s.detail('반려된 경운 작업');await p.getByRole('button',{name:'영농활동 수정 및 재제출',exact:true}).click();
   await p.getByRole('region',{name:'영농활동 수정 및 재제출',exact:true}).getByText('제목을 정정해 주세요',{exact:true}).waitFor();
   await p.getByLabel('증빙 own',{exact:true}).waitFor();assert.equal(await p.getByLabel('증빙 own',{exact:true}).isChecked(),true);
   await p.getByLabel('활동 제목',{exact:true}).fill('정정한 경운 작업');
   s.failOnce('/farming-activities/returned',409);await p.getByRole('button',{name:'수정 후 재제출',exact:true}).click();await p.getByText('상태가 변경되었습니다. 새로 조회해 주세요.',{exact:true}).waitFor();
   await p.getByRole('button',{name:'수정 후 재제출',exact:true}).click();await p.getByText('영농활동을 제출했습니다. 검수자가 증빙과 활동을 검토하고 계획에 연결할 수 있습니다.',{exact:true}).waitFor();
   const last=s.writes.at(-1);assert.equal(last.method,'PATCH');assert.equal(last.api,'/farming-activities/returned');assert.deepEqual(Object.keys(last.body).sort(),['activity_type','analysis_ids','description','title']);
   await p.getByRole('region',{name:'검토 이력',exact:true}).getByText('제목을 정정해 주세요',{exact:true}).waitFor();
   assert.equal(await p.getByRole('button',{name:'영농활동 수정 및 재제출',exact:true}).count(),0);
   await s.go('compliance-report');await p.getByText('승인 · 서명 확인',{exact:true}).click();await p.getByRole('region',{name:'보고서 승인 및 서명',exact:true}).getByText('승인 대기',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'보고서 승인',exact:true}).count(),0);
   await s.close();results.push('operator: eligible evidence, create, 409, same-event resubmit, preserved history, no self-review/approval');
  }
  {
   const s=await session('INSPECTOR'),{p}=s;await s.go('my-compliance');assert.equal(await p.getByRole('button',{name:'영농활동 등록',exact:true}).count(),0);
   await s.detail('반려된 경운 작업');assert.equal(await p.getByRole('button',{name:'영농활동 수정 및 재제출',exact:true}).count(),0);
   await s.detail('검토할 작업');await p.getByLabel('활동 검토 결과',{exact:true}).selectOption('cancelled');assert.equal(await p.getByRole('button',{name:'활동 검토 저장',exact:true}).isDisabled(),true);
   await p.getByLabel('활동 검토 의견',{exact:true}).fill('증빙 보완 필요');s.failOnce('/farming-activities/draft1/review',403);
   await p.getByRole('button',{name:'활동 검토 저장',exact:true}).click();await p.getByRole('alert').filter({hasText:'권한이 없습니다'}).waitFor();
   await p.getByRole('button',{name:'활동 검토 저장',exact:true}).click();await p.getByText('반려 사유',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'활동 검토 저장',exact:true}).count(),0);
   await s.go('compliance-report');await p.getByRole('button',{name:'보고서 검토·서명',exact:true}).click();await p.getByRole('region',{name:'보고서 승인 및 서명',exact:true}).getByText('승인 대기',{exact:true}).waitFor();
   await p.getByRole('button',{name:'보고서 반려',exact:true}).click();assert.equal(await p.getByRole('button',{name:'반려 확정',exact:true}).isDisabled(),true);
   await p.getByLabel('보고서 최종 검토 의견',{exact:true}).fill('보고서 증빙 확인 필요');await p.getByRole('button',{name:'반려 확정',exact:true}).click();await p.getByText('반려 · 실제 검토자 / 점검자',{exact:true}).waitFor();
   await p.getByRole('button',{name:'보고서 승인',exact:true}).click();await p.getByRole('button',{name:'승인 확정',exact:true}).click();await p.getByText('승인 완료 · 실제 검토자 / 점검자',{exact:true}).waitFor();
   assert.equal(await p.getByText('반려 · 실제 검토자 / 점검자',{exact:true}).count(),1);assert.equal(s.writes.filter(w=>w.api.endsWith('/approval')).length,2);
   if(process.env.TASK_SCREENSHOTS) {
    await p.getByRole('region',{name:'보고서 승인 및 서명',exact:true}).screenshot({path:path.join(process.env.TASK_SCREENSHOTS,'report-approval.png')});
    await p.setViewportSize({width:390,height:844});
    await p.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right <= 1);
    await p.getByRole('region',{name:'보고서 승인 및 서명',exact:true}).screenshot({path:path.join(process.env.TASK_SCREENSHOTS,'report-approval-mobile.png')});
    await p.setViewportSize({width:1440,height:1000});
   }
   await s.go('cctv');await p.getByRole('button',{name:'결과 확인',exact:true}).first().click();await p.getByText('AI 증빙 검토 완료',{exact:true}).waitFor();await p.getByRole('button',{name:'원본 이미지',exact:true}).click();await p.getByText('저장된 증빙 이미지가 없습니다.',{exact:true}).waitFor();
   assert.equal(await p.getByRole('button',{name:'현재 프레임 분석',exact:true}).count(),0);
   await s.close();results.push('inspector: cannot edit, rejection required, 403, report approval identity/history, Vision review history/source image');
  }
  {
   const s=await session('SYS_ADMIN'),{p}=s;await s.go('plan-assessment');await p.getByRole('button',{name:'계획 수정',exact:true}).click();await p.getByLabel('수정 계획명',{exact:true}).fill('수정 계획');await p.getByRole('button',{name:'계획 수정 저장',exact:true}).click();await p.getByRole('heading',{name:'수정 계획',exact:true}).waitFor();
   await p.getByRole('button',{name:'확정된 영농활동 연결',exact:true}).click();await p.getByLabel('연결할 활동',{exact:true}).selectOption('other');await p.getByRole('button',{name:'활동 연결',exact:true}).click();await p.getByText('연결된 활동 · 증빙 (1건)',{exact:true}).waitFor();
   await p.getByRole('button',{name:'계획 취소',exact:true}).click();await p.getByRole('button',{name:'계획 취소 확정',exact:true}).click();await p.getByText('취소되었거나 평가에서 제외된 계획입니다. 기존 평가 이력만 확인할 수 있습니다.',{exact:true}).waitFor();
   assert.equal(await p.getByRole('button',{name:'계획 수정',exact:true}).count(),0);assert.deepEqual(s.writes.map(w=>[w.method,w.api]),[['PATCH','/farming-plans/plan1'],['POST','/farming-plans/plan1/matches'],['PATCH','/farming-plans/plan1/cancel']]);
   await s.close();results.push('admin: plan edit, confirmed event matching, cancel and read-only cancelled state');
  }
  {
   const s=await session('VIEWER'),{p}=s;await s.go('my-compliance');await s.detail('반려된 경운 작업');assert.equal(await p.getByRole('button',{name:'영농활동 등록',exact:true}).count(),0);assert.equal(await p.getByRole('button',{name:'영농활동 수정 및 재제출',exact:true}).count(),0);
   await s.go('plan-assessment');await p.getByRole('heading',{name:'검증 계획',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'계획 수정',exact:true}).count(),0);assert.deepEqual(s.writes,[]);await s.close();results.push('viewer: read-only activity and plan screens');
  }
  {
   const operator=await session('PLANT_OPERATOR'),p=operator.p;
   await operator.go('plan-assessment?plant=p1&plan=plan1');
   await p.getByRole('link',{name:'이 계획의 활동 등록',exact:true}).click();
   await p.getByLabel('활동 제목',{exact:true}).waitFor();
   assert.equal(await p.getByLabel('작성 기준 계획',{exact:true}).inputValue(),'plan1');
   assert.equal(await p.getByLabel('활동 작업 유형',{exact:true}).inputValue(),'machinery_work');
   assert.equal(await p.getByLabel('활동 작업 유형',{exact:true}).isDisabled(),true);
   await p.getByLabel('활동 제목',{exact:true}).fill('계획 연결 통합 테스트');
   await p.getByLabel('증빙 free',{exact:true}).check();
   if(process.env.TASK_SCREENSHOTS)await p.getByRole('region',{name:'영농활동 등록',exact:true}).screenshot({path:path.join(process.env.TASK_SCREENSHOTS,'plan-activity-create.png')});
   await p.getByRole('button',{name:'활동 제출',exact:true}).click();
   await p.getByRole('region',{name:'영농활동 상세',exact:true}).getByRole('heading',{name:'계획 연결 통합 테스트',exact:true}).waitFor();
   const inspector=await session('INSPECTOR',operator.store),review=inspector.p;
   await inspector.go('my-compliance?plant=p1&plan=plan1&activity=new-event');
   await review.getByLabel('활동 검토 결과',{exact:true}).selectOption('confirmed');
   await review.getByLabel('활동 연결 계획',{exact:true}).selectOption('plan1');
   inspector.failOnce('/farming-plans/plan1/matches',409);
   await review.getByRole('button',{name:'활동 확정 및 계획 연결',exact:true}).click();
   await review.getByRole('button',{name:'계획 연결 다시 시도',exact:true}).waitFor();
   assert.equal(operator.store.events.find(a=>a.event_id==='new-event').status,'confirmed');
   assert.equal(operator.store.matches.length,0);
   await review.getByRole('button',{name:'계획 연결 다시 시도',exact:true}).click();
   await review.getByText('계획 연결 완료',{exact:true}).waitFor();
   assert.equal(inspector.writes.filter(w=>w.api==='/farming-activities/new-event/review').length,1);
   assert.equal(operator.store.matches[0].event_id,'new-event');
   if(process.env.TASK_SCREENSHOTS)await review.getByRole('region',{name:'영농활동 상세',exact:true}).screenshot({path:path.join(process.env.TASK_SCREENSHOTS,'activity-linked-review.png')});
   await p.reload();await p.getByText('계획 연결 완료',{exact:true}).waitFor();
   await p.getByRole('region',{name:'영농활동 상세',exact:true}).getByRole('link',{name:'계획 상세',exact:false}).click();
   await p.getByText('연결된 활동 · 증빙 (1건)',{exact:true}).waitFor();
   await p.getByRole('link',{name:'이 기간의 보고서',exact:true}).click();
   assert.equal(await p.getByLabel('시작일',{exact:true}).inputValue(),'2026-10-01');
   assert.equal(await p.getByLabel('종료일',{exact:true}).inputValue(),'2026-10-31');
   await p.getByRole('button',{name:'PDF 보고서 생성',exact:true}).click();
   await p.getByText('PDF 보고서를 생성하여 보관했습니다.',{exact:false}).waitFor();
   await inspector.go('compliance-report?plant=p1&from=2026-10-01&to=2026-10-31');
   await review.getByRole('button',{name:'보고서 검토·서명',exact:true}).click();
   await review.getByRole('button',{name:'보고서 승인',exact:true}).click();
   await review.getByRole('button',{name:'승인 확정',exact:true}).click();
   await review.getByRole('group',{name:'보고서 승인 상태',exact:true}).getByText('승인 완료',{exact:true}).waitFor();
   await p.reload();await p.getByRole('group',{name:'보고서 승인 상태',exact:true}).getByText('승인 완료',{exact:true}).waitFor();
   const downloadEvent=p.waitForEvent('download');await p.getByRole('button',{name:'PDF 다운로드',exact:true}).first().click();assert.equal((await downloadEvent).suggestedFilename(),'report.pdf');
   const admin=await session('SYS_ADMIN',operator.store);await admin.go('my-compliance?plant=p1&activity=new-event');await admin.p.getByText('계획 연결 완료',{exact:true}).waitFor();assert.deepEqual(admin.writes,[]);
   await admin.go('plan-assessment?plant=p1&plan=plan1');await admin.p.getByRole('button',{name:'계획 수정',exact:true}).click();await admin.p.getByLabel('수정 작업 유형',{exact:true}).selectOption('harvesting');await admin.p.getByRole('button',{name:'계획 수정 저장',exact:true}).click();await admin.p.getByRole('alert').filter({hasText:'이미 연결된 확정 활동과 맞지 않습니다'}).waitFor();assert.deepEqual(admin.writes,[]);
   await operator.close();await inspector.close();await admin.close();
   results.push('integrated: operator plan-to-activity, inspector approval + link-only retry, shared persisted links, plan-period report generation, inspector final approval, operator download, admin read-only verification');
  }
  {
   const s=await session('PLANT_OPERATOR'),{p}=s;
   s.store.plan.planned_start_date='2999-11-02';s.store.plan.planned_end_date='2999-11-02';
   await s.go('plan-assessment?plant=p1&plan=plan1');await p.getByRole('link',{name:'이 계획의 활동 등록',exact:true}).click();
   await p.getByLabel('증빙 free',{exact:true}).check();await p.getByRole('alert').filter({hasText:'계획 기간'}).waitFor();assert.equal(await p.getByRole('button',{name:'활동 제출',exact:true}).isDisabled(),true);assert.deepEqual(s.writes,[]);await s.close();
   const inspector=await session('INSPECTOR');inspector.store.plan.planned_start_date='2999-11-02';inspector.store.plan.planned_end_date='2999-11-02';await inspector.go('plan-assessment?plant=p1&plan=plan1');await inspector.p.getByLabel('평가 결과',{exact:true}).waitFor();assert.equal(await inspector.p.getByLabel('평가 결과',{exact:true}).isDisabled(),true);await inspector.p.getByText('2999-11-03',{exact:true}).waitFor();assert.deepEqual(inspector.writes,[]);await inspector.close();
   results.push('validation: mismatched evidence dates blocked before submission, future final assessment disabled with eligibility date, linked-plan incompatible edits blocked without writes');
  }
  {
   const s=await session('PLANT_OPERATOR'),{p}=s;await s.go('my-compliance');await p.getByRole('button',{name:'영농활동 등록',exact:true}).waitFor();
   const second=await s.context.newPage();await second.goto(base+'/');s.setRole('INSPECTOR');await second.evaluate(()=>localStorage.setItem('dongyang_token','inspector-fixture-token'));
   await p.getByText('INSPECTOR · 검증 사용자',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'영농활동 등록',exact:true}).count(),0);
   s.setRole('SYS_ADMIN');await second.evaluate(()=>localStorage.setItem('dongyang_token','admin-fixture-token'));await p.getByText('SYS_ADMIN · 검증 사용자',{exact:true}).waitFor();assert.deepEqual(s.writes,[]);await s.close();
   results.push('cross-tab: token changes restore the correct role and controls without page refresh');
  }
  {
   for(const role of ['INSPECTOR','SYS_ADMIN']) {
    const s=await session(role),{p}=s;await s.go('oversight');
    const tasks=p.getByRole('region',{name:'현장관리자 검토 업무',exact:true});await tasks.waitFor();
    await tasks.getByRole('link',{name:'영농활동 검토 바로가기',exact:true}).waitFor();
    if(process.env.TASK_SCREENSHOTS&&role==='INSPECTOR')await tasks.screenshot({path:path.join(process.env.TASK_SCREENSHOTS,'reviewer-task-entry.png')});
    await tasks.getByRole('link',{name:'영농활동 검토 바로가기',exact:true}).click();
    await p.getByRole('group',{name:'영농활동 검토 분류',exact:true}).waitFor();
    assert.equal(await p.getByLabel('활동 상태 필터',{exact:true}).inputValue(),'draft');
    assert.equal(await p.locator('.workflow-list > li').count(),1);
    await p.getByRole('button',{name:'검토하기',exact:true}).click();
    await p.getByLabel('활동 검토 결과',{exact:true}).waitFor();
    await p.getByRole('button',{name:'검토 결과 입력으로 이동',exact:true}).click();
    assert.equal(await p.getByLabel('활동 검토 결과',{exact:true}).isVisible(),true);
    await p.locator('.sidebar').getByRole('link',{name:'보고서 검토·서명',exact:true}).click();
    await p.getByRole('heading',{name:'검토할 PDF 보고서',exact:true}).waitFor();
    assert.equal(await p.getByRole('region',{name:'보고서 조회 결과',exact:true}).count(),0);
    await p.getByRole('button',{name:'보고서 검토·서명',exact:true}).click();
    await p.getByRole('button',{name:'보고서 승인',exact:true}).waitFor();
    await p.getByText('승인을 확정하면 로그인한 검토자의 이름·역할·시각이 서명 기록으로 저장됩니다.',{exact:true}).waitFor();
    if(process.env.TASK_SCREENSHOTS&&role==='INSPECTOR')await p.getByRole('region',{name:'보고서 승인 및 서명',exact:true}).screenshot({path:path.join(process.env.TASK_SCREENSHOTS,'report-review-entry.png')});
    assert.deepEqual(s.writes,[]);await s.close();
   }
   for(const role of ['PLANT_OPERATOR','VIEWER']) {
    const s=await session(role),{p}=s;await s.go('oversight');
    assert.equal(await p.getByRole('region',{name:'현장관리자 검토 업무',exact:true}).count(),0);
    assert.equal(await p.locator('.sidebar').getByRole('link',{name:'보고서 검토·서명',exact:true}).count(),0);
    await s.go('compliance-report?review=1');await p.getByRole('region',{name:'보고서 조회 결과',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'보고서 승인',exact:true}).count(),0);assert.deepEqual(s.writes,[]);await s.close();
   }
   results.push('review discoverability: inspector/admin dashboard shortcuts, pending activity queue, direct evidence/review entry, archive-first PDF signing entry, no reviewer controls for operator/viewer');
  }
  console.log(JSON.stringify({passed:results},null,2));
 } finally {await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
