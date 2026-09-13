import { useState, type ReactNode } from 'react'
import { Button, Drawer, Dropdown, Layout, Menu, Tooltip, Typography, type MenuProps } from 'antd'
import {
  AlertOutlined,
  ApartmentOutlined,
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  ClusterOutlined,
  CodeOutlined,
  CrownOutlined,
  DownOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  IdcardOutlined,
  KeyOutlined,
  LineChartOutlined,
  LogoutOutlined,
  MenuOutlined,
  PieChartOutlined,
  ReadOutlined,
  RedoOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  SettingOutlined,
  SmileOutlined,
  StarOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { useDeviceType } from '../hooks/useDeviceType'
import { useScreenTimeReminder } from '../hooks/useScreenTimeReminder'
import ThemeToggle from '../components/ThemeToggle'
import UserAvatar from '../components/UserAvatar'
import AvatarPickerModal from '../components/AvatarPickerModal'
import type { UserRole } from '../lib/permissions'

const { Sider, Header, Content } = Layout
const { Text } = Typography

interface NavigationItem {
  key: string
  icon: ReactNode
  label: string
  /** Mục có con thì hiện thành menu xổ xuống, bản thân nó không phải 1 trang */
  children?: NavigationItem[]
}

const staffNavigation: NavigationItem[] = [
  { key: '/my/quizzes', icon: <FileTextOutlined />, label: 'Bài kiểm tra của tôi' },
  { key: '/my/arena', icon: <ThunderboltOutlined />, label: 'Đấu trường' },
  { key: '/my/leaderboard', icon: <TrophyOutlined />, label: 'Bảng xếp hạng' },
  { key: '/my/practice', icon: <ExperimentOutlined />, label: 'Luyện tập tự do' },
  { key: '/my/review', icon: <RedoOutlined />, label: 'Ôn tập ngắt quãng' },
  { key: '/my/security', icon: <SafetyCertificateOutlined />, label: 'Bảo mật tài khoản' },
]

const trainingNavigation: NavigationItem[] = [
  { key: '/manage/questions', icon: <BookOutlined />, label: 'Ngân hàng câu hỏi' },
  { key: '/manage/question-analytics', icon: <PieChartOutlined />, label: 'Phân tích câu hỏi' },
  { key: '/manage/quizzes', icon: <FileTextOutlined />, label: 'Bộ đề' },
  { key: '/manage/assignments', icon: <TeamOutlined />, label: 'Phân công' },
  { key: '/manage/assignment-schedules', icon: <ScheduleOutlined />, label: 'Lịch giao bài tự động' },
  { key: '/manage/question-approval', icon: <CheckSquareOutlined />, label: 'Duyệt câu hỏi mới' },
  { key: '/manage/exam-sessions', icon: <CalendarOutlined />, label: 'Kỳ thi' },
  { key: '/manage/arena', icon: <TrophyOutlined />, label: 'Đấu trường' },
  { key: '/manage/tournaments', icon: <CrownOutlined />, label: 'Giải đấu loại trực tiếp' },
  { key: '/manage/achievements', icon: <StarOutlined />, label: 'Thành tích' },
  { key: '/manage/levels', icon: <TrophyOutlined />, label: 'Cấp độ' },
  { key: '/manage/reports', icon: <BarChartOutlined />, label: 'Báo cáo' },
  { key: '/manage/report-trends', icon: <LineChartOutlined />, label: 'Xu hướng điểm' },
  { key: '/manage/department-performance', icon: <ClusterOutlined />, label: 'So sánh chi nhánh' },
  { key: '/manage/at-risk-staff', icon: <AlertOutlined />, label: 'Cảnh báo nguy cơ' },
  { key: '/manage/attempt-violations', icon: <WarningOutlined />, label: 'Giám sát vi phạm' },
]

const adminNavigation: NavigationItem[] = [
  { key: '/manage/staff', icon: <IdcardOutlined />, label: 'Quản lý cán bộ' },
  { key: '/manage/branches', icon: <ApartmentOutlined />, label: 'Chi nhánh/Phòng ban' },
  { key: '/manage/classes', icon: <TeamOutlined />, label: 'Lớp học' },
  { key: '/manage/academic-years', icon: <CalendarOutlined />, label: 'Năm học' },
  { key: '/manage/audit-logs', icon: <AuditOutlined />, label: 'Nhật ký quản trị' },
  { key: '/manage/security', icon: <SafetyCertificateOutlined />, label: 'Giám sát bảo mật' },
]

const roleLabels: Record<UserRole, string> = {
  STAFF: 'Cán bộ',
  TRAINER: 'Cán bộ đào tạo',
  ADMIN: 'Quản trị viên',
}

/**
 * Menu "Hướng dẫn sử dụng" — bản dành cho quản trị hệ thống chỉ hiện với quản
 * trị viên và cán bộ IT (cờ isItStaff ở hồ sơ cán bộ); mọi người đều xem được
 * bản dành cho người dùng.
 */
function huongDanNavigation(xemDuocBanQuanTri: boolean): NavigationItem {
  return {
    key: '/huong-dan',
    icon: <ReadOutlined />,
    label: 'Hướng dẫn sử dụng',
    children: [
      ...(xemDuocBanQuanTri
        ? [{
            key: '/huong-dan/quan-tri',
            icon: <SettingOutlined />,
            label: 'Dành cho Quản trị hệ thống',
          }]
        : []),
      { key: '/huong-dan/nguoi-dung', icon: <UserOutlined />, label: 'Dành cho Người dùng' },
    ],
  }
}

// Chỉ quản trị viên xem được — phân tích thiết kế hệ thống, KHÔNG mở rộng cho
// cán bộ IT như "Hướng dẫn sử dụng" (nội dung nhạy cảm về kiến trúc/hạ tầng).
const taiLieuKyThuat: NavigationItem = {
  key: '/manage/technical-docs',
  icon: <CodeOutlined />,
  label: 'Tài liệu kỹ thuật',
}

function getNavigation(role: UserRole, isItStaff: boolean): NavigationItem[] {
  const huongDan = huongDanNavigation(role === 'ADMIN' || isItStaff)
  if (role === 'STAFF') return [...staffNavigation, huongDan]
  return role === 'ADMIN'
    ? [...trainingNavigation, ...adminNavigation, huongDan, taiLieuKyThuat]
    : [...trainingNavigation, huongDan]
}

function PortalBrand({ role }: { role: UserRole }) {
  return (
    <div className="portal-brand">
      <span className="portal-brand-mark"><BankOutlined /></span>
      <span>
        <strong>7800Quiz</strong>
        <small>{roleLabels[role]}</small>
      </span>
    </div>
  )
}

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { category } = useDeviceType()
  const isDesktop = category === 'desktop'
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  useScreenTimeReminder()

  // Đóng Drawer khi đổi route — cập nhật state ngay trong lúc render (theo khuyến nghị của React
  // cho việc "điều chỉnh state theo thay đổi của prop") thay vì dùng useEffect, tránh 1 nhịp render
  // thừa hiển thị Drawer cũ trước khi effect kịp chạy.
  const [lastPathname, setLastPathname] = useState(location.pathname)
  if (location.pathname !== lastPathname) {
    setLastPathname(location.pathname)
    setNavigationOpen(false)
  }

  if (!user) return null

  const navigation = getNavigation(user.role, !!user.isItStaff)
  // Trải phẳng để tìm trang đang mở — mục cha (vd "Hướng dẫn sử dụng") không phải 1 trang
  const navigationPhang = navigation.flatMap((item) => item.children ?? [item])
  const selectedKey = navigationPhang.find((item) =>
    location.pathname === item.key || location.pathname.startsWith(`${item.key}/`),
  )?.key
  const pageTitle = navigationPhang.find((item) => item.key === selectedKey)?.label ?? '7800Quiz'
  const menuItems: MenuProps['items'] = navigation.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
    children: item.children?.map((con) => ({ key: con.key, icon: con.icon, label: con.label })),
  }))
  // Đang ở trang con nào thì mở sẵn nhánh cha chứa nó
  const openKey = navigation.find((item) => item.children?.some((con) => con.key === selectedKey))?.key

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const userMenuItems = [
    {
      key: 'identity',
      label: (
        <div className="portal-identity">
          <strong>{user.fullName}</strong>
          <span>{user.username}</span>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'role',
      icon: <KeyOutlined />,
      label: roleLabels[user.role],
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'avatar',
      icon: <SmileOutlined />,
      label: 'Đổi ảnh đại diện',
      onClick: () => setAvatarModalOpen(true),
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
      onClick: handleLogout,
    },
  ]

  const navigationMenu = (
    <Menu
      className="portal-navigation"
      theme="dark"
      mode="inline"
      selectedKeys={selectedKey ? [selectedKey] : []}
      defaultOpenKeys={openKey ? [openKey] : []}
      items={menuItems}
      onClick={({ key }) => navigate(key)}
    />
  )

  return (
    <Layout className="portal-shell">
      {isDesktop && (
        <Sider className="portal-sider" width={248}>
          <PortalBrand role={user.role} />
          {navigationMenu}
        </Sider>
      )}

      <Drawer
        className="portal-drawer"
        open={!isDesktop && navigationOpen}
        onClose={() => setNavigationOpen(false)}
        placement="left"
        size={280}
        title={<PortalBrand role={user.role} />}
        styles={{
          wrapper: { width: 'min(280px, 86vw)' },
          body: { padding: '8px 0', background: 'var(--agribank-red-dark)' },
        }}
      >
        {navigationMenu}
      </Drawer>

      <Layout className="portal-main">
        <Header className="portal-header">
          {!isDesktop && (
            <Tooltip title="Mở menu">
              <Button
                className="portal-menu-trigger"
                type="text"
                icon={<MenuOutlined />}
                aria-label="Mở menu điều hướng"
                onClick={() => setNavigationOpen(true)}
              />
            </Tooltip>
          )}

          <Text className="portal-page-context">{pageTitle}</Text>

          <ThemeToggle />

          <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
            <button className="portal-user-menu" type="button">
              <UserAvatar avatarEmoji={user.avatarEmoji} avatarUrl={user.avatarUrl} size={32} />
              <span className="portal-user-name">{user.fullName}</span>
              <DownOutlined aria-hidden />
            </button>
          </Dropdown>
        </Header>

        <Content className="portal-content">
          <Outlet />
        </Content>
      </Layout>

      <AvatarPickerModal open={avatarModalOpen} onClose={() => setAvatarModalOpen(false)} />
    </Layout>
  )
}
