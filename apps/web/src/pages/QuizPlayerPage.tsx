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
  CheckCircleOutlined,
  ClockCircleOutlined,
  LeftOutlined,
  RightOutlined,
  SaveOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../lib/api'
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
  questionType: 'SINGLE' | 'MULTIPLE'
  orderIndex: number
  points: number
  options: QuizOption[]
}

interface AttemptData {
  attempt: {
    id: string
    status: 'IN_PROGRESS' | 'GRADED'
    deadlineAt: string
    answerRevision: number
  }
  quiz: {
    id: string
    title: string
    description: string | null
    durationMin: number
    passScore: number | null
    questions: QuizQuestion[]
  }
  answers: Array<{ questionId: string; selectedOptionIds: unknown }>
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
  const initializedAttemptId = useRef<string | undefined>(undefined)
  const answersRef = useRef(answers)
  const answerRevisionRef = useRef(answerRevision)
  const submissionStarted = useRef(false)

  answersRef.current = answers
  answerRevisionRef.current = answerRevision

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
      navigate(`/my/results/${result.id}`, { replace: true })
    },
    onError: () => message.error('Không thể nộp bài ngay bây giờ. Hệ thống sẽ chấm bản đã lưu khi hết giờ.'),
  })

  useEffect(() => {
    const handleOnline = () => setRetryToken((value) => value + 1)
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

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
      if (!navigator.onLine) {
        setSyncStatus('offline')
        return
      }

      const answersToSave = answersRef.current
      const revisionToSave = answerRevisionRef.current
      setSyncStatus('saving')

      void api.put(`/me/attempts/${attemptId}/answers`, {
        revision: revisionToSave,
        answers: Object.entries(answersToSave).map(([questionId, selectedOptionIds]) => ({
          questionId,
          selectedOptionIds,
        })),
      }).then(async (response) => {
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
      }).catch((error: { response?: { status?: number } }) => {
        if (error.response?.status === 409) {
          initializedAttemptId.current = undefined
          setHydrated(false)
          setPendingSave(false)
          setSyncStatus('conflict')
          void attemptQuery.refetch()
          return
        }
        setSyncStatus(navigator.onLine ? 'error' : 'offline')
      })
    }, 900)

    return () => window.clearTimeout(timer)
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
  const currentQuestion = quiz.questions[currentQuestionIndex]
  if (!currentQuestion) {
    return <Empty description="Bộ đề chưa có câu hỏi" />
  }

  const selectedOptionIds = answers[currentQuestion.id] ?? []
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
            <Tag>{currentQuestion.questionType === 'MULTIPLE' ? 'Chọn nhiều đáp án' : 'Chọn một đáp án'}</Tag>
          </div>
          <Title level={3}>{currentQuestion.content}</Title>

          {currentQuestion.questionType === 'MULTIPLE' ? (
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
          ) : (
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