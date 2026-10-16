import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import TopHeader from './TopHeader'
import Sidebar from './Sidebar'
import AuthOverlay from '../modals/AuthOverlay'

export default function Layout() {
  const { sessionExpired, clearSessionExpired, user } = useApp()
  const [navOpen, setNavOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  // 로그인 만료로 자동 로그아웃되면 로그인 창을 만료 안내와 함께 띄운다
  const showAuth = authOpen || sessionExpired
  const closeAuth = () => {
    setAuthOpen(false)
    clearSessionExpired()
  }

  return (
    <div className="app-shell">
      <TopHeader onToggleNav={() => setNavOpen((v) => !v)} onOpenAuth={() => setAuthOpen(true)} />
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <main className="main">
        {user?.source === 'api' && !user.permissionsLoaded && <div className="card" role="alert">서버에서 권한 목록을 받지 못했습니다. 권한 연동이 필요한 기능은 사용할 수 없습니다. 백엔드 업데이트 후 다시 로그인해 주세요.</div>}
        <Outlet />
      </main>
      {showAuth && (
        <AuthOverlay
          notice={sessionExpired ? '로그인이 만료되었습니다(30분). 계속 보려면 다시 로그인해 주세요.' : ''}
          onClose={closeAuth}
        />
      )}
    </div>
  )
}
