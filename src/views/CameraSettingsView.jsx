import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiCameraDevices, apiCameraRuntime, apiCreateCameraDevice, apiSaveCameraRuntime } from '../lib/api'
import { runtimePayload, DEVICE_STATES } from '../lib/camera'
import { workflowPath } from '../lib/workflow'
import { CameraNav, CameraScope, useCameraScope } from '../components/CameraWorkflow'
import { MutationStatus, QueryStatus, useWorkflowMutation, useWorkflowQuery } from '../components/WorkflowUI'

export function CameraRegistration({ plantId, onCreated }) {
  const [open, setOpen] = useState(false)
  const mutation = useWorkflowMutation()
  return <section className="card camera-panel">
    <button type="button" className="icon-btn" aria-expanded={open} onClick={() => setOpen(v => !v)}>카메라 장비 등록</button>
    {open && <form className="workflow-form" aria-label="카메라 장비 등록" onSubmit={e => {
      e.preventDefault()
      const values = Object.fromEntries(new FormData(e.currentTarget))
      mutation.run(() => {
        if (!values.name.trim()) throw new Error('카메라 이름을 입력해 주세요.')
        return apiCreateCameraDevice({ plant_id: plantId, name: values.name.trim(), model: values.model.trim() || null, serial_number: values.serial_number.trim() || null, install_date: values.install_date || null, status: 'active' })
      }, device => { setOpen(false); onCreated(device.device_id) })
    }}><fieldset disabled={mutation.busy}>
      <label>카메라 이름<input name="name" required maxLength={100} /></label>
      <label>모델<input name="model" maxLength={100} /></label>
      <label>일련번호<input name="serial_number" maxLength={100} /></label>
      <label>설치일<input name="install_date" type="date" /></label>
      <p className="camera-help">장비 등록 후 접속 주소와 촬영 정책을 설정하세요. 장비의 활성 상태는 연결 정상 판정이 아닙니다.</p>
      <button className="btn-primary" type="submit">{mutation.busy ? '등록 중…' : '카메라 등록'}</button>
    </fieldset></form>}
    <MutationStatus state={mutation} />
  </section>
}

function RuntimeForm({ device, existing, editable, onSaved }) {
  const [form, setForm] = useState({ main_rtsp_url: '', sub_rtsp_url: '', remove_sub: false,
    stream_key: existing?.stream_key || '', rtsp_transport: existing?.rtsp_transport || 'tcp', enabled: existing?.enabled ?? true,
    ptz_supported: existing?.ptz_supported || false, onvif_host: existing?.onvif_host || '', onvif_port: existing?.onvif_port || 80 })
  const [validation, setValidation] = useState('')
  const mutation = useWorkflowMutation()
  const update = (key, value) => setForm(f => ({ ...f, [key]: value }))
  async function submit(e) {
    e.preventDefault(); setValidation('')
    let payload
    try { payload = runtimePayload(form, existing) } catch (error) { setValidation(error.message); return }
    await mutation.run(async () => {
      try { return await apiSaveCameraRuntime(device.device_id, payload) }
      finally {
        // Discard secrets after every request, including an uncertain response.
        payload.main_rtsp_url = ''; payload.sub_rtsp_url = null
        setForm(f => ({ ...f, main_rtsp_url: '', sub_rtsp_url: '' }))
      }
    }, onSaved)
  }
  return <form className="workflow-form" aria-label="카메라 접속 설정" autoComplete="off" onSubmit={submit}>
    <p className="workflow-notice">설정 상태만 표시합니다. 실제 영상 연결·촬영 성공 여부는 이 화면에서 판정하지 않습니다.</p>
    {existing ? <div className="stack"><p>현재 설정: {existing.enabled ? '사용' : '비활성'} · 메인 {existing.main_rtsp_configured ? '설정됨' : '미설정'} · 보조 {existing.sub_rtsp_configured ? '설정됨' : '미설정'}</p>
      <code className="camera-masked">{existing.masked_main_rtsp_url}</code>{existing.masked_sub_rtsp_url && <code className="camera-masked">{existing.masked_sub_rtsp_url}</code>}
    </div> : <p>접속 미설정입니다. 메인 스트림 주소와 스트림 식별자를 입력하세요.</p>}
    {!editable && <p>조회 전용입니다. 접속 설정 수정 권한이 없습니다.</p>}
    <fieldset disabled={!editable || mutation.busy}>
      <label>메인 RTSP 주소<input aria-label="메인 RTSP 주소" type="password" autoComplete="new-password" value={form.main_rtsp_url} maxLength={2048} required onChange={e => update('main_rtsp_url', e.target.value)} /></label>
      <p className="camera-help">기존 주소는 보안상 조회되지 않습니다. 수정 저장 시 전체 주소를 다시 입력하세요. 입력값은 브라우저 저장소에 보관하지 않고 요청 후 비웁니다.</p>
      <label>보조 RTSP 주소<input aria-label="보조 RTSP 주소" type="password" autoComplete="new-password" value={form.sub_rtsp_url} maxLength={2048} disabled={form.remove_sub} onChange={e => update('sub_rtsp_url', e.target.value)} /></label>
      {existing?.sub_rtsp_configured && <><label className="camera-check"><input type="checkbox" checked={form.remove_sub} onChange={e => setForm(f => ({ ...f, remove_sub: e.target.checked, sub_rtsp_url: '' }))} />기존 보조 스트림 제거</label><p className="camera-help">기존 보조 주소를 유지하려면 다시 입력하세요. 제거하면 감지용 촬영에도 메인 스트림을 사용합니다.</p></>}
      <p className="camera-help">보조 스트림은 이벤트 감지에 우선 사용합니다. 최종 증빙은 메인 스트림에서 촬영합니다.</p>
      <div className="camera-grid">
        <label>스트림 식별자<input aria-label="스트림 식별자" required maxLength={100} value={form.stream_key} onChange={e => update('stream_key', e.target.value)} /></label>
        <label>RTSP 전송 방식<select value={form.rtsp_transport} onChange={e => update('rtsp_transport', e.target.value)}><option value="tcp">TCP</option><option value="udp">UDP</option></select></label>
      </div>
      <label className="camera-check"><input type="checkbox" checked={form.enabled} onChange={e => update('enabled', e.target.checked)} />접속 설정 사용</label>
      <label className="camera-check"><input type="checkbox" checked={form.ptz_supported} onChange={e => update('ptz_supported', e.target.checked)} />PTZ 지원 정보 등록</label>
      {form.ptz_supported && <div className="camera-grid"><label>ONVIF 호스트<input required maxLength={255} value={form.onvif_host} onChange={e => update('onvif_host', e.target.value)} /></label><label>ONVIF 포트<input type="number" required min={1} max={65535} value={form.onvif_port} onChange={e => update('onvif_port', e.target.value)} /></label></div>}
      <p className="camera-help">PTZ 항목은 장비 설정 정보입니다. 실제 방향 제어 기능은 제공하지 않습니다.</p>
      {editable && <button type="submit" className="btn-primary">{mutation.busy ? '저장 중…' : '접속 설정 저장'}</button>}
    </fieldset>
    {validation && <p role="alert" className="workflow-error">{validation}</p>}<MutationStatus state={mutation} />
  </form>
}

