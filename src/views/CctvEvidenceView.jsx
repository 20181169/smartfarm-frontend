import { useEffect, useRef, useState } from 'react'
import { ScanLine, Upload, Play, Square, Download, Tractor, Users, Camera } from 'lucide-react'
import { useApp } from '../context/useApp'
import { apiGetPlants, apiVisionCameras, apiDetectTractor } from '../lib/api'
import './CctvEvidenceView.css'

const LABELS = { tractor: '트랙터', person: '사람', car: '승용차', truck: '트럭', bus: '버스', excavator: '굴착기' }
const COLORS = { tractor: '#34d399', person: '#38bdf8', car: '#fbbf24', truck: '#fb923c', bus: '#c084fc', excavator: '#fb7185' }

function capture(video) {
  if (!video || video.readyState < 2) throw new Error('영상이 준비된 후 다시 시도하세요.')
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight))
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('프레임을 읽을 수 없습니다.')), 'image/jpeg', 0.9))
}

function seekVideo(video, time) {
  return new Promise((resolve, reject) => {
    if (!video || !Number.isFinite(video.duration)) {
      reject(new Error('영상 길이를 확인할 수 없습니다.'))
      return
    }
    const settle = () => requestAnimationFrame(() => requestAnimationFrame(resolve))
    if (Math.abs(video.currentTime - time) < 0.03) {
      settle()
      return
    }
    const timeout = setTimeout(() => {
      video.removeEventListener('seeked', done)
      reject(new Error('영상 프레임 이동 시간이 초과되었습니다.'))
    }, 5000)
    const done = () => {
      clearTimeout(timeout)
      settle()
    }
    video.addEventListener('seeked', done, { once: true })
    video.currentTime = time
  })
}

