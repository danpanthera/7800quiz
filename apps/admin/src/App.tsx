import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, App as AntApp, theme as antTheme } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { AuthProvider } from './lib/auth'
import RequireAuth from './components/RequireAuth'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/LoginPage'
import QuestionsPage from './pages/QuestionsPage'
import QuizzesPage from './pages/QuizzesPage'
import AssignmentsPage from './pages/AssignmentsPage'
import ReportsPage from './pages/ReportsPage'
import AcademicYearsPage from './pages/AcademicYearsPage'
import ClassesPage from './pages/ClassesPage'
import ExamSessionsPage from './pages/ExamSessionsPage'
import CanBoPage from './pages/CanBoPage'
import ArenaPage from './pages/ArenaPage'
import AchievementsPage from './pages/AchievementsPage'
import LevelsPage from './pages/LevelsPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={viVN}
        theme={{
          algorithm: antTheme.defaultAlgorithm,
          token: {
            colorPrimary: '#1565C0',
            colorSuccess: '#27AE60',
            colorWarning: '#F39C12',
            colorError: '#E53935',
            colorInfo: '#1976D2',
            colorBgLayout: '#EEF2FF',
            colorBgContainer: '#ffffff',
            colorBgElevated: '#ffffff',
            borderRadius: 8,
            borderRadiusSM: 6,
            borderRadiusLG: 12,
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
            fontSize: 14,
            controlHeight: 38,
            boxShadow: '0 4px 16px rgba(21,101,192,0.12)',
            boxShadowSecondary: '0 2px 8px rgba(0,0,0,0.08)',
          },
          components: {
            Button: {
              borderRadius: 8,
              controlHeight: 38,
              fontWeight: 600,
              primaryShadow: '0 4px 12px rgba(21,101,192,0.30)',
              defaultShadow: '0 2px 6px rgba(0,0,0,0.08)',
              dangerShadow: '0 4px 12px rgba(229,57,53,0.28)',
            },
            Table: {
              headerBg: '#F5F7FF',
              headerColor: '#344054',
              headerSortActiveBg: '#EEF2FF',
              rowHoverBg: '#F0F4FF',
              borderRadius: 12,
              borderRadiusOuter: 12,
              cellPaddingBlock: 12,
            },
            Card: {
              borderRadius: 12,
              boxShadowTertiary: '0 2px 12px rgba(0,0,0,0.06)',
            },
            Menu: {
              darkItemBg: 'transparent',
              darkSubMenuItemBg: 'rgba(0,0,0,0.2)',
              darkItemHoverBg: 'rgba(255,255,255,0.08)',
              darkItemSelectedBg: 'rgba(91,163,255,0.18)',
              darkItemSelectedColor: '#ffffff',
              itemBorderRadius: 8,
              itemMarginInline: 8,
              itemMarginBlock: 3,
              collapsedIconSize: 18,
            },
            Layout: {
              siderBg: '#0D2045',
              headerBg: '#ffffff',
              footerBg: '#ffffff',
            },
            Input: {
              borderRadius: 8,
              controlHeight: 38,
              hoverBorderColor: '#1565C0',
              activeShadow: '0 0 0 3px rgba(21,101,192,0.12)',
            },
            Select: {
              borderRadius: 8,
              controlHeight: 38,
              optionSelectedBg: '#EEF2FF',
              optionActiveBg: '#F5F7FF',
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
              labelColor: '#344054',
              verticalLabelPadding: '0 0 4px',
            },
            Divider: {
              colorSplit: '#EEF2FF',
            },
          },
        }}
      >
        <AntApp>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="/quizzes" replace />} />
                <Route path="questions" element={<QuestionsPage />} />
                <Route path="quizzes" element={<QuizzesPage />} />
                <Route path="assignments" element={<AssignmentsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="academic-years" element={<AcademicYearsPage />} />
                <Route path="classes" element={<ClassesPage />} />
                <Route path="exam-sessions" element={<ExamSessionsPage />} />
                <Route path="can-bo" element={<CanBoPage />} />
                <Route path="arena" element={<ArenaPage />} />
                <Route path="achievements" element={<AchievementsPage />} />
                <Route path="levels" element={<LevelsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  )
}
