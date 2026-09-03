import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Layout, Menu, Button, Table, Space, Tag, Popconfirm, message,
  Modal, Form, Input, Select, Upload, Typography, Divider, Tooltip,
  Drawer, Radio, Checkbox, Alert, Badge, theme,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  UploadOutlined, InboxOutlined, WarningOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
import type { ColumnType } from 'antd/es/table'
import api from '../lib/api'

const { Sider, Content } = Layout
const { Title, Text } = Typography

interface Subject { id: string; name: string; description?: string; _count?: { questions: number } }
interface QuestionOption { id?: string; content: string; isCorrect: boolean; orderIndex: number }
interface Question {
  id: string; content: string; imageUrl?: string; explanation?: string
  questionType: 'SINGLE' | 'MULTIPLE' | 'ORDERING'
  points: number; subjectId?: string
  options: QuestionOption[]
  subject?: { id: string; name: string }
}

interface DupMatch { id: string; content: string; score: number; level: 'exact' | 'high' | 'medium' }
interface DupResult { index: number; text: string; matches: DupMatch[] }
interface SpellWarning { word: string; suggestions: string[] }
interface SpellResult { rowIndex: number; warnings: SpellWarning[] }

interface PreviewRow {
  rowNumber: number
  content: string
  optionTexts: (string | null)[]
  correctIndex: number
  explanation: string | null
  duplicateLevel: 'exact' | 'high' | 'medium' | null
  duplicateMatch: { id: string; content: string; score: number } | null
  spellingWarnings: SpellWarning[]
}

