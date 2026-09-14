#!/usr/bin/env bash
# ============================================================================
# 7800Quiz — Kiểm tra cấu hình gửi mail Agribank (SMTP) dùng cho tính năng tự
# động gửi mật khẩu tạm khi bấm "Reset MK" ở trang Quản lý cán bộ.
#
# Chạy TRONG máy ảo Ubuntu của PROD (hoặc bất kỳ máy nào có đường mạng tới
# smtp.agribank.com.vn):
#   bash scripts/kiem-tra-mail-agribank.sh <username> [email-nhan-thu]
#   VD: bash scripts/kiem-tra-mail-agribank.sh datnguyentien2 datpanthera@gmail.com
#
# Script hỏi mật khẩu ngay tại chỗ (không hiện lên màn hình, không lưu lại ở
# đâu cả, không truyền qua tham số dòng lệnh) rồi thử gửi 1 email thử nghiệm.
#
# ⚠ MỌI DÒNG IN RA CỐ Ý CHỈ DÙNG KÝ TỰ ASCII (không dấu tiếng Việt) — lệnh
#   trên PROD thường gõ qua RDP -> cửa sổ Hyper-V Connect, đường này làm rơi
#   dấu tiếng Việt. Comment trong file thì vẫn tiếng Việt bình thường vì file
#   được git pull về, không ai gõ tay.
#
# Đúng cấu hình POP/SMTP Agribank đã xác nhận: máy chủ smtp.agribank.com.vn,
# cổng 587, bắt buộc mã hoá kiểu STARTTLS (không phải TLS ngầm định như cổng
# 465), đăng nhập bằng username THUẦN (không kèm đuôi @agribank.com.vn).
# ============================================================================
set -uo pipefail   # cố ý KHÔNG dùng -e: 1 bước lỗi vẫn cần in được tóm tắt

TEN_DANG_NHAP="${1:-}"
EMAIL_NHAN="${2:-}"
MAIL_HOST="${MAIL_SMTP_HOST:-smtp.agribank.com.vn}"
MAIL_PORT="${MAIL_SMTP_PORT:-587}"

if [ -z "$TEN_DANG_NHAP" ]; then
  echo "Cach dung: bash scripts/kiem-tra-mail-agribank.sh <username> [email-nhan-thu]"
  echo "VD:        bash scripts/kiem-tra-mail-agribank.sh datnguyentien2 datpanthera@gmail.com"
  exit 1
fi

tieu_de() {
  echo
  echo "=================================================================="
  echo "$1"
  echo "=================================================================="
}

# ---------------------------------------------------------------------------
tieu_de "1. DNS: co phan giai duoc ten may chu mail khong"
ip_ra=$(getent hosts "$MAIL_HOST" 2>/dev/null | awk '{print $1}' | paste -sd, -)
if [ -n "$ip_ra" ]; then
  printf "  %-30s -> %s\n" "$MAIL_HOST" "$ip_ra"
else
  echo "  KHONG phan giai duoc ten '$MAIL_HOST'."
  echo "  Neu chay tu may KHONG nam trong mang ngan hang (vi du may dev ngoai"
  echo "  Internet) thi day la ket qua BINH THUONG, khong phai loi cau hinh —"
  echo "  phai chay lai dung tren may ao PROD hoac may trong mang noi bo."
  exit 1
fi

# ---------------------------------------------------------------------------
tieu_de "2. CONG TCP $MAIL_PORT: duong mang co thong khong"
if timeout 5 bash -c "exec 3<>/dev/tcp/${MAIL_HOST}/${MAIL_PORT}" 2>/dev/null; then
  echo "  OPEN - duong mang toi $MAIL_HOST:$MAIL_PORT thong."
else
  echo "  KHONG mo duoc cong $MAIL_PORT toi $MAIL_HOST."
  echo "  Kiem tra tuong lua/duong mang truoc khi thu buoc dang nhap."
  exit 1
fi

# ---------------------------------------------------------------------------
tieu_de "3. DANG NHAP + GUI THU THU NGHIEM (STARTTLS, cong $MAIL_PORT)"
if ! command -v python3 >/dev/null 2>&1; then
  echo "  BO QUA: may nay chua cai python3 (sudo apt-get install -y python3)."
  exit 1
fi

python3 - "$MAIL_HOST" "$MAIL_PORT" "$TEN_DANG_NHAP" "$EMAIL_NHAN" <<'PYEOF'
import smtplib, ssl, sys, getpass

host, port, user, email_nhan = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
mat_khau = getpass.getpass(f"  Mat khau hop mail cua '{user}' (khong hien len man hinh): ")

try:
    with smtplib.SMTP(host, port, timeout=10) as s:
        s.ehlo()
        s.starttls(context=ssl.create_default_context())
        s.ehlo()
        s.login(user, mat_khau)
        print("  DANG NHAP OK - tai khoan/mat khau dung, may chu chap nhan.")

        if email_nhan:
            noi_dung = (
                f"Subject: [7800Quiz] Email thu nghiem cau hinh SMTP\r\n"
                f"From: {user}@agribank.com.vn\r\n"
                f"To: {email_nhan}\r\n\r\n"
                "Day la email thu nghiem cau hinh gui mail tu dong cho tinh nang "
                "Reset MK o trang Quan ly can bo cua 7800Quiz. Neu nhan duoc email "
                "nay nghia la cau hinh SMTP da hoat dong dung.\r\n"
            )
            s.sendmail(f"{user}@agribank.com.vn", [email_nhan], noi_dung)
            print(f"  DA GUI thu thu nghiem toi {email_nhan} - kiem tra hop thu (ke ca thu muc Spam).")
        else:
            print("  Khong truyen email nhan nen bo qua buoc gui thu - chi kiem tra dang nhap.")
except smtplib.SMTPAuthenticationError as e:
    print(f"  LOI DANG NHAP: sai username/mat khau, hoac tai khoan bi khoa. Chi tiet: {e}")
except Exception as e:
    print(f"  LOI: {type(e).__name__}: {e}")
PYEOF

echo
echo "=================================================================="
echo "XONG. Khong luu mat khau o dau ca."
echo "=================================================================="
