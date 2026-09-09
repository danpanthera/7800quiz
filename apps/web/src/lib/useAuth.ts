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
}

export interface AuthContextType {
  user: AuthUser | null
  token: string | null
  login: (token: string, user: AuthUser) => void
  markPasswordChanged: () => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
