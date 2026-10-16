import { useApp } from '../context/useApp'

export default function RequirePermission({ permissions, children }) {
  const { user, hasPermission } = useApp()
  if (permissions.every(hasPermission)) return children
  return <div className="view stack"><div className="card" role="status">
    <h2 style={{ fontSize: 17 }}>접근 권한이 없습니다</h2>
    <p>{!user || user.source !== 'api' ? '실제 계정으로 로그인해 주세요.'
      : !user.permissionsLoaded ? '서버에서 권한 목록을 받지 못했습니다. 권한 정보가 제공된 후 다시 로그인해 주세요.'
        : '이 화면에 필요한 권한이 없습니다. 담당 관리자에게 확인해 주세요.'}</p>
  </div></div>
}