export default function QuestionsPage() {
  const { token } = theme.useToken()
  const qc = useQueryClient()
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [subjectModalOpen, setSubjectModalOpen] = useState(false)
  const [editSubject, setEditSubject] = useState<Subject | null>(null)
  const [questionDrawerOpen, setQuestionDrawerOpen] = useState(false)
  const [editQuestion, setEditQuestion] = useState<Question | null>(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<UploadFile | null>(null)
  const [importing, setImporting] = useState(false)
  const [subjectForm] = Form.useForm()
  const [questionForm] = Form.useForm()
  const questionTypeWatch = Form.useWatch('questionType', questionForm)

  // ── Duplicate + spell check state for manual add ──────────────────────
  const [dupWarnings, setDupWarnings] = useState<DupMatch[]>([])
  const [spellWarnings, setSpellWarnings] = useState<SpellWarning[]>([])
  const [checking, setChecking] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Import preview state ──────────────────────────────────────────────
  const [previewStep, setPreviewStep] = useState<'upload' | 'preview'>('upload')
  const [previewData, setPreviewData] = useState<PreviewRow[]>([])
  const [previewErrors, setPreviewErrors] = useState<string[]>([])
  const [previewing, setPreviewing] = useState(false)

  const checkContent = useCallback(async (text: string) => {
    if (!text || text.trim().length < 5) { setDupWarnings([]); setSpellWarnings([]); return }
    setChecking(true)
    try {
      const [dupRes, spellRes] = await Promise.all([
        api.post('/admin/bank-questions/check-duplicates', { texts: [text] }),
        api.post('/admin/bank-questions/check-spelling', { texts: [text] }),
      ])
      setDupWarnings((dupRes.data as DupResult[])[0]?.matches ?? [])
      setSpellWarnings((spellRes.data as SpellResult[])[0]?.warnings ?? [])
    } catch { /* silent */ } finally { setChecking(false) }
  }, [])

  const onContentBlur = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => checkContent(text), 300)
  }, [checkContent])

  // Reset warnings when drawer closes
  useEffect(() => {
    if (!questionDrawerOpen) { setDupWarnings([]); setSpellWarnings([]) }
  }, [questionDrawerOpen])

  // ── Subjects ──────────────────────────────────────────────────────────
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: () => api.get('/admin/subjects').then((r) => r.data),
  })

  const createSubjectMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => api.post('/admin/subjects', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects'] }); setSubjectModalOpen(false); subjectForm.resetFields() },
    onError: (e: any) => message.error(e.response?.data?.message ?? 'Lỗi tạo lĩnh vực'),
  })

  const updateSubjectMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; description?: string }) =>
      api.put(`/admin/subjects/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects'] }); setSubjectModalOpen(false); setEditSubject(null); subjectForm.resetFields() },
  })

  const deleteSubjectMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/subjects/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects'] }) },
  })

  // ── Bank Questions ────────────────────────────────────────────────────
  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ['bank-questions', selectedSubjectId],
    queryFn: () =>
      api.get('/admin/bank-questions', { params: selectedSubjectId ? { subjectId: selectedSubjectId } : {} })
        .then((r) => r.data),
  })

  const createQuestionMutation = useMutation({
    mutationFn: (data: any) => api.post('/admin/bank-questions', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-questions'] })
      qc.invalidateQueries({ queryKey: ['subjects'] })
      setQuestionDrawerOpen(false); questionForm.resetFields()
    },
  })

  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/admin/bank-questions/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-questions'] })
      setQuestionDrawerOpen(false); setEditQuestion(null); questionForm.resetFields()
    },
  })

  const deleteQuestionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/bank-questions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-questions'] })
      qc.invalidateQueries({ queryKey: ['subjects'] })
      message.success('Đã xóa')
    },
  })

  // ── Handlers ─────────────────────────────────────────────────────────
  const openNewSubjectModal = () => { setEditSubject(null); subjectForm.resetFields(); setSubjectModalOpen(true) }
  const openEditSubjectModal = (s: Subject) => {
    setEditSubject(s); subjectForm.setFieldsValue({ name: s.name, description: s.description }); setSubjectModalOpen(true)
  }
  const handleSubjectSubmit = (values: any) => {
    if (editSubject) updateSubjectMutation.mutate({ id: editSubject.id, ...values })
    else createSubjectMutation.mutate(values)
  }

  const openNewQuestion = () => {
    setEditQuestion(null)
    questionForm.setFieldsValue({
      subjectId: selectedSubjectId ?? subjects[0]?.id,
      questionType: 'SINGLE',
      points: 1,
      options: [
        { content: '', isCorrect: true, orderIndex: 1 },
        { content: '', isCorrect: false, orderIndex: 2 },
        { content: '', isCorrect: false, orderIndex: 3 },
        { content: '', isCorrect: false, orderIndex: 4 },
      ],
    })
    setQuestionDrawerOpen(true)
  }

  const openEditQuestion = (q: Question) => {
    setEditQuestion(q)
    questionForm.setFieldsValue({
      content: q.content, imageUrl: q.imageUrl, explanation: q.explanation,
      subjectId: q.subjectId, questionType: q.questionType, points: q.points,
      options: q.options,
    })
    setQuestionDrawerOpen(true)
  }

  const handleQuestionSubmit = (values: any) => {
    if (editQuestion) {
      updateQuestionMutation.mutate({
        id: editQuestion.id,
        content: values.content, imageUrl: values.imageUrl, explanation: values.explanation,
        subjectId: values.subjectId, points: values.points,
      })
    } else {
      // Thứ tự hiển thị/đúng (câu ORDERING) lấy theo vị trí cuối cùng trong danh sách,
      // không phụ thuộc orderIndex khởi tạo ban đầu — để nút ↑↓ có tác dụng thật.
      const options = (values.options ?? []).map((opt: QuestionOption, idx: number) => ({ ...opt, orderIndex: idx + 1 }))
      createQuestionMutation.mutate({ ...values, options })
    }
  }

  const handleImport = async () => {
    if (!importFile || !selectedSubjectId) {
      message.error('Vui lòng chọn lĩnh vực và file Excel'); return
    }
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile.originFileObj as File)
      formData.append('subjectId', selectedSubjectId)
      const res = await api.post('/admin/bank-questions/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const imported = res.data.imported ?? 0
      const skipped = res.data.skipped ?? 0
      message.success(`Import thành công ${imported} câu hỏi${skipped > 0 ? `, bỏ qua ${skipped} câu trùng` : ''}`)
      if (res.data.errors?.length) message.warning(`${res.data.errors.length} dòng lỗi`)
      qc.invalidateQueries({ queryKey: ['bank-questions'] })
      qc.invalidateQueries({ queryKey: ['subjects'] })
      closeImportModal()
    } catch (e: any) {
      message.error(e.response?.data?.message ?? 'Lỗi import')
    } finally { setImporting(false) }
  }

  const handlePreviewImport = async () => {
    if (!importFile || !selectedSubjectId) {
      message.error('Vui lòng chọn lĩnh vực và file Excel'); return
    }
    setPreviewing(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile.originFileObj as File)
      formData.append('subjectId', selectedSubjectId)
      formData.append('dryRun', 'true')
      const res = await api.post('/admin/bank-questions/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPreviewData(res.data.preview ?? [])
      setPreviewErrors(res.data.errors ?? [])
      setPreviewStep('preview')
    } catch (e: any) {
      message.error(e.response?.data?.message ?? 'Lỗi kiểm tra file')
    } finally { setPreviewing(false) }
  }

  const closeImportModal = () => {
    setImportModalOpen(false); setImportFile(null)
    setPreviewStep('upload'); setPreviewData([]); setPreviewErrors([])
  }

  // ── Columns ───────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Câu hỏi', dataIndex: 'content', ellipsis: true,
      render: (v: string) => <Tooltip title={v}><span>{v}</span></Tooltip>,
    },
    {
      title: 'Lĩnh vực', dataIndex: ['subject', 'name'], width: 160,
      render: (v: string) => v ? <Tag color="cyan">{v}</Tag> : '-',
    },
    {
      title: 'Loại', dataIndex: 'questionType', width: 110,
      render: (v: string) => {
        const label = v === 'SINGLE' ? 'Chọn 1' : v === 'MULTIPLE' ? 'Chọn nhiều' : 'Sắp xếp'
        const color = v === 'SINGLE' ? 'blue' : v === 'MULTIPLE' ? 'purple' : 'gold'
        return <Tag color={color}>{label}</Tag>
      },
    },
    { title: 'Điểm', dataIndex: 'points', width: 70 },
    {
      title: '', width: 100,
      render: (_: any, r: Question) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEditQuestion(r)} />
          <Popconfirm title="Xóa câu hỏi?" onConfirm={() => deleteQuestionMutation.mutate(r.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100%', background: 'transparent' }}>
      {/* Sidebar lĩnh vực */}
      <Sider width={240} style={{ background: '#fff', borderRight: '1px solid #f0f0f0', borderRadius: 8 }}>
        <div style={{ padding: '16px 12px 8px' }}>
          <Title level={5} style={{ margin: 0 }}>Lĩnh vực</Title>
        </div>
        <div style={{ padding: '0 12px 8px' }}>
          <Button icon={<PlusOutlined />} size="small" block onClick={openNewSubjectModal}>
            Tạo lĩnh vực
          </Button>
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedSubjectId ? [selectedSubjectId] : ['__all__']}
          onClick={({ key }) => setSelectedSubjectId(key === '__all__' ? null : key)}
          items={[
            {
              key: '__all__',
              label: `Tất cả (${subjects.reduce((s, x) => s + (x._count?.questions ?? 0), 0)})`,
            },
            ...subjects.map((s) => ({
              key: s.id,
              label: (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                  <Space size={4} onClick={(e) => e.stopPropagation()}>
                    <Tag style={{ marginRight: 0 }}>{s._count?.questions ?? 0}</Tag>
                    <Button type="text" icon={<EditOutlined />} size="small" onClick={() => openEditSubjectModal(s)} />
                    <Popconfirm title="Xóa lĩnh vực?" onConfirm={() => deleteSubjectMutation.mutate(s.id)}>
                      <Button type="text" icon={<DeleteOutlined />} size="small" danger />
                    </Popconfirm>
                  </Space>
                </div>
              ),
            })),
          ]}
        />
      </Sider>

      {/* Main content */}
      <Content style={{ padding: '0 0 0 16px' }}>
        <div style={{ background: '#fff', padding: 16, borderRadius: 8, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={5} style={{ margin: 0 }}>
            {selectedSubjectId ? subjects.find((s) => s.id === selectedSubjectId)?.name : 'Tất cả câu hỏi'}
            <Text type="secondary" style={{ fontWeight: 'normal', fontSize: 14, marginLeft: 8 }}>
              ({questions.length} câu)
            </Text>
          </Title>
          <Space>
            <Button
              icon={<UploadOutlined />}
              onClick={() => {
                if (!selectedSubjectId) { message.warning('Chọn lĩnh vực trước khi import'); return }
                setImportModalOpen(true)
              }}
            >
              Import Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openNewQuestion}>
              Thêm câu hỏi
            </Button>
          </Space>
        </div>

        <Table
          rowKey="id" dataSource={questions} columns={columns} loading={isLoading} size="small"
          pagination={{ showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'], defaultPageSize: 20 }}
          expandable={{
            expandedRowRender: (r) => (
              <div style={{ padding: '4px 0' }}>
                {r.options
                  .slice()
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((o, i) => (
                    <div key={i} style={{ padding: '3px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {r.questionType === 'ORDERING'
                        ? <Tag>{i + 1}</Tag>
                        : (o.isCorrect ? <Tag color="green">✔</Tag> : <Tag color="default">✗</Tag>)}
                      {o.content}
                    </div>
                  ))}
              </div>
            ),
          }}
        />
      </Content>

      {/* Modal: Subject */}
      <Modal
        title={editSubject ? 'Sửa lĩnh vực' : 'Tạo lĩnh vực'}
        open={subjectModalOpen}
        onCancel={() => { setSubjectModalOpen(false); setEditSubject(null); subjectForm.resetFields() }}
        onOk={() => subjectForm.submit()}
        confirmLoading={createSubjectMutation.isPending || updateSubjectMutation.isPending}
      >
        <Form form={subjectForm} layout="vertical" onFinish={handleSubjectSubmit}>
          <Form.Item name="name" label="Tên lĩnh vực" rules={[{ required: true }]}>
            <Input placeholder="VD: Nghiệp vụ Tín dụng" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer: Question */}
      <Drawer
        title={editQuestion ? 'Sửa câu hỏi' : 'Thêm câu hỏi vào ngân hàng'}
        size="large"
        open={questionDrawerOpen}
        onClose={() => { setQuestionDrawerOpen(false); setEditQuestion(null); questionForm.resetFields() }}
        extra={
          <Button
            type="primary"
            onClick={() => questionForm.submit()}
            loading={createQuestionMutation.isPending || updateQuestionMutation.isPending}
          >
            Lưu
          </Button>
        }
      >
        <Form form={questionForm} layout="vertical" onFinish={handleQuestionSubmit}>
          <Form.Item name="subjectId" label="Lĩnh vực" rules={[{ required: true }]}>
            <Select options={subjects.map((s) => ({ value: s.id, label: s.name }))} placeholder="Chọn lĩnh vực" />
          </Form.Item>
          <Form.Item name="content" label="Nội dung câu hỏi" rules={[{ required: true }]}>
            <Input.TextArea
              rows={3}
              spellCheck
              lang="vi"
              onBlur={(e) => onContentBlur(e.target.value)}
            />
          </Form.Item>
          <Form.Item name="imageUrl" label="Ảnh minh hoạ (URL, không bắt buộc)">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.imageUrl !== cur.imageUrl}>
            {({ getFieldValue }) => {
              const url = getFieldValue('imageUrl')
              return url ? <img src={url} alt="" className="quiz-question-image" style={{ marginBottom: 16, maxHeight: 180 }} /> : null
            }}
          </Form.Item>

          {/* Duplicate warnings */}
          {!editQuestion && dupWarnings.length > 0 && (
            <Alert
              type={dupWarnings[0].level === 'exact' ? 'error' : 'warning'}
              showIcon
              icon={<WarningOutlined />}
              style={{ marginBottom: 12 }}
              message={dupWarnings[0].level === 'exact' ? 'Câu hỏi đã tồn tại trong ngân hàng!' : 'Câu hỏi tương tự đã có trong ngân hàng'}
              description={
                <div>
                  {dupWarnings.map((m, i) => (
                    <div key={i} style={{ fontSize: 12, marginTop: 4 }}>
                      <Tag color={m.level === 'exact' ? 'red' : 'orange'}>
                        {m.level === 'exact' ? 'Trùng' : `${Math.round(m.score * 100)}%`}
                      </Tag>
                      {m.content}
                    </div>
                  ))}
                </div>
              }
            />
          )}

          {/* Spell check warnings */}
          {!editQuestion && spellWarnings.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="Có thể có lỗi chính tả"
              description={
                <Space size={4} wrap>
                  {spellWarnings.map((w, i) => (
                    <Tooltip key={i} title={w.suggestions.length ? `Gợi ý: ${w.suggestions.join(', ')}` : 'Không có gợi ý'}>
                      <Tag color="orange" style={{ cursor: 'help' }}>{w.word}</Tag>
                    </Tooltip>
                  ))}
                </Space>
              }
            />
          )}

          {checking && <Text type="secondary" style={{ fontSize: 12 }}>Đang kiểm tra…</Text>}

          <Form.Item name="questionType" label="Loại">
            <Radio.Group>
              <Radio value="SINGLE">Chọn 1</Radio>
              <Radio value="MULTIPLE">Chọn nhiều</Radio>
              <Radio value="ORDERING">Sắp xếp thứ tự</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="explanation" label="Giải thích đáp án đúng">
            <Input.TextArea rows={2} spellCheck lang="vi" />
          </Form.Item>
          <Form.Item name="points" label="Điểm" rules={[{ required: true }]}>
            <Input type="number" style={{ width: 100 }} />
          </Form.Item>
          {!editQuestion && (
            <>
              <Divider>{questionTypeWatch === 'ORDERING' ? 'Thứ tự đúng (sắp từ trên xuống)' : 'Đáp án'}</Divider>
              {questionTypeWatch === 'ORDERING' && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  Nhập nội dung theo đúng thứ tự — dùng nút ↑↓ để sắp lại nếu cần. Hệ thống sẽ xáo vị trí hiển thị
                  cho từng người làm bài, thứ tự bạn nhập ở đây là đáp án đúng.
                </Text>
              )}
              <Form.List name="options">
                {(fields, { move }) => (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {fields.map((field, idx) => (
                      <div key={field.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {questionTypeWatch === 'ORDERING' ? (
                          <span className="quiz-option-letter">{idx + 1}</span>
                        ) : (
                          <Form.Item name={[field.name, 'isCorrect']} valuePropName="checked" style={{ margin: 0 }}>
                            <Checkbox />
                          </Form.Item>
                        )}
                        <Form.Item name={[field.name, 'content']} style={{ flex: 1, margin: 0 }} rules={[{ required: true, message: ' ' }]}>
                          <Input placeholder={`Đáp án ${String.fromCharCode(65 + idx)}`} spellCheck lang="vi" />
                        </Form.Item>
                        {questionTypeWatch === 'ORDERING' && (
                          <Space size={4}>
                            <Button size="small" disabled={idx === 0} onClick={() => move(idx, idx - 1)}>↑</Button>
                            <Button size="small" disabled={idx === fields.length - 1} onClick={() => move(idx, idx + 1)}>↓</Button>
                          </Space>
                        )}
                      </div>
                    ))}
                  </Space>
                )}
              </Form.List>
            </>
          )}
        </Form>
      </Drawer>

      {/* Modal: Import Excel */}
      <Modal
        title={previewStep === 'upload' ? 'Import câu hỏi từ Excel' : 'Kiểm tra trước khi import'}
        open={importModalOpen}
        onCancel={closeImportModal}
        width={previewStep === 'preview' ? 900 : 520}
        footer={
          previewStep === 'upload' ? (
            <Space>
              <Button onClick={closeImportModal}>Hủy</Button>
              <Button loading={previewing} onClick={handlePreviewImport} disabled={!importFile}>
                Kiểm tra
              </Button>
            </Space>
          ) : (
            <Space>
              <Button onClick={() => setPreviewStep('upload')}>← Quay lại</Button>
              <Button
                type="primary"
                loading={importing}
                onClick={handleImport}
                icon={<CheckCircleOutlined />}
              >
                Xác nhận import {previewData.filter((r) => !r.duplicateLevel || r.duplicateLevel === 'medium').length} câu mới
              </Button>
            </Space>
          )
        }
      >
        {previewStep === 'upload' ? (
          <>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              File không có dòng tiêu đề. Cột: A=Câu hỏi, B-E=Đáp án, F=Số TT đúng (1=B,2=C,3=D,4=E), G=Giải thích
            </Text>
            <Text strong>Lĩnh vực: </Text>
            <Text>{subjects.find((s) => s.id === selectedSubjectId)?.name ?? '—'}</Text>
            <div style={{ marginTop: 16 }}>
              <Upload.Dragger
                accept=".xlsx,.xls"
                maxCount={1}
                beforeUpload={() => false}
                onChange={({ fileList }) => setImportFile(fileList[0] ?? null)}
              >
                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                <p>Kéo thả hoặc click để chọn file .xlsx</p>
              </Upload.Dragger>
            </div>
          </>
        ) : (
          <>
            {/* Summary badges */}
            <Space style={{ marginBottom: 12 }} wrap>
              <Badge
                count={previewData.filter((r) => !r.duplicateLevel).length}
                overflowCount={9999}
                color="green"
              >
                <Tag color="green" style={{ padding: '4px 12px' }}>🆕 Câu mới</Tag>
              </Badge>
              <Badge
                count={previewData.filter((r) => r.duplicateLevel === 'exact' || r.duplicateLevel === 'high').length}
                overflowCount={9999}
                color="red"
              >
                <Tag color="red" style={{ padding: '4px 12px' }}>🔴 Trùng (sẽ bỏ qua)</Tag>
              </Badge>
              <Badge
                count={previewData.filter((r) => r.duplicateLevel === 'medium').length}
                overflowCount={9999}
                color="orange"
              >
                <Tag color="orange" style={{ padding: '4px 12px' }}>⚠️ Tương tự</Tag>
              </Badge>
              <Badge
                count={previewData.filter((r) => r.spellingWarnings.length > 0).length}
                overflowCount={9999}
                color="gold"
              >
                <Tag color="gold" style={{ padding: '4px 12px' }}>✏️ Cảnh báo chính tả</Tag>
              </Badge>
            </Space>

            {previewErrors.length > 0 && (
              <Alert type="error" message={`${previewErrors.length} dòng lỗi cấu trúc`}
                description={previewErrors.slice(0, 3).join('; ')} style={{ marginBottom: 12 }} />
            )}

            <Table<PreviewRow>
              dataSource={previewData}
              rowKey="rowNumber"
              size="small"
              pagination={{ pageSize: 10, showSizeChanger: false }}
              scroll={{ x: 800 }}
              rowClassName={(r) =>
                r.duplicateLevel === 'exact' || r.duplicateLevel === 'high'
                  ? 'ant-table-row-danger'
                  : ''
              }
              columns={[
                { title: 'STT', dataIndex: 'rowNumber', width: 55 },
                {
                  title: 'Câu hỏi',
                  dataIndex: 'content',
                  ellipsis: true,
                  render: (v: string) => <Tooltip title={v}><span>{v}</span></Tooltip>,
                },
                {
                  title: 'Trạng thái',
                  width: 150,
                  render: (_: unknown, r: PreviewRow) => {
                    if (!r.duplicateLevel) return <Tag color="green">🆕 Mới</Tag>
                    if (r.duplicateLevel === 'exact') return <Tag color="red">🔴 Trùng hoàn toàn</Tag>
                    if (r.duplicateLevel === 'high') return (
                      <Tooltip title={r.duplicateMatch?.content ?? ''}>
                        <Tag color="red">🔴 {Math.round((r.duplicateMatch?.score ?? 0) * 100)}% trùng</Tag>
                      </Tooltip>
                    )
                    return (
                      <Tooltip title={r.duplicateMatch?.content ?? ''}>
                        <Tag color="orange">⚠️ {Math.round((r.duplicateMatch?.score ?? 0) * 100)}% tương tự</Tag>
                      </Tooltip>
                    )
                  },
                },
                {
                  title: 'Chính tả',
                  width: 180,
                  render: (_: unknown, r: PreviewRow) => r.spellingWarnings.length === 0
                    ? <Text type="secondary">—</Text>
                    : (
                      <Space size={2} wrap>
                        {r.spellingWarnings.map((w, i) => (
                          <Tooltip key={i} title={w.suggestions.length ? `Gợi ý: ${w.suggestions.join(', ')}` : 'Không có gợi ý'}>
                            <Tag color="gold" style={{ cursor: 'help', fontSize: 11 }}>{w.word}</Tag>
                          </Tooltip>
                        ))}
                      </Space>
                    ),
                },
              ] as ColumnType<PreviewRow>[]}
            />
            <style>{`.ant-table-row-danger td { background: ${token.colorErrorBg} !important; }`}</style>
          </>
        )}
      </Modal>
    </Layout>
  )
}
