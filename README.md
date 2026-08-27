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

> 데이터는 원본과 동일한 데모용 목(mock) 데이터이며, 날씨만 Open-Meteo API로 실시간 조회합니다.
