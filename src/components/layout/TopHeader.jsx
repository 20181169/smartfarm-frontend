import { useState, useEffect } from 'react'
import { Menu, Clock, Sun, Moon, LogOut, LogIn, Radio } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { nowStamp } from '../../lib/format'
import logo from '/logo.png'

export default function TopHeader({ onToggleNav, onOpenAuth }) {
  const {
    plant, plantId, plantList, selectPlant, canSwitchPlant, user, logout, theme, toggleTheme, connected, isLive, liveState,
  } = useApp()
  // 현재 선택 발전소가 목록에 없으면(데모↔백엔드 전환 직후) 앞에 붙여 셀렉터 값 불일치 방지.
  const options = plantList.some((p) => p.id === plantId) ? plantList : [plant, ...plantList]
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
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p._backend ? `🛰️ ${p.shortName}` : `[${p.id}] ${p.shortName}`} ({p.capacityKw ?? '-'}kW)
            </option>
          ))}
        </select>
      </div>

      <div className="header-actions">
        {/* '실시간'은 선택 발전소의 계측 데이터가 들어올 때만. 백엔드 연결만 됐으면 '계측 없음' */}
        {connected && (isLive ? (
          <span className="badge badge-active" title="선택 발전소 계측 데이터 수신 중">
            <Radio size={13} /> 실시간
          </span>
        ) : plant?._backend && liveState !== 'loading' ? (
          <span className="badge badge-neutral" title="백엔드는 연결됐지만 선택 발전소의 계측 데이터가 없습니다">
            <Radio size={13} /> 계측 없음
          </span>
        ) : null)}
        <span className="pill hide-sm mono">
          <Clock /> {stamp}
        </span>

        {user ? (
          <>
            <span className="pill hide-sm" title={user.roleCode || ''}>
              {user.roleName || (user.role === '발전사업자' ? '사업자' : '관리자')} · {user.name}
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
