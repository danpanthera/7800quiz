import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, App as AntApp, theme as antTheme } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { AuthProvider } from './lib/auth'
import { ThemeProvider } from './lib/theme'
import { useThemeMode } from './lib/useThemeMode'
import RequireAuth from './components/RequireAuth'
import RoleGuard from './components/RoleGuard'
import HomeRedirect from './components/HomeRedirect'
import ReloadPrompt from './components/ReloadPrompt'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import MyQuizzesPage from './pages/MyQuizzesPage'
import ArenaLobbyPage from './pages/ArenaLobbyPage'
import LeaderboardPage from './pages/LeaderboardPage'
import PracticePage from './pages/PracticePage'
import ReviewPage from './pages/ReviewPage'
import QuizPlayerPage from './pages/QuizPlayerPage'
import QuizResultPage from './pages/QuizResultPage'
import QuestionsPage from './pages/QuestionsPage'
import QuestionAnalyticsPage from './pages/QuestionAnalyticsPage'
import QuizzesPage from './pages/QuizzesPage'
import AssignmentsPage from './pages/AssignmentsPage'
import ReportsPage from './pages/ReportsPage'
import ReportTrendsPage from './pages/ReportTrendsPage'
import DepartmentPerformancePage from './pages/DepartmentPerformancePage'
import AtRiskStaffPage from './pages/AtRiskStaffPage'
import AttemptViolationsPage from './pages/AttemptViolationsPage'
import AcademicYearsPage from './pages/AcademicYearsPage'
import ClassesPage from './pages/ClassesPage'
import ExamSessionsPage from './pages/ExamSessionsPage'
import CanBoPage from './pages/CanBoPage'
import BranchesPage from './pages/BranchesPage'
import AuditLogsPage from './pages/AuditLogsPage'
import ArenaPage from './pages/ArenaPage'
import ArenaReplayPage from './pages/ArenaReplayPage'
import ArenaPlayerPage from './pages/ArenaPlayerPage'
import ArenaSpectatorPage from './pages/ArenaSpectatorPage'
import AchievementsPage from './pages/AchievementsPage'
import LevelsPage from './pages/LevelsPage'
import AssignmentSchedulesPage from './pages/AssignmentSchedulesPage'
import QuestionApprovalPage from './pages/QuestionApprovalPage'
import TournamentsPage from './pages/TournamentsPage'
import SecurityPage from './pages/SecurityPage'
import AdminSecurityPage from './pages/AdminSecurityPage'
import { ADMIN_ROLES, TRAINING_ROLES, USER_ROLES } from './lib/permissions'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

/**
 * Ép giao diện sáng cố định cho các màn "sân khấu" thương hiệu Agribank
 * (LoginPage, ArenaPlayerPage) — 2 màn này có tông đỏ/vàng cố định thiết kế
 * riêng, không theo lựa chọn Sáng/Tối/Theo hệ thống của ThemeToggle. AntD
 * ConfigProvider lồng nhau sẽ kế thừa mọi token khác từ ConfigProvider cha
 * (màu thương hiệu, bo góc...), ở đây chỉ ghi đè lại phần nền/algorithm.
 */
function LightStage({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: antTheme.defaultAlgorithm,
        token: { colorBgLayout: '#F8F4EC', colorBgContainer: '#ffffff', colorBgElevated: '#ffffff' },
      }}
    >
      {children}
    </ConfigProvider>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

