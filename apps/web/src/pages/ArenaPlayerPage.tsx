import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Card, Input, Space, Spin, Typography, Tag, Avatar, List, Result, Alert,
} from 'antd'
import {
  TrophyOutlined, ThunderboltOutlined, CheckCircleOutlined, ArrowLeftOutlined, BankOutlined, LockOutlined,
  TeamOutlined, MailOutlined,
} from '@ant-design/icons'
import { io, Socket } from 'socket.io-client'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuth } from '../lib/useAuth'
import { playCorrectSound, playWrongSound, playWinSound, fireConfettiBurst } from '../lib/feedback-fx'

const { Title, Text } = Typography
const WS_URL = import.meta.env.VITE_WS_URL ?? window.location.origin
const OPTION_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']

// ─── Types ──────────────────────────────────────────────────────────────────

interface TeamMember { userId: string; fullName: string }
interface ArenaTeam { id: string; name: string; color: string; score: number; rank?: number; members?: TeamMember[] }
interface QuestionOption { id: string; content: string }
interface ArenaQuestion {
  roundId: string
  order: number
  question: { id: string; content: string; questionType: 'SINGLE' | 'MULTIPLE'; options: QuestionOption[] }
  autoAdvanceSec: number
  hostMode: string
}
interface RevealData {
  roundId: string; correctOptionIds: string[]; explanation?: string
  buzzes: { teamId: string; isCorrect: boolean; pointsAwarded: number }[]
  leaderboard: ArenaTeam[]
}
interface XpResult { levelUp: boolean; newLevel: number; newBadges: { code: string; name: string; iconSlug: string }[] }
interface SessionPreview {
  id: string; name: string; joinCode: string; status: string
  requiresPasscode: boolean
  isInviteOnly: boolean
  quiz: { id: string; title: string }
  teams: { id: string; name: string; color: string; score: number }[]
}

type View = 'join' | 'lobby' | 'game' | 'result' | 'kicked'

