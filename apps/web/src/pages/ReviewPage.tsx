import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Checkbox, Empty, Progress, Radio, Result, Space, Tag, Typography, message } from 'antd'
import { CheckCircleFilled, CloseCircleFilled, HistoryOutlined } from '@ant-design/icons'
import api, { getErrorMessage } from '../lib/api'

const { Title, Text } = Typography

interface ReviewOption { id: string; content: string; orderIndex: number }
interface ReviewCard {
  cardId: string
  questionId: string
  content: string
  questionType: 'SINGLE' | 'MULTIPLE' | 'ORDERING'
  subjectName: string | null
  repetitions: number
  options: ReviewOption[]
}
interface ReviewAnswerResult {
  isCorrect: boolean
  correctOptionIds: string[]
  explanation: string | null
  nextDueAt: string
  intervalDays: number
}
interface ReviewStats { dueCount: number; totalCount: number }

export default function ReviewPage() {
  const queryClient = useQueryClient()
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [result, setResult] = useState<ReviewAnswerResult | null>(null)

  const statsQuery = useQuery<ReviewStats>({
    queryKey: ['review-stats'],
    queryFn: () => api.get('/me/review/stats').then((r) => r.data),
  })
  const queueQuery = useQuery<ReviewCard[]>({
    queryKey: ['review-queue'],
    queryFn: () => api.get('/me/review/queue').then((r) => r.data),
  })

  const answerMutation = useMutation({
    mutationFn: (card: ReviewCard) =>
      api
        .post('/me/review/answer', { cardId: card.cardId, selectedOptionIds: selected })
        .then((r) => r.data as ReviewAnswerResult),
    onSuccess: (data) => {
      setResult(data)
      void queryClient.invalidateQueries({ queryKey: ['review-stats'] })
    },
    onError: (e) => message.error(getErrorMessage(e, 'Không thể gửi câu trả lời')),
  })

  const toggleOrdering = (optionId: string) => {
    setSelected((prev) => (prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]))
  }

  const cards = queueQuery.data ?? []
  const card = cards[index]

  const nextCard = () => {
    setResult(null)
    setSelected([])
    setIndex((i) => i + 1)
  }

  return (
    <div className="page-stack">
      <header className="page-title-row" style={{ marginBottom: 16 }}>
        <div>
          <Text className="page-eyebrow">7800Quiz</Text>
          <Title level={1}>Ôn tập ngắt quãng</Title>
        </div>
        <Tag icon={<HistoryOutlined />} color="blue">
          {statsQuery.data?.dueCount ?? 0} câu tới hạn / {statsQuery.data?.totalCount ?? 0} câu đang theo dõi
        </Tag>
      </header>
      <Text type="secondary">
        Hệ thống tự chọn lại các câu bạn từng trả lời sai trong bài thi thường — trả lời đúng sẽ giãn dần khoảng cách ôn lại, sai thì mai ôn lại ngay.
      </Text>

      {queueQuery.isLoading ? null : cards.length === 0 ? (
        <Empty description="Không có câu nào tới hạn ôn tập hôm nay — quay lại sau nhé!" />
      ) : !card ? (
        <Result status="success" title="Đã ôn hết hàng chờ hôm nay!" subTitle="Quay lại vào lần sau để tiếp tục ôn tập." />
      ) : (
        <Card bordered={false}>
          <Space style={{ marginBottom: 12 }} wrap>
            <Tag>Câu {index + 1}/{cards.length}</Tag>
            {card.subjectName && <Tag color="blue">Lĩnh vực: {card.subjectName}</Tag>}
            {card.repetitions > 0 && <Tag color="gold">Đã ôn đúng {card.repetitions} lần liên tiếp</Tag>}
          </Space>
          <Title level={4}>{card.content}</Title>

          {card.questionType === 'SINGLE' && (
            <Radio.Group disabled={!!result} value={selected[0]} onChange={(e) => setSelected([e.target.value])}>
              <Space direction="vertical">
                {card.options.map((o) => (
                  <Radio key={o.id} value={o.id}>{o.content}{danhDauDapAn(result, selected, o.id)}</Radio>
                ))}
              </Space>
            </Radio.Group>
          )}

          {card.questionType === 'MULTIPLE' && (
            <Checkbox.Group disabled={!!result} value={selected} onChange={(vals) => setSelected(vals as string[])}>
              <Space direction="vertical">
                {card.options.map((o) => (
                  <Checkbox key={o.id} value={o.id}>{o.content}{danhDauDapAn(result, selected, o.id)}</Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          )}

          {card.questionType === 'ORDERING' && (
            <Space direction="vertical">
              <Text type="secondary">Bấm lần lượt theo đúng thứ tự:</Text>
              <Space wrap>
                {card.options.map((o) => {
                  const pos = selected.indexOf(o.id)
                  return (
                    <Tag
                      key={o.id}
                      style={{ cursor: result ? 'default' : 'pointer', padding: '6px 12px' }}
                      color={pos >= 0 ? 'processing' : undefined}
                      onClick={() => !result && toggleOrdering(o.id)}
                    >
                      {pos >= 0 ? `${pos + 1}. ` : ''}{o.content}{danhDauDapAn(result, selected, o.id)}
                    </Tag>
                  )
                })}
              </Space>
            </Space>
          )}

          {result && (
            <div style={{ marginTop: 16 }}>
              <Tag color={result.isCorrect ? 'success' : 'error'} style={{ marginBottom: 8 }}>
                {result.isCorrect ? 'Chính xác!' : 'Chưa đúng'} — lần ôn tiếp theo sau {result.intervalDays} ngày
              </Tag>
              {!result.isCorrect && (
                <Text style={{ display: 'block', marginBottom: 8 }}>
                  <Text strong style={{ color: '#27AE60' }}>Đáp án đúng: </Text>
                  {card.options.filter((o) => result.correctOptionIds.includes(o.id)).map((o) => o.content).join(', ')}
                </Text>
              )}
              {result.explanation && <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{result.explanation}</Text>}
              <br />
              <Button type="primary" onClick={nextCard}>Câu tiếp theo</Button>
            </div>
          )}

          {!result && (
            <div style={{ marginTop: 16 }}>
              <Button
                type="primary"
                disabled={selected.length === 0}
                loading={answerMutation.isPending}
                onClick={() => answerMutation.mutate(card)}
              >
                Trả lời
              </Button>
            </div>
          )}

          <Progress percent={Math.round((index / cards.length) * 100)} showInfo={false} style={{ marginTop: 20 }} />
        </Card>
      )}
    </div>
  )
}

// Icon thay vì đổi màu chữ qua style — antd tự ép màu chữ xám khi Radio/Checkbox
// bị disabled (sau khi trả lời), đè mất màu inline style.
function danhDauDapAn(result: ReviewAnswerResult | null, daChon: string[], optionId: string) {
  if (!result) return null
  if (result.correctOptionIds.includes(optionId)) {
    return <CheckCircleFilled style={{ color: '#27AE60', marginLeft: 8 }} />
  }
  if (daChon.includes(optionId)) {
    return <CloseCircleFilled style={{ color: '#CF1322', marginLeft: 8 }} />
  }
  return null
}
