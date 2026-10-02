import { useState } from 'react'
import { X, Wifi, WifiOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import { menuRoleOf, isSupervisorRole } from '../../lib/roles'
import logo from '/logo.png'

// 로그인 역할 선택 — 통합 버전과 동일한 역할 구성.
// group(메뉴 역할): 'owner'(발전사업자) | 'official'(지자체 감독관) | 'admin'(최고 관리자). email 은 실로그인 시 프리필.
const ROLES = [
  { key: 'owner34', label: '온누리3,4 소유주', sub: '발전소 사업자', group: 'owner', name: '온누리3,4 소유주', email: 'viewer@example.com', desc: '원주 온누리3,4 소유 발전사업자 (본인 발전소 전용 조회 권한)' },
  { key: 'owner12', label: '온누리1,2 소유주', sub: '발전소 사업자', group: 'owner', name: '온누리1,2 소유주', email: 'viewer@example.com', desc: '원주 온누리1,2 소유 발전사업자 (본인 발전소 전용 조회 권한)' },
  { key: 'inspector', label: '지자체 감독관', sub: '영농행정 관리자', group: 'official', name: '지자체 감독관', email: 'admin@example.com', desc: '강원특별자치도 영농형 태양광 영농이행 감독관' },
  { key: 'admin', label: '최고 관리자', sub: '전체 시스템 풀관제', group: 'admin', name: '최고 관리자', email: 'admin@example.com', desc: '전체 시스템 통합 관리자 (발전 성능 & 영농이행 풀 관제)' },
]

export default function AuthOverlay({ onClose, notice = '' }) {
  const { apiSignIn, login } = useApp()
  const navigate = useNavigate()
  const [roleKey, setRoleKey] = useState(ROLES[0].key)
  const role = ROLES.find((r) => r.key === roleKey)
  const [email, setEmail] = useState(ROLES[0].email)
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const pickRole = (r) => { setRoleKey(r.key); setEmail(r.email); setError('') }
  // 관리자·감독관은 종합대시보드, 발전사업자는 현재상태로 시작 (통합 버전과 동일)
  const goHome = (menuRole) => navigate(isSupervisorRole(menuRole) ? '/oversight' : '/')

  const doLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const u = await apiSignIn(email, pw)
      goHome(menuRoleOf(u))
      onClose()
    } catch (err) {
      setError(
        err.status === 0 ? '백엔드에 연결할 수 없습니다. 아래 데모로 입장하세요.'
          : err.status === 401 ? '이메일 또는 비밀번호가 올바르지 않습니다.'
            : err.message || '로그인에 실패했습니다.'
      )
    } finally {
      setLoading(false)
    }
  }

  const doDemo = () => {
    login({ name: role.name, role: role.group === 'owner' ? '발전사업자' : '관리자', source: 'demo', demoRole: role.group })
    goHome(role.group)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <button className="modal-close" onClick={onClose} style={{ position: 'absolute', top: -4, right: -4 }}><X /></button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
            <img src={logo} alt="로고" style={{ height: 30 }} />
            <h2 style={{ fontSize: 17, fontWeight: 800 }}>동양연합 영농형 태양광</h2>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>사용자 권한(Role)별 맞춤 관제 플랫폼</p>
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-3)', margin: '16px 0 8px' }}>로그인 사용자 권한 선택</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {ROLES.map((r) => {
            const active = r.key === roleKey
            return (
              <button
                key={r.key}
                onClick={() => pickRole(r)}
                style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${active ? 'var(--sage-strong)' : 'var(--border)'}`,
                  background: active ? 'var(--bg-subtle)' : 'var(--card, #fff)',
                  outline: active ? '2px solid var(--sage-strong)' : 'none',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>({r.sub})</div>
              </button>
            )
          })}
        </div>

        <div style={{ background: 'var(--bg-subtle)', color: 'var(--sage-strong)', fontSize: 11.5, fontWeight: 700, padding: '8px 11px', borderRadius: 8, margin: '10px 0 12px', lineHeight: 1.5 }}>
          {role.desc}
        </div>

        {(error || notice) && (
          <div style={{ background: 'var(--terracotta-soft)', color: 'var(--terracotta)', fontSize: 12, fontWeight: 600, padding: '8px 11px', borderRadius: 8, marginBottom: 12, lineHeight: 1.5 }}>{error || notice}</div>
        )}

        <form onSubmit={doLogin}>
          <div className="field">
            <label>이메일</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@example.com" />
          </div>
          <div className="field">
            <label>비밀번호</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required placeholder="비밀번호 입력" />
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: 12, fontSize: 14, marginTop: 4, opacity: loading ? 0.7 : 1 }}>
            <Wifi /> {loading ? '연결 중…' : '관제 시스템 접속 (백엔드)'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', color: 'var(--text-3)', fontSize: 11 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />또는<div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <button className="icon-btn" onClick={doDemo} style={{ width: '100%', justifyContent: 'center', padding: 11 }}>
          <WifiOff />&nbsp;백엔드 없이 <b style={{ margin: '0 4px' }}>{role.label}</b> 데모로 입장
        </button>
      </div>
    </div>
  )
}
