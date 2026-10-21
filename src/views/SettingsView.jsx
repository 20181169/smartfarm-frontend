import { User, FileSignature, Bell } from 'lucide-react'
import { useApp } from '../context/useApp'

function Info({ label, value }) {
  return <div className="info-row bordered"><span>{label}</span><b>{value || '미등록'}</b></div>
}
export default function SettingsView() {
  const { plant, user } = useApp()
  const real = user?.source === 'api'
  return <div className="view stack">
    <div><div className="view-title">환경 설정</div><div className="view-sub">사용자 · 발전소 계약 · 알림 설정</div></div>
    <div className="grid grid-2">
      <section className="card"><div className="card-header"><h3 className="card-title"><User /> 나의 설정 정보</h3></div>
        <Info label="이름" value={real ? user.name : null} /><Info label="이메일" value={real ? user.email : null} />
        <Info label="역할" value={real ? user.roleName : null} />
        <Info label="연락처" value="준비 중" />
        <p className="text-muted">연락처 등록과 개인 설정 변경은 준비 중입니다.</p>
      </section>
      <section className="card"><div className="card-header"><h3 className="card-title"><FileSignature /> 발전소 계약정보</h3></div>
        <Info label="발전소 이름" value={plant._backend ? plant.shortName : null} />
        <Info label="인버터 종류" value={plant._backend ? plant.inverterModel : null} />
        {['계약 주체', '정책 및 제도', 'REC 가중치', '보유 REC'].map(label => <Info key={label} label={label} value="준비 중" />)}
        <p className="text-muted">계약정보 조회와 변경은 준비 중입니다.</p>
      </section>
    </div>
    <section className="card"><div className="card-header"><h3 className="card-title"><Bell /> 알림 및 데이터 연동</h3></div>
      {['경보 수신 시간', '일출·일몰 및 날씨별 알림', '카카오톡 알림 수신자 번호', '발전 정지 경보 시간', '시세·날씨 갱신 주기 설정'].map(label => <Info key={label} label={label} value="준비 중" />)}
      <p className="text-muted">알림 수신 설정은 아직 제공되지 않습니다.</p>
    </section>
  </div>
}
