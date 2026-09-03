import { useQuery } from '@tanstack/react-query'
import { Button, Result, Skeleton, Typography } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../lib/api'

const { Text } = Typography

interface QuizResult {
  id: string
  score: number | null
  isPassed: boolean | null
  submittedAt: string | null
}

export default function QuizResultPage() {
  const { submissionId } = useParams()
  const navigate = useNavigate()
  const resultQuery = useQuery<QuizResult>({
    queryKey: ['quiz-result', submissionId],
    queryFn: () => api.get(`/results/${submissionId}`).then((response) => response.data),
    enabled: Boolean(submissionId),
    retry: false,
  })

  if (resultQuery.isLoading) return <Skeleton active paragraph={{ rows: 6 }} />
  if (resultQuery.isError || !resultQuery.data) {
    return <Result status="error" title="Không thể tải kết quả" extra={<Button onClick={() => resultQuery.refetch()}>Thử lại</Button>} />
  }

  const result = resultQuery.data
  const score = Math.round(result.score ?? 0)
  const isPassed = result.isPassed === true

  return (
    <Result
      className="quiz-result"
      icon={isPassed ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
      status={isPassed ? 'success' : 'warning'}
      title={isPassed ? 'Bạn đã hoàn thành bài kiểm tra' : 'Bạn đã hoàn thành bài kiểm tra'}
      subTitle={<><strong>{score}/100 điểm</strong><br /><Text>{isPassed ? 'Kết quả đạt yêu cầu.' : 'Kết quả chưa đạt yêu cầu.'}</Text></>}
      extra={<Button type="primary" onClick={() => navigate('/my/quizzes', { replace: true })}>Về danh sách bài kiểm tra</Button>}
    />
  )
}