// Suy ra địa chỉ email khi hồ sơ (User/CanBo) chưa khai báo email — dùng đúng
// quy ước của ngân hàng: hộp mail cán bộ = <userAD hoặc mã CB>@<tên miền mail>.
// Tên miền lấy từ MAIL_DOMAIN (mặc định 'agribank.com.vn') để không hard-code
// cho một chi nhánh cụ thể — xem admin.service.ts:resetCanBoPasswords.
export function giaiQuyetEmail(
  email: string | null | undefined,
  tenDangNhap: string,
): string {
  const daCo = email?.trim();
  if (daCo) return daCo;
  const domain = process.env.MAIL_DOMAIN?.trim() || 'agribank.com.vn';
  return `${tenDangNhap}@${domain}`;
}
