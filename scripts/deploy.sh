#!/usr/bin/env bash
# 이미지를 로컬에서 빌드해 Docker Hub에 올리고, 서버는 받아서 실행만 한다.
#   scripts/deploy.sh            현재 HEAD를 빌드·배포
#   scripts/deploy.sh <tag>      이미 올린 태그로 되돌리기 (빌드 없음)
# 필요: 로컬·서버의 docker login, 서버 계정의 비밀번호 없는 sudo, 서버 ~/snote/.env.
set -euo pipefail

SERVER="${SNOTE_SERVER:-claudkim@49.50.139.64}"
REMOTE_DIR="${SNOTE_REMOTE_DIR:-snote}"
NGINX_CONF="${SNOTE_NGINX_CONF:-/root/git/trakit/nginx/conf.d/snote.conf}"
IMAGE="${SNOTE_IMAGE:-claudkim/snote}"
PLATFORM="${SNOTE_PLATFORM:-linux/amd64}"

cd "$(git rev-parse --show-toplevel)"

if [ $# -ge 1 ]; then
  TAG="$1"
  docker manifest inspect "$IMAGE:$TAG" >/dev/null
else
  if [ -n "$(git status --porcelain)" ]; then
    echo "커밋되지 않은 변경이 있습니다. 태그와 이미지가 어긋나므로 중단합니다." >&2
    exit 1
  fi
  TAG="$(git rev-parse --short HEAD)"
  docker buildx build --platform "$PLATFORM" --push -t "$IMAGE:$TAG" -t "$IMAGE:latest" .
fi

# 서버에 저장소가 없으므로 compose와 nginx 설정은 함께 올린다.
scp -q deploy/compose.yaml deploy/nginx-snote.conf "$SERVER:$REMOTE_DIR/"

ssh -o BatchMode=yes "$SERVER" bash -s -- "$REMOTE_DIR" "$TAG" "$NGINX_CONF" <<'REMOTE'
set -euo pipefail
dir="$1"; tag="$2"; conf="$3"
cd "$HOME/$dir"

sed -i "s/^SNOTE_TAG=.*/SNOTE_TAG=$tag/" .env
docker compose pull --quiet </dev/null
docker compose up -d </dev/null

# 문법 오류가 있으면 이전 설정으로 되돌려 같은 nginx를 쓰는 다른 서비스를 지킨다.
# 이 스크립트는 표준 입력으로 실행되므로, sudo가 그 입력을 읽지 못하게 막는다.
if ! sudo -n cmp -s nginx-snote.conf "$conf" </dev/null; then
  backup="$(mktemp)"
  sudo -n cp "$conf" "$backup" </dev/null
  sudo -n install -m 644 -o root -g root nginx-snote.conf "$conf" </dev/null
  if ! docker exec trakit-nginx nginx -t </dev/null; then
    sudo -n cp "$backup" "$conf" </dev/null
    echo "nginx 설정 검사 실패: 이전 설정으로 되돌렸습니다." >&2
    exit 1
  fi
  docker exec trakit-nginx nginx -s reload </dev/null
fi

# curl --retry는 -o /dev/null과 함께 쓰면 오류 23으로 끝날 수 있어 직접 반복한다.
code=000
for _ in $(seq 1 30); do
  code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 5 \
    --resolve snote.stock-snow.com:443:127.0.0.1 https://snote.stock-snow.com/ || true)"
  [ "$code" = 200 ] && break
  sleep 2
done
[ "$code" = 200 ] || { echo "상태 확인 실패: HTTP $code" >&2; exit 1; }
docker ps --format '{{.Names}} {{.Image}} {{.Status}}' | grep '^snote-'
REMOTE
echo "배포 완료: $TAG"
