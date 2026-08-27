import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import TopHeader from './TopHeader'
import Sidebar from './Sidebar'
import AuthOverlay from '../modals/AuthOverlay'

export default function Layout() {
  const [navOpen, setNavOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <div className="app-shell">
      <TopHeader onToggleNav={() => setNavOpen((v) => !v)} onOpenAuth={() => setAuthOpen(true)} />
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <main className="main">
        <Outlet />
      </main>
      {authOpen && <AuthOverlay onClose={() => setAuthOpen(false)} />}
    </div>
  )
}
