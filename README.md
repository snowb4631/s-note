# 스노트 (s-note)

로그인 없이 손글씨 느낌의 매매일지 카드를 작성해 PDF로 내려받거나 이메일로 받는 서비스. 데이터베이스가 없고, 스노트 서버는 카드 내용을 저장하지 않는다. 이메일로 받으면 발송 대행사(Cloudflare)가 자체 정책에 따라 메일을 보관할 수 있다.

## 개발

```bash
npm install
npm run dev            # http://localhost:3000. 키가 없으면 메일·봇 확인·횟수 제한을 건너뛰고 응답에 표시
npm run build
npm run lint
npm test               # 단위 테스트. PDF 게이트 결과 PNG는 artifacts/ 에 생성
npm run gate:pdf       # PDF 게이트만
npx playwright install chromium   # 처음 한 번
npm run test:e2e       # 빌드 후 E2E (포트 3100~3106 사용)
```

폰트를 바꾸면 `npm run fonts:metrics`로 폭 표와 woff2를 다시 만든다.

## 구조

| 경로 | 내용 |
| --- | --- |
| `src/lib/card/` | 공용 도메인. 스키마(`schema.ts`), 계산(`calc.ts`), 좌표(`layout.ts`), 줄바꿈(`text.ts`), 장면(`scene.ts`) |
| `src/components/` | 편집기, 필기 패드, 미리보기, 발송 화면, 광고 슬롯 |
| `src/pdf/` | react-pdf 문서와 렌더 |
| `src/server/` | `/api/pdf`, `/api/send` 처리 순서, Turnstile, 횟수 제한, 메일 |
| `src/content/guides.ts` | 가이드 글 |
| `src/lib/site.ts` | 서비스 이름, 운영 주체. 미확정 값은 `[확인 필요]` |

미리보기와 PDF가 같은 이유: 둘 다 `buildScene(card)`가 만든 같은 도형 목록을 그린다. 줄바꿈도 폰트 폭 표로 계산하는 순수 함수라 브라우저와 서버의 결과가 같다.

## 환경변수

값은 저장소에 넣지 않는다. 이름은 `.env.example`에 있다. 운영(`NODE_ENV=production`)에서 빠진 값이 있거나 Turnstile 테스트 키를 쓰면 API는 503으로 거절한다.

