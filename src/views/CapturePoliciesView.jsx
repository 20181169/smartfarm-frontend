import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiCameraDevices, apiCameraPolicies, apiCameraPolicy, apiCreateCameraPolicy, apiFarmingPlans, apiUpdateCameraPolicy } from '../lib/api'
import { capturePolicyPayload, newCapturePolicy } from '../lib/camera'
import { ACTIVITY_TYPES, activityTypeLabel, workflowPath } from '../lib/workflow'
import { CameraNav, CameraScope, RuntimeStatus, useCameraScope } from '../components/CameraWorkflow'
import { PlanSummary } from '../components/FarmingWorkflow'
import { MutationStatus, QueryStatus, useWorkflowMutation, useWorkflowQuery } from '../components/WorkflowUI'

function CapturePolicyForm({ policy, scope, devices, plans, onSaved }) {
  const { plantId, params, hasPermission } = scope
  const initialPlan = !policy && plans?.find(p => p.plan_id === params.get('plan') && p.status === 'scheduled')
  const [form, setForm] = useState(() => policy ? { ...policy, farming_plan_id: policy.farming_plan_id || '', activity_type: policy.activity_type || '', valid_from: policy.valid_from || '', valid_to: policy.valid_to || '',
    windows: [...policy.windows].sort((a, b) => a.display_order - b.display_order).map(w => ({ ...w })), cameras: policy.cameras.map(c => ({ ...c })), event_rules: policy.event_rules.map(r => ({ ...r })) } : newCapturePolicy(initialPlan))
  const [validation, setValidation] = useState('')
  const mutation = useWorkflowMutation()
  const editable = hasPermission(policy ? 'camera_capture:update' : 'camera_capture:create') && hasPermission('device:read')
  const update = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const row = (key, index, field, value) => setForm(f => ({ ...f, [key]: f[key].map((r, i) => i === index ? { ...r, [field]: value } : r) }))
  const remove = (key, index) => setForm(f => ({ ...f, [key]: f[key].filter((_, i) => i !== index) }))
  const plan = plans?.find(p => p.plan_id === form.farming_plan_id)
  async function submit(e) {
    e.preventDefault(); setValidation('')
    let payload
    try { payload = capturePolicyPayload(form, { plantId, devices, plans, creating: !policy }) } catch (error) { setValidation(error.message); return }
    mutation.run(() => policy ? apiUpdateCameraPolicy(policy.policy_id, payload) : apiCreateCameraPolicy(payload), onSaved)
  }
  return <form className="workflow-form" aria-label="촬영 정책 설정" onSubmit={submit}>
    {!editable && <p role="status">조회 전용입니다. 정책 편집에는 촬영 정책 수정과 장비 조회 권한이 필요합니다.</p>}
    <fieldset disabled={!editable || mutation.busy}>
      <label>정책명<input aria-label="정책명" required maxLength={150} value={form.name} onChange={e => update('name', e.target.value)} /></label>
      <label>연결할 영농계획<select aria-label="촬영 정책 영농계획" value={form.farming_plan_id} disabled={!plans} onChange={e => {
        const next = plans?.find(p => p.plan_id === e.target.value)
        setForm(f => ({ ...f, farming_plan_id: e.target.value, ...(next ? { activity_type: next.activity_type, valid_from: next.planned_start_date, valid_to: next.planned_end_date } : {}) }))
      }}><option value="">계획 연결 안 함</option>{form.farming_plan_id && !plans?.some(p => p.plan_id === form.farming_plan_id) && <option value={form.farming_plan_id}>기존 연결 계획 · {form.farming_plan_id}</option>}{plans?.map(p => <option key={p.plan_id} value={p.plan_id} disabled={p.status !== 'scheduled'}>{p.title}{p.status !== 'scheduled' ? ' · 취소됨' : ''}</option>)}</select></label>
      <p className="camera-help">계획을 선택하면 작업 유형과 적용 기간을 채웁니다. 촬영 정책의 계획 연결은 영농활동의 제출·확정·계획 연결을 대신하지 않습니다.</p>
      <label>작업 유형<select aria-label="촬영 정책 작업 유형" value={form.activity_type} onChange={e => update('activity_type', e.target.value)}><option value="">지정 안 함</option>{form.activity_type && !ACTIVITY_TYPES[form.activity_type] && <option value={form.activity_type}>{form.activity_type} (기존 유형)</option>}{Object.entries(ACTIVITY_TYPES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
      <div className="camera-grid"><label>적용 시작일<input type="date" value={form.valid_from} onChange={e => update('valid_from', e.target.value)} /></label><label>적용 종료일<input type="date" value={form.valid_to} onChange={e => update('valid_to', e.target.value)} /></label></div>
      <label className="camera-check"><input type="checkbox" checked={form.enabled} onChange={e => update('enabled', e.target.checked)} />정책 사용</label>
      <p className="camera-help">정책을 사용으로 저장하면 서버가 설정에 따라 자동 촬영을 처리합니다. 새 정책은 비활성으로 시작합니다.</p>
      <h3>정기 촬영</h3><p className="camera-help">한국 시간 기준입니다. 시간대는 서로 겹치지 않게 입력하세요. 이벤트 감지만 사용하려면 시간대의 사용을 해제하세요.</p>
      <div className="camera-repeat">{form.windows.map((w, i) => <section key={i} aria-label={`촬영 시간대 ${i + 1}`}><h4>촬영 시간대 {i + 1}</h4><div className="camera-grid">
        <label>시작 시간<input aria-label={`시간대 ${i + 1} 시작`} type="time" step={1} required value={w.start_time} onChange={e => row('windows', i, 'start_time', e.target.value)} /></label>
        <label>종료 시간<input aria-label={`시간대 ${i + 1} 종료`} type="time" step={1} required value={w.end_time} onChange={e => row('windows', i, 'end_time', e.target.value)} /></label>
        <label>목표 촬영 횟수<input type="number" min={1} max={100} required value={w.target_count} onChange={e => row('windows', i, 'target_count', e.target.value)} /></label>
        <label className="camera-check"><input type="checkbox" checked={w.enabled} onChange={e => row('windows', i, 'enabled', e.target.checked)} />시간대 {i + 1} 사용</label>
      </div><button type="button" className="icon-btn" onClick={() => remove('windows', i)}>시간대 {i + 1} 삭제</button></section>)}</div>
      <button type="button" className="icon-btn" onClick={() => update('windows', [...form.windows, { start_time: '09:00', end_time: '18:00', target_count: 1, enabled: true }])}>촬영 시간대 추가</button>
      <h3>이벤트 감지</h3><label className="camera-check"><input type="checkbox" checked={form.event_check_enabled} onChange={e => update('event_check_enabled', e.target.checked)} />이벤트 자동 감지</label>
      <p className="camera-help">설정된 주기로 객체를 확인하고 규칙과 일치하면 증빙 촬영을 생성합니다. 감지용 프레임은 증빙 목록에 표시하지 않으며, 메인 스트림을 다시 촬영한 최종 분석 결과를 증빙으로 저장합니다.</p>
      <div className="camera-grid"><label>규칙 일치 조건<select aria-label="규칙 일치 조건" value={form.event_match_mode} onChange={e => update('event_match_mode', e.target.value)}><option value="any">규칙 중 하나 이상 만족</option><option value="all">활성화된 모든 규칙 만족</option></select></label>
        <label>감지 주기 (초)<input aria-label="감지 주기" type="number" min={5} max={86400} required value={form.scout_interval_seconds} onChange={e => update('scout_interval_seconds', e.target.value)} /></label>
        <label>중복 촬영 방지 시간 (초)<input aria-label="중복 촬영 방지 시간" type="number" min={0} max={86400} required value={form.cooldown_seconds} onChange={e => update('cooldown_seconds', e.target.value)} /></label></div>
      <p className="camera-help">감지 처리가 끝난 뒤 설정 주기가 지나면 다시 검사합니다. 중복 촬영 방지는 같은 정책·같은 카메라 기준으로 적용합니다.</p>
      <div className="camera-repeat">{form.event_rules.map((r, i) => <section key={i} aria-label={`탐지 규칙 ${i + 1}`}><h4>탐지 규칙 {i + 1}</h4><div className="camera-grid">
        <label>탐지 대상<input aria-label={`규칙 ${i + 1} 탐지 대상`} required maxLength={100} value={r.class_name} placeholder="tractor, person" onChange={e => row('event_rules', i, 'class_name', e.target.value)} /></label>
        <label>최소 탐지 신뢰도 (0~1)<input aria-label={`규칙 ${i + 1} 신뢰도`} type="number" required min={0} max={1} step="any" value={r.min_confidence} onChange={e => row('event_rules', i, 'min_confidence', e.target.value)} /></label>
        <label className="camera-check"><input type="checkbox" checked={r.enabled} onChange={e => row('event_rules', i, 'enabled', e.target.checked)} />규칙 {i + 1} 사용</label>
      </div><button type="button" className="icon-btn" onClick={() => remove('event_rules', i)}>규칙 {i + 1} 삭제</button></section>)}</div>
      {form.event_check_enabled && !form.event_rules.some(r => r.enabled) && <p className="workflow-warning">이벤트 감지에는 활성 규칙이 최소 1개 필요합니다.</p>}
      <button type="button" className="icon-btn" onClick={() => update('event_rules', [...form.event_rules, { class_name: '', min_confidence: 0.7, enabled: true }])}>탐지 규칙 추가</button>
      <h3>촬영 카메라</h3><div className="camera-repeat">{form.cameras.map((c, i) => <section key={i} aria-label={`카메라 설정 항목 ${i + 1}`}><div className="camera-grid">
        <label>카메라<select aria-label={`촬영 카메라 ${i + 1}`} required value={c.camera_device_id} onChange={e => row('cameras', i, 'camera_device_id', e.target.value)}><option value="">카메라 선택</option>{c.camera_device_id && !devices.some(d => d.device_id === c.camera_device_id) && <option value={c.camera_device_id}>기존 카메라 · {c.camera_device_id}</option>}{devices.map(d => <option key={d.device_id} value={d.device_id} disabled={d.status !== 'active' || form.cameras.some((other, index) => index !== i && other.camera_device_id === d.device_id)}>{d.name}{d.status !== 'active' ? ' · 비활성 장비' : ''}</option>)}</select></label>
        <label>우선순위<input aria-label={`카메라 ${i + 1} 우선순위`} type="number" min={1} max={1000} required value={c.priority} onChange={e => row('cameras', i, 'priority', e.target.value)} /></label>
        <label className="camera-check"><input type="checkbox" checked={c.enabled} onChange={e => row('cameras', i, 'enabled', e.target.checked)} />카메라 {i + 1} 사용</label>
      </div><RuntimeStatus cameraId={c.camera_device_id} plantId={plantId} planId={form.farming_plan_id} /><button type="button" className="icon-btn" onClick={() => remove('cameras', i)}>카메라 {i + 1} 삭제</button></section>)}</div>
      <button type="button" className="icon-btn" onClick={() => update('cameras', [...form.cameras, { camera_device_id: '', priority: form.cameras.length + 1, enabled: true }])}>촬영 카메라 추가</button>
      {editable && <button type="submit" className="btn-primary">{mutation.busy ? '저장 중…' : policy ? '촬영 정책 저장' : '촬영 정책 등록'}</button>}
    </fieldset>
    {plan && <PlanSummary plan={plan} />}{validation && <p role="alert" className="workflow-error">{validation}</p>}<MutationStatus state={mutation} />
    {policy && hasPermission('camera_capture:update') && <><button type="button" className="icon-btn" disabled={mutation.busy} onClick={() => mutation.run(() => apiUpdateCameraPolicy(policy.policy_id, { enabled: !policy.enabled }), onSaved)}>{policy.enabled ? '정책 비활성화' : '저장된 정책 활성화'}</button><p className="camera-help">저장된 정책의 사용 여부만 변경합니다. 편집 중인 입력은 저장하지 않습니다.</p></>}
  </form>
}

function PolicyPanel({ policyId, scope, devices, plans, onSaved }) {
  const panel = useRef(null)
  const [notice, setNotice] = useState('')
  const state = useWorkflowQuery(async signal => {
    if (!policyId) return null
    const policy = await apiCameraPolicy(policyId, signal)
    if (policy.plant_id !== scope.plantId) throw new Error('선택한 발전소의 촬영 정책이 아닙니다.')
    return policy
  }, [policyId, scope.plantId])
  useEffect(() => { panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [policyId])
  const saved = policy => { setNotice('촬영 정책을 저장했습니다.'); state.reload(); onSaved(policy.policy_id) }
  return <section ref={panel} className="card camera-panel" aria-label="촬영 정책 상세"><div className="workflow-card-heading"><h2>{policyId ? '촬영 정책 상세' : '새 촬영 정책'}</h2>{policyId && <button className="icon-btn" onClick={state.reload}>정책 새로고침</button>}</div>
    {notice && <p role="status">{notice}</p>}<QueryStatus state={state} />
    {!state.loading && !state.error && <CapturePolicyForm key={JSON.stringify(state.data)} policy={state.data} scope={scope} devices={devices} plans={plans} onSaved={saved} />}
  </section>
}

export default function CapturePoliciesView() {
  const scope = useCameraScope(), { plantId, params, setParams, user, hasPermission } = scope
  const list = useWorkflowQuery(signal => plantId ? apiCameraPolicies(plantId, signal) : Promise.resolve([]), [plantId, user?.userId])
  const devices = useWorkflowQuery(signal => plantId && hasPermission('device:read') ? apiCameraDevices(plantId, signal) : Promise.resolve([]), [plantId, user?.userId])
  const plans = useWorkflowQuery(signal => plantId && hasPermission('farming_plan:read') ? apiFarmingPlans(plantId, signal) : Promise.resolve(null), [plantId, user?.userId])
  const [onlyEnabled, setOnlyEnabled] = useState(false)
  const [editor, setEditor] = useState(0)
  const create = params.get('create') === '1', policyId = params.get('policy')
  const canCreate = hasPermission('camera_capture:create') && hasPermission('device:read')
  const select = (id, creating = false) => { setEditor(v => v + 1); setParams({ plant: plantId, ...(params.get('plan') ? { plan: params.get('plan') } : {}), ...(id ? { policy: id } : {}), ...(creating ? { create: '1' } : {}) }) }
  const invalidPlan = !plans.loading && plans.data && params.get('plan') && !plans.data.some(p => p.plan_id === params.get('plan') && p.status === 'scheduled')
  const selectedPlan = plans.data?.find(p => p.plan_id === params.get('plan'))
  const visible = list.data?.filter(p => p.plant_id === plantId && (!onlyEnabled || p.enabled))
  return <div className="view stack">
    <header><h1 className="view-title">자동 촬영 정책</h1><p className="view-sub">정기 촬영과 객체 감지에 따른 증빙 촬영을 설정합니다.</p></header>
    <CameraScope scope={scope} /><CameraNav current="/capture-policies" plantId={plantId} planId={params.get('plan')} />
    <p className="workflow-next">서버가 촬영·분석한 최종 증빙은 AI 증빙 화면에서 확인합니다. 검수자가 증빙을 확정한 뒤 담당자가 활동을 제출하고, 활동 검토·계획 연결·보고서 승인을 각각 진행합니다.</p>
    {selectedPlan && <PlanSummary plan={selectedPlan} />}
    {plantId && <><QueryStatus state={devices} /><QueryStatus state={plans} />
      {invalidPlan && <div className="workflow-warning" role="alert">연결할 계획을 찾을 수 없거나 취소된 계획입니다. 계획 화면에서 다시 선택해 주세요. <button className="icon-btn" onClick={() => setParams({ plant: plantId, ...(create ? { create: '1' } : {}) })}>계획 연결 해제</button></div>}
      <div className="camera-layout"><section className="card camera-panel" aria-label="촬영 정책 목록"><div className="workflow-card-heading"><h2>촬영 정책</h2><button className="icon-btn" onClick={list.reload}>정책 목록 새로고침</button></div>
        {canCreate && <button className="btn-primary" onClick={() => select(null, true)}>새 촬영 정책</button>}
        <label className="camera-check" style={{ marginTop: 14 }}><input type="checkbox" checked={onlyEnabled} onChange={e => setOnlyEnabled(e.target.checked)} />사용 중인 정책만</label><QueryStatus state={list} />
        {visible?.length === 0 && <p>{list.data.length ? '조건에 맞는 정책이 없습니다.' : '등록된 촬영 정책이 없습니다.'}</p>}
        <ul className="camera-list">{visible?.map(p => <li key={p.policy_id} aria-current={policyId === p.policy_id}>
          <strong>{p.name}</strong><p>정책 {p.enabled ? '사용' : '비활성'} · 이벤트 감지 {p.event_check_enabled ? '사용' : '비활성'}</p><p>{activityTypeLabel(p.activity_type)} · {p.valid_from || '시작 제한 없음'} ~ {p.valid_to || '종료 제한 없음'}</p>
          <button className="icon-btn" onClick={() => select(p.policy_id)}>정책 상세 보기</button>
        </li>)}</ul>
        {hasPermission('camera_runtime:read') && <Link to={workflowPath('/camera-settings', { plantId, planId: params.get('plan') })}>카메라 등록 · 접속 설정</Link>}
      </section>
        {(policyId || create && canCreate) && !devices.loading && !devices.error && !plans.loading && !plans.error && (!create || !invalidPlan) && <PolicyPanel key={`${user.userId}:${plantId}:${policyId || 'new'}:${params.get('plan') || ''}:${editor}`} policyId={policyId} scope={scope} devices={devices.data || []} plans={plans.data} onSaved={id => { list.reload(); if (create) select(id) }} />}
      </div>
    </>}
  </div>
}
