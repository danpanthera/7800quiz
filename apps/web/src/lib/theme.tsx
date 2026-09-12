import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext, type ThemeChoice, type ResolvedTheme } from './useThemeMode'

/**
 * Quản lý giao diện sáng/tối cho toàn bộ portal (không áp dụng cho các màn hình
 * "sân khấu" đã có tông màu Agribank cố định — LoginPage, ArenaPlayerPage/
 * ArenaPage/ArenaSpectatorPage, InstantQuizPlayer — những màn đó luôn hiển thị
 * đúng 1 giao diện thương hiệu bất kể lựa chọn ở đây).
 *
 * `choice` là lựa chọn người dùng lưu lại (localStorage), `resolved` là giá trị
 * thực tế áp lên DOM: khi choice = 'system' thì bám theo prefers-color-scheme
 * của hệ điều hành và tự cập nhật khi hệ điều hành đổi theme lúc đang mở app.
 */

const STORAGE_KEY = 'theme-choice'

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice === 'system' ? getSystemTheme() : choice
}

function readStoredChoice(): ThemeChoice {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
}

// Màu thanh địa chỉ trình duyệt trên điện thoại — khớp nền trang ở mỗi theme.
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#F8F4EC',
  dark: '#170D10',
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readStoredChoice)
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(choice))

  // Đổi choice thì cập nhật resolved ngay trong lúc render (mẫu "điều chỉnh state theo
  // props/state khác" mà React khuyến nghị — xem AppLayout.tsx/lastPathname) thay vì
  // setState đồng bộ trong effect (gây render lồng không cần thiết).
  const [lastChoice, setLastChoice] = useState(choice)
  if (choice !== lastChoice) {
    setLastChoice(choice)
    setResolved(resolveTheme(choice))
  }

  // Effect chỉ đảm nhận đúng vai trò của nó: LẮNG NGHE hệ điều hành đổi theme khi
  // đang ở chế độ "Theo hệ thống" (nguồn thay đổi tới từ bên ngoài React).
  useEffect(() => {
    if (choice !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setResolved(getSystemTheme())
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [choice])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved])
  }, [resolved])

  function setChoice(next: ThemeChoice) {
    setChoiceState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
