import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from 'antd'
import api from '../lib/api'
import { fireLevelUpConfetti, playLevelUpFanfare } from '../lib/feedback-fx'

interface NewBadge {
  code: string
  name: string
  iconSlug: string
}

interface MyProgress {
  levelName: string
}

/**
 * Hiệu ứng toàn màn hình khi lên cấp — kiểu "level up" trong game RPG: hào
 * quang bung ra sau huy hiệu cấp độ, pháo giấy + fanfare, tên cấp mới hiện ra
 * dần. Dùng chung cho mọi nơi có lên cấp (bài thi chính thức, Đấu trường...).
 * Cố tình LUÔN nền tối bất kể theme Sáng/Tối của app — đây là màn ăn mừng
 * dạng "sân khấu" riêng, giống Arena/InstantQuizPlayer, không theo theme chung.
 */
export default function LevelUpOverlay({
  open,
  newLevel,
  newBadges,
  onClose,
}: {
  open: boolean
  newLevel: number
  newBadges?: NewBadge[]
  onClose: () => void
}) {
  // Chỉ cần lấy tên cấp mới để hiển thị — dữ liệu này đã có sẵn ở /me/progress
  // (MyQuizzesPage cũng gọi), không cần API riêng hay đổi response chỗ trao XP.
  const progressQuery = useQuery<MyProgress>({
    queryKey: ['me-progress-levelup'],
    queryFn: () => api.get('/me/progress').then((r) => r.data),
    enabled: open,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!open) return
    void fireLevelUpConfetti()
    playLevelUpFanfare()
  }, [open])

  // Khoá cuộn trang nền trong lúc hiệu ứng hiển thị — trải nghiệm toàn màn hình
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null

  return (
    <div className="levelup-overlay" role="dialog" aria-modal="true" aria-label={`Đã lên cấp ${newLevel}`}>
      <div className="levelup-backdrop" onClick={onClose} />
      <div className="levelup-content">
        <div className="levelup-burst" aria-hidden />
        <div className="levelup-eyebrow">Chúc mừng</div>
        <div className="levelup-badge-wrap">
          <span className="levelup-ring" aria-hidden />
          <span className="levelup-ring levelup-ring-delay" aria-hidden />
          <span className="levelup-badge">
            <span className="levelup-badge-label">Cấp</span>
            <span className="levelup-badge-number">{newLevel}</span>
          </span>
        </div>
        <div className="levelup-title">LÊN CẤP!</div>
        {progressQuery.data?.levelName && <div className="levelup-name">{progressQuery.data.levelName}</div>}

        {(newBadges?.length ?? 0) > 0 && (
          <div className="levelup-badges">
            {newBadges!.map((b) => (
              <span key={b.code} className="levelup-badge-chip">🏅 {b.name}</span>
            ))}
          </div>
        )}

        <Button type="primary" size="large" className="levelup-continue" onClick={onClose}>
          Tuyệt vời!
        </Button>
      </div>
    </div>
  )
}
