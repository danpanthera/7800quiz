#!/bin/bash
# ============================================================
# dev.sh — 7800Quiz dev starter
# AN TOÀN với OrbStack: KHÔNG dùng lsof/kill trên port Docker
# Docker (postgres, api, admin) quản lý bởi OrbStack → chỉ
# dùng docker compose để start/stop, tuyệt đối không kill PID
# đang giữ port đó vì có thể là OrbStack Helper daemon.
# ============================================================
set -e

ROOT="/opt/Projects/7800quiz"
export PATH="$HOME/flutter/bin:$PATH"

API_PORT=13010
ADMIN_PORT=15173
MOBILE_PORT=15851
DB_PORT=15433
API_BASE_URL="http://localhost:${API_PORT}/api"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${CYAN}"
echo "  ╔═══════════════════════════════╗"
echo "  ║     7800Quiz Dev Server       ║"
echo "  ╚═══════════════════════════════╝"
echo -e "${NC}"

# ── 1. Mở OrbStack nếu chưa chạy ──────────────────────────
if ! docker info >/dev/null 2>&1; then
  echo -e "${YELLOW}[ORBSTACK]${NC} Đang khởi động OrbStack..."
  open -a OrbStack 2>/dev/null || true
fi

# ── 2. Chờ Docker daemon sẵn sàng ─────────────────────────
DOCKER_WAIT=0
until docker info >/dev/null 2>&1; do
  DOCKER_WAIT=$((DOCKER_WAIT+1))
  if [ $DOCKER_WAIT -gt 90 ]; then
    echo -e "${RED}[ERROR]${NC} Docker daemon chưa ready sau 90s."
    echo -e "  Thử: open -a OrbStack  rồi chờ 30s và chạy lại ./dev.sh"
    exit 1
  fi
  printf "${YELLOW}.${NC}"; sleep 1
done
[ $DOCKER_WAIT -gt 0 ] && echo ""
echo -e "${CYAN}[DOCKER]${NC} Daemon ready ✓"

# ── 3. Khởi động DB + API + Admin qua Docker Compose ──────
# KHÔNG dùng lsof/kill -9 trên các port Docker (13010, 15173, 15433)
# OrbStack dùng scon daemon để forward port → kill nó = crash VM.
# docker compose up -d xử lý đúng: start nếu chưa có, skip nếu đã chạy.

echo -e "${YELLOW}[DB]${NC} Khởi động PostgreSQL..."
docker compose -f "$ROOT/docker-compose.yml" up -d postgres 2>&1 | grep -v "^$" || true

PG_WAIT=0
until docker exec quiz7800_db pg_isready -U postgres &>/dev/null 2>&1; do
  PG_WAIT=$((PG_WAIT+1))
  if [ $PG_WAIT -gt 30 ]; then
    echo -e "${RED}[DB]${NC} PostgreSQL không ready sau 30s."
    exit 1
  fi
  printf "${YELLOW}.${NC}"; sleep 1
done
[ $PG_WAIT -gt 0 ] && echo ""
echo -e "${YELLOW}[DB]${NC} PostgreSQL ready ✓  →  localhost:${DB_PORT}"

echo -e "${GREEN}[API]${NC} Khởi động API..."
docker compose -f "$ROOT/docker-compose.yml" up -d api 2>&1 | grep -v "^$" || true
echo -e "${GREEN}[API]${NC} API ready ✓  →  http://localhost:${API_PORT}/api"

echo -e "${CYAN}[ADMIN]${NC} Khởi động Admin portal..."
docker compose -f "$ROOT/docker-compose.yml" up -d admin 2>&1 | grep -v "^$" || true
echo -e "${CYAN}[ADMIN]${NC} Admin ready ✓  →  http://localhost:${ADMIN_PORT}"

# ── 4. Mobile Flutter (chạy local, port 15851 không phải Docker) ──
# Chỉ kill process flutter/dart/node trên port mobile, KHÔNG kill OrbStack
SKIP_MOBILE=0
for PID in $(lsof -ti:${MOBILE_PORT} 2>/dev/null); do
  CMD=$(ps -p $PID -o comm= 2>/dev/null || echo "")
  if echo "$CMD" | grep -qiE "flutter|dart|node"; then
    kill -9 $PID 2>/dev/null || true
    echo -e "${YELLOW}[MOBILE]${NC} Dừng process cũ: $CMD (pid $PID)"
  fi
done

if ! command -v flutter &>/dev/null; then
  echo -e "${YELLOW}[MOBILE]${NC} Flutter không tìm thấy tại ~/flutter/bin — bỏ qua mobile."
  SKIP_MOBILE=1
fi

# ── 5. Chạy Mobile qua tmux hoặc nền ──────────────────────
if [ "$SKIP_MOBILE" = "0" ]; then
  if command -v tmux &>/dev/null; then
    SESSION="7800quiz"
    # Chỉ kill tmux session, KHÔNG đụng Docker/OrbStack
    tmux kill-session -t $SESSION 2>/dev/null || true
    tmux new-session -d -s $SESSION -n "mobile"
    tmux send-keys -t $SESSION:mobile \
      "cd $ROOT/apps/mobile && flutter run -d web-server --web-hostname 0.0.0.0 --web-port $MOBILE_PORT --dart-define=API_URL=$API_BASE_URL" Enter
    tmux new-window -t $SESSION -n "api-log"
    tmux send-keys -t $SESSION:api-log "docker compose -f $ROOT/docker-compose.yml logs -f api" Enter
    tmux new-window -t $SESSION -n "admin-log"
    tmux send-keys -t $SESSION:admin-log "docker compose -f $ROOT/docker-compose.yml logs -f admin" Enter
    tmux select-window -t $SESSION:mobile
  else
    (cd "$ROOT/apps/mobile" && flutter run -d web-server \
      --web-hostname 0.0.0.0 --web-port $MOBILE_PORT \
      --dart-define=API_URL=$API_BASE_URL 2>&1 \
      | awk '{print "\033[1;33m[MOB] \033[0m " $0; fflush()}') &
    MOBILE_PID=$!
  fi
fi

# ── 6. Tóm tắt ────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ 7800Quiz đang chạy                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🗄  DB:     ${CYAN}localhost:${DB_PORT}${NC}                    [Docker]"
echo -e "  🚀 API:    ${GREEN}http://localhost:${API_PORT}/api${NC}     [Docker]"
echo -e "  🖥  Admin: ${GREEN}http://localhost:${ADMIN_PORT}${NC}          [Docker]"
if [ "$SKIP_MOBILE" = "0" ]; then
  echo -e "  📱 Mobile: ${GREEN}http://localhost:${MOBILE_PORT}${NC}         [Flutter local]"
fi
echo ""
echo -e "  Logs:     ${CYAN}docker compose logs -f api${NC}"
echo -e "  Stop:     ${CYAN}docker compose stop${NC}   ← giữ nguyên data"
echo -e "  Restart:  ${CYAN}docker compose restart api${NC}"
echo ""

if command -v tmux &>/dev/null && [ "$SKIP_MOBILE" = "0" ]; then
  echo -e "  tmux: Ctrl+B → ${YELLOW}0${NC} Mobile | ${YELLOW}1${NC} API log | ${YELLOW}2${NC} Admin log"
  echo -e "        ${CYAN}tmux attach -t 7800quiz${NC}  ← xem log mobile"
  echo ""
elif [ "$SKIP_MOBILE" = "0" ] && [ -n "${MOBILE_PID:-}" ]; then
  trap "kill $MOBILE_PID 2>/dev/null; echo 'Mobile stopped.'" EXIT INT TERM
  wait $MOBILE_PID
fi
