import { Layout, Menu, Button, Typography, Avatar, Dropdown } from 'antd'
import {
  BookOutlined,
  FileTextOutlined,
  TeamOutlined,
  BarChartOutlined,
  LogoutOutlined,
  UserOutlined,
  IdcardOutlined,
  TrophyOutlined,
  StarOutlined,
  BankOutlined,
  DownOutlined,
  KeyOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const { Sider, Header, Content } = Layout
const { Text } = Typography

const menuItems = [
  { key: '/questions', icon: <BookOutlined />, label: <Link to="/questions">Ngân hàng câu hỏi</Link> },
  { key: '/quizzes', icon: <FileTextOutlined />, label: <Link to="/quizzes">Bộ đề</Link> },
  { key: '/assignments', icon: <TeamOutlined />, label: <Link to="/assignments">Phân công</Link> },
  { key: '/can-bo', icon: <IdcardOutlined />, label: <Link to="/can-bo">Quản lý cán bộ</Link> },
  { key: '/arena', icon: <TrophyOutlined />, label: <Link to="/arena">Đấu trường</Link> },
  { key: '/achievements', icon: <StarOutlined />, label: <Link to="/achievements">Thành tích</Link> },
  { key: '/levels', icon: <TrophyOutlined />, label: <Link to="/levels">Cấp độ</Link> },
  { key: '/reports', icon: <BarChartOutlined />, label: <Link to="/reports">Báo cáo</Link> },
]

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const userMenuItems = [
    {
      key: 'name',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 700, color: '#0D2045' }}>{user?.fullName || 'Admin'}</div>
          <div style={{ fontSize: 12, color: '#7A8EAA', marginTop: 2 }}>{user?.username}</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'role',
      icon: <KeyOutlined />,
      label: <span style={{ color: '#7A8EAA', fontSize: 13 }}>Quản trị viên</span>,
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined style={{ color: '#E53935' }} />,
      label: <span style={{ color: '#E53935', fontWeight: 600 }}>Đăng xuất</span>,
      onClick: handleLogout,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ── Sidebar ────────────────────────────────────────────── */}
      <Sider
        className="admin-sider"
        width={220}
        style={{
          background: 'linear-gradient(180deg, #0D2045 0%, #1A3A6E 100%)',
          boxShadow: '4px 0 20px rgba(0,0,0,0.18)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <div className="admin-sider-logo">
          <div className="logo-icon">
            <BankOutlined style={{ color: '#FFB300', fontSize: 18 }} />
          </div>
          <div>
            <div className="logo-text">7800Quiz</div>
            <div className="logo-sub">Admin Portal</div>
          </div>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ background: 'transparent', border: 'none' }}
        />
      </Sider>

      <Layout>
        {/* ── Header ───────────────────────────────────────────── */}
        <Header
          className="admin-header"
          style={{
            background: '#fff',
            boxShadow: '0 1px 0 #E8EDF5, 0 2px 8px rgba(0,0,0,0.06)',
            height: 60,
            lineHeight: '60px',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            position: 'sticky',
            top: 0,
            zIndex: 9,
          }}
        >
          {/* Breadcrumb hint */}
          <div style={{ flex: 1 }}>
            <Text style={{ color: '#7A8EAA', fontSize: 13 }}>
              Hệ thống thi nội bộ ngân hàng
            </Text>
          </div>

          {/* User dropdown */}
          <Dropdown
            menu={{ items: userMenuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <div className="admin-user-info" style={{ cursor: 'pointer' }}>
              <Avatar
                icon={<UserOutlined />}
                size={30}
                style={{ background: 'linear-gradient(135deg, #1565C0, #42A5F5)', flexShrink: 0 }}
              />
              <Text style={{ fontWeight: 600, fontSize: 14, color: '#1A1A2E' }}>
                {user?.fullName || 'Quản trị viên'}
              </Text>
              <DownOutlined style={{ fontSize: 11, color: '#7A8EAA' }} />
            </div>
          </Dropdown>

          <Button
            type="primary"
            danger
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            style={{ borderRadius: 8 }}
          >
            Đăng xuất
          </Button>
        </Header>

        {/* ── Content ──────────────────────────────────────────── */}
        <Content
          className="admin-content"
          style={{ margin: 20 }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
