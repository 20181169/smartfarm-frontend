import { User, FileSignature, Bell } from 'lucide-react'
import { useApp } from '../context/useApp'

export default function SettingsView() {
  const { plant } = useApp()

  return (
    <div className="view stack">
      <div>
        <div className="view-title">환경 설정</div>
        <div className="view-sub">사용자 · 발전소 계약 · 알림 관제 설정</div>
      </div>

      <div className="grid grid-2">
        {/* 나의 설정 정보 */}
        <div className="card">
          <div className="card-header"><span className="card-title"><User /> 나의 설정 정보</span></div>
          <div className="field"><label>이름</label><input defaultValue="김진성" /></div>
          <div className="field"><label>연락처</label><input defaultValue="010 3574 1072" /></div>
          <div className="field">
            <label>경보 알람 시간</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input defaultValue="10" style={{ width: 60, textAlign: 'center' }} /> 시 ~
              <input defaultValue="15" style={{ width: 60, textAlign: 'center' }} /> 시
            </div>
          </div>
          <label className="check" style={{ marginBottom: 8 }}><input type="checkbox" defaultChecked /> 설정한 시간 내에 경보 알림을 받습니다.</label>
          <label className="check" style={{ marginBottom: 8 }}><input type="checkbox" /> 일출·일몰 시간으로 경보를 설정합니다.</label>
          <label className="check" style={{ marginBottom: 14 }}><input type="checkbox" /> 눈·비 예보 시 가동정지 알림을 받지 않습니다.</label>
          <button className="btn-terracotta" style={{ alignSelf: 'flex-end' }} onClick={() => alert('나의 설정 정보가 저장되었습니다.')}>설정 저장</button>
        </div>

        {/* 발전소 계약정보 */}
        <div className="card">
          <div className="card-header"><span className="card-title"><FileSignature /> 발전소 계약정보</span></div>
          <div className="info-row bordered"><span>발전소 이름</span><b>{plant.shortName}</b></div>
          <div className="info-row bordered" style={{ margin: '10px 0' }}><span>인버터 종류</span><b>[Hyundai] {plant.inverterModel}</b></div>
          <div className="field"><label>계약 주체</label>
            <select defaultValue="한국전력공사(KEPCO)"><option>한국전력공사(KEPCO)</option><option>전력거래소(KPX)</option><option>자가용 / PPA</option></select>
          </div>
          <div className="field"><label>정책 및 제도</label>
            <select defaultValue="RPS">
              <option value="RPS">RPS (신재생에너지 공급 의무화)</option>
              <option>고정가격계약 경쟁입찰</option>
              <option>한국형 FIT</option>
              <option>자가소비형</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="field" style={{ flex: 1 }}><label>가중치 (배)</label><input defaultValue="1.5" /></div>
            <div className="field" style={{ flex: 1 }}><label>보유 REC</label><input defaultValue="449.85" /></div>
          </div>
          <button className="btn-terracotta" style={{ alignSelf: 'flex-end' }} onClick={() => alert('발전소 계약정보가 저장되었습니다.')}>계약정보 저장</button>
        </div>
      </div>

      {/* 알림 · 연동 */}
      <div className="card">
        <div className="card-header"><span className="card-title"><Bell /> 알림 및 데이터 연동</span></div>
        <div className="grid grid-2">
          <div className="field"><label>카카오톡 알림 수신자 번호</label><input defaultValue="010-3849-XXXX" /></div>
          <div className="field"><label>인버터 발전 정지 경보 시간</label>
            <select><option>발전 중단 10분 후 즉시 알림</option><option>발전 중단 30분 후 즉시 알림</option></select>
          </div>
          <div className="field"><label>KPX REC 시세 자동 수신 주기</label>
            <select><option>10분 간격 (권장)</option><option>30분 간격</option><option>1시간 간격</option></select>
          </div>
          <div className="field"><label>기상청 동네예보 자동 갱신</label>
            <select><option>실시간 자동 갱신 사용 (ON)</option><option>사용 안 함</option></select>
          </div>
        </div>
        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <button className="btn-terracotta" onClick={() => alert('관제 설정 변경사항이 정상 저장되었습니다.')}>설정 저장하기</button>
        </div>
      </div>
    </div>
  )
}
