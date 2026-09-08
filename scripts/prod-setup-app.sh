#!/usr/bin/env bash
# ============================================================================
# 7800Quiz — Cài Docker + build + khởi tạo toàn bộ ứng dụng NGAY TRONG máy ảo
# Ubuntu, lúc máy chủ PROD đang được cắm Internet tạm thời (DEPLOYMENT.md
# Giai đoạn 2.3). Chạy MỘT LẦN, ngay sau khi cài xong Ubuntu.
#
# Dùng:
#   bash prod-setup-app.sh https://github.com/<đường-dẫn-repo-thật>/7800quiz.git
#
# Sau khi chạy xong: lưu lại JWT_SECRET/POSTGRES_PASSWORD được in ra cuối
# script vào kho mật khẩu ngân hàng, rồi làm theo Giai đoạn 3 (ngắt Internet,
# chuyển sang IP tĩnh nội bộ).
# ============================================================================
set -euo pipefail

REPO_URL="${1:?Cách dùng: prod-setup-app.sh <git-url-repo-7800quiz>}"
APP_DIR="${APP_DIR:-/opt/7800quiz}"
SITE_ADDRESS="${SITE_ADDRESS:-quiz.vbalaichau.com}"

log() { echo -e "\033[36m[prod-setup-app]\033[0m $1"; }

# ── 1. Cài Docker ────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log 'Đang cài Docker Engine...'
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  sudo systemctl enable docker
  log 'Đã cài Docker. Dùng sudo cho các lệnh docker trong chính script này (nhóm quyền mới cần đăng nhập lại mới có hiệu lực).'
else
  log 'Docker đã có sẵn — bỏ qua bước cài.'
fi

# ── 2. Lấy mã nguồn ──────────────────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  log "Mã nguồn đã có ở $APP_DIR — chạy git pull..."
  sudo git -C "$APP_DIR" pull --ff-only
else
  log "Đang clone mã nguồn vào $APP_DIR..."
  sudo git clone "$REPO_URL" "$APP_DIR"
fi
sudo chown -R "$USER":"$USER" "$APP_DIR"
cd "$APP_DIR"

# ── 3. Tạo .env.prod với bí mật sinh tự động ────────────────────────────────
if [ ! -f .env.prod ]; then
  log 'Đang tạo .env.prod với JWT_SECRET/POSTGRES_PASSWORD sinh ngẫu nhiên...'
  cp .env.prod.example .env.prod

  JWT_SECRET_VAL=$(openssl rand -hex 32)
  PG_PASSWORD_VAL=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)

  sed -i "s#^SITE_ADDRESS=.*#SITE_ADDRESS=${SITE_ADDRESS}#" .env.prod
  sed -i "s#^CORS_ORIGIN=.*#CORS_ORIGIN=https://${SITE_ADDRESS}#" .env.prod
  sed -i "s#^POSTGRES_PASSWORD=.*#POSTGRES_PASSWORD=${PG_PASSWORD_VAL}#" .env.prod
  sed -i "s#^JWT_SECRET=.*#JWT_SECRET=${JWT_SECRET_VAL}#" .env.prod
else
  log '.env.prod đã tồn tại — giữ nguyên, không sinh lại bí mật.'
fi

# ── 4. Build + khởi động (đang có Internet nên build được, khác lúc PROD offline) ──
log 'Đang build ảnh Docker (npm ci tải thư viện — cần Internet, đúng lúc này đang có)...'
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod build

log 'Đang khởi động 4 container...'
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

log 'Đang chờ container "healthy" (tối đa 90s)...'
for i in $(seq 1 18); do
  unhealthy=$(sudo docker compose -f docker-compose.prod.yml --env-file .env.prod ps --format '{{.Health}}' 2>/dev/null | grep -vc '^healthy$' || true)
  [ "$unhealthy" = "0" ] && break
  sleep 5
done
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod ps

# ── 5. Khởi tạo cơ sở dữ liệu ────────────────────────────────────────────────
log 'Đang chạy prisma migrate deploy...'
sudo docker exec quiz7800_api npx prisma migrate deploy

log 'Đang seed dữ liệu nền (9 chi nhánh + phòng ban, cấp độ/huy hiệu, tài khoản mẫu)...'
sudo docker exec quiz7800_api npm run seed

# ── 6. Tóm tắt ────────────────────────────────────────────────────────────────
echo ''
echo '=== XONG — LƯU NGAY 2 GIÁ TRỊ SAU VÀO KHO MẬT KHẨU NGÂN HÀNG ==='
grep -E '^(JWT_SECRET|POSTGRES_PASSWORD)=' .env.prod
echo ''
echo 'Kiểm tra nội bộ (cổng 8080, không qua HTTPS):'
echo '  curl -s http://127.0.0.1:8080/api/health'
echo ''
echo 'Bước tiếp theo: NGẮT Internet khỏi máy chủ, làm theo DEPLOYMENT.md Giai đoạn 3'
echo '(chuyển sang IP tĩnh nội bộ, đăng ký DNS quiz.vbalaichau.com qua RODC).'
