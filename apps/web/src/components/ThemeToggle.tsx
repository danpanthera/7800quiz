import type { ReactNode } from 'react'
import { DesktopOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { useThemeMode, type ThemeChoice } from '../lib/useThemeMode'

const OPTIONS: { key: ThemeChoice; icon: ReactNode; label: string }[] = [
  { key: 'light', icon: <SunOutlined />, label: 'Sáng' },
  { key: 'system', icon: <DesktopOutlined />, label: 'Theo hệ thống' },
  { key: 'dark', icon: <MoonOutlined />, label: 'Tối' },
]

/** Công tắc 3 trạng thái sáng/tối/theo hệ thống — viên trượt trôi theo lựa chọn đang chọn. */
export default function ThemeToggle() {
  const { choice, setChoice } = useThemeMode()
  const activeIndex = OPTIONS.findIndex((opt) => opt.key === choice)

  return (
    <Tooltip title="Giao diện sáng / tối">
      <div className="theme-toggle" role="radiogroup" aria-label="Chọn giao diện sáng/tối">
        <span className="theme-toggle-thumb" style={{ transform: `translateX(${activeIndex * 100}%)` }} aria-hidden />
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={choice === opt.key}
            aria-label={opt.label}
            className={`theme-toggle-btn${choice === opt.key ? ' is-active' : ''}`}
            onClick={() => setChoice(opt.key)}
          >
            {opt.icon}
          </button>
        ))}
      </div>
    </Tooltip>
  )
}
