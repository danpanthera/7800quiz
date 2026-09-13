import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Sai mật khẩu / sai mã xác thực 2 lớp lúc đăng nhập cũng trả về 401 nhưng KHÔNG
// phải hết phiên — để nguyên cho onError của trang đăng nhập tự hiển thị thông
// báo, tránh bị điều hướng lại /login (tải lại trang) xoá mất thông báo lỗi
// trước khi người dùng kịp đọc.
const LOGIN_URLS = ['/auth/login', '/auth/login/verify-totp']

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginRequest = LOGIN_URLS.includes(err.config?.url)
    if (err.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

/** Lấy message lỗi từ response API (nếu có) — dùng trong catch/onError thay cho ép kiểu `any`. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined
    return data?.message ?? fallback
  }
  return fallback
}

export default api
