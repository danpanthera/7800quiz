import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Button, Card, Col, Form, InputNumber, Row, Select, Space, Spin, Table, Tag,
  Typography, Divider, Alert, List, Progress, Modal, Input, Radio,
  Statistic, Avatar, Popconfirm, message, Checkbox,
} from 'antd'
import {
  TrophyOutlined, TeamOutlined, PlayCircleOutlined, CheckCircleOutlined,
  ArrowRightOutlined, StopOutlined, CopyOutlined, ReloadOutlined,
  ThunderboltOutlined, DeleteOutlined, LockOutlined, SafetyOutlined, UserDeleteOutlined,
  UsergroupAddOutlined, MailOutlined, PlusOutlined, SwapOutlined,
} from '@ant-design/icons'
import { QRCodeSVG } from 'qrcode.react'
import { io, Socket } from 'socket.io-client'
import { useQuery } from '@tanstack/react-query'
import api, { getErrorMessage } from '../lib/api'

const { Title, Text } = Typography
const WS_URL = import.meta.env.VITE_WS_URL ?? window.location.origin

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember { userId: string; fullName: string }
interface ArenaTeam { id: string; name: string; color: string; score: number; rank?: number; members?: TeamMember[]; isPreset?: boolean }
interface QuestionOption { id: string; content: string }
interface ArenaQuestion {
  roundId: string
  order: number
  question: { id: string; content: string; questionType: string; options: QuestionOption[] }
  autoAdvanceSec: number
  hostMode: string
}
interface BuzzEvent { teamId: string; teamName: string; teamColor: string }
interface RevealData {
  roundId: string; correctOptionIds: string[]; explanation?: string
  buzzes: { teamId: string; isCorrect: boolean; pointsAwarded: number }[]
  leaderboard: ArenaTeam[]
}
interface InvitedUser { id: string; user: { id: string; fullName: string } }
interface ArenaSession {
  id: string; name: string; joinCode: string; status: string
  hostMode: string; autoAdvanceSec: number
  passcode?: string | null
  invites?: InvitedUser[]
  quiz: { id: string; title: string }
  teams: ArenaTeam[]
  rounds: { id: string; order: number }[]
}

type PageView = 'list' | 'create' | 'lobby' | 'game' | 'result'

