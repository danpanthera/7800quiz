#!/usr/bin/env bash
# ============================================================================
# 7800Quiz — Đặt IP tĩnh cho máy ảo Ubuntu (DEPLOYMENT.md Giai đoạn 3.2)
#
# Tạo sẵn để gõ 1 lệnh ngắn qua console Hyper-V Connect, thay vì soạn tay file
# YAML nhiều dòng nhiều ký tự đặc biệt (#, :, [, ], thụt lề) — rất dễ gõ sai
# qua console đó (không dán clipboard được).
#
# Dùng (chạy bằng sudo):
#   sudo bash prod-set-static-ip.sh <IP/CIDR> <gateway> <dns[,dns-phụ]> [card-mạng]
# Ví dụ (1 DNS):
#   sudo bash prod-set-static-ip.sh 10.58.0.20/24 10.58.0.1 10.58.0.1
# Ví dụ (DNS chính + phụ — cách nhau bằng dấu phẩy, KHÔNG dấu cách):
#   sudo bash prod-set-static-ip.sh 10.58.0.20/24 10.58.0.1 10.58.0.11,10.0.58.11
#
# Lấy đúng gateway/DNS THẬT (đừng đoán): trên Windows chạy `ipconfig /all`,
# tìm đúng card đang có IP thật của máy chủ, đọc "Default Gateway"/"DNS Servers".
# card-mạng mặc định "eth0" — đổi nếu `ip addr` cho thấy tên khác.
#
# Script ghi đúng 1 file cố định /etc/netplan/99-prod-static.yaml, tắt mọi file
# netplan khác (đổi tên thành .bak-<giờ>, không xoá — khôi phục được), tắt
# cloud-init tự sinh lại cấu hình mạng, áp dụng, rồi TỰ KIỂM TRA: card đã nhận
# đúng IP chưa, còn sót IP cũ không, ping được gateway không. Chạy lại vẫn an toàn.
# ============================================================================
set -euo pipefail

if [ "$(id -u)" != 0 ]; then
  echo 'Cần chạy bằng sudo: sudo bash prod-set-static-ip.sh <IP/CIDR> <gateway> <dns>' >&2
  exit 1
fi

ADDR="${1:?Thiếu địa chỉ IP/CIDR, VD 10.58.0.20/24}"
GATEWAY="${2:?Thiếu gateway, VD 10.58.0.1 — lấy từ ipconfig /all trên Windows}"
DNS="${3:?Thiếu DNS, VD 10.58.0.1 (nhiều DNS thì cách nhau bằng dấu phẩy: 10.58.0.11,10.0.58.11) — lấy từ ipconfig /all trên Windows}"
IFACE="${4:-eth0}"

case "$ADDR" in
  */*) ;;
  *) echo "Thiếu tiền tố mạng (VD /24) trong '$ADDR' — sửa lại thành dạng 10.58.0.20/24" >&2; exit 1 ;;
esac

# Kiểm tra trước khi đụng vào gì: script tắt mọi file netplan khác, nên ghi cấu
# hình cho một card không tồn tại sẽ làm máy ảo mất mạng hoàn toàn.
if ! ip link show "$IFACE" >/dev/null 2>&1; then
  echo "Không thấy card mạng '$IFACE'. Card hiện có: $(ls /sys/class/net | tr '\n' ' ')" >&2
  echo 'Thêm đúng tên card làm tham số thứ 4.' >&2
  exit 1
fi

log() { echo -e "\033[36m[prod-set-static-ip]\033[0m $1"; }
# Không dùng grep -q sau dấu | : dưới pipefail, grep -q thoát sớm có thể làm
# lệnh phía trước dính SIGPIPE, cả script thoát oan (lỗi đã gặp ở prod-setup-app.sh).
has_addr() { ip -4 -o addr show dev "$IFACE" | grep -F " $1 " >/dev/null; }

# Netplan GỘP cấu hình từ mọi file *.yaml trong thư mục, file sau (theo tên)
# thắng file trước. Nên dùng đúng 1 file cố định, tên "99-" để luôn có tiếng
# nói cuối cùng, và tắt mọi file khác — tránh "dhcp4: true" còn sót từ lúc cài
# Ubuntu (dùng Internet tạm Giai đoạn 2) sống song song với IP tĩnh mới.
FILE="/etc/netplan/99-prod-static.yaml"
TS="$(date +%Y%m%d%H%M%S)"

shopt -s nullglob
for f in /etc/netplan/*.yaml; do
  [ "$f" = "$FILE" ] && continue
  mv "$f" "${f}.bak-${TS}"
  log "Đã tắt file netplan khác (đổi tên, không xoá): $f → ${f}.bak-${TS}"
done
shopt -u nullglob

if [ -f "$FILE" ]; then
  cp "$FILE" "${FILE}.bak-${TS}"
  log "Đã sao lưu file cũ: ${FILE}.bak-${TS}"
fi

cat > "$FILE" <<YAML
network:
  version: 2
  ethernets:
    ${IFACE}:
      dhcp4: false
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

# cloud-init (có sẵn trên Ubuntu Server) có thể sinh lại 50-cloud-init.yaml với
# dhcp4: true ở lần khởi động sau — tắt đúng theo cách chính file đó hướng dẫn.
if [ -d /etc/cloud/cloud.cfg.d ]; then
  echo 'network: {config: disabled}' > /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg
  log 'Đã tắt cloud-init tự sinh lại cấu hình mạng (giữ IP tĩnh qua các lần khởi động lại).'
fi

log 'Đang áp dụng (netplan apply)...'
netplan apply

for _ in $(seq 10); do
  has_addr "$ADDR" && break
  sleep 1
done
if ! has_addr "$ADDR"; then
  ip addr show "$IFACE"
  echo "LỖI: card $IFACE chưa nhận $ADDR sau khi áp dụng — chụp phần in ở trên để chẩn đoán." >&2
  exit 1
fi

# Máy ảo Hyper-V không hề thấy "rút dây" khi đổi dây mạng ở máy chủ thật (switch
# ảo vẫn lên), nên IP DHCP cũ (VD 192.168.1.x của Internet tạm) có thể còn bám
# trên card — xoá hẳn, tránh máy ảo tiếp tục đi qua gateway cũ không còn tồn tại.
for old in $(ip -4 -o addr show dev "$IFACE" | awk '{print $4}' | grep -vxF "$ADDR" || true); do
  ip addr del "$old" dev "$IFACE"
  log "Đã xoá IP cũ còn sót trên $IFACE: $old"
done

echo ''
log "Card $IFACE hiện tại:"
ip -4 addr show "$IFACE"
log 'Bảng định tuyến:'
ip route
echo ''
if ping -c 2 -W 2 "$GATEWAY" >/dev/null 2>&1; then
  log "OK — ping được gateway $GATEWAY."
else
  echo "CẢNH BÁO: chưa ping được gateway $GATEWAY. Kiểm tra lại đúng gateway (ipconfig /all trên"
  echo "Windows) và dây mạng. Một số router cố ý chặn ping — nếu máy khác trong LAN ping được"
  echo "${ADDR%/*} thì bỏ qua cảnh báo này."
fi
echo ''
echo "Ghi lại IP tĩnh này (${ADDR%/*}) — dùng để đăng ký DNS ở Giai đoạn 3.6."
