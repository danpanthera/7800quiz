import { useState } from 'react'
import { Modal, Upload, Button, message } from 'antd'
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons'
import api, { getErrorMessage } from '../lib/api'
import { useAuth } from '../lib/useAuth'
import UserAvatar from './UserAvatar'

// Bộ biểu tượng ngộ nghĩnh cho người dùng chọn nhanh — không cần backend biết
// trước danh sách này (chỉ giới hạn độ dài chuỗi), nên thêm/bớt icon ở đây là đủ.
const EMOJI_CHOICES = [
  '🦊', '🐼', '🐨', '🦁', '🐯', '🐸', '🐵', '🐧',
  '🦉', '🦄', '🐝', '🐢', '🦋', '🐳', '🐙', '🦖',
  '🚀', '⭐', '🎯', '🏆', '💡', '🎨', '🎮', '🍀',
  '⚡', '🌈', '🎉', '🥷', '🧠', '🔥', '🌙', '☀️',
]

const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png']

export default function AvatarPickerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateAvatar } = useAuth()
  const [savingEmoji, setSavingEmoji] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  if (!user) return null

  async function pickEmoji(emoji: string) {
    setSavingEmoji(emoji)
    try {
      const { data } = await api.patch('/auth/me/avatar', { emoji })
      updateAvatar(data)
      message.success('Đã đổi ảnh đại diện')
    } catch (e) {
      message.error(getErrorMessage(e, 'Không đổi được ảnh đại diện'))
    } finally {
      setSavingEmoji(null)
    }
  }

  async function handleUpload(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      message.error('Chỉ nhận ảnh định dạng JPG hoặc PNG')
      return false
    }
    if (file.size > MAX_AVATAR_BYTES) {
      message.error('Ảnh vượt quá 5MB, vui lòng chọn ảnh nhỏ hơn')
      return false
    }
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const { data } = await api.post('/auth/me/avatar/upload', formData)
      updateAvatar(data)
      message.success('Đã cập nhật ảnh đại diện')
    } catch (e) {
      message.error(getErrorMessage(e, 'Tải ảnh lên thất bại'))
    } finally {
      setUploading(false)
    }
    return false // chặn Upload tự gửi request riêng — đã tự gọi api ở trên
  }

  async function handleReset() {
    try {
      const { data } = await api.delete('/auth/me/avatar')
      updateAvatar(data)
      message.success('Đã bỏ ảnh đại diện')
    } catch (e) {
      message.error(getErrorMessage(e, 'Không xoá được ảnh đại diện'))
    }
  }

  return (
    <Modal title="Đổi ảnh đại diện" open={open} onCancel={onClose} footer={null} width={480} destroyOnHidden>
      <div className="avatar-picker-preview">
        <UserAvatar avatarEmoji={user.avatarEmoji} avatarUrl={user.avatarUrl} size={72} />
      </div>

      <div className="avatar-picker-grid">
        {EMOJI_CHOICES.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={`avatar-picker-emoji${user.avatarEmoji === emoji ? ' is-selected' : ''}`}
            onClick={() => pickEmoji(emoji)}
            disabled={savingEmoji !== null}
            aria-label={`Chọn biểu tượng ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="avatar-picker-actions">
        <Upload accept="image/png,image/jpeg" showUploadList={false} beforeUpload={handleUpload}>
          <Button icon={<UploadOutlined />} loading={uploading}>Tải ảnh lên (JPG/PNG, tối đa 5MB)</Button>
        </Upload>
        {(user.avatarEmoji || user.avatarUrl) && (
          <Button icon={<DeleteOutlined />} onClick={handleReset} type="text" danger>
            Bỏ ảnh đại diện
          </Button>
        )}
      </div>
    </Modal>
  )
}
