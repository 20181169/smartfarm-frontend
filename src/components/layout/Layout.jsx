import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import TopHeader from './TopHeader'
import Sidebar from './Sidebar'
import AuthOverlay from '../modals/AuthOverlay'

export default function Layout() {
  const { sessionExpired, clearSessionExpired } = useApp()
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
