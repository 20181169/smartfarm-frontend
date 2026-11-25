import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { apiAssessmentPlants, apiCameraRuntime } from '../lib/api'
import { workflowPath } from '../lib/workflow'
import { QueryStatus, useWorkflowQuery } from './WorkflowUI'
import './CameraWorkflow.css'

export function useCameraScope() {
  const { user, plantId: globalPlantId, hasPermission } = useApp()
  const [params, setParams] = useSearchParams()
  const plants = useWorkflowQuery(signal => hasPermission('plant:read') ? apiAssessmentPlants(signal) : Promise.reject(new Error('발전소 목록 조회 권한이 필요합니다.')), [user?.userId])
  const requested = params.get('plant')
  const items = plants.data || []
  const plantId = requested ? items.find(p => p.plant_id === requested)?.plant_id || '' : items.find(p => p.plant_id === globalPlantId)?.plant_id || items[0]?.plant_id || ''
  return { plants, plantId, invalidPlant: !!(requested && plants.data && !plantId), params, setParams, user, hasPermission }
}
export function CameraScope({ scope }) {
  return <section className="card camera-scope"><QueryStatus state={scope.plants} />
    <label className="field">대상 발전소<select aria-label="카메라 관리 발전소" value={scope.plantId} onChange={e => scope.setParams({ plant: e.target.value })}>
      <option value="">발전소 선택</option>{scope.plants.data?.map(p => <option key={p.plant_id} value={p.plant_id}>{p.name}</option>)}
    </select></label>
    {scope.invalidPlant && <p role="alert">접근 가능한 발전소가 아닙니다. 발전소를 다시 선택해 주세요.</p>}
    {scope.plants.data?.length === 0 && <p>접근 가능한 발전소가 없습니다.</p>}
  </section>
}
export function CameraNav({ current, plantId, planId }) {
  const { hasPermission } = useApp()
  const links = [{ path: '/camera-settings', name: '카메라 설정', permission: 'camera_runtime:read' }, { path: '/capture-policies', name: '자동 촬영 정책', permission: 'camera_capture:read' }, { path: '/cctv', name: 'AI 증빙 · 검토', permission: 'vision:read' }]
  return <nav className="camera-nav" aria-label="카메라 업무 메뉴">{links.filter(l => hasPermission(l.permission)).map(l => <Link key={l.path} className={`icon-btn ${current === l.path ? 'is-current' : ''}`} aria-current={current === l.path ? 'page' : undefined} to={workflowPath(l.path, { plantId, planId })}>{l.name}</Link>)}</nav>
}
export function cameraSettingsPath(plantId, cameraId, planId) {
  const path = workflowPath('/camera-settings', { plantId, planId })
  return `${path}${path.includes('?') ? '&' : '?'}camera=${encodeURIComponent(cameraId)}`
}
export function RuntimeStatus({ cameraId, plantId, planId }) {
  const { user, hasPermission } = useApp()
  const readable = hasPermission('camera_runtime:read')
  const runtime = useWorkflowQuery(async signal => {
    if (!readable || !cameraId) return undefined
    try { return await apiCameraRuntime(cameraId, signal) } catch (e) { if (e.status === 404) return null; throw e }
  }, [cameraId, readable, user?.userId])
  if (!readable || !cameraId) return null
  return <div className="camera-runtime-status"><QueryStatus state={runtime} />{!runtime.loading && !runtime.error && <>
    <span>{runtime.data ? `접속 설정됨 · ${runtime.data.enabled ? '설정 사용' : '설정 비활성'}` : '접속 미설정 · 자동 촬영 전에 설정이 필요합니다.'}</span>
    <Link to={cameraSettingsPath(plantId, cameraId, planId)}>접속 설정 보기</Link>
  </>}</div>
}