export default function CctvEvidenceView() {
  const { user } = useApp()
  const [plants, setPlants] = useState([])
  const [plantId, setPlantId] = useState('')
  const [cameras, setCameras] = useState([])
  const [cameraId, setCameraId] = useState('')
  const [mode, setMode] = useState('file')
  const [media, setMedia] = useState(null)
  const [ready, setReady] = useState(false)
  const [threshold, setThreshold] = useState(0.35)
  const [latestResult, setLatestResult] = useState(null)
  const [selectedFrameId, setSelectedFrameId] = useState(null)
  const [history, setHistory] = useState([])
  const [busy, setBusy] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState('')
  const video = useRef(null)
  const controller = useRef(null)
  const sequence = useRef(0)
  const pending = useRef(false)
  const runningRef = useRef(false)
  const analysisCount = useRef(0)
  const authenticated = user?.source === 'api'

  function stop() {
    runningRef.current = false
    setRunning(false); sequence.current += 1; controller.current?.abort()
    pending.current = false; setBusy(false)
  }

  useEffect(() => {
    let alive = true
    stop(); setPlants([]); setPlantId(''); setLatestResult(null); setSelectedFrameId(null); setHistory([])
    if (authenticated) apiGetPlants().then(data => {
      if (alive) { setPlants(data.items || []); setPlantId(data.items?.[0]?.plant_id || '') }
    }).catch(e => { if (alive) setError(e.message) })
    return () => { alive = false; controller.current?.abort(); sequence.current += 1 }
  }, [authenticated, user?.email])

  useEffect(() => {
    const abort = new AbortController()
    setCameras([]); setCameraId(''); setCameraError('')
    if (plantId && mode === 'camera') apiVisionCameras(plantId, abort.signal).then(data => {
      if (!abort.signal.aborted) { setCameras(data.items || []); setCameraId(data.items?.[0]?.camera_id || '') }
    }).catch(e => { if (!abort.signal.aborted) setCameraError(e.message) })
    return () => abort.abort()
  }, [plantId, mode])

  useEffect(() => () => { if (media) URL.revokeObjectURL(media.url) }, [media])

  function resetSource(change) {
    stop(); analysisCount.current = 0; setLatestResult(null); setSelectedFrameId(null); setHistory([]); setError(''); change()
  }

  async function analyze() {
    if (pending.current) return
    const version = sequence.current
    pending.current = true; setBusy(true); setError('')
    const abort = new AbortController()
    controller.current = abort
    const timeout = setTimeout(() => abort.abort(), 190000)
    try {
      const position = mode === 'file' && media?.type === 'video' ? video.current?.currentTime : null
      const blob = mode === 'file' ? (media.type === 'video' ? await capture(video.current) : media.file) : null
      const data = await apiDetectTractor({ plantId, cameraId: mode === 'camera' ? cameraId : null, blob, threshold, signal: abort.signal })
      if (version !== sequence.current) return
      const next = { ...data, source_name: mode === 'file' ? media.name : cameras.find(c => c.camera_id === cameraId)?.name,
        video_position: position, plant_id: plantId, analysis_no: ++analysisCount.current }
      setLatestResult(next)
      setHistory(rows => [next, ...rows].slice(0, 30))
      return true
    } catch (e) {
      if (version === sequence.current) {
        setError(e.name === 'AbortError' ? '분석 시간이 초과되었습니다. 모델 준비 상태를 확인하고 다시 시도하세요.' : e.message)
        runningRef.current = false
        setRunning(false)
      }
      return false
    } finally {
      clearTimeout(timeout)
      if (version === sequence.current) { pending.current = false; setBusy(false) }
    }
  }

  async function startContinuous() {
    const node = video.current
    if (!node || media?.type !== 'video' || runningRef.current) return
    node.pause()
    if (node.ended || node.currentTime >= node.duration - 0.05) await seekVideo(node, 0)
    runningRef.current = true
    setRunning(true)
    setSelectedFrameId(null)
    const version = sequence.current
    while (runningRef.current && version === sequence.current) {
      const succeeded = await analyze()
      if (!succeeded || !runningRef.current || version !== sequence.current) break
      const lastTime = Math.max(0, node.duration - 0.05)
      if (node.currentTime >= lastTime - 0.03) break
      const nextTime = Math.min(node.currentTime + 2, lastTime)
      try {
        await seekVideo(node, nextTime)
      } catch (e) {
        if (version === sequence.current) setError(e.message)
        break
      }
    }
    if (version === sequence.current) {
      runningRef.current = false
      setRunning(false)
    }
  }

  function selectFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) { setError('영상 또는 이미지 파일을 선택하세요.'); return }
    if (file.type.startsWith('image/') && file.size > 8 * 1024 * 1024) { setError('이미지는 8MB 이하로 선택하세요.'); return }
    resetSource(() => {
      setReady(false)
      setMedia({ file, url: URL.createObjectURL(file), name: file.name, type: file.type.startsWith('video/') ? 'video' : 'image' })
    })
    event.target.value = ''
  }

  function download() {
    if (!displayedResult) return
    const { frame_base64, ...metadata } = displayedResult
    const link = document.createElement('a')
    const url = URL.createObjectURL(new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }))
    link.href = url; link.download = `tractor-${displayedResult.frame_id}.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const canAnalyze = authenticated && plantId && (mode === 'camera' ? cameraId : media && ready)
  const selectedResult = selectedFrameId ? history.find(row => row.frame_id === selectedFrameId) : null
  const displayedResult = selectedResult || latestResult
  const sourceTime = displayedResult?.video_position != null ? `녹화 ${displayedResult.video_position.toFixed(1)}초` : displayedResult?.captured_at ? new Date(displayedResult.captured_at).toLocaleString('ko-KR') : '촬영시각 미제공'

  return <div className="view stack tractor-view">
    <header className="tractor-header">
      <div><div className="view-title"><Tractor size={22} /> CCTV 트랙터·사람 인식 <span className="badge badge-neutral">AI 탐지 후보</span></div>
        <p className="view-sub">동영상으로 탐지를 시작하고, 분석한 프레임에서 트랙터와 사람을 확인하세요.</p></div>
      <select aria-label="분석 발전소" className="plant-select" value={plantId} disabled={busy || running} onChange={e => resetSource(() => setPlantId(e.target.value))}>
        <option value="">발전소 선택</option>{plants.map(p => <option key={p.plant_id} value={p.plant_id}>{p.name}</option>)}
      </select>
    </header>
    {!authenticated && <div className="tractor-notice">실제 계정으로 로그인하면 접근 가능한 발전소의 영상을 분석할 수 있습니다.</div>}
    <div className="tractor-layout">
      <section className="card tractor-source">
        <div className="tractor-tabs" role="group" aria-label="영상 소스">
          <button className={mode === 'file' ? 'selected' : ''} onClick={() => resetSource(() => setMode('file'))}><Upload size={16} /> 동영상 / 이미지</button>
          <button className={mode === 'camera' ? 'selected' : ''} onClick={() => resetSource(() => setMode('camera'))}><Camera size={16} /> 등록 CCTV</button>
        </div>
        {mode === 'file' ? <>
          <label className="tractor-upload"><Upload size={18} /><span>{media?.name || '동영상 또는 이미지 파일 선택'}</span><input aria-label="CCTV 파일 선택" type="file" accept="video/*,image/*" onChange={selectFile} /></label>
          {media ? media.type === 'video' ? <video className="tractor-media" ref={video} src={media.url} controls playsInline onLoadedData={() => setReady(true)} onError={() => { setReady(false); stop(); setError('이 브라우저에서 재생할 수 없는 영상입니다. MP4(H.264)로 변환하세요.') }} />
            : <img className="tractor-media" src={media.url} alt="분석할 CCTV 이미지" onLoad={() => setReady(true)} onError={() => { setReady(false); setError('이미지를 열 수 없습니다.') }} />
            : <div className="tractor-empty"><Upload size={44} /><strong>분석할 영상을 준비하세요</strong><span>영상은 브라우저에서 재생하고 선택한 프레임만 분석 서버로 전송합니다.</span></div>}
        </> : <>
          <select aria-label="CCTV 카메라" className="plant-select" value={cameraId} onChange={e => resetSource(() => setCameraId(e.target.value))}>
            <option value="">카메라 선택</option>{cameras.map(c => <option key={c.camera_id} value={c.camera_id}>{c.name}</option>)}
          </select>
          <div className="tractor-empty"><Camera size={44} /><strong>{cameraId ? 'CCTV 프레임 분석 준비' : '등록된 CCTV가 없습니다'}</strong><span>{cameraError || '서버에 등록된 RTSP 카메라에서 프레임을 받아 분석합니다.'}</span></div>
        </>}
        <div className="tractor-controls">
          <label>탐지 기준 점수 <b>{threshold.toFixed(2)}</b><input aria-label="탐지 기준 점수" type="range" min="0.1" max="0.9" step="0.05" value={threshold} disabled={busy || running} onChange={e => setThreshold(Number(e.target.value))} /></label>
          <div className="tractor-buttons">
            <button className="btn-primary" disabled={!canAnalyze || busy || running} onClick={analyze}><ScanLine size={16} />{busy ? '분석 중…' : '현재 프레임 분석'}</button>
            {running || busy ? <button className="icon-btn" onClick={stop}><Square size={16} /> 중지</button> : <button className="icon-btn" disabled={!canAnalyze || mode !== 'file' || media?.type !== 'video'} onClick={startContinuous}><Play size={16} /> 연속 분석</button>}
          </div>
          <p className="text-muted">{running ? '영상 시간을 2초씩 이동하며 순서대로 분석합니다.' : '최초 분석은 모델 준비로 오래 걸릴 수 있습니다.'} 탐지 점수는 정확도 보증값이 아닙니다.</p>
        </div>
      </section>
      <section className="card tractor-result" aria-live="polite">
        <div className="tractor-header"><h3>{selectedResult ? '분석 이력 프레임' : '최근 분석 프레임'}</h3><div className="tractor-result-actions">{selectedResult && <button className="icon-btn" onClick={() => setSelectedFrameId(null)}>최신 결과로</button>}<span className={`badge ${busy ? 'badge-warning' : displayedResult ? 'badge-active' : 'badge-neutral'}`}>{busy ? '다음 프레임 분석 중' : selectedResult ? '이력 확인' : displayedResult ? '분석 완료' : '대기'}</span></div></div>
        {error && <div role="alert" className="tractor-error">{error}</div>}
        {displayedResult ? <>
          <div className="tractor-frame" key={displayedResult.frame_id} style={{ aspectRatio: `${displayedResult.width}/${displayedResult.height}` }}>
            <img src={`data:image/jpeg;base64,${displayedResult.frame_base64}`} alt="탐지한 실제 CCTV 프레임" />
            {displayedResult.detections.map((d, i) => <div key={i} className="tractor-box" style={{ left: `${d.box[0]*100}%`, top: `${d.box[1]*100}%`, width: `${(d.box[2]-d.box[0])*100}%`, height: `${(d.box[3]-d.box[1])*100}%`, borderColor: COLORS[d.label] }}>
              <span style={{ background: COLORS[d.label] }}>{LABELS[d.label]} {d.score.toFixed(2)}</span>
            </div>)}
          </div>
          <div className="tractor-stats"><div><Tractor size={20} /><b>{displayedResult.counts.tractor}</b><span>트랙터 후보</span></div><div><Users size={20} /><b>{displayedResult.counts.person}</b><span>사람</span></div><div><b>{(displayedResult.inference_ms/1000).toFixed(1)}초</b><span>처리 시간</span></div></div>
          {displayedResult.counts.tractor === 0 && <p className="text-muted">이 프레임에서는 설정한 기준 이상의 트랙터가 탐지되지 않았습니다.</p>}
          <div className="tractor-meta">{displayedResult.source_name} · {sourceTime}<br />분석 시각 {new Date(displayedResult.analyzed_at).toLocaleString('ko-KR')}<br />{displayedResult.model_id}</div>
          <button className="icon-btn" onClick={download}><Download size={16} /> 분석 결과 JSON 저장</button>
        </> : <div className="tractor-empty"><ScanLine size={44} /><strong>탐지 결과가 여기에 표시됩니다</strong><span>트랙터는 초록색, 사람은 파란색 박스와 이름으로 표시됩니다.</span></div>}
      </section>
    </div>
    <section className="card"><div className="tractor-header"><h3>이번 세션 분석 로그</h3><span className="text-muted">최근 30개 프레임 · 로그를 클릭해 결과 확인</span></div>
      {history.length ? <div className="tractor-log-list">{history.map((row, index) => <button type="button" className={`tractor-log ${displayedResult?.frame_id === row.frame_id ? 'selected' : ''}`} key={row.frame_id} onClick={() => setSelectedFrameId(row.frame_id)}>
        <img src={`data:image/jpeg;base64,${row.frame_base64}`} alt={`분석 로그 ${index + 1} 프레임`} />
        <span className="tractor-log-order">#{row.analysis_no ?? history.length - index}</span>
        <span className="tractor-log-body"><b>{row.video_position != null ? `녹화 ${row.video_position.toFixed(1)}초` : row.camera_id ? 'CCTV 프레임' : '이미지'}</b><small>{new Date(row.analyzed_at).toLocaleTimeString('ko-KR')} · 처리 {(row.inference_ms/1000).toFixed(1)}초</small><span><em>트랙터 {row.counts.tractor}</em><em>사람 {row.counts.person}</em></span></span>
      </button>)}</div> : <div className="tractor-log-empty">분석을 시작하면 프레임 이미지와 탐지 결과가 로그에 추가됩니다.</div>}
    </section>
    <p className="text-muted">트랙터·사람의 존재를 탐지하는 초기 모델입니다. 작업 여부·경운/파종 종류는 아직 판정하지 않습니다. 같은 대상이 여러 프레임에 나타나므로 이력을 작업 횟수로 합산하지 마세요.</p>
  </div>
}