function RankMedal({ rank }: { rank: number }) {
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
  return <span style={{ fontSize: 20 }}>{medals[rank] ?? '🏅'}</span>
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ArenaPlayerPage() {
  const { joinCode = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [view, setView] = useState<View>('join')
  const [teamName, setTeamName] = useState(user?.fullName ?? '')
  const [passcode, setPasscode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [myTeamColor, setMyTeamColor] = useState<string>('#1565C0')
  const [lobbyTeams, setLobbyTeams] = useState<ArenaTeam[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<ArenaQuestion | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [hasAnswered, setHasAnswered] = useState(false)
  const [revealData, setRevealData] = useState<RevealData | null>(null)
  const [finalRanking, setFinalRanking] = useState<ArenaTeam[]>([])
  const [myXp, setMyXp] = useState<XpResult | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const myTeamIdRef = useRef<string | null>(null)

  const { data: preview, isLoading: previewLoading, isError: previewFailed } = useQuery<SessionPreview>({
    queryKey: ['arena-join-preview', joinCode],
    queryFn: () => api.get(`/arena/join/${joinCode}`).then((r) => r.data),
    retry: false,
  })

  useEffect(() => () => { socketRef.current?.disconnect() }, [])

  const myScore = lobbyTeams.find((t) => t.id === myTeamId)?.score ?? 0
  const myRevealResult = revealData?.buzzes.find((b) => b.teamId === myTeamId)

  const handleJoin = useCallback(() => {
    const name = teamName.trim()
    if (!name) { setJoinError('Nhập tên đội/tên bạn để tham gia'); return }
    if (preview?.requiresPasscode && !passcode.trim()) {
      setJoinError('Phòng này yêu cầu mật khẩu — nhập mật khẩu do MC cung cấp')
      return
    }

    setJoining(true)
    setJoinError('')
    const token = localStorage.getItem('token')
    const socket = io(WS_URL, { auth: { token }, transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect_error', () => {
      setJoining(false)
      setJoinError('Không kết nối được máy chủ, thử lại')
    })

    socket.on('arena.team_joined', ({ team }: { team: ArenaTeam }) => {
      setLobbyTeams((prev) => [...prev.filter((t) => t.id !== team.id), { ...team, score: 0 }])
    })

    socket.on('arena.teams_updated', ({ teams }: { teams: ArenaTeam[] }) => {
      setLobbyTeams(teams)
    })

    socket.on('arena.started', () => setView('game'))

    socket.on('arena.you_were_kicked', () => {
      setView('kicked')
      socket.disconnect()
      socketRef.current = null
    })

    // MC gộp mình vào 1 đội khác — đồng bộ lại tên/màu đội đang hiển thị
    socket.on('arena.you_were_merged', ({ teamId, teamName: newName, teamColor }: { teamId: string; teamName: string; teamColor: string }) => {
      setMyTeamId(teamId)
      myTeamIdRef.current = teamId
      setTeamName(newName)
      setMyTeamColor(teamColor)
    })

    // Đồng đội khác đã trả lời thay cả đội — không để mình treo ở màn hình chọn đáp án
    socket.on('arena.team_answered', () => {
      setHasAnswered(true)
    })

    socket.on('arena.question', (q: ArenaQuestion) => {
      setCurrentQuestion(q)
      setSelected([])
      setHasAnswered(false)
      setRevealData(null)
      setView('game')
    })

    socket.on('arena.revealed', (data: RevealData) => {
      setRevealData(data)
      setLobbyTeams(data.leaderboard)
      const mine = data.buzzes.find((b) => b.teamId === myTeamIdRef.current)
      if (mine) void (mine.isCorrect ? playCorrectSound() : playWrongSound())
    })

    socket.on('arena.leaderboard', ({ teams }: { teams: ArenaTeam[] }) => {
      setLobbyTeams(teams)
    })

    socket.on('arena.ended', ({ ranking, xpResults }: { ranking: ArenaTeam[]; xpResults?: Record<string, XpResult> }) => {
      setFinalRanking(ranking)
      if (user && xpResults?.[user.id]) setMyXp(xpResults[user.id])
      setView('result')
      const mine = ranking.find((t) => t.id === myTeamIdRef.current)
      if (mine?.rank === 1) {
        void playWinSound()
        void fireConfettiBurst()
      }
    })

    socket.emit(
      'arena.join',
      { joinCode, teamName: name, passcode: passcode.trim() || undefined },
      (res: { ok?: boolean; teamId?: string; teamColor?: string; error?: string }) => {
        setJoining(false)
        if (!res?.ok) {
          setJoinError(res?.error ?? 'Tham gia thất bại')
          socket.disconnect()
          socketRef.current = null
          return
        }
        setMyTeamId(res.teamId!)
        myTeamIdRef.current = res.teamId!
        setMyTeamColor(res.teamColor!)
        setView('lobby')
      },
    )
  }, [joinCode, teamName, passcode, preview?.requiresPasscode, user])

  function toggleOption(optionId: string, questionType: 'SINGLE' | 'MULTIPLE') {
    if (hasAnswered) return
    setSelected((prev) => {
      if (questionType === 'SINGLE') return prev[0] === optionId ? [] : [optionId]
      return prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
    })
  }

  function submitAnswer() {
    if (!currentQuestion || selected.length === 0 || !myTeamIdRef.current) return
    setHasAnswered(true)
    socketRef.current?.emit('arena.answer', {
      arenaRoundId: currentQuestion.roundId,
      teamId: myTeamIdRef.current,
      selectedOptionIds: selected,
    })
  }

  // ─── Nội dung theo view ──────────────────────────────────────────────────
  // Gom thành 1 điểm return duy nhất để chỉ vẽ topbar (brand + nút Thoát) một lần,
  // thay vì lặp lại ở mỗi nhánh view như trước.

  let body: React.ReactNode

  if (view === 'join') {
    if (previewLoading) {
      body = <CenterCard key={view}><Spin size="large" /></CenterCard>
    } else if (previewFailed || !preview) {
      body = (
        <CenterCard key={view}>
          <Result status="error" title="Mã tham gia không hợp lệ" subTitle="Kiểm tra lại mã hoặc quét lại mã QR từ MC." />
        </CenterCard>
      )
    } else if (preview.status !== 'LOBBY') {
      body = (
        <CenterCard key={view}>
          <Result
            status="warning"
            title={preview.status === 'RUNNING' ? 'Phiên đấu đã bắt đầu' : 'Phiên đấu đã kết thúc'}
            subTitle="Không thể tham gia lúc này — liên hệ MC nếu cần vào lại."
          />
        </CenterCard>
      )
    } else {
      body = (
        <CenterCard key={view}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <TrophyOutlined style={{ fontSize: 40, color: '#faad14' }} />
            <Title level={3} style={{ margin: '8px 0 0' }}>{preview.name}</Title>
            <Text type="secondary">{preview.quiz.title}</Text>
            {(preview.requiresPasscode || preview.isInviteOnly) && (
              <Space style={{ marginTop: 6 }}>
                {preview.requiresPasscode && <Tag icon={<LockOutlined />} color="gold">Phòng yêu cầu mật khẩu</Tag>}
                {preview.isInviteOnly && <Tag icon={<MailOutlined />} color="purple">Chỉ dành cho người được mời</Tag>}
              </Space>
            )}
          </div>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong>Tên đội / tên bạn</Text>
              <Input
                size="large"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                onPressEnter={handleJoin}
                maxLength={30}
                placeholder="VD: Đội Tín dụng"
              />
            </div>
            {preview.requiresPasscode && (
              <div>
                <Text strong>Mật khẩu phòng</Text>
                <Input.Password
                  size="large"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  onPressEnter={handleJoin}
                  placeholder="MC cung cấp mật khẩu để vào phòng"
                />
              </div>
            )}
            {joinError && <Alert type="error" message={joinError} showIcon />}
            <Button type="primary" size="large" block loading={joining} onClick={handleJoin} icon={<ThunderboltOutlined />}>
              Tham gia ngay
            </Button>
            <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>
              Đã có {preview.teams.length} đội tham gia
            </Text>
          </Space>
        </CenterCard>
      )
    }
  } else if (view === 'lobby') {
    body = (
      <CenterCard key={view}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Spin size="large" />
          <Title level={4} style={{ marginTop: 16 }}>Đã tham gia! Đang chờ MC bắt đầu…</Title>
          <Tag color={myTeamColor} style={{ fontSize: 14, padding: '4px 12px', marginTop: 8 }}>{teamName}</Tag>
        </div>
        <Text strong>Các đội trong phòng ({lobbyTeams.length})</Text>
        <List
          style={{ marginTop: 8 }}
          dataSource={lobbyTeams}
          renderItem={(team) => {
            const members = team.members ?? []
            return (
              <List.Item>
                <Space direction="vertical" size={0} style={{ width: '100%' }}>
                  <Space>
                    <Avatar size="small" style={{ backgroundColor: team.color }}>{team.name[0]?.toUpperCase()}</Avatar>
                    <Text strong={team.id === myTeamId}>{team.name}{team.id === myTeamId ? ' (bạn)' : ''}</Text>
                    {members.length > 1 && <Tag icon={<TeamOutlined />} style={{ marginLeft: 4 }}>{members.length} người</Tag>}
                  </Space>
                  {members.length > 1 && (
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 28 }}>{members.map((m) => m.fullName).join(', ')}</Text>
                  )}
                </Space>
              </List.Item>
            )
          }}
        />
      </CenterCard>
    )
  } else if (view === 'game' && currentQuestion) {
    const isRevealed = !!revealData
    body = (
      <div key={currentQuestion.roundId} className="arena-view-transition" style={{ maxWidth: 560, margin: '0 auto', padding: '16px 12px' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
          <Tag color={myTeamColor}>{teamName}</Tag>
          <Text strong>{myScore} điểm</Text>
        </Space>

        {isRevealed && myRevealResult && (
          <Alert
            style={{ marginBottom: 12 }}
            type={myRevealResult.isCorrect ? 'success' : 'error'}
            showIcon
            message={
              myRevealResult.isCorrect
                ? `Chính xác! +${myRevealResult.pointsAwarded} điểm`
                : myRevealResult.pointsAwarded < 0
                  ? `Sai rồi — ${myRevealResult.pointsAwarded} điểm`
                  : 'Sai rồi'
            }
          />
        )}

        <Card>
          <Text strong style={{ fontSize: 17 }}>{currentQuestion.question.content}</Text>
          <Space direction="vertical" size={10} style={{ width: '100%', marginTop: 18 }}>
            {currentQuestion.question.options.map((opt, idx) => {
              const isSelected = selected.includes(opt.id)
              const isCorrectOpt = revealData?.correctOptionIds.includes(opt.id)
              let bg = OPTION_COLORS[idx % 4]
              if (isRevealed) bg = isCorrectOpt ? '#52c41a' : (isSelected ? '#ff4d4f' : '#bfbfbf')

              return (
                <button
                  key={opt.id}
                  disabled={hasAnswered || isRevealed}
                  onClick={() => toggleOption(opt.id, currentQuestion.question.questionType)}
                  style={{
                    width: '100%', textAlign: 'left', border: isSelected ? '3px solid #0D2045' : '3px solid transparent',
                    background: bg, color: '#fff', borderRadius: 10, padding: '16px 18px',
                    fontSize: 15, fontWeight: 600, cursor: hasAnswered || isRevealed ? 'default' : 'pointer',
                    opacity: hasAnswered && !isSelected && !isRevealed ? 0.5 : 1,
                  }}
                >
                  {String.fromCharCode(65 + idx)}. {opt.content}
                  {isRevealed && isCorrectOpt && <CheckCircleOutlined style={{ marginLeft: 8 }} />}
                </button>
              )
            })}
          </Space>

          {!hasAnswered && !isRevealed && (
            <Button
              type="primary" size="large" block style={{ marginTop: 18 }}
              disabled={selected.length === 0}
              onClick={submitAnswer}
            >
              Gửi đáp án
            </Button>
          )}
          {hasAnswered && !isRevealed && (
            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <Spin /> <Text type="secondary" style={{ marginLeft: 8 }}>Đã gửi — chờ MC công bố kết quả…</Text>
            </div>
          )}
          {isRevealed && (
            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <Text type="secondary">Chờ câu hỏi tiếp theo…</Text>
            </div>
          )}
        </Card>
      </div>
    )
  } else if (view === 'result') {
    const myRank = finalRanking.find((t) => t.id === myTeamId)
    body = (
      <CenterCard key={view}>
        <div style={{ textAlign: 'center' }}>
          <Title level={3}><TrophyOutlined style={{ color: '#faad14' }} /> Kết quả Đấu trường</Title>
          {myRank && (
            <div style={{ margin: '16px 0' }}>
              <RankMedal rank={myRank.rank ?? 99} />
              <div style={{ marginTop: 4 }}>
                <Text strong style={{ fontSize: 18 }}>Hạng {myRank.rank}</Text> — <Text>{myRank.score} điểm</Text>
              </div>
            </div>
          )}
          {myXp && (
            <Alert
              style={{ marginTop: 8, textAlign: 'left' }}
              type={myXp.levelUp ? 'success' : 'info'}
              showIcon
              message={myXp.levelUp ? `🎉 Lên cấp ${myXp.newLevel}!` : 'Đã cộng điểm kinh nghiệm'}
              description={myXp.newBadges.length > 0 ? `Mở khóa huy hiệu: ${myXp.newBadges.map((b) => b.name).join(', ')}` : undefined}
            />
          )}
          <Text strong style={{ display: 'block', marginTop: 20 }}>Bảng xếp hạng chung</Text>
          <List
            style={{ marginTop: 8, textAlign: 'left' }}
            dataSource={finalRanking}
            renderItem={(team) => (
              <List.Item>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Text style={{ minWidth: 24 }}>#{team.rank}</Text>
                    <Avatar size="small" style={{ backgroundColor: team.color }}>{team.name[0]?.toUpperCase()}</Avatar>
                    <Text strong={team.id === myTeamId}>{team.name}</Text>
                  </Space>
                  <Text>{team.score} đ</Text>
                </Space>
              </List.Item>
            )}
          />
          <Button style={{ marginTop: 20 }} icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            Về trang chủ
          </Button>
        </div>
      </CenterCard>
    )
  } else if (view === 'kicked') {
    body = (
      <CenterCard key={view}>
        <Result
          status="warning"
          title="Bạn đã bị mời ra khỏi phòng"
          subTitle="MC đã đưa bạn ra khỏi phiên đấu này. Liên hệ MC nếu đây là nhầm lẫn."
          extra={<Button type="primary" onClick={() => navigate('/')}>Về trang chủ</Button>}
        />
      </CenterCard>
    )
  } else {
    body = <CenterCard key={view}><Spin size="large" /></CenterCard>
  }

  return (
    <div className="arena-player-shell">
      <header className="arena-player-topbar">
        <span className="arena-player-brand"><BankOutlined /> 7800Quiz</span>
        <Button size="small" type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>Thoát</Button>
      </header>
      {body}
    </div>
  )
}

// ─── Layout helper ──────────────────────────────────────────────────────────

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="arena-view-transition" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 420 }}>
        {children}
      </Card>
    </div>
  )
}