export function RuntimePanel({ device, canUpdate, planId, onPolicies }) {
  const panel = useRef(null)
  const [savedNotice, setSavedNotice] = useState('')
  const state = useWorkflowQuery(async signal => {
    try { return await apiCameraRuntime(device.device_id, signal) } catch (e) { if (e.status === 404) return null; throw e }
  }, [device.device_id])
  useEffect(() => { panel.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }, [device.device_id])
  return <section className="card camera-panel" ref={panel} aria-label="선택 카메라 설정">
    <h2>{device.name}</h2><p className="text-muted">장비 등록 상태: {DEVICE_STATES[device.status] || device.status}</p>
    {savedNotice && <p role="status">{savedNotice}</p>}<QueryStatus state={state} />
    {!state.loading && !state.error && <RuntimeForm key={JSON.stringify(state.data)} device={device} existing={state.data} editable={canUpdate} onSaved={() => { setSavedNotice('카메라 접속 설정을 저장했습니다.'); state.reload() }} />}
    {onPolicies ? <button className="icon-btn" onClick={onPolicies}>다음: 자동 촬영 정책 설정</button> : onPolicies !== null && <Link className="icon-btn" to={workflowPath('/capture-policies', { plantId: device.plant_id, planId })}>다음: 자동 촬영 정책 설정</Link>}
  </section>
}

export default function CameraSettingsView() {
  const scope = useCameraScope()
  const { plantId, params, setParams, hasPermission, user } = scope
  const canReadDevices = hasPermission('device:read')
  const devices = useWorkflowQuery(signal => plantId && canReadDevices ? apiCameraDevices(plantId, signal) : Promise.resolve([]), [plantId, canReadDevices, user?.userId])
  const selectedId = params.get('camera') || devices.data?.[0]?.device_id
  const selected = devices.data?.find(d => d.device_id === selectedId && d.plant_id === plantId)
  return <div className="view stack">
    <header><h1 className="view-title">카메라 설정</h1><p className="view-sub">카메라 장비를 등록하고 자동 촬영에 사용할 접속 정보를 설정합니다.</p></header>
    <CameraScope scope={scope} /><CameraNav current="/camera-settings" plantId={plantId} planId={params.get('plan')} />
    {plantId && <>
      {!canReadDevices ? <p role="status">카메라 목록을 선택하려면 장비 조회 권한이 필요합니다.</p> : <>
        {hasPermission('device:create') && <CameraRegistration key={`${user.userId}:${plantId}`} plantId={plantId} onCreated={id => { devices.reload(); setParams({ plant: plantId, camera: id, ...(params.get('plan') ? { plan: params.get('plan') } : {}) }) }} />}
        <div className="camera-layout"><section className="card camera-panel" aria-label="카메라 장비 목록"><div className="workflow-card-heading"><h2>카메라 장비</h2><button className="icon-btn" onClick={devices.reload}>목록 새로고침</button></div><QueryStatus state={devices} />
          {devices.data?.length === 0 && <p>등록된 카메라가 없습니다. 카메라 장비를 먼저 등록해 주세요.</p>}
          <ul className="camera-list">{devices.data?.map(d => <li key={d.device_id} aria-current={selectedId === d.device_id}>
            <strong>{d.name}</strong><p>{d.model || '모델 미등록'} · 장비 {DEVICE_STATES[d.status] || d.status}</p>
            <button className="icon-btn" onClick={() => setParams({ plant: plantId, camera: d.device_id, ...(params.get('plan') ? { plan: params.get('plan') } : {}) })}>접속 설정 보기</button>
          </li>)}</ul>
        </section>
          {selected ? <RuntimePanel key={`${user.userId}:${plantId}:${selected.device_id}`} device={selected} canUpdate={hasPermission('camera_runtime:update')} planId={params.get('plan')} /> : params.get('camera') && devices.data ? <p role="alert">선택한 발전소의 카메라를 다시 선택해 주세요.</p> : null}
        </div>
      </>}
    </>}
  </div>
}
