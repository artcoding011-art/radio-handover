# KBS창원 라디오 업무 인수인계 시스템

KBS창원 라디오 방송국의 업무 인수인계서를 작성하고 관리하는 웹 애플리케이션입니다.

---

## 주요 기능

- **인수인계서 작성**: R-Studio / R-MCR / AFS 섹션, 정상/불량 드롭다운 입력
- **날짜별 이력 관리**: 캘린더에서 날짜 클릭 → 해당일 인수인계서 조회/수정
- **특이사항 요약**: 선택 날짜 특이사항 미리보기 + 이달의 특이사항 목록
- **CSV 내보내기**: 원본 양식 형태로 Excel 호환 CSV 다운로드
- **로그인 인증**: JWT 기반 세션 (HTTP-only 쿠키)

---

## 프로젝트 구조

```
RADIO/
├── app/
│   ├── page.tsx                        # 메인 페이지 (서버 컴포넌트)
│   ├── layout.tsx
│   ├── globals.css                     # react-calendar 커스텀 스타일
│   ├── MainClient.tsx                  # 메인 레이아웃 (4:6 분할)
│   ├── login/page.tsx                  # 로그인 페이지
│   └── api/
│       ├── auth/login/route.ts         # POST /api/auth/login
│       ├── auth/logout/route.ts        # POST /api/auth/logout
│       ├── entries/route.ts            # GET(전체날짜) / POST(저장)
│       ├── entries/[date]/route.ts     # GET /api/entries/YYYY-MM-DD
│       └── entries/month/[yearMonth]/route.ts  # GET /api/entries/month/YYYY-MM
├── components/
│   ├── HandoverForm.tsx                # 인수인계서 폼 컴포넌트
│   └── CalendarView.tsx               # 캘린더 컴포넌트
├── lib/
│   ├── types.ts                        # 타입 정의 및 기본값
│   ├── db.ts                           # Vercel KV 래퍼 (로컬은 메모리 폴백)
│   └── auth.ts                         # JWT 인증 유틸
├── middleware.ts                        # 라우트 보호 미들웨어
├── .env.local.example                  # 환경변수 예시
├── .env.local                          # 실제 환경변수 (git 제외)
├── package.json
└── vercel.json
```

---

## 로컬 개발 환경 설정

### 1. Node.js 설치
Node.js 18 이상 필요: https://nodejs.org

### 2. 의존성 설치
```bash
cd RADIO
npm install
```

### 3. 환경변수 설정
`.env.local.example`을 복사하여 `.env.local` 생성:
```bash
copy .env.local.example .env.local
```

`.env.local` 편집:
```env
JWT_SECRET=아무문자열이나입력하세요

# 로그인 계정 (기본값: admin / admin)
ADMIN_ID=admin
ADMIN_PASSWORD=admin

# Vercel KV (로컬 개발 시 없어도 메모리로 동작)
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

### 4. 개발 서버 실행

Claude Code에서:
```
preview_start "radio-dev"
```

또는 터미널에서:
```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속

### 5. 로그인
- ID: `admin`
- Password: `admin`

---

## Claude Code에서 계속 작업하기

이 프로젝트는 `.claude/launch.json`에 개발 서버 설정이 저장되어 있습니다.
Claude Code에서 `/preview radio-dev` 또는 preview_start 도구로 바로 실행됩니다.

### 추가 작업 시 참고 사항
- 폼 데이터 구조: `lib/types.ts`의 `HandoverEntry` 인터페이스 참조
- DB 저장: `lib/db.ts` — Vercel KV가 없으면 자동으로 메모리(휘발성) 사용
- 스타일: Tailwind CSS + `app/globals.css` (react-calendar 커스텀)
- 인증: `radio_session` 쿠키 (7일 만료 JWT)

---

## Vercel 배포

### 1. GitHub에 업로드
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_NAME/radio-handover.git
git push -u origin main
```

### 2. Vercel 연결
1. https://vercel.com 에서 "New Project" → GitHub 저장소 선택
2. Framework Preset: **Next.js** (자동 감지)
3. Deploy 클릭

### 3. Vercel KV 생성
1. Vercel 대시보드 → Storage → Create Database → KV
2. 프로젝트에 연결 → 환경변수 자동 추가됨

### 4. 환경변수 추가 (Vercel 대시보드)
```
JWT_SECRET=임의의긴문자열
ADMIN_ID=admin
ADMIN_PASSWORD=원하는비밀번호
```

---

## 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 스타일 | Tailwind CSS |
| 인증 | jose (JWT) |
| DB | Vercel KV (Redis) / 메모리 폴백 |
| 캘린더 | react-calendar |
| 날짜 처리 | date-fns |
| 배포 | Vercel |

---

## 화면 구성

```
┌─────────────────────────────────────────────────────┐
│  KBS창원 라디오              로그인: admin  [로그아웃] │
├────────────────────┬────────────────────────────────┤
│                    │  [캘린더 - 60%]                 │
│  인수인계서 (40%)  │  ┌──────────────────────────┐   │
│                    │  │   2026년 3월             │   │
│  [CSV] [저장]      │  │  일 월 화 수 목 금 토    │   │
│                    │  │   1  2  3  4  5  6  7   │   │
│  R-Studio          │  └──────────────────────────┘   │
│  R-MCR             │                                 │
│  AFS               │  [선택된 날짜 정보]             │
│                    │  [이달의 특이사항]              │
└────────────────────┴────────────────────────────────┘
```
