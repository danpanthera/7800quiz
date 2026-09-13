import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  Progress,
  Radio,
  Result,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeInvisibleOutlined,
  LeftOutlined,
  RightOutlined,
  SaveOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../lib/api'
import InstantQuizPlayer, { type LockedResult } from '../components/InstantQuizPlayer'
import {
  deleteAttemptDraft,
  getAttemptDraft,
  saveAttemptDraft,
  type AttemptDraft,
} from '../lib/attempt-drafts'

const { Title, Text, Paragraph } = Typography

type SyncStatus = 'loading' | 'saved' | 'pending' | 'saving' | 'offline' | 'conflict' | 'error'

interface QuizOption {
  id: string
  content: string
  orderIndex: number
}

interface QuizQuestion {
  id: string
  content: string
  imageUrl: string | null
  questionType: 'SINGLE' | 'MULTIPLE' | 'ORDERING'
  orderIndex: number
  points: number
  subjectName: string | null
  options: QuizOption[]
}

// ORDERING: nếu đã có đáp án đủ số mục thì giữ đúng thứ tự đã chọn,
// chưa trả lời thì hiện theo thứ tự server đã xáo sẵn cho attempt này.
function getOrderingArrangement(question: QuizQuestion, selected: string[]): QuizOption[] {
  if (selected.length === question.options.length) {
    const byId = new Map(question.options.map((o) => [o.id, o]))
    const arranged = selected.map((id) => byId.get(id)).filter((o): o is QuizOption => Boolean(o))
    if (arranged.length === question.options.length) return arranged
  }
  return question.options
}

function moveItem(list: string[], index: number, direction: -1 | 1): string[] {
  const next = [...list]
  const target = index + direction
  if (target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

interface AttemptData {
  attempt: {
    id: string
    status: 'IN_PROGRESS' | 'GRADED'
    deadlineAt: string
    answerRevision: number
    violationCount: number
  }
  quiz: {
    id: string
    title: string
    description: string | null
    durationMin: number
    passScore: number | null
    instantFeedback: boolean
    violationLimit: number
    auditMode: boolean
    questions: QuizQuestion[]
  }
  answers: Array<{
    questionId: string
    selectedOptionIds: unknown
    lockedAt?: string | null
    isCorrect?: boolean | null
    correctOptionIds?: string[] | null
    explanation?: string | null
  }>
}

const syncStatusText: Record<SyncStatus, string> = {
  loading: 'Đang tải bài kiểm tra',
  saved: 'Đã lưu trên hệ thống',
  pending: 'Đang chờ lưu',
  saving: 'Đang lưu',
  offline: 'Mất kết nối - đã lưu nháp trên thiết bị',
  conflict: 'Dữ liệu đã được cập nhật ở nơi khác - đang tải lại',
  error: 'Không thể lưu - sẽ thử lại khi có mạng',
}

const toAnswerMap = (answers: AttemptData['answers']): Record<string, string[]> =>
  Object.fromEntries(
    answers.map((answer) => [
      answer.questionId,
      Array.isArray(answer.selectedOptionIds)
        ? answer.selectedOptionIds.filter((id): id is string => typeof id === 'string')
        : [],
    ]),
  )

const getRemainingSeconds = (deadlineAt: string) =>
  Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 1000))

const formatRemainingTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

// Bộ đề tắt chế tài (violationLimit = 0): chỉ cảnh báo sau khi đã vi phạm, giữ
// nguyên nội dung cũ. Bộ đề bật chế tài: báo trước quy tắc ngay từ đầu, rồi
// đổi màu/nội dung cảnh báo rõ dần khi số vi phạm tiến gần ngưỡng tự nộp.
function BannerViPham({ violationCount, violationLimit }: { violationCount: number; violationLimit: number }) {
  if (violationLimit <= 0) {
    if (violationCount <= 0) return null
    return (
      <Alert
        type="warning"
        showIcon
        icon={<EyeInvisibleOutlined />}
        message={`Đã ghi nhận ${violationCount} lần rời khỏi màn hình làm bài`}
        description="Hành vi này được hệ thống lưu lại để đối chiếu. Vui lòng ở lại trang làm bài cho đến khi nộp."
      />
    )
  }
  if (violationCount <= 0) {
    return (
      <Alert
        type="info"
        showIcon
        icon={<EyeInvisibleOutlined />}
        message={`Bộ đề này tự động nộp bài nếu rời màn hình làm bài ${violationLimit} lần`}
        description="Rời tab, chuyển sang cửa sổ khác, hoặc cố sao chép đề đều được tính là 1 lần vi phạm."
      />
    )
  }
  const remaining = Math.max(0, violationLimit - violationCount)
  return (
    <Alert
      type="error"
      showIcon
      icon={<EyeInvisibleOutlined />}
      message={`Đã vi phạm ${violationCount}/${violationLimit} lần`}
      description={
        remaining > 0
          ? `Thêm ${remaining} lần nữa hệ thống sẽ tự động nộp bài theo các câu đã lưu.`
          : 'Hệ thống đang tự động nộp bài của bạn...'
      }
    />
  )
}

