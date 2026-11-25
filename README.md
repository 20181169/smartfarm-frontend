# 동양연합 영농형 태양광 — React 대시보드

기존 바닐라 JS 사이트([hmapt01-netizen/dongyang-solar](https://github.com/hmapt01-netizen/dongyang-solar))를
**Vite + React**로 전체 포팅하고, 디자인을 현대적으로 정리한 버전입니다.

## 실행 방법

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 프로덕션 빌드 → dist/
npm run preview  # 빌드 결과 미리보기
```

### 전력거래소 SMP·REC 시세 (선택)

대시보드의 SMP·REC 시세는 공공데이터포털 OpenAPI 를 브라우저에서 직접 호출합니다(`src/lib/kpx.js`).
인증키가 없으면 데모 시세로 표시됩니다.

1. [공공데이터포털](https://www.data.go.kr)에서 두 API 활용신청 (같은 인증키 사용)
   - 한국전력거래소_계통한계가격 및 수요예측(하루전 발전계획용) — `B552115/SmpWithForecastDemand`
   - 한국전력거래소_REC 현물시장 정보 — `B552115/RecMarketInfo2`
2. 로컬: 프로젝트 루트 `.env.local` 에 `VITE_DATA_GO_KR_KEY=인증키` (git 에 올라가지 않음) 후 개발 서버 재시작
3. 배포: GitHub 저장소 Settings → Secrets and variables → Actions 에 `DATA_GO_KR_KEY` 등록
   (빌드 결과물에 포함되므로 공개 키로 취급 — 응답은 브라우저에 캐시해 호출 수를 줄임)

## 기술 스택

- **Vite 5** + **React 18** (JSX)
- **react-router-dom** (HashRouter — GitHub Pages 배포 편의)
- **chart.js** + **react-chartjs-2** (원본 차트 설정 재사용)
- **lucide-react** (아이콘 통일 — 원본의 이모지+SVG 혼용 정리)
- 순수 CSS 디자인 시스템 (`src/index.css`) · 라이트/다크 테마

## 폴더 구조

```
src/
├─ data/          plants.js(5개 발전소) · market.js(시세·이력·비교)
├─ lib/           format.js(포맷·CSV) · weather.js(Open-Meteo 실시간 날씨)
├─ context/       AppContext.jsx(발전소 선택·테마·로그인·날씨)
├─ components/
│  ├─ layout/     Layout · TopHeader · Sidebar · navConfig
│  ├─ charts/     시간/월/연 발전량 · REC/SMP 시세 · 상세·MPPT 차트
│  └─ modals/     로그인 · 일간리포트 · 발전소상세 · 인버터/MPPT 로그
└─ views/         Dashboard · Equipment · Calendar · Report ·
                  Overview · Errors · Settings · Comparison
```

## 주요 화면 (원본 8개 뷰 전체 포팅)

| 경로 | 화면 | 내용 |
|------|------|------|
| `/` | 현재상태 | 실시간 KPI·날씨·AI진단·발전/수익 위젯·차트 |
| `/equipment` | 설비 | 인버터/MPPT 실시간 표 + 이력 로그 모달 |
| `/calendar` | 달력보기 | 월별 발전 달력 + 일간 리포트 모달 |
| `/report` | 보고서 | 월간 종합·AI 수익 분석 |
| `/overview` | 발전소현황 | 5개 발전소 종합 카드 + 상세 그래프 모달 |
| `/errors` | 에러정보 | AI 고장 이력(필터) + CSV 내보내기 |
| `/settings` | 설정 | 사용자·계약·알림 설정 |
| `/comparison` | 발전소비교 | 5개 발전소 성과(PR) 비교표 |

## 개선 사항 (옮기면서 개선)

- 세이지/테라코타 팔레트는 유지하되 **간격·타이포·카드 시스템을 정리**
- 아이콘을 **lucide-react 한 세트로 통일** (원본의 이모지+SVG 혼용 제거)
- 인라인 스타일 538개 → **재사용 가능한 CSS 컴포넌트 클래스**로 재구성
- 강제 로그인 오버레이 제거(버튼으로 접근) · 라우팅 기반 SPA
- 라이트/다크 테마 즉시 전환 (localStorage 기억)

## GitHub Pages 배포

`vite.config.js`의 `base`를 레포 이름에 맞게 바꾼 뒤 빌드하세요.

```js
// 예: https://<user>.github.io/dongyang-solar-react/ 로 배포 시
base: '/dongyang-solar-react/',
```

```bash
npm run build   # dist/ 생성 → gh-pages 브랜치 또는 Pages 소스로 배포
```

HashRouter를 사용하므로 새로고침 404 걱정 없이 바로 동작합니다.

## 영농 업무 흐름

실계정의 계획평가 → AI 증빙 → 영농활동 제출·검토 → 계획 연결·최종 평가 → 보고서 생성·승인을 기존 API로 연결합니다.

- 계획 상세의 **이 계획의 활동 등록**에서 작업 유형과 기간을 이어받습니다. 증빙 상세의 **이 증빙으로 활동 등록**에서는 해당 증빙을 미리 선택합니다.
- 검수자는 활동 상세에서 연결할 계획을 선택하고 **활동 확정 및 계획 연결**을 실행합니다. 연결만 실패하면 활동 승인을 반복하지 않고 연결을 다시 시도합니다.
- 활동 목록·상세에는 서버에 실제 저장된 연결 계획을 표시합니다. 작성 기준으로 고른 계획은 최종 연결과 구분되며, 검수자가 연결 계획을 확인해야 합니다.
- 보관 보고서에는 승인·반려 상태를 표시하고, 해당 PDF를 미리 본 뒤 검토할 수 있습니다. 웹 승인 기록은 PDF 원문과 별도로 보관됩니다.

로컬 개발 서버는 기본적으로 기존 백엔드에 연결합니다. `VITE_API_TARGET`으로 백엔드를 바꾸거나 `VITE_VISION_API_TARGET`으로 별도 비전 서버를 지정할 수 있습니다.

```bash
npm test             # 상태 전이·권한·날짜·연결 재시도 단위 검증
npm run build
npm run test:browser # Playwright/Chromium 필요. 모든 업무 API는 테스트 응답으로 격리
```

브라우저 테스트에서 별도 설치를 사용할 때는 `PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE`을 지정합니다. 변경 범위와 수동 검증 순서는 `docs/frontend-review/workflow-ui-20261101.txt`를 참고하세요.

> 실계정의 영농계획·활동·증빙·보고서는 백엔드 API 데이터를 사용합니다. 일부 관제 화면에는 시연용 데이터가 포함되어 있습니다.

## 카메라 자동 촬영과 증빙

메인 **영농관리 · 로컬 시연** (`/#/farming-workspace`)은 실제 계정에서 **운영 자료**를 기본 표시합니다. 영농계획 → 사진 갤러리 → 수행 기록 → 보고서 → 현장 확인의 다섯 탭 안에서 서버 자료를 사용하며, 관리자 촬영 설정도 영농계획 탭 안에 있습니다. 기존 로컬 자료는 **샘플 시연** 버튼에서 보존합니다. `npm run test:workspace`로 메인 업무 흐름을 격리된 API 응답으로 검증할 수 있습니다. [메인 화면 연결 기록](docs/frontend-review/main-farming-workspace-20261125.txt)을 참고하세요.

- **카메라 설정** (`/#/camera-settings`): DB 카메라 등록, 보안 접속 설정, 메인·보조 스트림과 PTZ 설정 정보.
- **자동 촬영 정책** (`/#/capture-policies`): 영농계획·시간대·카메라 연결, 정기 촬영과 ANY/ALL 이벤트 감지 규칙.
- **CCTV 트랙터 인식**: 자동 촬영 증빙과 업로드 분석 결과를 날짜·상태·객체로 검색하고 확정·반려합니다.

메뉴와 편집 기능은 서버가 반환한 권한에 따릅니다. 새 정책은 비활성으로 시작하며, 실제 카메라 연결 정상 여부를 추정하지 않습니다. 원본 RTSP 주소는 로그·브라우저 저장소에 기록하지 않습니다.

`npm run test:camera`는 빌드된 화면에서 카메라 설정·정책·권한·증빙 검색을 격리된 API 응답으로 검증합니다. 적용 범위와 수동 테스트 순서는 [카메라·Vision 반영 기록](docs/frontend-review/camera-vision-ui-20261125.txt)을 참고하세요. 로컬 개발 화면의 기본 백엔드는 운영 서버이므로 실제 저장은 운영 자료를 변경합니다.
