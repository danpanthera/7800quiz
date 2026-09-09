import { useState } from 'react'
import { ThunderboltOutlined, RightOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Input, List, Space, Tag, Typography, message } from 'antd'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

const { Title, Text } = Typography

interface ArenaHistoryItem {
  sessionId: string
  sessionName: string
  joinCode: string
  status: 'LOBBY' | 'RUNNING' | 'FINISHED'
  quizTitle: string
  teamName: string
  teamColor: string
  score: number
  rank: number | null
  joinedAt: string
}

export default function ArenaLobbyPage() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')

  const arenaHistoryQuery = useQuery<ArenaHistoryItem[]>({
    queryKey: ['my-arena-history'],
    queryFn: () => api.get('/me/arena-history').then((r) => r.data),
  })

  const liveArena = arenaHistoryQuery.data?.filter((a) => a.status !== 'FINISHED') ?? []
  const pastArena = arenaHistoryQuery.data?.filter((a) => a.status === 'FINISHED') ?? []

  const handleJoinArena = () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 4) {
      message.warning('Nhập mã tham gia do người dẫn cung cấp (6 ký tự)')
      return
    }
    navigate(`/arena/join/${code}`)
  }

  return (
    <div className="page-stack">
      <header className="page-title-row" style={{ marginBottom: 16 }}>
        <div>
          <Text className="page-eyebrow">7800Quiz</Text>
          <Title level={1}><ThunderboltOutlined /> Đấu trường</Title>
        </div>
      </header>

      <Card bordered={false}>
        <div className="dash-arena-join">
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onPressEnter={handleJoinArena}
            placeholder="NHẬP MÃ"
            maxLength={6}
            style={{ width: 160 }}
          />
          <Button type="primary" icon={<RightOutlined />} onClick={handleJoinArena}>
            Tham gia
          </Button>
          <Text type="secondary">Nhập mã 6 ký tự do người dẫn chương trình cung cấp</Text>
        </div>
      </Card>

      {liveArena.length > 0 && (
        <Card title={<Text strong>Đang diễn ra</Text>} bordered={false}>
          <List
            className="dash-arena-list"
            dataSource={liveArena}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button key="join" type="link" onClick={() => navigate(`/arena/join/${item.joinCode}`)}>
                    Vào lại
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Tag color={item.teamColor}>{item.teamName}</Tag>}
                  title={item.sessionName}
                  description={item.quizTitle}
                />
                <Tag color="processing">{item.status === 'LOBBY' ? 'Đang chờ' : 'Đang thi'}</Tag>
              </List.Item>
            )}
          />
        </Card>
      )}

      <Card title={<Text strong>Đã tham gia</Text>} bordered={false}>
        <List
          className="dash-arena-list"
          loading={arenaHistoryQuery.isLoading}
          dataSource={pastArena}
          locale={{ emptyText: 'Chưa tham gia phiên Đấu trường nào' }}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Tag color={item.teamColor}>{item.teamName}</Tag>}
                title={item.sessionName}
                description={`${item.quizTitle} · ${dayjs(item.joinedAt).format('DD/MM/YYYY')}`}
              />
              <Space>
                {item.rank && <Tag color={item.rank === 1 ? 'gold' : 'default'}>Hạng {item.rank}</Tag>}
                <Text strong>{item.score} điểm</Text>
              </Space>
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}
