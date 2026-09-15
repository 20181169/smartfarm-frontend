import { Lock } from 'lucide-react'
import { useApp } from '../context/useApp'

// 감독 권한(관리자·감독관, level ≤ 60) 전용 화면 가드.
export default function RequireSupervisor({ children }) {
  const { isSupervisor } = useApp()
  if (isSupervisor) return children
  return (
    <div className="view stack">
      <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
        <Lock size={40} style={{ color: 'var(--text-3)', marginBottom: 12 }} />
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>접근 권한이 없습니다</div>
        <div className="text-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          이 화면은 <b>감독 권한(시스템·지자체 관리자, 현장 점검자)</b> 계정만 이용할 수 있습니다.
        </div>
      </div>
    </div>
  )
}
