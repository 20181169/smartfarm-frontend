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
 async function session(role) {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),p=await context.newPage(),writes=[],errors=[];
  p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>localStorage.setItem('dongyang_token','fixture-token'));
  const events=[event('returned','cancelled','own'),event('other','confirmed','used'),event('draft1','draft','review')];
  const reviews={returned:[{review_id:'old-review',previous_status:'draft',new_status:'cancelled',comment:'제목을 정정해 주세요',reviewed_at:date,reviewer_user_id:'inspector'}],other:[],draft1:[]};
  let plan={...basePlan},matches=[],approvals=[],failure=null;
  function failOnce(url,status){failure={url,status}}
  await p.route('**/*',async route=>{
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
   if(api==='/auth/me')return json({user_id:role,name:'검증 사용자',email:role+'@fixture.local',role_code:role,role_name:role,level:role==='PLANT_OPERATOR'?70:10,permissions:roles[role]});
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
   if(api==='/farming-plans/reports/archive')return list([{report_id:'report1',plant_id:'p1',period:'2026-10',file_name:'report.pdf',issued_at:date}]);
   if(api==='/farming-plans/reports/archive/report1/approval'){
    if(method==='POST'){assert.deepEqual(Object.keys(body).sort(),['comment','decision']);const r={approval_id:'ap'+writes.length,report_id:'report1',reviewer_name:'실제 검토자',reviewer_role_name:'점검자',reviewer_role_code:role,signed_at:date,decision:body.decision,comment:body.comment};approvals.unshift(r);return json(r,201)}
    return json({report_id:'report1',latest:approvals[0]||null,items:approvals,total:approvals.length});
   }
   if(api==='/farming-plans/reports/data')return json({plant,summary:{},activity_summary:{},plans:[],total_plans:0,from_date:'2026-10-01',to_date:'2026-10-31',generated_at:date});
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
  async function detail(title){await p.locator('.workflow-list > li').filter({hasText:title}).getByRole('button',{name:'활동 상세',exact:true}).click();await p.getByRole('region',{name:'영농활동 상세',exact:true}).getByRole('heading',{name:title,exact:true}).waitFor()}
  async function close(){assert.deepEqual(errors,[]);await context.close()}
  return {p,writes,go,detail,close,failOnce};
 }
 try {
  {
   const s=await session('PLANT_OPERATOR'),{p}=s;await s.go('my-compliance');
   await p.getByRole('button',{name:'영농활동 등록',exact:true}).click();await p.getByLabel('활동 제목',{exact:true}).fill('새 경운 작업');
   await p.getByLabel('증빙 free',{exact:true}).waitFor();
   for(const id of ['used','own','wrong','pending','review'])assert.equal(await p.getByLabel('증빙 '+id,{exact:true}).count(),0);
   await p.getByLabel('증빙 free',{exact:true}).check();await p.getByRole('button',{name:'활동 제출',exact:true}).click();
   await p.getByText('영농활동을 제출했습니다. 검토자의 확인을 기다리고 있습니다.',{exact:true}).waitFor();
   assert.equal(s.writes.filter(w=>w.api==='/farming-activities').length,1);
   assert.equal(await p.getByRole('button',{name:'활동 검토 저장',exact:true}).count(),0);
   await s.detail('반려된 경운 작업');await p.getByRole('button',{name:'영농활동 수정 및 재제출',exact:true}).click();
   await p.getByRole('region',{name:'영농활동 수정 및 재제출',exact:true}).getByText('제목을 정정해 주세요',{exact:true}).waitFor();
   await p.getByLabel('증빙 own',{exact:true}).waitFor();assert.equal(await p.getByLabel('증빙 own',{exact:true}).isChecked(),true);
   await p.getByLabel('활동 제목',{exact:true}).fill('정정한 경운 작업');
   s.failOnce('/farming-activities/returned',409);await p.getByRole('button',{name:'수정 후 재제출',exact:true}).click();await p.getByText('상태가 변경되었습니다. 새로 조회해 주세요.',{exact:true}).waitFor();
   await p.getByRole('button',{name:'수정 후 재제출',exact:true}).click();await p.getByText('수정 내용이 재제출되었습니다. 검토자의 확인을 기다리고 있습니다.',{exact:true}).waitFor();
   const last=s.writes.at(-1);assert.equal(last.method,'PATCH');assert.equal(last.api,'/farming-activities/returned');assert.deepEqual(Object.keys(last.body).sort(),['activity_type','analysis_ids','description','title']);
   await p.getByRole('region',{name:'검토 이력',exact:true}).getByText('제목을 정정해 주세요',{exact:true}).waitFor();
   assert.equal(await p.getByRole('button',{name:'영농활동 수정 및 재제출',exact:true}).count(),0);
   await s.go('compliance-report');await p.getByText('승인 · 서명 확인',{exact:true}).click();await p.getByText('승인 대기',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'보고서 승인',exact:true}).count(),0);
   await s.close();results.push('operator: eligible evidence, create, 409, same-event resubmit, preserved history, no self-review/approval');
  }
  {
   const s=await session('INSPECTOR'),{p}=s;await s.go('my-compliance');assert.equal(await p.getByRole('button',{name:'영농활동 등록',exact:true}).count(),0);
   await s.detail('반려된 경운 작업');assert.equal(await p.getByRole('button',{name:'영농활동 수정 및 재제출',exact:true}).count(),0);
   await s.detail('검토할 작업');await p.getByLabel('활동 검토 결과',{exact:true}).selectOption('cancelled');assert.equal(await p.getByRole('button',{name:'활동 검토 저장',exact:true}).isDisabled(),true);
   await p.getByLabel('활동 검토 의견',{exact:true}).fill('증빙 보완 필요');s.failOnce('/farming-activities/draft1/review',403);
   await p.getByRole('button',{name:'활동 검토 저장',exact:true}).click();await p.getByRole('alert').filter({hasText:'권한이 없습니다'}).waitFor();
   await p.getByRole('button',{name:'활동 검토 저장',exact:true}).click();await p.getByText('반려 사유',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'활동 검토 저장',exact:true}).count(),0);
   await s.go('compliance-report');await p.getByText('승인 · 서명 확인',{exact:true}).click();await p.getByText('승인 대기',{exact:true}).waitFor();
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
  console.log(JSON.stringify({passed:results},null,2));
 } finally {await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
