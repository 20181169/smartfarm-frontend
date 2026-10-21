import { Link } from 'react-router-dom'
import { useApp } from '../context/useApp'

export default function DemoBoundary({ title, children }) {
  const { canViewDemo, hasPermission } = useApp()
  if (canViewDemo) return children
  return <div className="view stack"><div className="view-title">{title}</div>
    <section className="card" role="status"><h3>실제 데이터 연결 준비 중</h3>
      <p>이 화면의 종합 지표는 아직 실제 데이터와 연결되지 않았습니다.</p>
      {hasPermission('farming_plan:read') && hasPermission('farming_assessment:read') && <Link to="/plan-assessment">등록된 영농계획과 평가 확인</Link>}
    </section></div>
}
