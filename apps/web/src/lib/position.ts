// Thứ tự ưu tiên chức vụ: GĐ > PGĐ > TP > PP > NV
export function positionRank(pos?: string | null): number {
  if (!pos) return 9
  const p = pos.toLowerCase()
  if (p.includes('giám đốc') && !p.includes('phó')) return 1
  if (p.includes('phó giám đốc') || p.includes('pgđ')) return 2
  if (p.includes('trưởng')) return 3
  if (p.includes('phó')) return 4
  if (p.includes('nhân viên')) return 5
  return 6
}

// Từ Phó phòng trở lên (rank <= 4) — dùng để quyết định có hiển thị kèm
// chức danh/phòng ban ở những nơi chỉ nên nêu bật cán bộ quản lý (ví dụ lời
// chào ở trang "Bài kiểm tra của tôi").
export function isManagerPosition(pos?: string | null): boolean {
  return positionRank(pos) <= 4
}
