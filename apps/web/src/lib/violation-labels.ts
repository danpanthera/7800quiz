// Nhãn hiển thị cho từng loại vi phạm khi thi — dùng chung giữa trang admin
// "Giám sát vi phạm" (AttemptViolationsPage) và popup giải thích lý do tự nộp
// bài ở màn hình làm bài (QuizPlayerPage), tránh lệch nhãu nếu chỉ sửa 1 chỗ.
export const NHAN_LOAI_VI_PHAM: Record<string, { label: string; color: string }> = {
  TAB_HIDDEN: { label: 'Rời tab / thu nhỏ cửa sổ', color: 'warning' },
  FULLSCREEN_EXIT: { label: 'Thoát toàn màn hình', color: 'orange' },
  COPY_ATTEMPT: { label: 'Cố sao chép đề bài', color: 'error' },
  WINDOW_BLUR: { label: 'Chuyển sang cửa sổ khác', color: 'orange' },
  IDLE_TIMEOUT: { label: 'Vắng mặt bất thường', color: 'error' },
  MULTI_SESSION_LOGIN: { label: 'Đăng nhập thêm nơi khác', color: 'error' },
  DEVTOOLS_OPEN: { label: 'Nghi vấn mở DevTools (độ tin cậy thấp)', color: 'default' },
  SCREENSHOT_ATTEMPT: { label: 'Nghi vấn chụp màn hình (độ tin cậy thấp)', color: 'default' },
}
