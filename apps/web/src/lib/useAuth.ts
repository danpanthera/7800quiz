import { createContext, useContext } from 'react'
import type { UserRole } from './permissions'

export interface AuthUserDepartment {
  id: string
  name: string
  parentName: string | null
}

export interface AuthUser {
  id: string
  username: string
  fullName: string
  role: UserRole
  mustChangePassword: boolean
  // Chức vụ (Giám đốc/Phó giám đốc/Trưởng phòng/Phó phòng...) và phòng ban —
  // null nếu tài khoản không gắn hồ sơ CanBo hoặc chưa gán phòng ban.
  position?: string | null
  department?: AuthUserDepartment | null
  // Cán bộ IT (đánh dấu ở trang Quản lý cán bộ) — được xem hướng dẫn dành cho
  // quản trị hệ thống, nhưng KHÔNG có quyền quản trị. Tài khoản đăng nhập từ
  // trước khi có tính năng này sẽ nhận cờ sau lần đăng nhập kế tiếp.
  isItStaff?: boolean
  // Ảnh đại diện — loại trừ nhau, xem apps/api/src/auth/auth.service.ts.
  // Cả 2 null/undefined thì hiện icon người dùng mặc định.
  avatarEmoji?: string | null
  avatarUrl?: string | null
  // Biệt danh tự đặt — CHỈ thay tên thật ở Bảng xếp hạng và Đấu trường (xem
  // ten-hien-thi.util.ts phía API). Null/rỗng = chưa đặt, hiện fullName như cũ.
  nickname?: string | null
}

export interface AvatarUpdate {
  avatarEmoji: string | null
  avatarUrl: string | null
}

export interface AuthContextType {
  user: AuthUser | null
  token: string | null
  login: (token: string, user: AuthUser) => void
  markPasswordChanged: () => void
  updateAvatar: (avatar: AvatarUpdate) => void
  updateNickname: (nickname: string | null) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
