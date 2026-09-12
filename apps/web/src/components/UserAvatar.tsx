import { Avatar } from 'antd'
import { UserOutlined } from '@ant-design/icons'

interface UserAvatarProps {
  avatarEmoji?: string | null
  avatarUrl?: string | null
  size?: number
}

/** Hiện ảnh đại diện: ưu tiên ảnh tự tải lên, rồi tới emoji đã chọn, cuối cùng
 * mới về icon người dùng mặc định (tài khoản chưa từng đổi ảnh đại diện). */
export default function UserAvatar({ avatarEmoji, avatarUrl, size = 32 }: UserAvatarProps) {
  if (avatarUrl) return <Avatar src={avatarUrl} size={size} />
  if (avatarEmoji) {
    // Nền vàng kim nhạt cố định (không đổi theo theme) — luôn đủ tương phản với
    // emoji ở cả 2 giao diện sáng/tối, không cần thêm biến CSS riêng.
    return (
      <Avatar size={size} style={{ background: 'rgba(255, 179, 0, 0.18)', fontSize: Math.round(size * 0.58) }}>
        {avatarEmoji}
      </Avatar>
    )
  }
  return <Avatar icon={<UserOutlined />} size={size} />
}
