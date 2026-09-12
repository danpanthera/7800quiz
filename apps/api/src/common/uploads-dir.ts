import { join } from 'path';

// Thư mục lưu file người dùng tự tải lên (hiện chỉ có ảnh đại diện). Dùng
// process.cwd() thay vì __dirname vì __dirname sau khi build nằm trong
// dist/src/common, còn thư mục "uploads" phải nằm ngoài dist để không bị xoá
// mỗi lần build lại (`tsc` không dọn thư mục output nhưng CI/deploy có thể).
// cwd luôn là gốc app (apps/api lúc dev, /app trong Docker — xem Dockerfile).
export const UPLOADS_DIR = join(process.cwd(), 'uploads');
export const AVATARS_DIR = join(UPLOADS_DIR, 'avatars');

// Tiền tố URL public tương ứng — PHẢI khớp app.useStaticAssets() trong main.ts
// và cách auth.service.ts ghép avatarUrl khi lưu vào DB.
export const AVATARS_URL_PREFIX = '/api/uploads/avatars';