// ─── Medal helper ─────────────────────────────────────────────────────────────
function RankMedal({ rank }: { rank: number }) {
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
  return <span style={{ fontSize: 20 }}>{medals[rank] ?? '🏅'}</span>
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ArenaPage() {
  const [view, setView] = useState<PageView>('list')
  const [session, setSession] = useState<ArenaSession | null>(null)
  const [teams, setTeams] = useState<ArenaTeam[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<ArenaQuestion | null>(null)
  const [buzzes, setBuzzes] = useState<BuzzEvent[]>([])
  const [revealData, setRevealData] = useState<RevealData | null>(null)
  const [finalRanking, setFinalRanking] = useState<ArenaTeam[]>([])
  const [autoTimer, setAutoTimer] = useState(0)
  const socketRef = useRef<Socket | null>(null)
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Socket helpers ───────────────────────────────────────────────────────

  const connectSocket = useCallback((sessionId: string) => {
    const token = localStorage.getItem('token')
    const socket = io(WS_URL, { auth: { token }, transports: ['websocket'] })
    socketRef.current = socket

    socket.emit('arena.host', { sessionId })

    // Track hostMode inside closure (shared between question + revealed handlers)
    let capturedHostMode = 'MANUAL'

    socket.on('arena.team_joined', ({ team }: { team: ArenaTeam }) => {
      setTeams((prev) => [...prev.filter((t) => t.id !== team.id), { ...team, score: 0 }])
    })

    socket.on('arena.teams_updated', ({ teams: t }: { teams: ArenaTeam[] }) => {
      setTeams(t)
    })

    socket.on('arena.started', () => setView('game'))

    socket.on('arena.question', (q: ArenaQuestion) => {
      capturedHostMode = q.hostMode
      setCurrentQuestion(q)
      setBuzzes([])
      setRevealData(null)
      if (q.hostMode === 'AUTO') {
        setAutoTimer(q.autoAdvanceSec)
        autoTimerRef.current = setInterval(() => {
          setAutoTimer((s) => {
            if (s <= 1) {
              clearInterval(autoTimerRef.current!)
              // Auto-reveal when countdown reaches zero
              socket.emit('arena.reveal', { sessionId })
              return 0
            }
            return s - 1
          })
        }, 1000)
      }
    })

    socket.on('arena.buzz_in', (buzz: BuzzEvent) => {
      setBuzzes((prev) => [...prev, buzz])
    })

    socket.on('arena.revealed', (data: RevealData) => {
      setRevealData(data)
      setTeams(data.leaderboard)
      if (autoTimerRef.current) clearInterval(autoTimerRef.current)
      // AUTO mode: advance to next question after 3s pause (so players can see result)
      if (capturedHostMode === 'AUTO') {
        setTimeout(() => socket.emit('arena.next', { sessionId }), 3000)
      }
    })

    socket.on('arena.leaderboard', ({ teams: t }: { teams: ArenaTeam[] }) => {
      setTeams(t)
    })

    socket.on('arena.ended', ({ ranking }: { ranking: ArenaTeam[] }) => {
      setFinalRanking(ranking)
      setView('result')
    })
  }, [])

  const disconnectSocket = useCallback(() => {
    if (autoTimerRef.current) clearInterval(autoTimerRef.current)
    socketRef.current?.disconnect()
    socketRef.current = null
  }, [])

  useEffect(() => () => disconnectSocket(), [disconnectSocket])

  // ─── Socket emit helpers ──────────────────────────────────────────────────

  function emitStart() { socketRef.current?.emit('arena.start', { sessionId: session!.id }) }
  function emitReveal() { socketRef.current?.emit('arena.reveal', { sessionId: session!.id }) }
  function emitNext() { socketRef.current?.emit('arena.next', { sessionId: session!.id }) }
  function emitKick(teamId: string) { socketRef.current?.emit('arena.kick', { sessionId: session!.id, teamId }) }
  function emitKickMember(teamId: string, userId: string) {
    socketRef.current?.emit('arena.kick_member', { sessionId: session!.id, teamId, userId })
  }
  function emitMoveMember(userId: string, targetTeamId: string) {
    socketRef.current?.emit('arena.move_member', { sessionId: session!.id, userId, targetTeamId })
  }
  function emitMerge(teamIds: string[], teamName?: string) {
    socketRef.current?.emit('arena.merge', { sessionId: session!.id, teamIds, teamName })
  }
  function emitEnd() {
    Modal.confirm({
      title: 'Kết thúc phiên đấu?',
      content: 'Tất cả điểm số sẽ được chốt và hiển thị kết quả cuối.',
      okText: 'Kết thúc',
      okType: 'danger',
      onOk: () => socketRef.current?.emit('arena.end', { sessionId: session!.id }),
    })
  }

  // ─── View router ──────────────────────────────────────────────────────────

  if (view === 'list') return <SessionList onNew={() => setView('create')} onOpen={(s) => { setSession(s); setTeams(s.teams); connectSocket(s.id); setView('lobby') }} />
  if (view === 'create') return <CreateForm onCreated={(s) => { setSession(s); setTeams([]); connectSocket(s.id); setView('lobby') }} onBack={() => setView('list')} />
  if (view === 'lobby') return (
    <Lobby
      session={session!} teams={teams} onStart={emitStart} onKick={emitKick}
      onKickMember={emitKickMember} onMoveMember={emitMoveMember} onMerge={emitMerge}
      onBack={() => { disconnectSocket(); setView('list') }}
    />
  )
  if (view === 'game') return (
    <GameControl
      session={session!} teams={teams} currentQuestion={currentQuestion}
      buzzes={buzzes} revealData={revealData} autoTimer={autoTimer}
      onReveal={emitReveal} onNext={emitNext} onEnd={emitEnd}
    />
  )
  if (view === 'result') return <ResultScreen ranking={finalRanking} onBack={() => { disconnectSocket(); setView('list') }} />
  return null
}

// ─── SessionList ──────────────────────────────────────────────────────────────

function SessionList({ onNew, onOpen }: { onNew: () => void; onOpen: (s: ArenaSession) => void }) {
  const { data, isLoading, refetch } = useQuery<ArenaSession[]>({
    queryKey: ['arena-sessions'],
    queryFn: () => api.get('/admin/arena-sessions').then((r) => r.data),
  })
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const statusColor: Record<string, string> = { LOBBY: 'blue', RUNNING: 'green', FINISHED: 'default' }
  const statusLabel: Record<string, string> = { LOBBY: 'Chờ', RUNNING: 'Đang chạy', FINISHED: 'Kết thúc' }

  async function handleCancel(id: string) {
    try {
      await api.patch(`/admin/arena-sessions/${id}/cancel`)
      message.success('Đã hủy phiên đấu')
      refetch()
    } catch (e) {
      message.error(getErrorMessage(e, 'Hủy thất bại'))
    }
  }

  async function handleStop(id: string) {
    try {
      await api.patch(`/admin/arena-sessions/${id}/stop`)
      message.success('Đã dừng phiên đấu')
      refetch()
    } catch (e) {
      message.error(getErrorMessage(e, 'Dừng thất bại'))
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/admin/arena-sessions/${id}`)
      message.success('Đã xóa phiên đấu')
      refetch()
    } catch (e) {
      message.error(getErrorMessage(e, 'Xóa thất bại'))
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    const ids = selectedKeys as string[]
    const results = await Promise.allSettled(ids.map((id) => api.delete(`/admin/arena-sessions/${id}`)))
    const failed = results.filter((r) => r.status === 'rejected').length
    setBulkDeleting(false)
    setSelectedKeys([])
    if (failed === 0) message.success(`Đã xóa ${ids.length} phiên`)
    else message.warning(`Xóa ${ids.length - failed}/${ids.length} phiên, ${failed} thất bại`)
    refetch()
  }

  const finishedIds = new Set((data ?? []).filter((s) => s.status === 'FINISHED').map((s) => s.id))

  return (
    <Card
      title={<Space><TrophyOutlined style={{ color: '#faad14' }} /><span>Đấu trường</span></Space>}
      extra={<Space><Button icon={<ReloadOutlined />} onClick={() => refetch()} /><Button type="primary" icon={<PlayCircleOutlined />} onClick={onNew}>Tạo phiên mới</Button></Space>}
    >
      {selectedKeys.length > 0 && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text style={{ flex: 1 }}>Đã chọn <Text strong>{selectedKeys.length}</Text> phiên kết thúc</Text>
          <Button size="small" onClick={() => setSelectedKeys([])}>Bỏ chọn</Button>
          <Popconfirm
            title={`Xóa ${selectedKeys.length} phiên đấu?`}
            description="Toàn bộ dữ liệu kết quả sẽ bị xóa vĩnh viễn."
            okText="Xóa tất cả"
            okType="danger"
            cancelText="Quay lại"
            onConfirm={handleBulkDelete}
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={bulkDeleting}>
              Xóa {selectedKeys.length} phiên
            </Button>
          </Popconfirm>
        </div>
      )}
      <Spin spinning={isLoading}>
        <Table
          dataSource={data ?? []}
          rowKey="id"
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: setSelectedKeys,
            getCheckboxProps: (r: ArenaSession) => ({
              disabled: r.status !== 'FINISHED',
              title: r.status !== 'FINISHED' ? 'Chỉ có thể chọn phiên đã kết thúc' : undefined,
            }),
          }}
          columns={[
            { title: 'Tên phiên', dataIndex: 'name', render: (v, r: ArenaSession) => <><Text strong>{v}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.quiz.title}</Text></> },
            {
              title: 'Mã vào', dataIndex: 'joinCode', render: (v, r: ArenaSession) => (
                <Space>
                  <Tag color="purple" style={{ fontFamily: 'monospace', fontSize: 16, letterSpacing: 2 }}>{v}</Tag>
                  {r.passcode && <Tag icon={<LockOutlined />} color="gold">Có mật khẩu</Tag>}
                </Space>
              )
            },
            { title: 'Trạng thái', dataIndex: 'status', render: (v) => <Tag color={statusColor[v]}>{statusLabel[v] ?? v}</Tag> },
            { title: 'Số đội', render: (_: unknown, r: ArenaSession) => r.teams.length },
            {
              title: '', render: (_: unknown, r: ArenaSession) => (
                <Space>
                  <Button type="link" onClick={() => onOpen(r)}>
                    {r.status === 'FINISHED' ? 'Xem kết quả' : 'Vào phòng'}
                  </Button>
                  {r.status === 'LOBBY' && (
                    <Popconfirm
                      title="Hủy phiên đấu?"
                      description="Phiên sẽ bị xóa và các đội đã tham gia sẽ bị mất."
                      okText="Hủy phiên"
                      okType="danger"
                      cancelText="Quay lại"
                      onConfirm={() => handleCancel(r.id)}
                    >
                      <Button type="link" danger>Hủy</Button>
                    </Popconfirm>
                  )}
                  {r.status === 'RUNNING' && (
                    <Popconfirm
                      title="Dừng phiên đấu?"
                      description="Phiên sẽ kết thúc ngay và tổng kết điểm hiện tại."
                      okText="Dừng"
                      okType="danger"
                      cancelText="Quay lại"
                      onConfirm={() => handleStop(r.id)}
                    >
                      <Button type="link" danger icon={<StopOutlined />}>Dừng</Button>
                    </Popconfirm>
                  )}
                  {r.status === 'FINISHED' && (
                    <Popconfirm
                      title="Xóa phiên đấu?"
                      description="Toàn bộ dữ liệu kết quả sẽ bị xóa vĩnh viễn."
                      okText="Xóa"
                      okType="danger"
                      cancelText="Quay lại"
                      onConfirm={() => handleDelete(r.id)}
                    >
                      <Button type="link" danger>Xóa</Button>
                    </Popconfirm>
                  )}
                </Space>
              )
            },
          ]}
        />
      </Spin>
      {finishedIds.size > 0 && selectedKeys.length === 0 && (
        <div style={{ marginTop: 8, textAlign: 'right' }}>
          <Button size="small" type="text" style={{ color: '#aaa', fontSize: 12 }} onClick={() => setSelectedKeys([...finishedIds])}>
            Chọn tất cả phiên kết thúc ({finishedIds.size})
          </Button>
        </div>
      )}
    </Card>
  )
}

// ─── CreateForm ───────────────────────────────────────────────────────────────

function CreateForm({ onCreated, onBack }: { onCreated: (s: ArenaSession) => void; onBack: () => void }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const { data: quizzes } = useQuery<{ id: string; title: string }[]>({
    queryKey: ['quizzes-select'],
    queryFn: () => api.get('/admin/quizzes').then((r) => r.data),
  })
  const { data: users } = useQuery<{ id: string; fullName: string; username: string }[]>({
    queryKey: ['users-select'],
    queryFn: () => api.get('/admin/users').then((r) => r.data),
  })

  async function onFinish(values: Record<string, unknown>) {
    setLoading(true)
    try {
      const passcode = (values.passcode as string | undefined)?.trim()
      const invitedUserIds = values.invitedUserIds as string[] | undefined
      const res = await api.post('/admin/arena-sessions', {
        ...values,
        passcode: passcode || undefined,
        invitedUserIds: invitedUserIds?.length ? invitedUserIds : undefined,
        pointsForRank: (values.pointsForRank as string).split(',').map((v) => parseInt(v.trim())),
      })
      onCreated(res.data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title={<Space><TrophyOutlined /><span>Tạo phiên Đấu trường</span></Space>}
      extra={<Button onClick={onBack}>Quay lại</Button>} style={{ maxWidth: 600, margin: '0 auto' }}>
      <Form form={form} layout="vertical" onFinish={onFinish}
        initialValues={{ hostMode: 'MANUAL', autoAdvanceSec: 15, pointsForRank: '10,7,5,3,2,2,2,2,2', penaltyWrong: 0 }}>
        <Form.Item name="name" label="Tên phiên" rules={[{ required: true }]}>
          <Input placeholder="VD: Đấu trường Tháng 5 — Tín dụng" />
        </Form.Item>
        <Form.Item name="quizId" label="Bộ đề" rules={[{ required: true }]}>
          <Select placeholder="Chọn bộ đề" options={quizzes?.map((q) => ({ value: q.id, label: q.title }))} />
        </Form.Item>
        <Form.Item name="hostMode" label="Chế độ điều khiển">
          <Radio.Group>
            <Radio value="MANUAL">Manual — MC bấm từng bước</Radio>
            <Radio value="AUTO">Auto — Tự động đếm ngược</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="autoAdvanceSec" label="Thời gian trả lời (giây, dùng cho AUTO)">
          <InputNumber min={5} max={120} style={{ width: 120 }} addonAfter="giây" />
        </Form.Item>
        <Form.Item name="pointsForRank" label="Điểm theo thứ tự đúng (9 giá trị, cách nhau dấu phẩy)"
          extra="Rank 1 đến Rank 9, VD: 10,7,5,3,2,2,2,2,2">
          <Input />
        </Form.Item>
        <Form.Item name="penaltyWrong" label="Trừ điểm nếu sai">
          <InputNumber min={0} max={10} style={{ width: 120 }} addonAfter="điểm" />
        </Form.Item>
        <Divider titlePlacement="left" styles={{ content: { margin: 0 } }} style={{ fontSize: 13, color: '#8c8c8c' }}>
          <SafetyOutlined /> Bảo mật phòng (tuỳ chọn)
        </Divider>
        <Form.Item
          name="passcode"
          label="Mật khẩu phòng"
          rules={[
            {
              validator: (_, value: string | undefined) => {
                const v = value?.trim()
                if (!v) return Promise.resolve()
                if (v.length < 4 || v.length > 20) return Promise.reject(new Error('Mật khẩu cần 4-20 ký tự'))
                return Promise.resolve()
              },
            },
          ]}
          extra="Để trống nếu không cần — khi đặt, người quét mã QR/link phải nhập đúng mật khẩu này mới vào được phòng."
        >
          <Input.Password placeholder="Không bắt buộc, VD: 1234" autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="invitedUserIds"
          label={<span><MailOutlined /> Mời cán bộ cụ thể (tuỳ chọn)</span>}
          extra="Để trống thì ai có mã/QR (và đúng mật khẩu nếu có) đều join được. Chọn cán bộ ở đây thì phòng chỉ nhận đúng những người này — người khác dù đúng mã/mật khẩu vẫn bị từ chối."
        >
          <Select
            mode="multiple"
            allowClear
            showSearch
            placeholder="Không bắt buộc — để trống nếu không giới hạn"
            optionFilterProp="label"
            options={users?.map((u) => ({ value: u.id, label: `${u.fullName} (${u.username})` }))}
          />
        </Form.Item>
        <Divider titlePlacement="left" styles={{ content: { margin: 0 } }} style={{ fontSize: 13, color: '#8c8c8c' }}>
          <TeamOutlined /> Đội đặt trước (tuỳ chọn, tối đa 8 đội)
        </Divider>
        <Form.List name="presetTeamNames">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => (
                <Form.Item key={field.key} style={{ marginBottom: 8 }}>
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item {...field} noStyle rules={[{ required: true, message: 'Nhập tên đội' }]}>
                      <Input placeholder="VD: Đội Tín dụng" maxLength={30} />
                    </Form.Item>
                    <Button icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                  </Space.Compact>
                </Form.Item>
              ))}
              {fields.length < 8 && (
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>Thêm đội</Button>
              )}
            </>
          )}
        </Form.List>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4, marginBottom: 16 }}>
          Đặt tên trước thì người chơi bắt buộc chọn 1 trong các đội này khi vào phòng (không tự gõ tên đội nữa), mỗi đội tối đa 5 người. MC có thể chuyển/đá từng người giữa các đội trong sảnh chờ.
        </Text>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} icon={<PlayCircleOutlined />} block>
            Tạo phiên & vào Lobby
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

function Lobby({ session, teams, onStart, onKick, onKickMember, onMoveMember, onMerge, onBack }: {
  session: ArenaSession; teams: ArenaTeam[]; onStart: () => void; onKick: (teamId: string) => void
  onKickMember: (teamId: string, userId: string) => void
  onMoveMember: (userId: string, targetTeamId: string) => void
  onMerge: (teamIds: string[], teamName?: string) => void; onBack: () => void
}) {
  const joinUrl = `${window.location.origin}/arena/join/${session.joinCode}`
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [mergeName, setMergeName] = useState('')

  function copyCode() {
    navigator.clipboard.writeText(session.joinCode)
  }

  function toggleSelect(teamId: string) {
    setSelectedIds((prev) => prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId])
  }

  const selectedTeams = teams.filter((t) => selectedIds.includes(t.id))
  const selectedMemberCount = selectedTeams.reduce((sum, t) => sum + (t.members?.length ?? 1), 0)
  const canMerge = selectedIds.length >= 2 && selectedMemberCount >= 2 && selectedMemberCount <= 5
  const hasNonPresetTeams = teams.some((t) => !t.isPreset)
  const teamsWithMembersCount = teams.filter((t) => (t.members?.length ?? 0) > 0).length

  function openMergeModal() {
    setMergeName('')
    setMergeModalOpen(true)
  }

  function confirmMerge() {
    onMerge(selectedIds, mergeName.trim() || undefined)
    setMergeModalOpen(false)
    setSelectedIds([])
  }

  const joinedUserIds = new Set(teams.flatMap((t) => (t.members ?? []).map((m) => m.userId)))
  const invites = session.invites ?? []

  return (
    <Row gutter={24}>
      <Col span={10}>
        <Card title="Mã tham gia">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 8, color: '#722ed1', marginBottom: 16 }}>
              {session.joinCode}
            </div>
            <QRCodeSVG value={joinUrl} size={180} />
            <div style={{ marginTop: 12 }}>
              <Button icon={<CopyOutlined />} onClick={copyCode} size="small">Sao chép mã</Button>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>{joinUrl}</Text>
          </div>
          <Divider />
          {session.passcode ? (
            <>
              <Space align="center" style={{ marginBottom: 4 }}>
                <LockOutlined style={{ color: '#faad14' }} />
                <Text strong>Mật khẩu phòng (đọc cho người chơi)</Text>
              </Space>
              <div style={{ textAlign: 'center', margin: '4px 0 12px' }}>
                <Text style={{ fontSize: 22, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 4 }}>
                  {session.passcode}
                </Text>
                <Button
                  size="small" type="text" icon={<CopyOutlined />}
                  onClick={() => navigator.clipboard.writeText(session.passcode!)}
                  style={{ marginLeft: 8 }}
                />
              </div>
            </>
          ) : (
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Không đặt mật khẩu — ai có mã/QR đều tham gia được.
            </Text>
          )}
          <Text type="secondary">{session.quiz.title}</Text><br />
          <Text type="secondary">Chế độ: <Tag>{session.hostMode}</Tag></Text><br />
          <Text type="secondary">{session.rounds?.length ?? 0} câu hỏi</Text>
        </Card>

        {invites.length > 0 && (
          <Card
            style={{ marginTop: 16 }}
            title={
              <Space>
                <MailOutlined style={{ color: '#faad14' }} />
                <span>Danh sách được mời ({invites.filter((i) => joinedUserIds.has(i.user.id)).length}/{invites.length} đã vào)</span>
              </Space>
            }
          >
            <List
              size="small"
              dataSource={invites}
              renderItem={(invite) => {
                const joined = joinedUserIds.has(invite.user.id)
                return (
                  <List.Item>
                    <Space>
                      {joined ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <Spin size="small" />}
                      <Text type={joined ? undefined : 'secondary'}>{invite.user.fullName}</Text>
                    </Space>
                    {!joined && <Text type="secondary" style={{ fontSize: 12 }}>Chưa vào</Text>}
                  </List.Item>
                )
              }}
            />
          </Card>
        )}
      </Col>
      <Col span={14}>
        <Card
          title={<Space><TeamOutlined /><span>Đội tham gia ({teams.length}/9)</span></Space>}
          extra={
            <Space>
              <Button onClick={onBack}>Quay lại</Button>
              <Button type="primary" icon={<PlayCircleOutlined />} disabled={teamsWithMembersCount < 2} onClick={onStart}>
                Bắt đầu ({teamsWithMembersCount} đội)
              </Button>
            </Space>
          }
        >
          {hasNonPresetTeams && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fafafa', border: '1px solid #eee', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Text type="secondary" style={{ flex: 1, fontSize: 13 }}>
                {selectedIds.length === 0
                  ? 'Chọn 2-5 người chơi (đội tự phát sinh) để gộp thành 1 đội chung điểm số'
                  : `Đã chọn ${selectedIds.length} mục — ${selectedMemberCount} người${selectedMemberCount > 5 ? ' (vượt quá 5, bỏ bớt)' : ''}`}
              </Text>
              {selectedIds.length > 0 && <Button size="small" onClick={() => setSelectedIds([])}>Bỏ chọn</Button>}
              <Button size="small" type="primary" icon={<UsergroupAddOutlined />} disabled={!canMerge} onClick={openMergeModal}>
                Gộp thành 1 đội
              </Button>
            </div>
          )}
          {teams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">Đang chờ các đội tham gia…</Text>
              </div>
            </div>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {teams.map((team) => {
                const members = team.members ?? []
                const isFull = members.length >= 5
                const otherTeamOptions = teams
                  .filter((t) => t.id !== team.id)
                  .map((t) => ({
                    value: t.id,
                    label: `${t.name} (${(t.members?.length ?? 0)}/5)`,
                    disabled: (t.members?.length ?? 0) >= 5,
                  }))
                return (
                  <Card key={team.id} size="small" styles={{ body: { padding: '10px 14px' } }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                      <Space>
                        {!team.isPreset && (
                          <Checkbox
                            checked={selectedIds.includes(team.id)}
                            onChange={() => toggleSelect(team.id)}
                          />
                        )}
                        <Avatar size="small" style={{ backgroundColor: team.color }}>{team.name[0].toUpperCase()}</Avatar>
                        <Text strong>{team.name}</Text>
                        <Tag color={isFull ? 'red' : undefined}>{members.length}/5</Tag>
                        {team.isPreset && <Tag color="blue">Đặt trước</Tag>}
                      </Space>
                      <Popconfirm
                        title={team.isPreset ? 'Gỡ hết người khỏi đội này?' : 'Mời cả đội ra khỏi phòng?'}
                        description={team.isPreset ? 'Đội vẫn giữ chỗ cho người khác vào sau.' : `Đội "${team.name}" sẽ bị ngắt khỏi phòng ngay lập tức.`}
                        okText="Xác nhận"
                        okType="danger"
                        cancelText="Bỏ qua"
                        onConfirm={() => onKick(team.id)}
                        disabled={members.length === 0}
                      >
                        <Button size="small" danger type="text" icon={<UserDeleteOutlined />} disabled={members.length === 0}>
                          Đá cả đội
                        </Button>
                      </Popconfirm>
                    </Space>
                    {members.length === 0 ? (
                      <Text type="secondary" style={{ fontSize: 12, marginLeft: 28 }}>Chưa có ai</Text>
                    ) : (
                      <div style={{ marginTop: 6, marginLeft: 28 }}>
                        {members.map((m) => (
                          <div key={m.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
                            <Text style={{ fontSize: 13 }}>{m.fullName}</Text>
                            <Space size={4}>
                              {teams.length > 1 && (
                                <Select
                                  size="small" style={{ width: 160 }} placeholder="Chuyển đội"
                                  suffixIcon={<SwapOutlined />}
                                  options={otherTeamOptions}
                                  onChange={(targetTeamId: string) => onMoveMember(m.userId, targetTeamId)}
                                />
                              )}
                              <Popconfirm
                                title="Gỡ người chơi này khỏi đội?"
                                okText="Gỡ ra" okType="danger" cancelText="Bỏ qua"
                                onConfirm={() => onKickMember(team.id, m.userId)}
                              >
                                <Button size="small" danger type="text" icon={<UserDeleteOutlined />} />
                              </Popconfirm>
                            </Space>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })}
            </Space>
          )}
        </Card>
      </Col>

      <Modal
        title="Gộp thành 1 đội"
        open={mergeModalOpen}
        onOk={confirmMerge}
        onCancel={() => setMergeModalOpen(false)}
        okText="Gộp đội"
        cancelText="Hủy"
      >
        <Text type="secondary">
          Gộp {selectedMemberCount} người ({selectedTeams.map((t) => t.name).join(', ')}) thành 1 đội chung điểm số.
        </Text>
        <Input
          style={{ marginTop: 12 }}
          placeholder="Tên đội mới (để trống thì giữ tên đội vào phòng sớm nhất)"
          value={mergeName}
          onChange={(e) => setMergeName(e.target.value)}
          maxLength={30}
        />
      </Modal>
    </Row>
  )
}

// ─── GameControl ──────────────────────────────────────────────────────────────

function GameControl({ session, teams, currentQuestion, buzzes, revealData, autoTimer, onReveal, onNext, onEnd }: {
  session: ArenaSession; teams: ArenaTeam[]; currentQuestion: ArenaQuestion | null
  buzzes: BuzzEvent[]; revealData: RevealData | null; autoTimer: number
  onReveal: () => void; onNext: () => void; onEnd: () => void
}) {
  const isManual = session.hostMode === 'MANUAL'
  const totalRounds = session.rounds?.length ?? 0
  const currentOrder = currentQuestion?.order ?? 0
  const isRevealed = !!revealData

  return (
    <Row gutter={16}>
      {/* Left: Question panel */}
      <Col span={16}>
        <Card
          title={
            <Space>
              <Text strong>Câu {(currentOrder) + 1}/{totalRounds}</Text>
              {!isManual && currentQuestion && !isRevealed && (
                <Progress
                  type="circle" size={36} strokeColor={autoTimer <= 3 ? 'red' : '#1890ff'}
                  percent={Math.round((autoTimer / currentQuestion.autoAdvanceSec) * 100)}
                  format={() => `${autoTimer}s`}
                />
              )}
            </Space>
          }
          extra={
            <Space>
              {isManual && !isRevealed && currentQuestion && (
                <Button type="primary" icon={<CheckCircleOutlined />} onClick={onReveal}>Reveal đáp án</Button>
              )}
              {isRevealed && (
                <Button type="primary" icon={<ArrowRightOutlined />} onClick={onNext}>Câu tiếp theo</Button>
              )}
              <Button danger icon={<StopOutlined />} onClick={onEnd}>Kết thúc</Button>
            </Space>
          }
        >
          {!currentQuestion ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : (
            <>
              <Text style={{ fontSize: 18 }}>{currentQuestion.question.content}</Text>
              <Row gutter={[12, 12]} style={{ marginTop: 20 }}>
                {currentQuestion.question.options.map((opt, idx) => {
                  const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']
                  const isCorrect = revealData?.correctOptionIds.includes(opt.id)
                  return (
                    <Col span={12} key={opt.id}>
                      <div style={{
                        background: isRevealed ? (isCorrect ? '#52c41a' : '#ff4d4f') : colors[idx % 4],
                        color: '#fff', borderRadius: 8, padding: '12px 16px', fontSize: 15, fontWeight: 500,
                        border: isCorrect ? '3px solid #fff' : 'none',
                      }}>
                        {String.fromCharCode(65 + idx)}. {opt.content}
                        {isCorrect && <CheckCircleOutlined style={{ marginLeft: 8 }} />}
                      </div>
                    </Col>
                  )
                })}
              </Row>
              {isRevealed && revealData.explanation && (
                <Alert style={{ marginTop: 16 }} type="info" message={`💡 ${revealData.explanation}`} />
              )}
            </>
          )}
        </Card>

        {/* Buzz tracker */}
        <Card style={{ marginTop: 16 }} title={<Space><ThunderboltOutlined style={{ color: '#faad14' }} /><span>Đội đã trả lời ({buzzes.length})</span></Space>}>
          {buzzes.length === 0 ? (
            <Text type="secondary">Chưa có đội nào trả lời…</Text>
          ) : (
            <Space wrap>
              {buzzes.map((b, i) => (
                <Tag key={i} color={b.teamColor} style={{ padding: '4px 12px', fontSize: 14 }}>
                  #{i + 1} {b.teamName}
                  {isRevealed && revealData && (
                    <span style={{ marginLeft: 6 }}>
                      {revealData.buzzes.find((rb) => rb.teamId === b.teamId)?.isCorrect ? '✅' : '❌'}
                    </span>
                  )}
                </Tag>
              ))}
            </Space>
          )}
        </Card>
      </Col>

      {/* Right: Leaderboard */}
      <Col span={8}>
        <Card title={<Space><TrophyOutlined style={{ color: '#faad14' }} /><span>Bảng điểm</span></Space>}>
          <List
            dataSource={[...teams].sort((a, b) => b.score - a.score)}
            renderItem={(team, idx) => (
              <List.Item style={{ padding: '8px 0' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Text style={{ minWidth: 20 }}>#{idx + 1}</Text>
                    <Avatar size="small" style={{ backgroundColor: team.color }}>{team.name[0]}</Avatar>
                    <Text>{team.name}</Text>
                  </Space>
                  <Statistic value={team.score} suffix="đ" valueStyle={{ fontSize: 16, color: idx === 0 ? '#faad14' : undefined }} />
                </Space>
              </List.Item>
            )}
          />
        </Card>
      </Col>
    </Row>
  )
}

// ─── ResultScreen ─────────────────────────────────────────────────────────────

function ResultScreen({ ranking, onBack }: { ranking: ArenaTeam[]; onBack: () => void }) {
  const podium = ranking.slice(0, 3)
  const encouragement = ranking.slice(3)

  return (
    <Card
      title={<Space><TrophyOutlined style={{ color: '#faad14', fontSize: 20 }} /><Title level={4} style={{ margin: 0 }}>Kết quả Đấu trường</Title></Space>}
      extra={<Button onClick={onBack}>Về trang chủ</Button>}
    >
      {/* Podium */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={3}>🏆 Bảng xếp hạng</Title>
        <Row justify="center" gutter={24} align="bottom" style={{ marginTop: 24 }}>
          {/* 2nd */}
          {podium[1] && (
            <Col>
              <div style={{ textAlign: 'center' }}>
                <RankMedal rank={2} />
                <div style={{ background: podium[1].color, color: '#fff', borderRadius: 8, padding: '12px 24px', marginTop: 8, minWidth: 120, height: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Text strong style={{ color: '#fff', fontSize: 16 }}>{podium[1].name}</Text><br />
                  <Text style={{ color: '#fff' }}>{podium[1].score} điểm</Text>
                </div>
              </div>
            </Col>
          )}
          {/* 1st */}
          {podium[0] && (
            <Col>
              <div style={{ textAlign: 'center' }}>
                <RankMedal rank={1} />
                <div style={{ background: podium[0].color, color: '#fff', borderRadius: 8, padding: '16px 32px', marginTop: 8, minWidth: 140, height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                  <Text strong style={{ color: '#fff', fontSize: 18 }}>{podium[0].name}</Text><br />
                  <Text style={{ color: '#fff', fontSize: 16 }}>{podium[0].score} điểm</Text>
                </div>
              </div>
            </Col>
          )}
          {/* 3rd */}
          {podium[2] && (
            <Col>
              <div style={{ textAlign: 'center' }}>
                <RankMedal rank={3} />
                <div style={{ background: podium[2].color, color: '#fff', borderRadius: 8, padding: '10px 20px', marginTop: 8, minWidth: 110, height: 70, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Text strong style={{ color: '#fff', fontSize: 15 }}>{podium[2].name}</Text><br />
                  <Text style={{ color: '#fff' }}>{podium[2].score} điểm</Text>
                </div>
              </div>
            </Col>
          )}
        </Row>
      </div>

      {/* Encouragement */}
      {encouragement.length > 0 && (
        <>
          <Divider>🏅 Khuyến khích</Divider>
          <Row gutter={[16, 16]} justify="center">
            {encouragement.map((team) => (
              <Col key={team.id}>
                <Tag color={team.color} style={{ padding: '6px 14px', fontSize: 14 }}>
                  #{team.rank} {team.name} — {team.score} điểm
                </Tag>
              </Col>
            ))}
          </Row>
        </>
      )}
    </Card>
  )
}