function ThemedApp() {
  const { resolved } = useThemeMode()
  const isDark = resolved === 'dark'

  return (
      <ConfigProvider
        locale={viVN}
        theme={{
          algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
          token: {
            // Màu thương hiệu Agribank — phải khớp --agribank-red trong index.css
            // (AntD tự tính các sắc độ hover/active từ giá trị hex này nên không
            // dùng được var(--...) ở đây). Giữ nguyên đỏ/vàng thương hiệu ở cả 2 theme,
            // chỉ đổi nền/chữ trung tính — các giá trị dark PHẢI khớp khối
            // `:root[data-theme="dark"]` trong index.css.
            colorPrimary: '#7A1428',
            colorSuccess: '#27AE60',
            colorWarning: '#F39C12',
            colorError: '#E53935',
            colorInfo: '#9C2A3F',
            colorBgLayout: isDark ? '#170D10' : '#F8F4EC',
            colorBgContainer: isDark ? '#1F1215' : '#ffffff',
            colorBgElevated: isDark ? '#271820' : '#ffffff',
            borderRadius: 8,
            borderRadiusSM: 6,
            borderRadiusLG: 12,
            fontFamily: "'Be Vietnam Pro', sans-serif",
            fontSize: 14,
            controlHeight: 38,
            boxShadow: '0 4px 16px rgba(122,20,40,0.12)',
            boxShadowSecondary: isDark ? '0 2px 8px rgba(0,0,0,0.45)' : '0 2px 8px rgba(0,0,0,0.08)',
          },
          components: {
            Button: {
              borderRadius: 8,
              controlHeight: 38,
              fontWeight: 600,
              primaryShadow: '0 4px 12px rgba(122,20,40,0.30)',
              defaultShadow: isDark ? '0 2px 6px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.08)',
              dangerShadow: '0 4px 12px rgba(229,57,53,0.28)',
            },
            Table: {
              headerBg: isDark ? '#241519' : '#FBF7F1',
              headerColor: isDark ? '#F3ECE6' : '#4E0D1A',
              headerSortActiveBg: isDark ? '#2E1B22' : '#F5EDE6',
              rowHoverBg: isDark ? '#241519' : '#FBF5F2',
              borderRadius: 12,
              borderRadiusOuter: 12,
              cellPaddingBlock: 12,
            },
            Card: {
              borderRadius: 12,
              boxShadowTertiary: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
            },
            Menu: {
              darkItemBg: 'transparent',
              darkSubMenuItemBg: 'rgba(0,0,0,0.2)',
              darkItemHoverBg: 'rgba(255,255,255,0.10)',
              darkItemSelectedBg: 'rgba(255,179,0,0.20)',
              darkItemSelectedColor: '#ffffff',
              itemBorderRadius: 8,
              itemMarginInline: 8,
              itemMarginBlock: 3,
              collapsedIconSize: 18,
            },
            Layout: {
              // Sider luôn đỏ mận thương hiệu ở cả 2 theme — chỉ Header đổi theo
              siderBg: '#4E0D1A',
              headerBg: isDark ? '#1F1215' : '#ffffff',
              footerBg: isDark ? '#1F1215' : '#ffffff',
            },
            Input: {
              borderRadius: 8,
              controlHeight: 38,
              hoverBorderColor: '#7A1428',
              activeShadow: '0 0 0 3px rgba(122,20,40,0.12)',
            },
            Select: {
              borderRadius: 8,
              controlHeight: 38,
              optionSelectedBg: isDark ? '#2E1B22' : '#F5EDE6',
              optionActiveBg: isDark ? '#241519' : '#FBF7F1',
            },
            Modal: {
              borderRadius: 16,
              titleFontSize: 17,
            },
            Drawer: {
              borderRadius: 0,
            },
            Tag: {
              borderRadius: 20,
              fontSizeSM: 11,
            },
            Badge: {
              borderRadius: 10,
            },
            Pagination: {
              borderRadius: 8,
            },
            Form: {
              labelFontSize: 13,
              labelColor: isDark ? '#C9B8B0' : '#344054',
              verticalLabelPadding: '0 0 4px',
            },
            Divider: {
              colorSplit: isDark ? '#3A252C' : '#EFE6DD',
            },
          },
        }}
      >
        <AntApp>
        <ReloadPrompt />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LightStage><LoginPage /></LightStage>} />
              <Route
                path="/change-password"
                element={
                  <RequireAuth>
                    <ChangePasswordPage />
                  </RequireAuth>
                }
              />
              {/* Full-screen, không lồng trong AppLayout — học viên quét QR vào chơi trên điện thoại
                  không cần Header/Sider/Drawer của portal quản trị. Vẫn yêu cầu đăng nhập. */}
              <Route
                path="/arena/join/:joinCode"
                element={
                  <RequireAuth>
                    <LightStage>
                      <ArenaPlayerPage />
                    </LightStage>
                  </RequireAuth>
                }
              />
              <Route
                path="/arena/spectate/:joinCode"
                element={
                  <RequireAuth>
                    <ArenaSpectatorPage />
                  </RequireAuth>
                }
              />
              <Route
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<HomeRedirect />} />

                <Route element={<RoleGuard allowedRoles={USER_ROLES} />}>
                  <Route path="my/quizzes" element={<MyQuizzesPage />} />
                  <Route path="my/arena" element={<ArenaLobbyPage />} />
                  <Route path="my/attempts/:attemptId" element={<QuizPlayerPage />} />
                  <Route path="my/results/:submissionId" element={<QuizResultPage />} />
                  <Route path="my/leaderboard" element={<LeaderboardPage />} />
                  <Route path="my/practice" element={<PracticePage />} />
                  <Route path="my/review" element={<ReviewPage />} />
                  <Route path="my/security" element={<SecurityPage />} />
                </Route>

                <Route element={<RoleGuard allowedRoles={TRAINING_ROLES} />}>
                  <Route path="manage/questions" element={<QuestionsPage />} />
                  <Route path="manage/question-analytics" element={<QuestionAnalyticsPage />} />
                  <Route path="manage/quizzes" element={<QuizzesPage />} />
                  <Route path="manage/assignments" element={<AssignmentsPage />} />
                  <Route path="manage/reports" element={<ReportsPage />} />
                  <Route path="manage/report-trends" element={<ReportTrendsPage />} />
                  <Route path="manage/department-performance" element={<DepartmentPerformancePage />} />
                  <Route path="manage/at-risk-staff" element={<AtRiskStaffPage />} />
                  <Route path="manage/attempt-violations" element={<AttemptViolationsPage />} />
                  <Route path="manage/exam-sessions" element={<ExamSessionsPage />} />
                  <Route path="manage/arena" element={<ArenaPage />} />
                  <Route path="manage/arena/:id/replay" element={<ArenaReplayPage />} />
                  <Route path="manage/achievements" element={<AchievementsPage />} />
                  <Route path="manage/levels" element={<LevelsPage />} />
                  <Route path="manage/assignment-schedules" element={<AssignmentSchedulesPage />} />
                  <Route path="manage/question-approval" element={<QuestionApprovalPage />} />
                  <Route path="manage/tournaments" element={<TournamentsPage />} />
                </Route>

                <Route element={<RoleGuard allowedRoles={ADMIN_ROLES} />}>
                  <Route path="manage/academic-years" element={<AcademicYearsPage />} />
                  <Route path="manage/classes" element={<ClassesPage />} />
                  <Route path="manage/staff" element={<CanBoPage />} />
                  <Route path="manage/branches" element={<BranchesPage />} />
                  <Route path="manage/audit-logs" element={<AuditLogsPage />} />
                  <Route path="manage/security" element={<AdminSecurityPage />} />
                </Route>

                <Route path="quizzes" element={<HomeRedirect />} />
                <Route path="questions" element={<Navigate to="/manage/questions" replace />} />
                <Route path="assignments" element={<Navigate to="/manage/assignments" replace />} />
                <Route path="reports" element={<Navigate to="/manage/reports" replace />} />
                <Route path="academic-years" element={<Navigate to="/manage/academic-years" replace />} />
                <Route path="classes" element={<Navigate to="/manage/classes" replace />} />
                <Route path="exam-sessions" element={<Navigate to="/manage/exam-sessions" replace />} />
                <Route path="can-bo" element={<Navigate to="/manage/staff" replace />} />
                <Route path="arena" element={<Navigate to="/manage/arena" replace />} />
                <Route path="achievements" element={<Navigate to="/manage/achievements" replace />} />
                <Route path="levels" element={<Navigate to="/manage/levels" replace />} />
                <Route path="*" element={<HomeRedirect />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
        </AntApp>
      </ConfigProvider>
  )
}
