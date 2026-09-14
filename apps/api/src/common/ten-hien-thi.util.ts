// Tên hiện ra CHO NGƯỜI KHÁC xem ở Bảng xếp hạng và sảnh chờ Đấu trường — ưu
// tiên biệt danh nếu người dùng đã tự đặt, không thì hiện tên thật như cũ.
// Không dùng ở đâu cần truy vết đúng người thật (báo cáo, nhật ký quản trị,
// trang quản lý Đấu trường của TRAINER/ADMIN) — những chỗ đó luôn giữ fullName.
export function tenHienThi(
  nickname: string | null | undefined,
  fullName: string,
): string {
  const trimmed = nickname?.trim();
  return trimmed ? trimmed : fullName;
}
