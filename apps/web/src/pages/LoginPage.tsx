import { Form, Input, Button, Typography, message } from 'antd'
import { BankOutlined, UserOutlined, LockOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../lib/useAuth'

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
    <main className="login-page">
      <section className="login-brand" aria-label="7800Quiz">
        <div className="login-brand-lockup">
          <span className="login-brand-mark"><BankOutlined /></span>
          <Text>Hệ thống thi thử nghiệp vụ</Text>
        </div>
        <div className="login-brand-title">
          <Title level={1}>7800Quiz</Title>
          <p className="login-brand-statement">Thi thử nghiệp vụ<br />Đấu trường kiến thức</p>
        </div>
        <Text className="login-brand-footer">Agribank Chi nhánh Lai Châu</Text>
      </section>

      <section className="login-form-region">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <span className="login-brand-mark"><BankOutlined /></span>
            <strong>7800Quiz</strong>
          </div>

          <header className="login-form-heading">
            <Text>Chào mừng trở lại</Text>
            <Title level={2}>Đăng nhập</Title>
          </header>

          <Form layout="vertical" onFinish={mutation.mutate} size="large" requiredMark={false}>
            <Form.Item
              label="User AD (VD: datnguyentien2)"
              name="username"
              rules={[{ required: true, message: 'Vui lòng nhập User AD' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="datnguyentien2"
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              label="Mật khẩu"
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
              style={{ marginBottom: 24 }}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Mật khẩu này độc lập với mật khẩu vào máy"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item className="login-submit-row">
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={mutation.isPending}
              >
                Đăng nhập
              </Button>
            </Form.Item>
          </Form>

          <Text className="login-support">Liên hệ IT nếu tài khoản bị khóa.</Text>
        </div>
      </section>
    </main>
  )
}
