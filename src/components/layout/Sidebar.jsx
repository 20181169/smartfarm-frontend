import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navConfig'
import { useApp } from '../../context/useApp'

export default function Sidebar({ open, onClose }) {
  const { menuRole } = useApp()
  // 현재 역할(발전사업자/감독관·관리자) 메뉴 + 공통 메뉴만 노출
  const items = NAV_ITEMS.filter((it) => it.group === 'both' || it.group === menuRole)
  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <ul className="nav-list">
          {items.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <Icon strokeWidth={2} />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="sidebar-foot">
          동양연합 영농형 태양광<br />
          통합 관제 시스템 v1.0
        </div>
      </aside>
      <div className={`sidebar-backdrop ${open ? 'show' : ''}`} onClick={onClose} />
    </>
  )
}
