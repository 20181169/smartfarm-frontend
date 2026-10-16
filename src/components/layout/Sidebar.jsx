import { NavLink } from 'react-router-dom'
import { navigationItems } from './navConfig'
import { useApp } from '../../context/useApp'

export default function Sidebar({ open, onClose }) {
  const { menuRole, user } = useApp()
  // 현재 역할(시스템 관리자 / 지자체 감독관 / 발전사업자)의 메뉴
  const items = navigationItems(user, menuRole)
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
          K 에너지 솔루션<br />
          통합 관제 시스템 v1.0
        </div>
      </aside>
      <div className={`sidebar-backdrop ${open ? 'show' : ''}`} onClick={onClose} />
    </>
  )
}
