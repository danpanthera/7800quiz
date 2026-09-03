import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Tag, Typography, Badge, Button, Space, Popconfirm, message,
  Modal, Form, Input, InputNumber, Switch, Drawer, Select, theme,
  Card, Grid, List, Tooltip,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ThunderboltOutlined, MinusCircleOutlined } from '@ant-design/icons'
import api from '../lib/api'

interface Quiz {
  id: string; title: string; description?: string; topic?: string
  durationMin: number; passScore?: number; isActive: boolean
  _count: { questions: number; assignments: number }
}
interface Subject { id: string; name: string }
interface QuestionOption { content: string; isCorrect: boolean }
interface Question { id: string; content: string; questionType: string; points: number; options: QuestionOption[]; subject?: { name: string } }

export default function QuizzesPage() {
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  const isCompactView = screens.md !== true
  const qc = useQueryClient()
  const [quizModalOpen, setQuizModalOpen] = useState(false)
  const [editQuiz, setEditQuiz] = useState<Quiz | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [detailQuiz, setDetailQuiz] = useState<Quiz | null>(null)
  const [pickModalOpen, setPickModalOpen] = useState(false)
  const [pickTarget, setPickTarget] = useState<Quiz | null>(null)
  const [quizForm] = Form.useForm()
  const [pickForm] = Form.useForm()

  // ── Resizable drawer ──────────────────────────────────────────────────
  const [drawerWidth, setDrawerWidth] = useState(640)
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    isResizing.current = true
    startX.current = e.clientX
    startW.current = drawerWidth
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return
      const delta = startX.current - ev.clientX
      setDrawerWidth(Math.max(360, Math.min(window.innerWidth - 100, startW.current + delta)))
    }
    const onUp = () => { isResizing.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [drawerWidth])

  // ── Queries ───────────────────────────────────────────────────────────
  const { data: quizzes = [], isLoading } = useQuery<Quiz[]>({
    queryKey: ['quizzes'],
    queryFn: () => api.get('/admin/quizzes').then((r) => r.data),
  })

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: () => api.get('/admin/subjects').then((r) => r.data),
  })

  const { data: quizDetail } = useQuery<{ questions: Question[] }>({
    queryKey: ['quiz-detail', detailQuiz?.id],
    queryFn: () => api.get(`/admin/quizzes/${detailQuiz!.id}`).then((r) => r.data),
    enabled: !!detailQuiz,
  })

  // ── Mutations ─────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/admin/quizzes', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quizzes'] }); setQuizModalOpen(false); quizForm.resetFields() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/admin/quizzes/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quizzes'] }); setQuizModalOpen(false); setEditQuiz(null); quizForm.resetFields() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/quizzes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quizzes'] }); message.success('Đã xóa bộ đề') },
    onError: (e: any) => message.error(e.response?.data?.message ?? 'Lỗi khi xóa bộ đề'),
  })

  const pickMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.post(`/admin/quizzes/${id}/pick-random`, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quizzes'] })
      qc.invalidateQueries({ queryKey: ['quiz-detail', pickTarget?.id] })
      message.success(`Đã thêm ${res.data.added} câu hỏi vào bộ đề`)
      setPickModalOpen(false); pickForm.resetFields()
    },
    onError: (e: any) => message.error(e.response?.data?.message ?? 'Lỗi'),
  })

  // ── Handlers ─────────────────────────────────────────────────────────
  const openNew = () => { setEditQuiz(null); quizForm.resetFields(); quizForm.setFieldsValue({ durationMin: 30, passScore: 70, isActive: true }); setQuizModalOpen(true) }
  const openEdit = (q: Quiz) => { setEditQuiz(q); quizForm.setFieldsValue(q); setQuizModalOpen(true) }
  const openDetail = (q: Quiz) => { setDetailQuiz(q); setDetailDrawerOpen(true) }
  const openPick = (q: Quiz) => {
    setPickTarget(q)
    setPickModalOpen(true)
  }

  // Sync form values when pickTarget changes (Modal key causes remount, but initialValues uses stale closure)
  useEffect(() => {
    if (pickTarget && pickModalOpen) {
      pickForm.setFieldsValue({
        subjectSlots: [{ subjectId: undefined, count: pickTarget._count.questions || 10 }],
        replaceAll: false,
      })
    }
  }, [pickTarget, pickModalOpen])

  const handleQuizSubmit = (values: any) => {
    if (editQuiz) updateMutation.mutate({ id: editQuiz.id, ...values })
    else createMutation.mutate(values)
  }

  const handlePick = (values: any) => {
    pickMutation.mutate({ id: pickTarget!.id, subjectSlots: values.subjectSlots, replaceAll: values.replaceAll })
  }

  const renderQuizActions = (quiz: Quiz) => (
    <Space size={6}>
      <Tooltip title="Xem câu hỏi">
        <Button aria-label={`Xem câu hỏi của ${quiz.title}`} icon={<EyeOutlined />} size="small" onClick={() => openDetail(quiz)} />
      </Tooltip>
      <Tooltip title="Lấy câu ngẫu nhiên">
        <Button aria-label={`Lấy câu ngẫu nhiên cho ${quiz.title}`} icon={<ThunderboltOutlined />} size="small" onClick={() => openPick(quiz)} />
      </Tooltip>
      <Tooltip title="Sửa bộ đề">
        <Button aria-label={`Sửa ${quiz.title}`} icon={<EditOutlined />} size="small" onClick={() => openEdit(quiz)} />
      </Tooltip>
      <Popconfirm title="Xóa bộ đề?" onConfirm={() => deleteMutation.mutate(quiz.id)}>
        <Tooltip title="Xóa bộ đề">
          <Button aria-label={`Xóa ${quiz.title}`} icon={<DeleteOutlined />} size="small" danger />
        </Tooltip>
      </Popconfirm>
    </Space>
  )

  // ── Columns ───────────────────────────────────────────────────────────
  const columns = [
    { title: 'Tên bộ đề', dataIndex: 'title', ellipsis: true },
    { title: 'Chuyên đề', dataIndex: 'topic', width: 160, render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : '-' },
    { title: 'Thời gian', dataIndex: 'durationMin', width: 100, render: (v: number) => `${v} phút` },
    { title: 'Câu hỏi', dataIndex: ['_count', 'questions'], width: 80 },
    { title: 'Phân công', dataIndex: ['_count', 'assignments'], width: 90 },
    {
      title: 'Trạng thái', dataIndex: 'isActive', width: 110,
      render: (v: boolean) => <Badge status={v ? 'success' : 'default'} text={v ? 'Hoạt động' : 'Tắt'} />,
    },
    {
      title: '', width: 160,
      render: (_: any, quiz: Quiz) => renderQuizActions(quiz),
    },
  ]

  return (
    <>
      <div className="management-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>Quản lý bộ đề</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>Tạo bộ đề</Button>
      </div>
      {isCompactView ? (
        <List
          className="manage-card-list"
          loading={isLoading}
          dataSource={quizzes}
          renderItem={(quiz) => (
            <List.Item>
              <Card className="manage-record-card" bordered={false}>
                <div className="manage-record-heading">
                  <div>
                    <Typography.Title level={5}>{quiz.title}</Typography.Title>
                    {quiz.topic && <Tag color="geekblue">{quiz.topic}</Tag>}
                  </div>
                  <Badge status={quiz.isActive ? 'success' : 'default'} text={quiz.isActive ? 'Hoạt động' : 'Tắt'} />
                </div>
                <dl className="manage-record-meta">
                  <div><dt>Thời gian</dt><dd>{quiz.durationMin} phút</dd></div>
                  <div><dt>Câu hỏi</dt><dd>{quiz._count.questions}</dd></div>
                  <div><dt>Phân công</dt><dd>{quiz._count.assignments}</dd></div>
                </dl>
                <div className="manage-record-actions">{renderQuizActions(quiz)}</div>
              </Card>
            </List.Item>
          )}
        />
      ) : (
        <Table rowKey="id" loading={isLoading} dataSource={quizzes} columns={columns} size="small" />
      )}

      {/* Modal: Create / Edit Quiz */}
      <Modal
        title={editQuiz ? 'Sửa bộ đề' : 'Tạo bộ đề mới'}
        open={quizModalOpen}
        onCancel={() => { setQuizModalOpen(false); setEditQuiz(null); quizForm.resetFields() }}
        onOk={() => quizForm.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={540}
      >
        <Form form={quizForm} layout="vertical" onFinish={handleQuizSubmit}>
          <Form.Item name="title" label="Tên bộ đề" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="topic" label="Chuyên đề">
            <Input placeholder="VD: Nghiệp vụ tín dụng cơ bản" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space size={16}>
            <Form.Item name="durationMin" label="Thời gian (phút)" rules={[{ required: true }]}>
              <InputNumber min={1} max={300} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="passScore" label="Điểm đạt (%)">
              <InputNumber min={0} max={100} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="isActive" label="Hoạt động" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* Drawer: Quiz detail (danh sách câu hỏi) */}
      <Drawer
        title={`Câu hỏi trong bộ đề: ${detailQuiz?.title ?? ''}`}
        open={detailDrawerOpen}
        onClose={() => { setDetailDrawerOpen(false); setDetailQuiz(null) }}
        extra={
          <Button icon={<ThunderboltOutlined />} type="primary" onClick={() => { setDetailDrawerOpen(false); openPick(detailQuiz!) }}>
            Lấy câu ngẫu nhiên
          </Button>
        }
        styles={{ wrapper: { width: isCompactView ? '100%' : drawerWidth, transition: isResizing.current ? 'none' : undefined } }}
      >
        {/* Resize handle */}
        {!isCompactView && (
          <div
            onMouseDown={onResizeStart}
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 5,
              cursor: 'col-resize', zIndex: 10,
              background: 'transparent',
            }}
            title="Kéo để thay đổi độ rộng"
          />
        )}
        {quizDetail?.questions?.length === 0 && (
          <Typography.Text type="secondary">Chưa có câu hỏi nào. Dùng nút "Lấy câu ngẫu nhiên" để thêm từ ngân hàng.</Typography.Text>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {(quizDetail?.questions ?? []).map((q, idx) => (
            <div
              key={q.id}
              style={{
                padding: '12px 0',
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Typography.Text strong>{idx + 1}. {q.content}</Typography.Text>
              <div style={{ marginTop: 6 }}>
                <Space size={4} wrap>
                  {q.subject && <Tag color="cyan">{q.subject.name}</Tag>}
                  <Tag color={q.questionType === 'SINGLE' ? 'blue' : 'purple'}>
                    {q.questionType === 'SINGLE' ? 'Chọn 1' : 'Chọn nhiều'}
                  </Tag>
                  {q.options.map((o, i) => (
                    <Tag key={i} color={o.isCorrect ? 'green' : 'default'}>{o.content}</Tag>
                  ))}
                </Space>
              </div>
            </div>
          ))}
        </div>
      </Drawer>

      {/* Modal: Pick random */}
      <Modal
        key={pickTarget?.id ?? 'pick'}
        title={`Lấy câu hỏi ngẫu nhiên → ${pickTarget?.title ?? ''}`}
        open={pickModalOpen}
        onCancel={() => { setPickModalOpen(false); pickForm.resetFields() }}
        onOk={() => pickForm.submit()}
        confirmLoading={pickMutation.isPending}
        okText="Lấy ngẫu nhiên"
        width={560}
      >
        <Form form={pickForm} layout="vertical" onFinish={handlePick}
          initialValues={{ subjectSlots: [{ count: 10 }], replaceAll: false }}
        >
          <Form.Item label={
            <span>
              Lĩnh vực &amp; số câu cần lấy
              {pickTarget && (
                <Typography.Text type="secondary" style={{ marginLeft: 8, fontWeight: 'normal', fontSize: 12 }}>
                  (hiện có {pickTarget._count.questions} câu)
                </Typography.Text>
              )}
            </span>
          }>
            <Form.List
              name="subjectSlots"
              rules={[{
                validator: async (_, slots) => {
                  if (!slots || slots.length === 0) return Promise.reject('Thêm ít nhất 1 dòng')
                  const total = (slots as any[]).reduce((s: number, r: any) => s + (r?.count || 0), 0)
                  if (total <= 0) return Promise.reject('Tổng số câu phải lớn hơn 0')
                },
              }]}
            >
              {(fields, { add, remove }, { errors }) => (
                <>
                  {fields.map(({ key, name }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item name={[name, 'subjectId']} noStyle>
                        <Select
                          allowClear
                          placeholder="Tất cả lĩnh vực"
                          style={{ width: 220 }}
                          options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                        />
                      </Form.Item>
                      <Form.Item name={[name, 'count']} noStyle rules={[{ required: true, message: 'Nhập số câu' }]}>
                        <InputNumber min={1} max={500} placeholder="Số câu" style={{ width: 90 }} />
                      </Form.Item>
                      {fields.length > 1 && (
                        <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f', cursor: 'pointer' }} />
                      )}
                    </Space>
                  ))}
                  <Form.ErrorList errors={errors} />
                  <Button
                    type="dashed"
                    onClick={() => add({ subjectId: undefined, count: 1 })}
                    icon={<PlusOutlined />}
                    size="small"
                  >
                    Thêm lĩnh vực
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
          <Form.Item name="replaceAll" label="Thay thế toàn bộ câu hỏi hiện tại" valuePropName="checked">
            <Switch />
          </Form.Item>
          {/* Tóm tắt kết quả dự kiến */}
          <Form.Item shouldUpdate noStyle>
            {() => {
              const slots = pickForm.getFieldValue('subjectSlots') ?? []
              const total = (slots as any[]).reduce((s: number, r: any) => s + (r?.count || 0), 0)
              const replaceAll = pickForm.getFieldValue('replaceAll')
              const current = pickTarget?._count.questions ?? 0
              const after = replaceAll ? total : current + total
              if (total <= 0) return null
              return (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Sẽ lấy <strong>{total}</strong> câu ngẫu nhiên &nbsp;→&nbsp;
                  bộ đề sẽ có <strong>{after}</strong> câu
                  {!replaceAll && current > 0 && ` (${current} hiện tại + ${total} mới)`}
                </Typography.Text>
              )
            }}
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

