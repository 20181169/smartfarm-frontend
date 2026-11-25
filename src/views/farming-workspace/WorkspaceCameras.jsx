import { useState } from 'react'
import { apiCameraDevices, apiCameraPolicies, apiCameraPolicy } from '../../lib/api'
import { QueryStatus, useWorkflowQuery } from '../../components/WorkflowUI'
import { CameraRegistration, RuntimePanel } from '../CameraSettingsView'
import { CapturePolicyForm } from '../CapturePoliciesView'
import { Field, button } from './WorkspaceShared'

export default function WorkspaceCameras({ workspace: w }) {
  const [section, setSection] = useState(w.hasPermission('camera_runtime:read') ? 'cameras' : 'policies')
  const [cameraId, setCameraId] = useState(''), [policyId, setPolicyId] = useState(''), [create, setCreate] = useState(false), [version, setVersion] = useState(0)
  const devices = useWorkflowQuery(signal => w.hasPermission('device:read') ? apiCameraDevices(w.plantId, signal) : Promise.resolve([]), [w.plantId, version])
  const policies = useWorkflowQuery(signal => w.hasPermission('camera_capture:read') ? apiCameraPolicies(w.plantId, signal) : Promise.resolve([]), [w.plantId, version])
  const selected = devices.data?.find(d => d.device_id === (cameraId || devices.data?.[0]?.device_id))
  const policy = useWorkflowQuery(async signal => {
    if (!policyId || create) return null
    const result = await apiCameraPolicy(policyId, signal)
    if (result.plant_id !== w.plantId) throw new Error('현재 발전소의 촬영 정책이 아닙니다.')
    return result
  }, [policyId, create, version])
  const scope = { plantId: w.plantId, params: new URLSearchParams(w.planId ? { plan: w.planId } : {}), hasPermission: w.hasPermission }
  return <section className="fw-live-camera-panel" aria-label="영농관리 촬영 설정"><div className="fw-actions">
    {w.hasPermission('camera_runtime:read') && <button className={button(section === 'cameras')} onClick={() => setSection('cameras')}>카메라 접속 설정</button>}
    {w.hasPermission('camera_capture:read') && <button className={button(section === 'policies')} onClick={() => setSection('policies')}>자동 촬영 정책</button>}
    <button className={button()} onClick={() => w.go('gallery')}>촬영 증빙 확인</button>
  </div><QueryStatus state={devices} />
    {section === 'cameras' && w.hasPermission('camera_runtime:read') && <>
      {!w.hasPermission('device:read') ? <p>카메라 선택에는 장비 조회 권한이 필요합니다.</p> : <>
        {w.hasPermission('device:create') && <CameraRegistration plantId={w.plantId} onCreated={id => { setCameraId(id); setVersion(v => v + 1) }} />}
        <Field label="설정할 카메라"><select value={selected?.device_id || ''} onChange={e => setCameraId(e.target.value)}><option value="">카메라 선택</option>{devices.data?.map(d => <option key={d.device_id} value={d.device_id}>{d.name}</option>)}</select></Field>
        {devices.data?.length === 0 && <p>등록된 카메라가 없습니다. 카메라 장비를 먼저 등록해 주세요.</p>}
        {selected && <RuntimePanel key={selected.device_id} device={selected} canUpdate={w.hasPermission('camera_runtime:update')} planId={w.planId} onPolicies={w.hasPermission('camera_capture:read') ? () => setSection('policies') : null} />}
      </>}
    </>}
    {section === 'policies' && w.hasPermission('camera_capture:read') && <><QueryStatus state={policies} /><Field label="촬영 정책 선택"><select value={create ? '' : policyId} onChange={e => { setPolicyId(e.target.value); setCreate(false) }}><option value="">정책 선택</option>{policies.data?.map(p => <option key={p.policy_id} value={p.policy_id}>{p.name} · {p.enabled ? '사용' : '비활성'}</option>)}</select></Field>
      {w.hasPermission('camera_capture:create') && w.hasPermission('device:read') && <button className={button()} onClick={() => { setPolicyId(''); setCreate(true) }}>새 촬영 정책</button>}
      <QueryStatus state={policy} />
      {(create || policy.data) && !devices.loading && !devices.error && !w.plans.loading && <CapturePolicyForm key={`${policyId}:${create}:${version}:${w.planId}`} policy={create ? null : policy.data} scope={scope} devices={devices.data || []} plans={w.plans.data || []} embedded onOpenCamera={id => { setCameraId(id); setSection('cameras') }} onSaved={p => { setPolicyId(p.policy_id); setCreate(false); setVersion(v => v + 1) }} />}
    </>}
  </section>
}