| 이름 | 용도 | 필요한 곳 |
| --- | --- | --- |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile | `/send`, `/api/send` |
| `RATE_LIMIT_BACKEND` | `memory`면 프로세스 메모리로 횟수 제한(단일 서버 전용). 그 외에는 아래 Upstash 사용 | `/api/send`, `/api/pdf` |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | 횟수 제한 저장소 | `/api/send`, `/api/pdf` |
| `RATE_LIMIT_HMAC_SECRET` | 수신 주소·IP 해시 키. 32자 이상 임의 값(운영에서 더 짧으면 503). 바꾸면 카운터가 초기화된다 | `/api/send`, `/api/pdf` |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_API_TOKEN` | Cloudflare Email Service 발송 | `/api/send` |
| `MAIL_FROM` | 발신자. 온보딩한 하위 도메인의 주소. 예: `no-reply@mail.stock-snow.com` | `/api/send` |
| `EMAIL_SENDING_ENABLED` | `true`일 때만 이메일 받기를 연다. 그 외에는 버튼을 미구현으로 표시하고 `/api/send`는 503. 실제 발송을 확인한 뒤 켠다 | `/`, `/send`, `/api/send` |
| `SEND_DAILY_CAP` | 선택. 하루 전체 발송 상한. 기본 80, 양의 정수가 아니면 기본값 | `/api/send` |
| `ADSENSE_CLIENT`, `ADSENSE_SLOT` | 선택. 둘 다 있을 때만 `/send`에 광고 슬롯과 스크립트 렌더. 승인 전에는 비워 둔다 | `/send` |

`/send` 관련 값은 요청 시점에 읽으므로 환경변수를 바꾼 뒤 재빌드 없이 재배포만 하면 된다.

## 자체 서버 배포 (현재 운영)

`deploy/compose.yaml`로 앱 컨테이너 하나를 띄운다. 횟수 제한은 `RATE_LIMIT_BACKEND=memory`로 프로세스 메모리에 둔다. 인스턴스가 하나일 때만 유효하고 재시작하면 카운터가 초기화된다.

```bash
docker buildx build --platform linux/amd64 --push -t claudkim/snote:TAG .
# 서버의 ~/snote: compose.yaml, .env(SNOTE_TAG, RATE_LIMIT_HMAC_SECRET, EMAIL_SENDING_ENABLED)
docker compose pull && docker compose up -d
```

앱은 `127.0.0.1:3300`과 앞단 nginx의 Docker 네트워크에만 열린다. `deploy/nginx-snote.conf`를 앞단 nginx의 `conf.d`에 넣으면 `Host`로 라우팅하고, Cloudflare 대역에서 온 요청은 `CF-Connecting-IP`로 실제 IP를 읽는다. 대역이 바뀌면 이 파일도 갱신한다. 인증서는 `certbot --dns-cloudflare`로 받는다.

## 배포와 DNS (사용자 작업)

1. Vercel 프로젝트를 만들고 이 폴더를 연결한다. 광고를 붙이면 상업적 이용이므로 Pro 요금제가 필요하다.
2. 위 환경변수를 Production에 넣는다.
3. Vercel에 `snote.stock-snow.com` 도메인을 추가하고, stock-snow.com DNS에 Vercel이 안내하는 CNAME을 추가한다. stock-snow.com의 네임서버가 Cloudflare이므로 이 레코드는 반드시 프록시를 끈 **DNS only (grey cloud)** 로 둔다.
4. 메일 발신 도메인을 온보딩한다. 아래 "메일 설정"을 본다.
5. Turnstile 위젯에 `snote.stock-snow.com`을 허용 도메인으로 등록한다.
6. 개인정보처리방침의 `[확인 필요]` 값을 채우고 전문가 검토를 받는다. (`src/lib/site.ts`, `src/app/privacy/page.tsx`)
7. 실제 메일을 Gmail, 네이버 등으로 보내 수신과 스팸함 여부를 확인한다.
8. AdSense 승인 후 `ADSENSE_CLIENT`, `ADSENSE_SLOT`을 넣는다.

## 메일 설정

Cloudflare Email Service(Beta)를 REST API로 호출한다. Workers Paid 요금제가 필요하다.

1. Cloudflare 대시보드에서 Compute > Email Service > Email Sending > Onboard Domain으로 들어가 메일 하위 도메인(예: `mail.stock-snow.com`)을 등록한다.
2. 안내되는 `cf-bounce` MX·SPF, DKIM, `_dmarc` 레코드를 추가한다. DMARC는 처음에 `p=none`으로 시작하고 보고서를 본 뒤 올린다.
3. Email Sending 권한이 있는 API 토큰을 만들어 `.env.local`에 넣는다.

```bash
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_EMAIL_API_TOKEN=...
MAIL_FROM=no-reply@mail.stock-snow.com
```

4. 시험 발송: `npm run mail:test -- me@example.com`. 실제 렌더·메일 코드로 샘플 카드를 한 통 보내고 `delivered`, `queued` 또는 오류만 출력한다. 이 API는 메시지 id를 돌려주지 않는다.

- 온보딩 전에는 인증된 수신 주소(verified destination address)로만 보낼 수 있다.
- 새 계정은 보수적인 일일 한도로 시작하며 수치는 공개되어 있지 않다. `SEND_DAILY_CAP` 기본값 80이 그 한도보다 크면 낮춘다.
- 메시지 한도는 첨부 포함 5 MiB다. base64로 늘어나는 분을 감안해 PDF가 3.5 MiB를 넘으면 보내지 않고 안내한다. 최악 카드의 PDF는 약 1.5 MB다.
- 메일 API 오류는 `/send`에 한국어로 표시한다. 429는 "잠시 후 다시 시도", 401·403은 발신 설정 안내, 받는 주소가 영구 반송되면 주소 확인 안내다.

## 횟수 제한

IP당 시간당 5통(IPv6는 /64 단위), 하루 전체 80통(`SEND_DAILY_CAP`), 수신 주소당 하루 10통(대소문자, `+태그`, Gmail의 점을 무시), `/api/pdf`는 IP당 시간당 60회. `src/server/rate-limit.ts`에서 바꾼다. 확인 순서는 IP, 수신 주소, 전체이며 앞 단계에서 거절되면 뒤 단계의 횟수를 쓰지 않는다. 전체 상한에서 거절된 요청은 수신 주소 횟수를 이미 쓴 상태다. Redis 장애 시 거절한다. Redis에는 HMAC 해시만 들어가고, fixed window라 키는 한 창(최대 24시간)이 지나면 만료된다. 한도에 걸린 해시는 인스턴스 메모리에 창이 끝날 때까지 남아 반복 요청은 Redis를 호출하지 않는다.

전체 상한은 소진되면 그날 모든 사용자의 메일이 막힌다. 악용으로 소진될 수 있으니 아래 경보를 켠다.

## 운영 보호 설정 (사용자 작업)

- Vercel Firewall: `/api/send`, `/api/pdf`에 IP당 분당 요청 수를 제한하는 Rate Limit 규칙을 추가한다. 함수 실행 전에 막히므로 비용을 줄인다.
- Upstash: 콘솔에서 예산 상한(Budget)과 사용량 경보를 설정한다. 요청 폭주가 곧 비용이 되는 것을 막는다.
- `artifacts/banned-phrases.json`(git 미추적)이 있으면 금지 문구 검사가 실행되고, 없으면 건너뛴다.
