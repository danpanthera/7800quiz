import { CalendarOutlined, ClockCircleOutlined, FileTextOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button, Card, Empty, List, Skeleton, Tag, Typography, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

const { Title, Text } = Typography

interface Assignment {
  id: string
  startAt: string | null
  endAt: string | null
  quiz: {
    id: string
    title: string
    description: string | null
    topic: string | null
    durationMin: number
  }
}

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(value))
    : null

export default function MyQuizzesPage() {
  const navigate = useNavigate()
  const assignmentsQuery = useQuery<Assignment[]>({
    queryKey: ['my-assignments'],
    queryFn: () => api.get('/me/assignments').then((response) => response.data),
  })
  const startAttemptMutation = useMutation({
    mutationFn: (assignmentId: string) => api.post('/me/attempts', {
      id: crypto.randomUUID(),
      assignmentId,
    }).then((response) => response.data),
    onSuccess: (data) => navigate(`/my/attempts/${data.attempt.id}`),
    onError: () => message.error('Không thể bắt đầu bài kiểm tra. Vui lòng thử lại.'),
  })

  return (
    <div className="page-stack">
      <header className="page-title-row">
        <div>
          <Text className="page-eyebrow">7800Quiz</Text>
          <Title level={1}>Bài kiểm tra của tôi</Title>
        </div>
        {!assignmentsQuery.isLoading && (
          <Tag color="blue">{assignmentsQuery.data?.length ?? 0} bài đang mở</Tag>
        )}
      </header>

      {assignmentsQuery.isLoading ? (
        <div className="quiz-grid" aria-label="Đang tải bài kiểm tra">
          {[1, 2, 3].map((item) => <Card key={item}><Skeleton active /></Card>)}
        </div>
      ) : assignmentsQuery.data?.length ? (
        <List
          className="quiz-list"
          grid={{ gutter: 16, xs: 1, sm: 2, xl: 3 }}
          dataSource={assignmentsQuery.data}
          renderItem={(assignment) => (
            <List.Item>
              <Card className="quiz-card" bordered={false}>
                <div className="quiz-card-icon"><FileTextOutlined /></div>
                {assignment.quiz.topic && <Tag>{assignment.quiz.topic}</Tag>}
                <Title level={3}>{assignment.quiz.title}</Title>
                {assignment.quiz.description && (
                  <Text className="quiz-card-description">{assignment.quiz.description}</Text>
                )}
                <dl className="quiz-meta">
                  <div>
                    <dt><ClockCircleOutlined /> Thời lượng</dt>
                    <dd>{assignment.quiz.durationMin} phút</dd>
                  </div>
                  {(assignment.startAt || assignment.endAt) && (
                    <div>
                      <dt><CalendarOutlined /> Thời gian</dt>
                      <dd>{formatDate(assignment.startAt) ?? 'Bây giờ'} - {formatDate(assignment.endAt) ?? 'Không giới hạn'}</dd>
                    </div>
                  )}
                </dl>
                <Button
                  type="primary"
                  block
                  onClick={() => startAttemptMutation.mutate(assignment.id)}
                  loading={startAttemptMutation.isPending && startAttemptMutation.variables === assignment.id}
                >
                  Bắt đầu làm bài
                </Button>
              </Card>
            </List.Item>
          )}
        />
      ) : (
        <Empty description="Hiện chưa có bài kiểm tra được giao" />
      )}
    </div>
  )
}