// Chế độ giám sát nghiêm ngặt (audit), sau khi đã vào toàn màn hình rồi thoát ra
// giữa chừng — che kín màn hình bằng overlay thay vì thay hẳn nội dung, để giữ
// nguyên đồng hồ đếm giờ và trạng thái bài làm phía dưới trong lúc chờ quay lại.
function FullscreenExitOverlay({ onReenter }: { onReenter: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <Card style={{ maxWidth: 420, textAlign: 'center' }}>
        <Title level={4}>Bạn đã thoát chế độ toàn màn hình</Title>
        <Paragraph>Hành vi này đã được ghi nhận là 1 lần vi phạm. Bấm nút bên dưới để quay lại và tiếp tục làm bài.</Paragraph>
        <Button type="primary" size="large" onClick={onReenter}>Quay lại chế độ toàn màn hình</Button>
      </Card>
    </div>
  )
}

export default function QuizPlayerPage() {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [answerRevision, setAnswerRevision] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
  const [pendingSave, setPendingSave] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [retryToken, setRetryToken] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [violationCount, setViolationCount] = useState(0)
  const [violationLimit, setViolationLimit] = useState(0)
  // Chế độ giám sát nghiêm ngặt (audit) — theo dõi trạng thái toàn màn hình.
  // hasEnteredFullscreen phân biệt "chưa từng vào" (hiện màn chắn ban đầu,
  // không tính vi phạm) với "đã vào rồi mà thoát ra" (tính 1 lần vi phạm).
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement))
  const [hasEnteredFullscreen, setHasEnteredFullscreen] = useState(false)
  const fullscreenSupported = typeof document.documentElement.requestFullscreen === 'function'
  const initializedAttemptId = useRef<string | undefined>(undefined)
  const answersRef = useRef(answers)
  const answerRevisionRef = useRef(answerRevision)
  const pendingSaveRef = useRef(pendingSave)
  const submissionStarted = useRef(false)

  const requestFullscreen = () => {
    document.documentElement.requestFullscreen().catch(() => {
      message.error('Không thể vào chế độ toàn màn hình trên trình duyệt này.')
    })
  }
  // Thoát toàn màn hình khi rời trang làm bài (nộp bài, hết giờ, bị tự nộp do vi
  // phạm) — không để cán bộ kẹt trong chế độ toàn màn hình ở trang kết quả.
  const exitFullscreenIfActive = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }

  // Đồng bộ ref theo state mới nhất qua effect (không ghi ref ngay trong lúc render) — để các
  // callback/timer đăng ký 1 lần (debounce lưu draft, cảnh báo rời tab...) luôn đọc được giá trị mới nhất.
  useEffect(() => {
    answersRef.current = answers
    answerRevisionRef.current = answerRevision
    pendingSaveRef.current = pendingSave
  }, [answers, answerRevision, pendingSave])

  const attemptQuery = useQuery<AttemptData>({
    queryKey: ['attempt', attemptId],
    queryFn: () => api.get(`/me/attempts/${attemptId}`).then((response) => response.data),
    enabled: Boolean(attemptId),
    retry: false,
  })

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/me/attempts/${attemptId}/submit`).then((response) => response.data),
    onSuccess: async (result) => {
      if (attemptId) await deleteAttemptDraft(attemptId)
      exitFullscreenIfActive()
      navigate(`/my/results/${result.id}`, {
        replace: true,
        state: { levelUp: result.levelUp, newLevel: result.newLevel, newBadges: result.newBadges },
      })
    },
    onError: () => message.error('Không thể nộp bài ngay bây giờ. Hệ thống sẽ chấm bản đã lưu khi hết giờ.'),
  })

  useEffect(() => {
    const handleOnline = () => setRetryToken((value) => value + 1)
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  // Lưu đáp án lên server ngay lập tức (bỏ qua debounce 900ms) — dùng chung cho
  // bộ đếm tự động (bên dưới) và cho lúc báo vi phạm, để câu vừa chọn không bị
  // mất nếu đúng lần vi phạm đó kích hoạt tự nộp bài (xem effect ghi nhận vi
  // phạm ngay dưới đây, gọi qua flushPendingSaveRef để không phải đăng ký lại
  // listener trên mỗi lần đổi đáp án).
  const flushPendingSave = async () => {
    if (!attemptId || !pendingSaveRef.current) return
    if (!navigator.onLine) {
      setSyncStatus('offline')
      return
    }

    const answersToSave = answersRef.current
    const revisionToSave = answerRevisionRef.current
    setSyncStatus('saving')

    try {
      const response = await api.put(`/me/attempts/${attemptId}/answers`, {
        revision: revisionToSave,
        answers: Object.entries(answersToSave).map(([questionId, selectedOptionIds]) => ({
          questionId,
          selectedOptionIds,
        })),
      })
      const nextRevision = response.data.answerRevision as number
      answerRevisionRef.current = nextRevision
      setAnswerRevision(nextRevision)

      if (answersRef.current === answersToSave) {
        await deleteAttemptDraft(attemptId)
        setPendingSave(false)
        setSyncStatus('saved')
        return
      }

      await saveAttemptDraft({
        attemptId,
        answerRevision: nextRevision,
        answers: answersRef.current,
        updatedAt: new Date().toISOString(),
      })
      setSyncStatus('pending')
    } catch (error) {
      const err = error as { response?: { status?: number } }
      if (err.response?.status === 409) {
        initializedAttemptId.current = undefined
        setHydrated(false)
        setPendingSave(false)
        setSyncStatus('conflict')
        void attemptQuery.refetch()
        return
      }
      setSyncStatus(navigator.onLine ? 'error' : 'offline')
    }
  }
  const flushPendingSaveRef = useRef(flushPendingSave)
  useEffect(() => {
    flushPendingSaveRef.current = flushPendingSave
  })

  // Ghi nhận rời màn hình / chuyển cửa sổ / cố sao chép đề khi đang làm bài. Mặc
  // định (violationLimit = 0) chỉ cảnh báo + lưu lại để đối chiếu sau, KHÔNG tự
  // động chấm rớt (tránh oan vô tình alt-tab). Nếu bộ đề bật ngưỡng, tới đúng lần
  // vi phạm thứ N server sẽ tự nộp bài — xem reportViolation()/finalize() ở API.
  useEffect(() => {
    if (!attemptId || attemptQuery.data?.attempt.status !== 'IN_PROGRESS') return
    const auditMode = Boolean(attemptQuery.data?.quiz.auditMode) && fullscreenSupported

    const reportViolation = async (
      type:
        | 'TAB_HIDDEN'
        | 'COPY_ATTEMPT'
        | 'WINDOW_BLUR'
        | 'FULLSCREEN_EXIT'
        | 'IDLE_TIMEOUT'
        | 'DEVTOOLS_OPEN'
        | 'SCREENSHOT_ATTEMPT',
    ) => {
      // 2 loại "mềm" độ tin cậy thấp (dễ oan do cấu hình trình duyệt/màn hình
      // khác nhau) — server chỉ ghi log, không cộng dồn/không tự nộp, nên ở
      // đây cũng không cần lưu đáp án trước hay cảnh báo người dùng.
      const isSoft = type === 'DEVTOOLS_OPEN' || type === 'SCREENSHOT_ATTEMPT'
      if (!isSoft) {
        // Lưu câu vừa chọn TRƯỚC khi báo vi phạm — nếu đúng lần này kích hoạt
        // tự nộp, server phải thấy được đáp án mới nhất khi chấm điểm.
        await flushPendingSaveRef.current()
      }
      try {
        const response = await api.post(`/me/attempts/${attemptId}/violations`, { type })
        const { violationCount: nextCount, violationLimit: limit, autoSubmitted, submissionId } = response.data as {
          violationCount: number
          violationLimit: number
          autoSubmitted: boolean
          submissionId?: string
        }
        if (isSoft) return
        setViolationCount(nextCount)
        setViolationLimit(limit)
        if (autoSubmitted && submissionId) {
          await deleteAttemptDraft(attemptId)
          exitFullscreenIfActive()
          navigate(`/my/results/${submissionId}`, { replace: true })
          return
        }
        if (limit > 0) {
          message.warning(`Đã vi phạm ${nextCount}/${limit} lần — vui lòng ở lại trang làm bài.`)
        }
      } catch {
        // Im lặng bỏ qua — lỗi báo cáo vi phạm không được chặn người dùng tiếp tục làm bài.
      }
    }
    const handleVisibility = () => {
      if (document.hidden) void reportViolation('TAB_HIDDEN')
    }
    const handleCopy = (event: ClipboardEvent) => {
      event.preventDefault()
      void reportViolation('COPY_ATTEMPT')
    }
    // Chặn chuột phải để hạn chế truy cập nhanh "Sao chép"/"Kiểm tra phần tử"
    // từ menu ngữ cảnh — không báo vi phạm vì bấm chuột phải rất phổ biến do
    // thói quen, không phải dấu hiệu gian lận đáng kể.
    const handleContextMenu = (event: MouseEvent) => event.preventDefault()

    // Nghi vấn mở DevTools (F12/Kiểm tra phần tử): khi mở panel dock 1 bên,
    // outerWidth/outerHeight (kích thước cả cửa sổ) và innerWidth/innerHeight
    // (kích thước vùng hiển thị trang) lệch nhau bất thường. Ngưỡng 220px khá
    // rộng để giảm oan (thanh bookmark/tải xuống/zoom trình duyệt vẫn trong
    // ngưỡng bình thường) — độ tin cậy không tuyệt đối nên đây là vi phạm mềm.
    // Chỉ báo 1 lần mỗi khi CHUYỂN từ đóng sang mở, không báo lặp lại liên tục.
    let devtoolsOpen = false
    const DEVTOOLS_THRESHOLD_PX = 220
    const checkDevtools = () => {
      const widthDiff = window.outerWidth - window.innerWidth
      const heightDiff = window.outerHeight - window.innerHeight
      const nowOpen = widthDiff > DEVTOOLS_THRESHOLD_PX || heightDiff > DEVTOOLS_THRESHOLD_PX
      if (nowOpen && !devtoolsOpen) void reportViolation('DEVTOOLS_OPEN')
      devtoolsOpen = nowOpen
    }
    const devtoolsPoller = window.setInterval(checkDevtools, 2_000)

    // Nghi vấn chụp màn hình — độ tin cậy thấp (không phải hệ điều hành/trình
    // duyệt nào cũng lộ phím tắt này ra sự kiện keydown), chỉ để ghi log tham
    // khảo. Windows/nhiều bàn phím: phím PrintScreen. macOS: Cmd+Shift+3/4/5.
    const handleScreenshotKey = (event: KeyboardEvent) => {
      const isPrintScreen = event.key === 'PrintScreen'
      const isMacShortcut =
        event.metaKey && event.shiftKey && ['3', '4', '5'].includes(event.key)
      if (isPrintScreen || isMacShortcut) void reportViolation('SCREENSHOT_ATTEMPT')
    }

    // Vắng mặt dù không chuyển tab/cửa sổ (rời máy đi hỏi bài, tra tài liệu
    // giấy, dùng điện thoại riêng) — không có bất kỳ thao tác chuột/bàn phím/
    // chạm/cuộn nào trong IDLE_THRESHOLD_MS dù tab vẫn hiển thị và có focus.
    // Chỉ báo 1 lần mỗi lượt vắng mặt, reset khi có thao tác trở lại.
    const IDLE_THRESHOLD_MS = 3 * 60 * 1000
    let lastActivityAt = Date.now()
    let idleReported = false
    const handleActivity = () => {
      lastActivityAt = Date.now()
      idleReported = false
    }
    const idlePoller = window.setInterval(() => {
      if (document.hidden || !document.hasFocus()) return
      if (!idleReported && Date.now() - lastActivityAt >= IDLE_THRESHOLD_MS) {
        idleReported = true
        void reportViolation('IDLE_TIMEOUT')
      }
    }, 10_000)

    // Chuyển sang cửa sổ khác (chia đôi màn hình, mở app khác cạnh bên, màn
    // hình phụ) mà trang KHÔNG bị ẩn — visibilitychange ở trên không bắt được
    // trường hợp này. Chờ 3 giây trước khi tính là vi phạm thật, để không oan
    // các trường hợp mất focus thoáng qua (thông báo hệ thống, đổi cửa sổ nhầm).
    let blurTimer: number | undefined
    const handleBlur = () => {
      if (document.hidden) return
      blurTimer = window.setTimeout(() => {
        void reportViolation('WINDOW_BLUR')
      }, 3_000)
    }
    const handleFocus = () => {
      if (blurTimer !== undefined) {
        window.clearTimeout(blurTimer)
        blurTimer = undefined
      }
    }

    // Chế độ giám sát nghiêm ngặt (audit): thoát toàn màn hình giữa chừng tính
    // là 1 vi phạm. hasEnteredFullscreen phân biệt "chưa từng vào" (đang hiện
    // màn chắn ban đầu, xem render bên dưới) với "đã vào rồi mà thoát ra".
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement)
      setIsFullscreen(active)
      if (active) {
        setHasEnteredFullscreen(true)
      } else if (hasEnteredFullscreen) {
        void reportViolation('FULLSCREEN_EXIT')
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleScreenshotKey)
    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('scroll', handleActivity)
    window.addEventListener('touchstart', handleActivity)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    if (auditMode) document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleScreenshotKey)
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('scroll', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      if (auditMode) document.removeEventListener('fullscreenchange', handleFullscreenChange)
      if (blurTimer !== undefined) window.clearTimeout(blurTimer)
      window.clearInterval(devtoolsPoller)
      window.clearInterval(idlePoller)
    }
  }, [attemptId, attemptQuery.data?.attempt.status, attemptQuery.data?.quiz.auditMode, fullscreenSupported, hasEnteredFullscreen, navigate])

  useEffect(() => {
    const data = attemptQuery.data
    if (!data || !attemptId || initializedAttemptId.current === attemptId) return
    initializedAttemptId.current = attemptId
    let active = true

    const hydrate = async () => {
      const serverAnswers = toAnswerMap(data.answers)
      let draft: AttemptDraft | undefined
      try {
        draft = await getAttemptDraft(attemptId)
      } catch {
        setSyncStatus('error')
      }

      if (!active) return
      const canRecoverDraft = draft?.answerRevision === data.attempt.answerRevision
      const recoveredAnswers = canRecoverDraft && draft
        ? { ...serverAnswers, ...draft.answers }
        : serverAnswers
      if (draft && !canRecoverDraft) {
        void deleteAttemptDraft(attemptId)
      }

      setAnswers(recoveredAnswers)
      setAnswerRevision(data.attempt.answerRevision)
      setPendingSave(canRecoverDraft && JSON.stringify(recoveredAnswers) !== JSON.stringify(serverAnswers))
      setSyncStatus(canRecoverDraft ? 'pending' : 'saved')
      // Lấy từ server để tải lại trang không bị đếm lại từ 0 giữa chừng bài thi.
      setViolationCount(data.attempt.violationCount ?? 0)
      setViolationLimit(data.quiz.violationLimit ?? 0)
      setHasEnteredFullscreen(Boolean(document.fullscreenElement))
      setIsFullscreen(Boolean(document.fullscreenElement))
      setHydrated(true)
    }

    void hydrate()
    return () => {
      active = false
    }
  }, [attemptId, attemptQuery.data])

  useEffect(() => {
    const data = attemptQuery.data
    if (!data) return
    if (data.attempt.status === 'GRADED') {
      exitFullscreenIfActive()
      navigate(`/my/results/${attemptId}`, { replace: true })
      return
    }

    const refreshRemainingTime = () => {
      const nextRemainingSeconds = getRemainingSeconds(data.attempt.deadlineAt)
      setRemainingSeconds(nextRemainingSeconds)
      if (nextRemainingSeconds === 0 && !submissionStarted.current) {
        submissionStarted.current = true
        submitMutation.mutate()
      }
    }

    refreshRemainingTime()
    const timer = window.setInterval(refreshRemainingTime, 1_000)
    return () => window.clearInterval(timer)
  }, [attemptId, attemptQuery.data, navigate, submitMutation])

  useEffect(() => {
    const data = attemptQuery.data
    if (!data || !attemptId || !hydrated || !pendingSave || data.attempt.status !== 'IN_PROGRESS') {
      return
    }

    const timer = window.setTimeout(() => {
      void flushPendingSave()
    }, 900)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flushPendingSave đổi identity mỗi lần render (đọc ref), thêm vào đây sẽ reset debounce timer liên tục
  }, [answerRevision, attemptId, attemptQuery, hydrated, pendingSave, retryToken])

  const updateAnswer = (questionId: string, selectedOptionIds: string[]) => {
    if (!attemptId) return
    const nextAnswers = { ...answersRef.current, [questionId]: selectedOptionIds }
    answersRef.current = nextAnswers
    setAnswers(nextAnswers)
    setPendingSave(true)
    setSyncStatus(navigator.onLine ? 'pending' : 'offline')
    void saveAttemptDraft({
      attemptId,
      answerRevision: answerRevisionRef.current,
      answers: nextAnswers,
      updatedAt: new Date().toISOString(),
    }).catch(() => setSyncStatus('error'))
  }

  if (attemptQuery.isLoading || !hydrated) {
    return <Skeleton active paragraph={{ rows: 12 }} />
  }

  if (attemptQuery.isError || !attemptQuery.data) {
    return <Result status="error" title="Không thể tải bài kiểm tra" extra={<Button onClick={() => attemptQuery.refetch()}>Thử lại</Button>} />
  }

  const { quiz } = attemptQuery.data

  // Chế độ giám sát nghiêm ngặt (audit): chưa từng vào toàn màn hình thì chặn
  // hẳn, chưa cho thấy đề bài — Fullscreen API bắt buộc phải có thao tác bấm
  // của người dùng nên không thể tự động vào ngay khi tải trang.
  if (quiz.auditMode && fullscreenSupported && !isFullscreen && !hasEnteredFullscreen) {
    return (
      <Result
        status="info"
        title="Kỳ thi yêu cầu chế độ toàn màn hình"
        subTitle="Để đảm bảo tính nghiêm túc, bạn cần vào chế độ toàn màn hình trước khi bắt đầu làm bài. Thoát toàn màn hình giữa chừng sẽ được tính là 1 lần vi phạm."
        extra={<Button type="primary" size="large" onClick={requestFullscreen}>Vào toàn màn hình &amp; bắt đầu làm bài</Button>}
      />
    )
  }
  const showFullscreenExitOverlay = quiz.auditMode && fullscreenSupported && !isFullscreen && hasEnteredFullscreen

  // Bộ đề bật phản hồi tức thì dùng giao diện kiểu Quizizz: chốt từng câu, hiện
  // ngay đúng/sai rồi tự sang câu kế. Đề thi chính thức giữ nguyên giao diện cũ
  // (còn quay lại sửa được, chỉ chấm khi nộp).
  if (quiz.instantFeedback) {
    if (!quiz.questions.length) return <Empty description="Bộ đề chưa có câu hỏi" />
    const lockedResults: Record<string, LockedResult> = Object.fromEntries(
      attemptQuery.data.answers
        .filter((answer) => answer.lockedAt)
        .map((answer) => [
          answer.questionId,
          {
            selectedOptionIds: Array.isArray(answer.selectedOptionIds)
              ? answer.selectedOptionIds.filter((id): id is string => typeof id === 'string')
              : [],
            isCorrect: Boolean(answer.isCorrect),
            correctOptionIds: answer.correctOptionIds ?? [],
            explanation: answer.explanation ?? null,
          },
        ]),
    )
    // InstantQuizPlayer tự vẽ toàn màn hình (position: fixed) — banner đặt đè
    // lên trên bằng z-index cao hơn thay vì chèn vào bên trong component đó
    // (không sửa InstantQuizPlayer.tsx vì file đang có thay đổi khác của Sếp).
    return (
      <>
        {(violationLimit > 0 || violationCount > 0) && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30, padding: 12 }}>
            <BannerViPham violationCount={violationCount} violationLimit={violationLimit} />
          </div>
        )}
        {showFullscreenExitOverlay && <FullscreenExitOverlay onReenter={requestFullscreen} />}
        <InstantQuizPlayer
          attemptId={attemptId!}
          quizTitle={quiz.title}
          questions={quiz.questions}
          initialResults={lockedResults}
          remainingSeconds={remainingSeconds}
          isSubmitting={submitMutation.isPending}
          onFinish={() => {
            if (submissionStarted.current) return
            submissionStarted.current = true
            submitMutation.mutate()
          }}
        />
      </>
    )
  }

  const currentQuestion = quiz.questions[currentQuestionIndex]
  if (!currentQuestion) {
    return <Empty description="Bộ đề chưa có câu hỏi" />
  }

  const selectedOptionIds = answers[currentQuestion.id] ?? []
  const orderingArrangement = currentQuestion.questionType === 'ORDERING'
    ? getOrderingArrangement(currentQuestion, selectedOptionIds)
    : []
  const orderingArrangementIds = orderingArrangement.map((o) => o.id)
  const answeredQuestionCount = Object.values(answers).filter((selected) => selected.length > 0).length
  const progressPercent = quiz.questions.length
    ? Math.round((answeredQuestionCount / quiz.questions.length) * 100)
    : 0
  const isTimeRunningOut = remainingSeconds <= 5 * 60
  const canSubmit = !pendingSave && syncStatus === 'saved' && remainingSeconds > 0

  return (
    <div className="quiz-player-page">
      <header className="quiz-player-header">
        <div>
          <Text className="page-eyebrow">Đang làm bài</Text>
          <Title level={1}>{quiz.title}</Title>
          {quiz.description && <Paragraph>{quiz.description}</Paragraph>}
        </div>
        <div className={`quiz-timer${isTimeRunningOut ? ' quiz-timer-warning' : ''}`}>
          <ClockCircleOutlined />
          <span>{formatRemainingTime(remainingSeconds)}</span>
        </div>
      </header>

      <div className="quiz-save-status" role="status">
        <SaveOutlined />
        <span>{syncStatusText[syncStatus]}</span>
      </div>

      {syncStatus === 'offline' && (
        <Alert
          type="warning"
          showIcon
          message="Bạn vẫn có thể tiếp tục làm bài"
          description="Các lựa chọn mới đã được lưu trên thiết bị. Hệ thống sẽ tự đồng bộ khi có mạng trước thời hạn."
        />
      )}

      {syncStatus === 'conflict' && (
        <Alert
          type="warning"
          showIcon
          message="Bài làm đã thay đổi ở một nơi khác"
          description="Hệ thống đang tải lại dữ liệu mới nhất để tránh ghi đè đáp án."
        />
      )}

      <BannerViPham violationCount={violationCount} violationLimit={violationLimit} />
      {showFullscreenExitOverlay && <FullscreenExitOverlay onReenter={requestFullscreen} />}

      <div className="quiz-player-layout">
        <aside className="quiz-navigation" aria-label="Danh sách câu hỏi">
          <div className="quiz-navigation-summary">
            <span>Tiến độ</span>
            <strong>{answeredQuestionCount}/{quiz.questions.length}</strong>
          </div>
          <Progress percent={progressPercent} showInfo={false} strokeColor="#246b5a" />
          <div className="quiz-question-indexes">
            {quiz.questions.map((question, index) => (
              <Button
                key={question.id}
                type={index === currentQuestionIndex ? 'primary' : 'default'}
                className={answers[question.id]?.length ? 'quiz-question-index-answered' : ''}
                aria-label={`Câu ${index + 1}${answers[question.id]?.length ? ', đã trả lời' : ''}`}
                onClick={() => setCurrentQuestionIndex(index)}
              >
                {index + 1}
              </Button>
            ))}
          </div>
        </aside>

        <Card className="quiz-question-card" bordered={false}>
          <div className="quiz-question-heading">
            <Text>Câu {currentQuestionIndex + 1} / {quiz.questions.length}</Text>
            <Tag>
              {currentQuestion.questionType === 'MULTIPLE' && 'Chọn nhiều đáp án'}
              {currentQuestion.questionType === 'SINGLE' && 'Chọn một đáp án'}
              {currentQuestion.questionType === 'ORDERING' && 'Sắp xếp đúng thứ tự'}
            </Tag>
          </div>
          {currentQuestion.subjectName && (
            <Text strong style={{ display: 'block', marginTop: 12, color: '#246b5a' }}>
              <BookOutlined /> Lĩnh vực: {currentQuestion.subjectName}
            </Text>
          )}
          <Title level={3}>{currentQuestion.content}</Title>
          {currentQuestion.imageUrl && (
            <img src={currentQuestion.imageUrl} alt="" className="quiz-question-image" style={{ marginBottom: 20 }} />
          )}

          {currentQuestion.questionType === 'MULTIPLE' && (
            <Checkbox.Group
              className="quiz-options"
              value={selectedOptionIds}
              onChange={(values) => updateAnswer(currentQuestion.id, values as string[])}
            >
              {currentQuestion.options.map((option) => (
                <Checkbox key={option.id} value={option.id} className="quiz-option">
                  <span className="quiz-option-letter">{String.fromCharCode(65 + option.orderIndex - 1)}</span>
                  <span>{option.content}</span>
                </Checkbox>
              ))}
            </Checkbox.Group>
          )}

          {currentQuestion.questionType === 'SINGLE' && (
            <Radio.Group
              className="quiz-options"
              value={selectedOptionIds[0]}
              onChange={(event) => updateAnswer(currentQuestion.id, [event.target.value])}
            >
              {currentQuestion.options.map((option) => (
                <Radio key={option.id} value={option.id} className="quiz-option">
                  <span className="quiz-option-letter">{String.fromCharCode(65 + option.orderIndex - 1)}</span>
                  <span>{option.content}</span>
                </Radio>
              ))}
            </Radio.Group>
          )}

          {currentQuestion.questionType === 'ORDERING' && (
            <Space direction="vertical" size={8} className="quiz-options" style={{ width: '100%' }}>
              {orderingArrangement.map((option, idx) => (
                <div key={option.id} className="quiz-option quiz-ordering-item">
                  <span className="quiz-option-letter">{idx + 1}</span>
                  <span style={{ flex: 1 }}>{option.content}</span>
                  <Space size={4}>
                    <Button
                      size="small"
                      icon={<ArrowUpOutlined />}
                      disabled={idx === 0}
                      aria-label="Di chuyển lên"
                      onClick={() => updateAnswer(currentQuestion.id, moveItem(orderingArrangementIds, idx, -1))}
                    />
                    <Button
                      size="small"
                      icon={<ArrowDownOutlined />}
                      disabled={idx === orderingArrangement.length - 1}
                      aria-label="Di chuyển xuống"
                      onClick={() => updateAnswer(currentQuestion.id, moveItem(orderingArrangementIds, idx, 1))}
                    />
                  </Space>
                </div>
              ))}
            </Space>
          )}

          <footer className="quiz-player-actions">
            <Button
              icon={<LeftOutlined />}
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex((index) => index - 1)}
            >
              Câu trước
            </Button>
            <Space>
              <Button
                disabled={currentQuestionIndex === quiz.questions.length - 1}
                onClick={() => setCurrentQuestionIndex((index) => index + 1)}
              >
                Câu tiếp
                <RightOutlined />
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={submitMutation.isPending}
                disabled={!canSubmit}
                onClick={() => submitMutation.mutate()}
              >
                Nộp bài
              </Button>
            </Space>
          </footer>
        </Card>
      </div>

      {pendingSave && (
        <Text className="quiz-submit-note"><CheckCircleOutlined /> Nút nộp bài sẽ bật sau khi dữ liệu được lưu trên hệ thống.</Text>
      )}
    </div>
  )
}