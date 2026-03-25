# Mac OS Monterey 로컬 서버 설정 가이드

본 가이드는 Mac OS Monterey 환경에서 DB(Redis)와 OpenClaw 에이전트를 구축하고, Vercel과 연결하는 방법을 설명합니다.

## 1. 사전 준비
- **Docker Desktop for Mac** 설치가 필요합니다.
- **Node.js 22** 이상 버전이 권장됩니다.
- **Cloudflare 계정** (무료 터널링 서비스 이용 시)

## 2. Docker를 이용한 DB 및 에이전트 실행
프로젝트 루트 폴더에서 다음 명령어를 실행하여 Redis와 OpenClaw를 구동합니다.

```bash
docker-compose -f docker-compose.mac.yml up -d
```

- **Redis**: `localhost:6379`에서 대기합니다.
- **OpenClaw**: Docker 내부에서 실행되며 필요 시 자동 업데이트됩니다.

## 3. Vercel과 로컬 DB 연결 (터널링)
Vercel에서 로컬 Mac의 Redis에 접속하기 위해 Cloudflare Tunnel을 권장합니다.

1. **cloudflared 설치**:
   ```bash
   brew install cloudflare/cloudflare/cloudflared
   ```
2. **Tunnel 생성 및 실행**:
   ```bash
   cloudflared tunnel localhost:6379
   ```
3. 생성된 **고유 URL(예: https://...trycloudflare.com)**을 복사합니다.

## 4. Vercel 환경 변수 설정
Vercel 대시보드 -> Settings -> Environment Variables에서 다음을 추가합니다.

- `KV_REST_API_URL`: 위에서 복사한 터널 URL
- `KV_REST_API_TOKEN`: (Redis 비밀번호 설정 시 입력, 기본은 비어둠)
- `JWT_SECRET`: 기존 `.env.local`의 값

## 5. OpenClaw 에이전트 관리
OpenClaw 에이전트는 Mac 시스템을 관리하거나 AI 기능을 보조합니다. 에이전트 설정 및 상세 활용법은 공식 문서를 참조해 주세요.
