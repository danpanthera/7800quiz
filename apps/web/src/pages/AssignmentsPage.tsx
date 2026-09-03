import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Tag, Typography, Badge, Button, Space, Popconfirm, App,
  Modal, Form, Select, DatePicker, Radio, Divider,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined, ApartmentOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../lib/api'

interface Assignment {
  id: string
  quiz: { id: string; title: string }
  user: { id: string; fullName: string } | null
  canBo: { id: string; fullName: string; cbCode: string; department?: { id: string; name: string } | null } | null
  department: { id: string; name: string; parentId?: string | null } | null
  startAt: string | null
  endAt: string | null
  status: string
}
interface Quiz { id: string; title: string }
interface Department {
  id: string; name: string; code: string; parentId?: string | null;
  parent?: { id: string; name: string; code: string } | null;
  _count?: { children: number }
}
interface CanBoItem {
  id: string; fullName: string; cbCode: string; username?: string | null; isActive: boolean;
  departmentId?: string | null;
  department?: { id: string; name: string; code: string; parentId?: string | null; parent?: { id: string; name: string; code: string } | null } | null;
}

// Thứ tự đơn vị cố định
const UNIT_ORDER = ['01-HS','02-BL','03-PT','04-SH','05-BT','06-TU','07-DK','08-TAU','09-NH']

