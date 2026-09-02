import { Form, Input, Button, Typography, message } from 'antd'
import { BankOutlined, UserOutlined, LockOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../lib/auth'

const { Title, Text } = Typography

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: (values: { username: string; password: string }) =>
      api.post('/auth/login', values).then((r) => r.data),
    onSuccess: (data) => {
      login(data.accessToken, data.user)
      navigate('/')
    },
    onError: () => message.error('Sai tài khoản hoặc mật khẩu'),
  })

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0D2045 0%, #1565C0 55%, #1E88E5 100%)',
        padding: '24px',
      }}
    >
      {/* Decorative circles */}
      <div style={{
        position: 'fixed', top: -80, right: -80,
        width: 320, height: 320,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: -120, left: -80,
        width: 400, height: 400,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)',
        pointerEvents: 'none',
      }} />

      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          animation: 'fadeIn 0.5s ease',
        }}
      >
        {/* Top gradient banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0D2045 0%, #1565C0 100%)',
            padding: '32px 32px 28px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              border: '1.5px solid rgba(255,255,255,0.2)',
            }}
          >
            <BankOutlined style={{ fontSize: 30, color: '#FFB300' }} />
          </div>
          <Title level={3} style={{ color: '#fff', margin: 0, fontWeight: 800, letterSpacing: 0.5 }}>
            7800Quiz
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4, display: 'block' }}>
            Hệ thống quản trị nội bộ ngân hàng
          </Text>
        </div>

        {/* Form area */}
        <div style={{ padding: '28px 32px 32px' }}>
          <Title level={5} style={{ marginBottom: 20, color: '#0D2045', fontWeight: 700 }}>
            Đăng nhập
          </Title>

          <Form layout="vertical" onFinish={mutation.mutate} size="large">
            <Form.Item
              label="Tài khoản"
              name="username"
              rules={[{ required: true, message: 'Vui lòng nhập tài khoản' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#9FAECC' }} />}
                placeholder="Nhập tên đăng nhập"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item
              label="Mật khẩu"
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
              style={{ marginBottom: 24 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#9FAECC' }} />}
                placeholder="Nhập mật khẩu"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={mutation.isPending}
                style={{
                  height: 48,
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #1565C0, #1E88E5)',
                  border: 'none',
                  boxShadow: '0 6px 18px rgba(21,101,192,0.35)',
                }}
              >
                Đăng nhập
              </Button>
            </Form.Item>
          </Form>

          <Text
            style={{
              display: 'block',
              textAlign: 'center',
              marginTop: 20,
              color: '#AAB4C8',
              fontSize: 12,
            }}
          >
            © 2026 Ngân hàng 7800 — Hệ thống thi nội bộ
          </Text>
        </div>
      </div>
    </div>
  )
}
