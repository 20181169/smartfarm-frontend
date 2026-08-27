# 백엔드(FastAPI Smartfarm) 연동 가이드

React 프론트(`dongyang-solar-react`) ↔ 백엔드(`dongyang-solar-backend`, FastAPI) **실연동 완료** 상태 문서입니다.

## 🔑 로그인 정보 (부트스트랩 생성됨)

```
이메일:   admin@dongyang.com
비밀번호: admin1234
```

우측 상단 **로그인** → 위 계정 → 헤더에 `🛰️ 실시간` 배지가 뜨고 대시보드가 백엔드 실데이터로 전환됩니다.

---

## 1. 실행 순서

```bash
# 1) 백엔드 (이미 마이그레이션·계정·발전소·텔레메트리 시드 완료됨)
cd C:\Users\user\Desktop\dongyang-solar-backend
docker compose up -d

# 2) 프론트
cd C:\Users\user\Desktop\dongyang-solar-react
npm run dev            # http://localhost:5173
```

> 백엔드가 꺼져 있으면 앱은 자동으로 **데모(목) 데이터**로 동작합니다.

---

## 2. 연동되는 데이터

| 대시보드 요소 | 백엔드 연동 | 출처 |
|------|------|------|
| 로그인(JWT) | ✅ | `POST /api/v1/auth/login` |
| 발전소 목록·메타(이름·용량·상태·주소·위경도) | ✅ | `GET /api/v1/plants` |
| 현재 출력·금일 발전량 | ✅ 실시간 | 인버터 텔레메트리 합산 |
| 인버터별 계측(전압·전류·출력·일발전량) — 대시보드/설비 | ✅ 실시간 | `GET /api/v1/telemetry/inverter/recent` |
| 기상/환경(기온·습도·풍속·일사량·토양) | ✅ 실시간 | `GET /api/v1/telemetry/environment/recent` |
| 예상 수익·CO₂ 감축 | 🔶 파생 | 실발전량 기반 계산 |
| SMP/REC 시세, AI 진단, 월/연 히스토리, 에러 이력, 발전소 비교(PR) | ❌ 목 | 백엔드에 대응 엔드포인트 없음 |

대시보드 상단 `🛰️ 백엔드 실시간` 배지 / 날씨줄 `🛰️ 백엔드 센서 실시간` 표시로 실데이터 여부를 구분합니다.

---

## 3. ⚠️ 텔레메트리는 시계열이라 시간이 지나면 만료됨

인버터·환경 데이터는 InfluxDB에 **시점 데이터**로 저장되고, 프론트는 최근 180분 이내만 조회합니다.
시드한 데이터가 3시간을 넘기면 "최근" 범위를 벗어나 대시보드가 다시 목 데이터로 보일 수 있어요.

**최신 텔레메트리 다시 채우기** (백엔드 루트 `dongyang-solar-backend` 에서):

```bash
docker compose exec -T backend python - < seed_telemetry.py
```

> 재시드 스크립트는 `dongyang-solar-backend/seed_telemetry.py` 에 있고, 위 명령은 이미지 리빌드 없이
> stdin 으로 실행합니다. 실제 운영에선 현장 장비가 `POST /api/v1/telemetry/inverter` · `/environment`
> 로 주기 전송하면 자동으로 최신 상태가 유지됩니다.

---

## 4. 프론트 연동 구조 (이미 적용됨)

| 파일 | 내용 |
|------|------|
| `vite.config.js` | `/api/*` → 백엔드(:8000) 프록시 |
| `src/lib/api.js` | API 클라이언트 + `apiPlantLive()`(인버터 합산·환경 최신값 정규화) |
| `src/context/useApp.js` | 컨텍스트/훅 분리(fast-refresh 안전) |
| `src/context/AppContext.jsx` | 실발전소 조회·연결상태·실시간 텔레메트리 병합 |
| `src/components/modals/AuthOverlay.jsx` | 백엔드 로그인 + 데모 폴백 |
| `src/views/OverviewView.jsx` | "백엔드 실시간 발전소 목록" |

백엔드 측:
- `backend/app/main.py` — **CORS 미들웨어 추가**
- `backend/alembic/versions/*seed*` — **중복 시드 멱등 가드 추가**(마이그레이션 버그 수정)

---

## 5. 참고

- 위 마이그레이션 수정·부트스트랩·CORS는 **로컬에만** 반영돼 있습니다. 재클론/팀 공유 시 재적용(또는 커밋) 필요.
- 남은 실연동 후보: SMP/REC·수익은 별도 시세 소스/계산 로직, AI 진단·에러 이력·월/연 집계는 백엔드 엔드포인트 추가가 필요합니다.
