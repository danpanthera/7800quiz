import { randomInt } from 'crypto';

// Bỏ các ký tự dễ nhầm khi cán bộ IT đọc qua điện thoại/loa ngoài: 0/O, 1/l/I.
const BANG_CHU_AN_TOAN =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Sinh mật khẩu tạm NGẪU NHIÊN, riêng cho từng người — thay cho hằng số
 * "Abcd@1234" dùng chung trước đây (ai biết trước userAD của một cán bộ là
 * đăng nhập được ngay, vì userAD không phải bí mật). Dùng khi tạo tài khoản
 * lần đầu và khi cán bộ IT reset mật khẩu — xem auth.service.ts,
 * admin.service.ts.
 */
export function sinhMatKhauTam(doDai = 10): string {
  let matKhau = '';
  for (let i = 0; i < doDai; i++) {
    matKhau += BANG_CHU_AN_TOAN[randomInt(BANG_CHU_AN_TOAN.length)];
  }
  return matKhau;
}
