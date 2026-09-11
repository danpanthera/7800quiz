#!/usr/bin/env bash
# ============================================================================
# 7800Quiz — Đặt IP tĩnh cho máy ảo Ubuntu (DEPLOYMENT.md Giai đoạn 3.2)
#
# Tạo sẵn để gõ 1 lệnh ngắn qua console Hyper-V Connect, thay vì soạn tay file
# YAML nhiều dòng nhiều ký tự đặc biệt (#, :, [, ], thụt lề) — rất dễ gõ sai
# qua console đó (không dán clipboard được).
#
# Dùng (chạy bằng sudo):
#   sudo bash prod-set-static-ip.sh <IP/CIDR> <gateway> <dns> [card-mạng]
# Ví dụ:
#   sudo bash prod-set-static-ip.sh 10.58.0.20/24 10.58.0.1 10.58.0.1
#
# Lấy đúng gateway/DNS THẬT (đừng đoán): trên Windows chạy `ipconfig /all`,
# tìm đúng card đang có IP thật của máy chủ, đọc "Default Gateway"/"DNS Servers".
# card-mạng mặc định "eth0" — đổi nếu `ip addr` cho thấy tên khác.
#
# Script tự sao lưu file netplan cũ trước khi ghi đè (không mất bản gốc), tự
# áp dụng (netplan apply) và in lại IP để xác nhận ngay — chạy lại vẫn an toàn.
# ============================================================================
set -euo pipefail

if [ "$(id -u)" != 0 ]; then
  echo 'Cần chạy bằng sudo: sudo bash prod-set-static-ip.sh <IP/CIDR> <gateway> <dns>' >&2
  exit 1
fi

ADDR="${1:?Thiếu địa chỉ IP/CIDR, VD 10.58.0.20/24}"
GATEWAY="${2:?Thiếu gateway, VD 10.58.0.1 — lấy từ ipconfig /all trên Windows}"
DNS="${3:?Thiếu DNS, VD 10.58.0.1 — lấy từ ipconfig /all trên Windows}"
IFACE="${4:-eth0}"

case "$ADDR" in
  */*) ;;
  *) echo "Thiếu tiền tố mạng (VD /24) trong '$ADDR' — sửa lại thành dạng 10.58.0.20/24" >&2; exit 1 ;;
esac

log() { echo -e "\033[36m[prod-set-static-ip]\033[0m $1"; }

EXISTING="$(ls /etc/netplan/*.yaml 2>/dev/null | head -1 || true)"
FILE="${EXISTING:-/etc/netplan/01-prod-static.yaml}"

if [ -n "$EXISTING" ]; then
  BACKUP="${EXISTING}.bak-$(date +%Y%m%d%H%M%S)"
  cp "$EXISTING" "$BACKUP"
  log "Đã sao lưu file cũ: $BACKUP"
fi

cat > "$FILE" <<YAML
network:
  version: 2
  ethernets:
    ${IFACE}:
      addresses: [${ADDR}]
      routes:
        - to: default
          via: ${GATEWAY}
      nameservers:
        addresses: [${DNS}]
YAML
chmod 600 "$FILE"
log "Đã ghi $FILE:"
cat "$FILE"

log 'Đang áp dụng (netplan apply)...'
netplan apply

echo ''
log "Xong — kiểm tra lại card $IFACE:"
ip addr show "$IFACE"
echo ''
echo "Ghi lại IP tĩnh này (${ADDR%/*}) — dùng để đăng ký DNS ở Giai đoạn 3.6."
