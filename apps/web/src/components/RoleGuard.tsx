import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { canAccess, getDefaultRoute, type UserRole } from '../lib/permissions'

interface RoleGuardProps {
  allowedRoles: readonly UserRole[]
  /**
   * Cho phép thêm cán bộ IT (cờ isItStaff ở hồ sơ cán bộ) vào, dù vai trò tài
   * khoản không nằm trong allowedRoles. Chỉ dùng cho nội dung mang tính tra
   * cứu/kỹ thuật — KHÔNG dùng cho các trang quản trị có sửa đổi dữ liệu.
   */
  allowItStaff?: boolean
}

export default function RoleGuard({ allowedRoles, allowItStaff = false }: RoleGuardProps) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (!canAccess(user.role, allowedRoles) && !(allowItStaff && user.isItStaff)) {
    return <Navigate to={getDefaultRoute(user.role)} replace />
  }

  return <Outlet />
}