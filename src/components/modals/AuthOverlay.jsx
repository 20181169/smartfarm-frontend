import { useState } from 'react'
import { X, Wifi, WifiOff } from 'lucide-react'
import { useApp } from '../../context/useApp'
import logo from '/logo.png'

export default function AuthOverlay({ onClose }) {
  const { apiSignIn, login } = useApp()
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const doApiLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiSignIn(email, pw)
      onClose()
    } catch (err) {
      if (err.status === 0) {
        setError('백엔드에 연결할 수 없습니다. 서버 실행 여부를 확인하거나 아래 데모 모드를 이용하세요.')
      } else if (err.status === 401) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      } else {
        setError(err.message || '로그인에 실패했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  const doDemo = () => {
    login({ name: '데모 관리자', role: '관리자', source: 'demo' })
    onClose()
  }

  const doSignup = (e) => {
    e.preventDefault()
    const f = e.target
    if (f.pw.value !== f.pwc.value) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    login({ name: f.name.value || '신규사업자', role: '발전사업자', source: 'demo' })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <button className="modal-close" onClick={onClose} style={{ position: 'absolute', top: -4, right: -4 }}>
            <X />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
            <img src={logo} alt="로고" style={{ height: 30 }} />
            <h2 style={{ fontSize: 17, fontWeight: 800 }}>동양연합 영농형 태양광</h2>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
            통합 태양광 발전소 시스템에 로그인하세요
          </p>
        </div>

        <div className="segmented" style={{ display: 'flex', margin: '16px 0' }}>
          <button className={tab === 'login' ? 'active' : ''} style={{ flex: 1 }} onClick={() => { setTab('login'); setError('') }}>
            로그인
          </button>
          <button className={tab === 'signup' ? 'active' : ''} style={{ flex: 1 }} onClick={() => { setTab('signup'); setError('') }}>
            회원가입
          </button>
        </div>

        {error && (
          <div style={{ background: 'var(--terracotta-soft)', color: 'var(--terracotta)', fontSize: 12, fontWeight: 600, padding: '8px 11px', borderRadius: 8, marginBottom: 12, lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        {tab === 'login' ? (
          <>
            <form onSubmit={doApiLogin}>
              <div className="field">
                <label>이메일</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@dongyang.com" />
              </div>
              <div className="field">
                <label>비밀번호</label>
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required placeholder="비밀번호 입력" />
              </div>
              <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: 12, fontSize: 14, marginTop: 4, opacity: loading ? 0.7 : 1 }}>
                <Wifi /> {loading ? '연결 중…' : '백엔드로 로그인'}
              </button>
            </form>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', color: 'var(--text-3)', fontSize: 11 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              또는
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <button className="icon-btn" onClick={doDemo} style={{ width: '100%', justifyContent: 'center', padding: 11 }}>
              <WifiOff /> 백엔드 없이 데모 모드로 입장
            </button>
          </>
        ) : (
          <form onSubmit={doSignup}>
            <div className="field">
              <label>사용자 성명</label>
              <input name="name" required placeholder="홍길동" />
            </div>
            <div className="field">
              <label>아이디 (이메일)</label>
              <input name="email" type="email" required placeholder="user@dongyang.com" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="field">
                <label>비밀번호</label>
                <input name="pw" type="password" required placeholder="비밀번호" />
              </div>
              <div className="field">
                <label>비밀번호 확인</label>
                <input name="pwc" type="password" required placeholder="확인" />
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 12px' }}>
              ※ 회원가입은 데모용 로컬 처리입니다. 실제 계정은 백엔드에서 발급됩니다.
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12, fontSize: 14 }}>
              데모 계정으로 시작
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