export default function AssignmentsPage() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Assignment | null>(null)
  const [form] = Form.useForm()

  // State cho form tạo mới
  const [assignTarget, setAssignTarget] = useState<'all' | 'custom' | 'department'>('custom')
  const [filterUnitId, setFilterUnitId] = useState<string | undefined>()
  const [filterDeptId, setFilterDeptId] = useState<string | undefined>()

  const { data = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['assignments'],
    queryFn: () => api.get('/admin/assignments').then((r) => r.data),
  })
  const { data: quizzes = [] } = useQuery<Quiz[]>({
    queryKey: ['quizzes'],
    queryFn: () => api.get('/admin/quizzes').then((r) => r.data),
  })
  const { data: canBoList = [] } = useQuery<CanBoItem[]>({
    queryKey: ['can-bo'],
    queryFn: () => api.get('/admin/can-bo').then((r) => r.data),
  })
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/admin/departments').then((r) => r.data),
  })

  // Đơn vị cấp 1 có sub-dept hoặc có user trực tiếp, sort theo UNIT_ORDER
  const topUnits = useMemo(() =>
    departments
      .filter(d => !d.parentId && (d._count?.children ?? 0) > 0)
      .sort((a, b) => {
        const ia = UNIT_ORDER.indexOf(a.code), ib = UNIT_ORDER.indexOf(b.code)
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      }),
    [departments]
  )

  // Sub-depts của unit đang chọn — chỉ hiển thị depts thực sự có canBo active
  const subDepts = useMemo(() => {
    if (!filterUnitId) return []
    const activeCanBoDeptIds = new Set(
      canBoList.filter(c => c.isActive).map(c => c.departmentId).filter(Boolean) as string[]
    )
    return departments.filter(d => d.parentId === filterUnitId && activeCanBoDeptIds.has(d.id))
  }, [departments, filterUnitId, canBoList])

  // CanBo lọc theo unit+dept
  const filteredCanBo = useMemo(() => {
    return canBoList.filter(c => {
      if (!c.isActive) return false
      if (filterDeptId) return c.departmentId === filterDeptId
      if (filterUnitId) {
        const deptParentId = c.department?.parentId ?? c.department?.parent?.id
        return deptParentId === filterUnitId || c.departmentId === filterUnitId
      }
      return true
    }).sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'vi'))
  }, [canBoList, filterUnitId, filterDeptId])

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/admin/assignments', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignments'] }); closeModal(); message.success('Đã tạo phân công') },
    onError: (e: any) => message.error(e.response?.data?.message ?? 'Lỗi'),
  })
  const bulkMut = useMutation({
    mutationFn: (d: any) => api.post('/admin/assignments/bulk', d),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['assignments'] })
      closeModal()
      message.success(`Đã tạo ${res.data.count} phân công`)
    },
    onError: (e: any) => message.error(e.response?.data?.message ?? 'Lỗi'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) => api.put(`/admin/assignments/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignments'] }); closeModal(); message.success('Đã cập nhật') },
    onError: (e: any) => message.error(e.response?.data?.message ?? 'Lỗi'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/assignments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignments'] }); message.success('Đã xóa phân công') },
    onError: (e: any) => message.error(e.response?.data?.message ?? 'Lỗi khi xóa'),
  })

  const openNew = () => {
    setEditItem(null)
    setAssignTarget('custom')
    setFilterUnitId(undefined)
    setFilterDeptId(undefined)
    setModalOpen(true)
  }
  const openEdit = (row: Assignment) => {
    setEditItem(row)
    if (row.department) {
      setAssignTarget('department')
      setFilterUnitId(row.department.parentId ?? undefined)
    } else {
      setAssignTarget(row.canBo || row.user ? 'custom' : 'all')
      setFilterUnitId(undefined)
    }
    setFilterDeptId(undefined)
    setModalOpen(true)
  }
  const closeModal = () => {
    setModalOpen(false)
  }

  const handleSubmit = (values: any) => {
    const base = {
      status: values.status,
      startAt: values.startAt ? values.startAt.toISOString() : null,
      endAt: values.endAt ? values.endAt.toISOString() : null,
    }
    if (editItem) {
      const updatePayload: any = { ...base, quizId: values.quizId }
      if (assignTarget === 'all') {
        // Giao cho tất cả: không thay đổi đối tượng
      } else if (assignTarget === 'department') {
        const deptIds: string[] = values.departmentIds ?? []
        if (deptIds.length > 1) {
          message.warning('Sửa phân công chỉ hỗ trợ 1 phòng ban. Để giao nhiều phòng ban, vui lòng tạo phân công mới.')
          return
        }
        if (deptIds.length === 1) updatePayload.departmentId = deptIds[0]
      } else {
        const ids: string[] = values.canBoIds ?? []
        if (ids.length === 1) updatePayload.canBoId = ids[0]
      }
      updateMut.mutate({ id: editItem.id, ...updatePayload })
      return
    }
    // Tạo mới
    if (assignTarget === 'all') {
      bulkMut.mutate({ quizId: values.quizId, canBoIds: 'all', ...base })
    } else if (assignTarget === 'department') {
      const deptIds: string[] = values.departmentIds ?? []
      if (!deptIds.length) { message.warning('Vui lòng chọn ít nhất 1 phòng ban'); return }
      bulkMut.mutate({ quizId: values.quizId, departmentIds: deptIds, ...base })
    } else {
      const ids: string[] = values.canBoIds ?? []
      if (!ids.length) { message.warning('Vui lòng chọn ít nhất 1 cán bộ'); return }
      if (ids.length === 1) {
        createMut.mutate({ quizId: values.quizId, canBoId: ids[0], ...base })
      } else {
        bulkMut.mutate({ quizId: values.quizId, canBoIds: ids, ...base })
      }
    }
  }

  const columns = [
    { title: 'Bộ đề', dataIndex: ['quiz', 'title'], ellipsis: true },
    {
      title: 'Giao cho',
      render: (_: unknown, row: Assignment) =>
        row.canBo ? row.canBo.fullName
          : row.user ? row.user.fullName
          : (row.department?.name ?? '—'),
    },
    {
      title: 'Loại', width: 100,
      render: (_: unknown, row: Assignment) =>
        row.canBo ? <Tag color="blue">Cán bộ</Tag>
          : row.user ? <Tag color="cyan">Tài khoản</Tag>
          : <Tag color="green">Phòng ban</Tag>,
    },
    {
      title: 'Mở từ', dataIndex: 'startAt', width: 130,
      render: (v: string | null) => v ? new Date(v).toLocaleDateString('vi-VN') : '—',
    },
    {
      title: 'Đến', dataIndex: 'endAt', width: 130,
      render: (v: string | null) => v ? new Date(v).toLocaleDateString('vi-VN') : '—',
    },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 110,
      render: (v: string) => (
        <Badge status={v === 'ACTIVE' ? 'success' : v === 'DRAFT' ? 'warning' : 'default'}
          text={v === 'ACTIVE' ? 'Đang mở' : v === 'DRAFT' ? 'Nháp' : 'Đã đóng'} />
      ),
    },
    {
      title: '', width: 90,
      render: (_: unknown, row: Assignment) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(row)} />
          <Popconfirm title="Xóa phân công này?" onConfirm={() => deleteMut.mutate(row.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const isPending = createMut.isPending || bulkMut.isPending || updateMut.isPending

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Phân công quiz</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>Tạo phân công</Button>
      </div>
      <Table rowKey="id" loading={isLoading} dataSource={data} columns={columns} pagination={{ pageSize: 20 }} size="small" />

      <Modal
        title={editItem ? 'Sửa phân công' : 'Tạo phân công mới'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={isPending}
        width={560}
        afterOpenChange={(open) => {
          if (!open) return
          if (editItem) {
            form.setFieldsValue({
              quizId: editItem.quiz.id,
              canBoIds: editItem.canBo ? [editItem.canBo.id] : undefined,
              departmentIds: editItem.department ? [editItem.department.id] : undefined,
              status: editItem.status,
              startAt: editItem.startAt ? dayjs(editItem.startAt) : null,
              endAt: editItem.endAt ? dayjs(editItem.endAt) : null,
            })
          }
        }}
        afterClose={() => {
          form.resetFields()
          setEditItem(null)
          setAssignTarget('custom')
          setFilterUnitId(undefined)
          setFilterDeptId(undefined)
        }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ status: 'ACTIVE' }}>
          <>
            <Form.Item name="quizId" label="Bộ đề" rules={[{ required: true, message: 'Chọn bộ đề' }]}>
              <Select showSearch optionFilterProp="label" placeholder="Chọn bộ đề"
                options={quizzes.map((q) => ({ value: q.id, label: q.title }))} />
            </Form.Item>

            <Divider titlePlacement="left" style={{ marginTop: 4, marginBottom: 12 }}>Giao cho</Divider>

            {/* Lựa chọn kiểu giao */}
            <Radio.Group
              value={assignTarget}
              onChange={e => {
                setAssignTarget(e.target.value)
                setFilterUnitId(undefined)
                setFilterDeptId(undefined)
                form.setFieldValue('canBoIds', undefined)
                form.setFieldValue('departmentIds', undefined)
              }}
              style={{ marginBottom: 12 }}
            >
              <Radio value="all"><TeamOutlined /> Tất cả người dùng</Radio>
              <Radio value="custom">Chọn cá nhân cụ thể</Radio>
              <Radio value="department"><ApartmentOutlined /> Theo phòng ban</Radio>
            </Radio.Group>

            {assignTarget === 'department' && (
              <>
                {/* Chọn chi nhánh rồi multi-select nhiều phòng ban trong chi nhánh đó */}
                <Form.Item label="Chi nhánh" required style={{ marginBottom: 8 }}>
                  <Select
                    placeholder="Chọn chi nhánh"
                    allowClear
                    style={{ width: '100%' }}
                    value={filterUnitId}
                    onChange={val => { setFilterUnitId(val); form.setFieldValue('departmentIds', undefined) }}
                    options={topUnits.map(d => ({ value: d.id, label: d.name }))}
                  />
                </Form.Item>

                <Form.Item
                  name="departmentIds"
                  label={`Chọn phòng ban${subDepts.length ? ` (${subDepts.length} phòng ban)` : ''}`}
                  rules={[{ required: true, message: 'Chọn ít nhất 1 phòng ban' }]}
                >
                  <Select
                    mode="multiple"
                    showSearch
                    optionFilterProp="label"
                    disabled={!filterUnitId}
                    placeholder={filterUnitId ? 'Chọn 1 hoặc nhiều phòng ban...' : 'Chọn chi nhánh trước'}
                    maxTagCount="responsive"
                    options={subDepts.map(d => {
                      const unitName = topUnits.find(u => u.id === filterUnitId)?.name ?? ''
                      const label = unitName && d.name.toLowerCase().startsWith(unitName.toLowerCase())
                        ? d.name.slice(unitName.length).replace(/^\s*[-–]\s*/, '').trim()
                        : d.name
                      return { value: d.id, label }
                    })}
                  />
                </Form.Item>
              </>
            )}

            {assignTarget === 'custom' && (
              <>
                {/* Bộ lọc Chi nhánh → Phòng ban */}
                <Space style={{ marginBottom: 8, width: '100%' }} styles={{ item: { flex: 1 } }}>
                  <Select
                    placeholder="Lọc theo chi nhánh"
                    allowClear
                    style={{ width: '100%' }}
                    value={filterUnitId}
                    onChange={val => { setFilterUnitId(val); setFilterDeptId(undefined); form.setFieldValue('canBoIds', undefined) }}
                    options={topUnits.map(d => ({ value: d.id, label: d.name }))}
                  />
                  <Select
                    placeholder="Lọc theo phòng ban"
                    allowClear
                    style={{ width: '100%' }}
                    value={filterDeptId}
                    disabled={!filterUnitId}
                    onChange={val => { setFilterDeptId(val); form.setFieldValue('canBoIds', undefined) }}
                    options={subDepts.map(d => {
                      const unitName = topUnits.find(u => u.id === filterUnitId)?.name ?? ''
                      const label = unitName && d.name.toLowerCase().startsWith(unitName.toLowerCase())
                        ? d.name.slice(unitName.length).replace(/^\s*[-–]\s*/, '').trim()
                        : d.name
                      return { value: d.id, label }
                    })}
                  />
                </Space>

                {/* Multi-select cán bộ */}
                <Form.Item
                  name="canBoIds"
                  label={`Chọn cán bộ${filteredCanBo.length ? ` (${filteredCanBo.length} người)` : ''}`}
                  rules={[{ required: true, message: 'Chọn ít nhất 1 cán bộ' }]}
                >
                  <Select
                    mode="multiple"
                    showSearch
                    optionFilterProp="label"
                    placeholder="Tìm và chọn cán bộ..."
                    maxTagCount="responsive"
                    options={filteredCanBo.map(c => ({
                      value: c.id,
                      label: `${c.fullName}${c.cbCode ? ` (${c.cbCode})` : ''}`,
                    }))}
                  />
                </Form.Item>
              </>
            )}
          </>

          <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="DRAFT">Nháp</Radio>
              <Radio value="ACTIVE">Đang mở</Radio>
              <Radio value="CLOSED">Đã đóng</Radio>
            </Radio.Group>
          </Form.Item>
          <Space size={16}>
            <Form.Item name="startAt" label="Mở từ">
              <DatePicker showTime format="DD/MM/YYYY HH:mm" placeholder="Không giới hạn" />
            </Form.Item>
            <Form.Item name="endAt" label="Đến">
              <DatePicker showTime format="DD/MM/YYYY HH:mm" placeholder="Không giới hạn" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  )
}
