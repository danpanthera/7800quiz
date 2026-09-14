import { useState } from 'react'
import React from 'react'
import {
  App, Button, Checkbox, Table, Space, Modal, Form, Input, Select, Popconfirm,
  Typography, Switch, DatePicker, Tag, Row, Col, Divider, Upload, Alert, Dropdown, Tooltip,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, IdcardOutlined, LockOutlined, UploadOutlined, MoreOutlined, UndoOutlined, ClearOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import ManageTable from '../components/ManageTable'
import api, { getErrorMessage } from '../lib/api'
import { positionRank } from '../lib/position'
import { useAuth } from '../lib/useAuth'

interface Department { id: string; name: string; code: string; parentId?: string | null; parent?: { id: string; name: string; code: string } | null; _count?: { children: number; canBo: number } }

// Thứ tự đơn vị cố định theo code 01-HS → 09-NH
const UNIT_ORDER = ['01-HS','02-BL','03-PT','04-SH','05-BT','06-TU','07-DK','08-TAU','09-NH']
function unitRank(code?: string | null): number {
  if (!code) return 99
  const idx = UNIT_ORDER.indexOf(code)
  return idx === -1 ? 98 : idx
}

// Thứ tự ưu tiên phòng ban: BGD > KHDN > KHCN > KH > KTNQ > PGD > KTGSNB > TH > KHRR
function deptPriority(name: string, code: string): number {
  const n = name.toLowerCase(); const c = code.toLowerCase()
  if (n.includes('ban giám đốc') || c.includes('bgd')) return 1
  if (n.includes('khdn') || n.includes('doanh nghiệp')) return 2
  if (n.includes('khcn') || n.includes('cá nhân')) return 3
  if (n.includes('khách hàng')) return 4
  if (n.includes('ktnq') || n.includes('kế toán') || n.includes('ngân quỹ')) return 5
  if (n.includes('giao dịch') || c.includes('pgd')) return 6
  if (n.includes('ktgsnb') || n.includes('kiểm tra') || n.includes('giám sát')) return 7
  if (n.includes('tổng hợp') || c.includes('th')) return 8
  if (n.includes('khrr') || n.includes('rủi ro') || n.includes('qlrr')) return 9
  return 10
}

interface CanBoItem {
  id: string; cbCode: string; fullName: string; username?: string;
  email?: string; phoneNumber?: string; userAD?: string; userIPCAS?: string;
  maCbtd?: string; cccd?: string; ngayCapCmt?: string; noiCapCmt?: string;
  ngaySinh?: string; gioiTinh?: string; departmentId?: string;
  department?: { id: string; name: string; code: string; parent?: { id: string; name: string; code: string } | null };
  position?: string; isPartyMember: boolean; isUnionMember: boolean;
  isYouthUnionMember: boolean; isItStaff: boolean; isActive: boolean;
  // Mật khẩu tạm còn hiệu lực (chưa đăng nhập đổi mật khẩu lần nào) — null nếu
  // đã đổi. Chỉ API trả về cho ADMIN/Cán bộ IT, xem admin.service.ts:getCanBo.
  initialPassword?: string | null;
}
// Dữ liệu form thêm/sửa cán bộ — bỏ các field server tự sinh (id, username, department object)
type CanBoFormValues = Omit<CanBoItem, 'id' | 'username' | 'department'>

interface SuperDeleteResult {
  quizAttempts: number; submissions: number; assignments: number;
  xpTransactions: number; userBadges: number; dailyQuestionAttempts: number; reviewCards: number;
}

export default function CanBoPage() {
  const qc = useQueryClient()
  const { message } = App.useApp()
  const { user } = useAuth()
  // Cán bộ IT vào được trang này nhưng CHỈ để reset mật khẩu — mọi thao tác còn
  // lại ẩn đi ở đây và chặn luôn ở API (can-bo-it.guard.ts), không chỉ ẩn nút.
  const laAdmin = user?.role === 'ADMIN'
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CanBoItem | null>(null)
  const [formUnitId, setFormUnitId] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [filterUnitId, setFilterUnitId] = useState<string | undefined>()
  const [filterDeptId, setFilterDeptId] = useState<string | undefined>()
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [resetResultOpen, setResetResultOpen] = useState(false)
  const [resetResult, setResetResult] = useState<{ reset: number; noAccount: number; details: { fullName: string; cbCode: string; ok: boolean; initialPassword?: string; mailSent?: boolean; mailError?: string }[] } | null>(null)
  // ids đang chờ reset — khác null thì mở modal nhập mật khẩu hộp mail (dùng
  // đúng 1 lần để gửi, KHÔNG lưu lại — xem admin.service.ts:resetCanBoPasswords)
  const [resetTarget, setResetTarget] = useState<string[] | null>(null)
  const [resetMailForm] = Form.useForm()
  const [importOpen, setImportOpen] = useState(false)
  const [importResult, setImportResult] = useState<{
    created: number; updated: number; skipped: number; errors: string[];
    rows: { empno: string; fullName: string; branchCode?: string; branchName?: string; deptName?: string; position?: string; userAD?: string; action: 'created' | 'updated' | 'skipped' | 'error'; note?: string }[];
  } | null>(null)
  const [superDeleteTarget, setSuperDeleteTarget] = useState<CanBoItem | null>(null)
  const [superDeleteConfirmText, setSuperDeleteConfirmText] = useState('')
  const [superDeleteResultOpen, setSuperDeleteResultOpen] = useState(false)
  const [superDeleteResult, setSuperDeleteResult] = useState<SuperDeleteResult | null>(null)

  const { data: canBoList = [], isLoading } = useQuery<CanBoItem[]>({
    queryKey: ['can-bo', search, filterUnitId, filterDeptId],
    queryFn: () => api.get('/admin/can-bo', {
      params: {
        ...(search ? { search } : {}),
        ...(filterDeptId ? { departmentId: filterDeptId } : filterUnitId ? { unitId: filterUnitId } : {}),
      }
    }).then(r => r.data),
  })

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/admin/departments').then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (body: CanBoFormValues) => api.post('/admin/can-bo', body).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['can-bo'] }); closeModal(); message.success('Đã thêm cán bộ') },
    onError: (e: unknown) => message.error(getErrorMessage(e, 'Lỗi khi thêm')),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & CanBoFormValues) => api.put(`/admin/can-bo/${id}`, body).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['can-bo'] }); closeModal(); message.success('Đã cập nhật') },
    onError: (e: unknown) => message.error(getErrorMessage(e, 'Lỗi khi cập nhật')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/can-bo/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['can-bo'] }); message.success('Đã xóa') },
    onError: () => message.error('Không thể xóa'),
  })

  const resetMut = useMutation({
    mutationFn: (payload: { ids: string[]; mailPassword: string }) =>
      api.post('/admin/can-bo/reset-passwords', payload).then(r => r.data),
    onSuccess: (data) => {
      setSelectedRowKeys([])
      setResetTarget(null)
      resetMailForm.resetFields()
      setResetResult(data)
      setResetResultOpen(true)
    },
    onError: () => message.error('Lỗi khi reset mật khẩu'),
  })

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: string[]) => api.delete('/admin/can-bo/bulk', { data: { ids } }).then(r => r.data),
    onSuccess: (data: { deleted: number }) => {
      qc.invalidateQueries({ queryKey: ['can-bo'] })
      setSelectedRowKeys([])
      message.success(`Đã xóa ${data.deleted} cán bộ`)
    },
    onError: () => message.error('Lỗi khi xóa cán bộ'),
  })

  const superDeleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/can-bo/${id}/super-delete`).then(r => r.data),
    onSuccess: (data: SuperDeleteResult) => {
      qc.invalidateQueries({ queryKey: ['can-bo'] })
      setSuperDeleteTarget(null)
      setSuperDeleteConfirmText('')
      setSuperDeleteResult(data)
      setSuperDeleteResultOpen(true)
    },
    onError: (e: unknown) => message.error(getErrorMessage(e, 'Lỗi khi xóa triệt để')),
  })

  const hardResetMut = useMutation({
    mutationFn: (id: string) => api.post(`/admin/can-bo/${id}/hard-reset`).then(r => r.data),
    onSuccess: (data: { userBadges: number; xpTransactions: number }) => {
      message.success(`Đã reset cứng: gỡ ${data.userBadges} huy hiệu, xóa ${data.xpTransactions} giao dịch XP, đưa cấp độ về 1`)
    },
    onError: (e: unknown) => message.error(getErrorMessage(e, 'Lỗi khi reset cứng')),
  })

  const importMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post('/admin/can-bo/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['can-bo'] })
      qc.invalidateQueries({ queryKey: ['departments'] })
      setImportResult(data)
    },
    onError: (e: unknown) => message.error(getErrorMessage(e, 'Lỗi khi import file')),
  })

  function openAdd() {
    setEditing(null)
    setFormUnitId(undefined)
    form.resetFields()
    form.setFieldsValue({ isActive: true, isItStaff: false })
    setModalOpen(true)
  }

  function openEdit(record: CanBoItem) {
    setEditing(record)
    // Xác định chi nhánh và phòng ban từ department hiện tại
    const hasParent = !!record.department?.parent
    const branchId = hasParent ? record.department!.parent!.id : record.departmentId
    const deptId = hasParent ? record.departmentId : undefined
    setFormUnitId(branchId)
    form.setFieldsValue({
      cbCode: record.cbCode,
      fullName: record.fullName,
      email: record.email,
      userAD: record.userAD,
      gioiTinh: record.gioiTinh,
      position: record.position,
      isActive: record.isActive,
      isItStaff: record.isItStaff,
      ngaySinh: record.ngaySinh ? dayjs(record.ngaySinh) : undefined,
      departmentId: deptId,
    })
    setModalOpen(true)
  }

  function closeModal() { setModalOpen(false); setEditing(null); form.resetFields(); setFormUnitId(undefined) }

  // Đơn vị cấp 1: không có parentId VÀ có ít nhất 1 phòng ban con, sort theo code (01→09)
  const topUnits = departments
    .filter(d => !d.parentId && (d._count?.children ?? 0) > 0)
    .sort((a, b) => a.code.localeCompare(b.code))

  // Phòng ban cấp 2: chỉ hiển thị phòng ban có cán bộ thực tế, sort theo thứ tự ưu tiên
  const subDepts = filterUnitId
    ? departments
        .filter(d => d.parentId === filterUnitId && (d._count?.canBo ?? 0) > 0)
        .sort((a, b) => deptPriority(a.name, a.code) - deptPriority(b.name, b.code) || a.name.localeCompare(b.name, 'vi'))
    : []

  // Sắp xếp 4 cấp: đơn vị (01-HS→09-NH) → phòng ban (BGD trước) → chức vụ → tên
  const sortedCanBo = [...canBoList].sort((a, b) => {
    // 1. Đơn vị cha (parent.code)
    const uA = a.department?.parent?.code ?? a.department?.code
    const uB = b.department?.parent?.code ?? b.department?.code
    const ur = unitRank(uA) - unitRank(uB)
    if (ur !== 0) return ur
    // 2. Phòng ban trong đơn vị (BGD → KHDN → KHCN → KH → KTNQ → PGD → KTGSNB → TH → KHRR)
    const dA = a.department; const dB = b.department
    const dr = deptPriority(dA?.name ?? '', dA?.code ?? '') - deptPriority(dB?.name ?? '', dB?.code ?? '')
    if (dr !== 0) return dr
    // 3. Chức vụ (GĐ > PGĐ > TP > PP > NV)
    const pr = positionRank(a.position) - positionRank(b.position)
    if (pr !== 0) return pr
    // 4. Họ tên
    return (a.fullName ?? '').localeCompare(b.fullName ?? '', 'vi')
  })

  function handleUnitChange(val: string | undefined) {
    setFilterUnitId(val)
    setFilterDeptId(undefined)
  }

  async function handleSubmit() {
    const values = await form.validateFields()
    const payload = {
      ...values,
      ngaySinh: values.ngaySinh ? values.ngaySinh.toISOString() : undefined,
      // Nếu không chọn phòng ban cụ thể, lưu chi nhánh vào departmentId
      departmentId: values.departmentId ?? formUnitId ?? undefined,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, ...payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const renderCanBoActions = (record: CanBoItem) => (
    <Space>
      {laAdmin && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />}
      <Button
        size="small"
        icon={<LockOutlined />}
        title="Reset mật khẩu"
        onClick={() => setResetTarget([record.id])}
      />
      {!laAdmin ? null : (
        <>
      <Popconfirm title="Xác nhận xóa cán bộ này?" onConfirm={() => deleteMut.mutate(record.id)} okText="Xóa" cancelText="Hủy">
        <Button size="small" danger icon={<DeleteOutlined />} />
      </Popconfirm>
      <Dropdown
        menu={{
          items: [
            {
              key: 'hard-reset',
              icon: <UndoOutlined />,
              label: 'Reset cứng huy hiệu/cấp độ',
              onClick: () => {
                Modal.confirm({
                  title: 'Reset cứng huy hiệu + cấp độ?',
                  content: `Đưa toàn bộ XP, cấp độ, huy hiệu của "${record.fullName}" về mốc ban đầu (cấp 1, 0 XP), không quan tâm đã thi thế nào. Không đụng tới bài nộp/lượt thi đã có.`,
                  okText: 'Reset', okButtonProps: { danger: true }, cancelText: 'Hủy',
                  onOk: () => hardResetMut.mutate(record.id),
                })
              },
            },
            { type: 'divider' },
            {
              key: 'super-delete',
              icon: <ClearOutlined />,
              danger: true,
              label: 'Xóa triệt để (Super Delete)',
              onClick: () => { setSuperDeleteTarget(record); setSuperDeleteConfirmText('') },
            },
          ],
        }}
        trigger={['click']}
      >
        <Button size="small" icon={<MoreOutlined />} title="Thao tác khác" />
      </Dropdown>
        </>
      )}
    </Space>
  )

  const columns = [
    { title: 'STT', render: (_: unknown, __: unknown, i: number) => i + 1, width: 55 },
    { title: 'Mã CB', dataIndex: 'cbCode', width: 110, sorter: (a: CanBoItem, b: CanBoItem) => a.cbCode.localeCompare(b.cbCode) },
    {
      title: 'Họ tên', dataIndex: 'fullName', width: 180,
      render: (v: string, r: CanBoItem) => (
        <Space size={4} wrap>
          <span>{v}</span>
          {r.isItStaff && <Tag color="geekblue">Cán bộ IT</Tag>}
        </Space>
      ),
    },
    { title: 'UserAD', dataIndex: 'userAD', width: 130 },
    {
      title: 'Mật khẩu tạm', dataIndex: 'initialPassword', width: 150,
      render: (v: string | null | undefined) => v
        ? <Typography.Text code copyable={{ text: v }}>{v}</Typography.Text>
        : <span style={{ color: '#bbb' }}>đã đổi</span>,
    },
    { title: 'Phòng ban', dataIndex: ['department', 'name'], width: 200,
      render: (_: unknown, r: CanBoItem) => r.department
        ? <span>{r.department.name}</span>
        : '-'
    },
    { title: 'Chi nhánh', width: 200,
      render: (_: unknown, r: CanBoItem) => {
        const parent = r.department?.parent
        return parent ? <span style={{ color: '#1677ff' }}>{parent.name}</span> : '-'
      }
    },
    { title: 'Chức vụ', dataIndex: 'position', width: 150 },
    { title: 'Email', dataIndex: 'email', width: 200 },
    {
      title: 'Trạng thái', dataIndex: 'isActive', width: 100,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Hoạt động' : 'Nghỉ'}</Tag>,
    },
    {
      // Cán bộ IT chỉ còn đúng 1 nút reset nên không cần chừa chỗ cho 4 nút
      title: 'Thao tác', width: laAdmin ? 190 : 90, fixed: 'right' as const,
      render: (_: unknown, record: CanBoItem) => renderCanBoActions(record),
    },
  ]

  return (
    <div>
      {!laAdmin && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Quyền của Cán bộ IT trong trang này"
          description="Chỉ được reset mật khẩu cán bộ (từng người hoặc tích chọn nhiều người rồi bấm Reset MK) — mỗi lần reset sinh 1 mật khẩu tạm ngẫu nhiên riêng, xem ở cột &quot;Mật khẩu tạm&quot; để đọc lại cho cán bộ. Việc thêm, sửa, xoá, import và các thao tác khác thuộc quyền Quản trị viên."
        />
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}><IdcardOutlined /> Quản lý cán bộ</Typography.Title>
        <Space wrap>
          <Select
            placeholder="Tất cả đơn vị"
            allowClear
            style={{ width: 180 }}
            value={filterUnitId}
            onChange={handleUnitChange}
            options={topUnits.map(d => ({ value: d.id, label: d.name }))}
          />
          <Select
            placeholder="Tất cả phòng ban"
            allowClear
            style={{ width: 200 }}
            value={filterDeptId}
            onChange={setFilterDeptId}
            disabled={!filterUnitId}
            options={subDepts.map(d => {
              // Bỏ prefix tên đơn vị nếu có (VD: "Hội sở - P.KH Cá nhân" → "P.KH Cá nhân")
              const unitName = topUnits.find(u => u.id === filterUnitId)?.name ?? ''
              const label = unitName && d.name.toLowerCase().startsWith(unitName.toLowerCase())
                ? d.name.slice(unitName.length).replace(/^\s*[-–]\s*/, '').trim()
                : d.name
              return { value: d.id, label }
            })}
          />
          <Input.Search
            placeholder="Tìm theo tên, mã CB, UserAD..."
            allowClear
            onSearch={setSearch}
            onChange={e => !e.target.value && setSearch('')}
            style={{ width: 240 }}
          />
          {laAdmin && (
            <>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Thêm cán bộ</Button>
              <Button icon={<UploadOutlined />} onClick={() => { setImportResult(null); setImportOpen(true) }}>Import GAHR26</Button>
            </>
          )}
          {selectedRowKeys.length > 0 && (
            <>
              <Button
                icon={<LockOutlined />}
                danger
                onClick={() => setResetTarget(selectedRowKeys as string[])}
              >
                Reset MK ({selectedRowKeys.length})
              </Button>
              {laAdmin && (
                <Popconfirm
                  title={`Xóa ${selectedRowKeys.length} cán bộ đã chọn?`}
                  description="Hành động này không thể hoàn tác. Tài khoản đăng nhập liên kết cũng sẽ bị xóa."
                  onConfirm={() => bulkDeleteMut.mutate(selectedRowKeys as string[])}
                  okText="Xóa" okButtonProps={{ danger: true }}
                  cancelText="Hủy"
                  icon={<DeleteOutlined style={{ color: '#E53935' }} />}
                >
                  <Button
                    icon={<DeleteOutlined />}
                    loading={bulkDeleteMut.isPending}
                    danger
                    type="primary"
                  >
                    Xóa đã chọn ({selectedRowKeys.length})
                  </Button>
                </Popconfirm>
              )}
            </>
          )}
        </Space>
      </div>

      <ManageTable<CanBoItem>
        rowKey="id"
        dataSource={sortedCanBo}
        columns={columns}
        loading={isLoading}
        size="small"
        scroll={{ x: 1600, y: 'calc(100vh - 280px)' }}
        pagination={{ pageSize, onShowSizeChange: (_, size) => setPageSize(size), showSizeChanger: true, showTotal: (t) => `Tổng ${t} cán bộ` }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          preserveSelectedRowKeys: true,
        }}
        cardHeading={(record) => (
          <>
            <Typography.Title level={5}>{record.fullName}</Typography.Title>
            <Tag>{record.cbCode}</Tag>
            {record.isItStaff && <Tag color="geekblue">Cán bộ IT</Tag>}
          </>
        )}
        cardBadge={(record) => <Tag color={record.isActive ? 'green' : 'red'}>{record.isActive ? 'Hoạt động' : 'Nghỉ'}</Tag>}
        cardMeta={[
          { label: 'Phòng ban', render: (record) => record.department?.name ?? '-' },
          {
            label: 'Chi nhánh',
            render: (record) => record.department?.parent
              ? <span style={{ color: '#1677ff' }}>{record.department.parent.name}</span>
              : '-',
          },
          { label: 'Chức vụ', render: (record) => record.position ?? '-' },
        ]}
        cardActions={renderCanBoActions}
      />

      <Modal
        title={editing ? 'Sửa thông tin cán bộ' : 'Thêm cán bộ mới'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText={editing ? 'Cập nhật' : 'Thêm'}
        cancelText="Hủy"
        width={800}
        forceRender
      >
        <Form form={form} layout="vertical" size="small">
          <Divider titlePlacement="left" plain>Thông tin cơ bản</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="cbCode" label="Mã CB" rules={[{ required: true, message: 'Nhập mã CB' }, { pattern: /^\d{9}$/, message: 'Mã CB phải là 9 chữ số' }]}>
                <Input placeholder="9 chữ số" maxLength={9} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email không hợp lệ' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="userAD" label="User AD (tên đăng nhập)">
                <Input placeholder="Dùng để đăng nhập" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left" plain>Thông tin cá nhân</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ngaySinh" label="Ngày sinh">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Chọn ngày sinh" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="gioiTinh" label="Giới tính">
                <Select placeholder="Chọn giới tính" allowClear>
                  <Select.Option value="Nam">Nam</Select.Option>
                  <Select.Option value="Nữ">Nữ</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left" plain>Đơn vị công tác</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Chi nhánh">
                <Select
                  placeholder="Chọn chi nhánh"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  value={formUnitId}
                  onChange={(val) => {
                    setFormUnitId(val)
                    form.setFieldValue('departmentId', undefined)
                  }}
                >
                  {departments.filter(d => !d.parentId).map(d => (
                    <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="departmentId" label="Phòng ban">
                <Select
                  placeholder={formUnitId ? 'Chọn phòng ban' : 'Chọn chi nhánh trước'}
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  disabled={!formUnitId}
                >
                  {departments.filter(d => d.parentId === formUnitId).map(d => (
                    <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="position" label="Chức vụ">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
                <Switch checkedChildren="Đang làm" unCheckedChildren="Đã nghỉ" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="isItStaff"
                label="Cán bộ IT"
                valuePropName="checked"
                extra="Được xem thêm hướng dẫn và một số chức năng kỹ thuật dành riêng. KHÔNG phải quyền quản trị viên — vẫn không vào được các trang quản trị."
              >
                <Checkbox>Đánh dấu là cán bộ IT</Checkbox>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal: Kết quả reset mật khẩu */}
      <Modal
        title="Kết quả reset mật khẩu"
        open={resetResultOpen}
        onOk={() => setResetResultOpen(false)}
        onCancel={() => setResetResultOpen(false)}
        cancelButtonProps={{ style: { display: 'none' } }}
        okText="Đóng"
      >
        {resetResult && (
          <>
            <p>
              ✅ Reset thành công: <strong>{resetResult.reset}</strong> tài khoản{' '}
              {resetResult.noAccount > 0 && <>| ⚠️ Không có tài khoản: <strong>{resetResult.noAccount}</strong></>}
            </p>
            <p style={{ color: '#888', fontSize: 12 }}>Mỗi người 1 mật khẩu tạm ngẫu nhiên riêng — đọc/copy ở cột bên dưới cho cán bộ, sẽ phải đổi lại sau lần đăng nhập đầu tiên. Nếu lỡ đóng bảng này, vẫn xem lại được ở cột "Mật khẩu tạm" trong danh sách cán bộ.</p>
            <Table
              size="small"
              rowKey="cbCode"
              dataSource={resetResult.details}
              columns={[
                { title: 'Họ tên', dataIndex: 'fullName' },
                { title: 'Mã CB', dataIndex: 'cbCode' },
                {
                  title: 'Mật khẩu tạm', dataIndex: 'initialPassword',
                  render: (v?: string) => v
                    ? <Typography.Text code copyable={{ text: v }}>{v}</Typography.Text>
                    : '-',
                },
                {
                  title: 'Kết quả', dataIndex: 'ok', width: 120,
                  render: (ok: boolean) => ok
                    ? <Tag color="green">Đã reset</Tag>
                    : <Tag color="orange">Chưa có TK</Tag>,
                },
                {
                  title: 'Gửi mail', dataIndex: 'mailSent', width: 160,
                  render: (v: boolean | undefined, r) => v === undefined
                    ? '-'
                    : v
                      ? <Tag color="blue">Đã gửi</Tag>
                      : <Tooltip title={r.mailError}><Tag color="red">Gửi lỗi</Tag></Tooltip>,
                },
              ]}
              pagination={false}
            />
          </>
        )}
      </Modal>

      {/* Modal: Nhập mật khẩu hộp mail để reset + tự động gửi thông báo cho cán bộ */}
      <Modal
        title={`Reset mật khẩu${resetTarget && resetTarget.length > 1 ? ` ${resetTarget.length} cán bộ` : ''}`}
        open={!!resetTarget}
        onCancel={() => { setResetTarget(null); resetMailForm.resetFields() }}
        onOk={() => resetMailForm.submit()}
        okText="Reset & Gửi mail"
        cancelText="Hủy"
        confirmLoading={resetMut.isPending}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Mật khẩu hộp mail chỉ dùng đúng 1 lần để gửi, KHÔNG được lưu lại"
          description={
            <>
              Sinh 1 mật khẩu tạm ngẫu nhiên riêng cho mỗi người, rồi tự gửi mail thông báo — tới địa chỉ email đã khai báo, nếu cán bộ chưa có email thì tự dùng <code>UserAD@agribank.com.vn</code>.
              {' '}Mật khẩu hộp mail của bạn nhập bên dưới chỉ dùng ngay lúc này để đăng nhập gửi mail, không lưu vào hệ thống.
            </>
          }
        />
        <Form
          form={resetMailForm}
          layout="vertical"
          onFinish={(values: { mailPassword: string }) => {
            if (resetTarget) resetMut.mutate({ ids: resetTarget, mailPassword: values.mailPassword })
          }}
        >
          <Form.Item
            name="mailPassword"
            label="Mật khẩu hộp mail của bạn"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hộp mail' }]}
          >
            <Input.Password autoComplete="current-password" autoFocus />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Xác nhận Super Delete — phải gõ đúng mã CB mới bấm được */}
      <Modal
        title="⚠️ Xóa triệt để cán bộ"
        open={!!superDeleteTarget}
        onCancel={() => { setSuperDeleteTarget(null); setSuperDeleteConfirmText('') }}
        onOk={() => superDeleteTarget && superDeleteMut.mutate(superDeleteTarget.id)}
        okText="Xóa triệt để"
        cancelText="Hủy"
        okButtonProps={{
          danger: true,
          disabled: !superDeleteTarget || superDeleteConfirmText.trim() !== superDeleteTarget.cbCode,
          loading: superDeleteMut.isPending,
        }}
      >
        {superDeleteTarget && (
          <>
            <Alert
              type="error"
              showIcon
              message="Hành động KHÔNG THỂ HOÀN TÁC"
              description={
                <>
                  Sẽ xóa vĩnh viễn toàn bộ phân công, bài nộp, lượt thi, huy hiệu, cấp độ
                  và tài khoản đăng nhập của <strong>{superDeleteTarget.fullName}</strong> ({superDeleteTarget.cbCode}),
                  bỏ qua mọi cảnh báo "còn lịch sử làm bài". Bộ đề dùng chung vẫn được giữ
                  nguyên cho những cán bộ khác đang được giao/đang dùng.
                </>
              }
              style={{ marginBottom: 16 }}
            />
            <Typography.Text>
              Gõ đúng mã CB <Typography.Text code>{superDeleteTarget.cbCode}</Typography.Text> để xác nhận:
            </Typography.Text>
            <Input
              style={{ marginTop: 8 }}
              placeholder={superDeleteTarget.cbCode}
              value={superDeleteConfirmText}
              onChange={(e) => setSuperDeleteConfirmText(e.target.value)}
              onPressEnter={() => {
                if (superDeleteTarget && superDeleteConfirmText.trim() === superDeleteTarget.cbCode) {
                  superDeleteMut.mutate(superDeleteTarget.id)
                }
              }}
            />
          </>
        )}
      </Modal>

      {/* Modal: Kết quả Super Delete */}
      <Modal
        title="Đã xóa triệt để"
        open={superDeleteResultOpen}
        onOk={() => setSuperDeleteResultOpen(false)}
        onCancel={() => setSuperDeleteResultOpen(false)}
        cancelButtonProps={{ style: { display: 'none' } }}
        okText="Đóng"
      >
        {superDeleteResult && (
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>Lượt thi: <strong>{superDeleteResult.quizAttempts}</strong></li>
            <li>Bài nộp: <strong>{superDeleteResult.submissions}</strong></li>
            <li>Phân công: <strong>{superDeleteResult.assignments}</strong></li>
            <li>Huy hiệu: <strong>{superDeleteResult.userBadges}</strong></li>
            <li>Giao dịch XP: <strong>{superDeleteResult.xpTransactions}</strong></li>
            <li>Câu hỏi hàng ngày đã trả lời: <strong>{superDeleteResult.dailyQuestionAttempts}</strong></li>
            <li>Thẻ ôn tập ngắt quãng: <strong>{superDeleteResult.reviewCards}</strong></li>
          </ul>
        )}
      </Modal>

      {/* Modal: Import GAHR26 */}
      <Modal
        title="Import cán bộ từ file GAHR26"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        footer={<Button onClick={() => setImportOpen(false)}>Đóng</Button>}
        width={1100}
      >
        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 8px', color: '#555', fontSize: 13 }}>
            Chọn file <strong>*gahr26*.csv</strong> hoặc <strong>.xls/.xlsx</strong>.
            File cần có cột: <code>EMPNO</code>, <code>BRCD</code>, <code>BRNM</code>, <code>DEPTNM</code>, <code>POSITION</code>, <code>SEX</code>, <code>BIRTHDT</code>.
            Username đăng nhập luôn lấy theo <code>EMPNO</code> (mã cán bộ).
          </p>
          <Upload
            accept=".csv,.xls,.xlsx"
            showUploadList={false}
            beforeUpload={(file) => {
              setImportResult(null)
              importMut.mutate(file)
              return false
            }}
          >
            <Button icon={<UploadOutlined />} loading={importMut.isPending} type="primary">
              {importMut.isPending ? 'Đang xử lý...' : 'Chọn file để import'}
            </Button>
          </Upload>
        </div>

        {importResult && (
          <>
            <Alert
              type={importResult.errors.length > 0 ? 'warning' : 'success'}
              message={
                <span>
                  ✅ Thêm mới: <strong>{importResult.created}</strong> &nbsp;|&nbsp;
                  🔄 Cập nhật: <strong>{importResult.updated}</strong> &nbsp;|&nbsp;
                  ⏭️ Bỏ qua: <strong>{importResult.skipped}</strong>
                  {importResult.errors.length > 0 && <> &nbsp;|&nbsp; ❌ Lỗi: <strong>{importResult.errors.length}</strong></>}
                </span>
              }
              style={{ marginBottom: 12 }}
            />
            {importResult.errors.length > 0 && (
              <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 4, padding: '8px 12px', marginBottom: 12, maxHeight: 120, overflow: 'auto' }}>
                {importResult.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#d46b08' }}>{e}</div>)}
              </div>
            )}
            <Table
              size="small"
              rowKey="empno"
              dataSource={importResult.rows}
              pagination={{ pageSize: 10, size: 'small' }}
              scroll={{ x: 900 }}
              columns={[
                { title: 'EMPNO', dataIndex: 'empno', width: 110 },
                { title: 'Họ tên', dataIndex: 'fullName', width: 160 },
                { title: 'Mã CN (BRCD)', dataIndex: 'branchCode', width: 110 },
                { title: 'Tên chi nhánh (BRNM)', dataIndex: 'branchName', width: 200 },
                { title: 'Phòng ban (DEPTNM)', dataIndex: 'deptName', width: 180 },
                { title: 'Chức vụ (POSITION)', dataIndex: 'position', width: 160 },
                {
                  title: 'Kết quả', dataIndex: 'action', width: 100,
                  render: (a: string) => {
                    if (a === 'created') return <Tag color="green">Thêm mới</Tag>
                    if (a === 'updated') return <Tag color="blue">Cập nhật</Tag>
                    if (a === 'skipped') return <Tag color="default">Bỏ qua</Tag>
                    return <Tag color="red">Lỗi</Tag>
                  },
                },
                { title: 'Ghi chú', dataIndex: 'note', render: (n?: string) => n ? <span style={{ color: '#cf1322', fontSize: 12 }}>{n}</span> : null },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  )
}
