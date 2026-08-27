import { useState, useEffect } from 'react'
import { Menu, Clock, Sun, Moon, LogOut, LogIn, Radio } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { PLANTS } from '../../data/plants'
import { nowStamp } from '../../lib/format'
import logo from '/logo.png'

export default function TopHeader({ onToggleNav, onOpenAuth }) {
  const { plant, plantId, selectPlant, canSwitchPlant, user, logout, theme, toggleTheme, connected } = useApp()
  const [stamp, setStamp] = useState(nowStamp())

  useEffect(() => {
    const t = setInterval(() => setStamp(nowStamp()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="top-header">
      <div className="brand">
        <button className="nav-drawer-handle only-sm" onClick={onToggleNav} aria-label="메뉴">
          <Menu />
        </button>
        <img src={logo} alt="동양연합 로고" />
        <span className="brand-title hide-sm">
          동양연합 <span className="accent">영농형 태양광</span>
        </span>
        <select
          className="plant-select"
          value={plantId}
          disabled={!canSwitchPlant}
          onChange={(e) => selectPlant(e.target.value)}
          title={canSwitchPlant ? '발전소 선택' : '담당 발전소 전용 계정입니다'}
        >
          {Object.values(PLANTS).map((p) => (
            <option key={p.id} value={p.id}>
              [{p.id}] {p.shortName} ({p.capacityKw}kW)
            </option>
          ))}
        </select>
      </div>

      <div className="header-actions">
        {connected && (
          <span className="badge badge-active" title="백엔드 실시간 연동 중">
            <Radio size={13} /> 실시간
          </span>
        )}
        <span className="pill hide-sm mono">
          <Clock /> {stamp}
        </span>

        {user ? (
          <>
            <span className="pill hide-sm">
              {user.role === '발전사업자' ? '사업자' : '관리자'} · {user.name}
            </span>
            <button className="btn-ghost" onClick={logout}>
              <LogOut /> 로그아웃
            </button>
          </>
        ) : (
          <button className="btn-primary" onClick={onOpenAuth}>
            <LogIn /> 로그인
          </button>
        )}

        <button className="icon-btn" onClick={toggleTheme} title="다크/라이트 전환">
          {theme === 'dark' ? <Moon /> : <Sun />}
          <span className="hide-sm">테마</span>
        </button>
      </div>
    </header>
  )
}
