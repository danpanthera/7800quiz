import { useMemo, useState, type Key } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Checkbox, Input, Select, Space, Tag, Typography, DatePicker } from 'antd'
import { ClearOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import ManageTable from '../components/ManageTable'
import api from '../lib/api'

const { Text } = Typography
const { RangePicker } = DatePicker

interface AuditLogRow {
  id: string
  userId: string | null
  userName: string | null
  username: string | null
  action: string
  entityId: string | null
  meta: unknown
  ipAddress: string | null
  createdAt: string
}

// Diễn giải các action đã biết sang tiếng Việt — action lạ (chưa có trong map)
// vẫn hiện nguyên chuỗi gốc, không rơi vào lỗi hay bị ẩn đi.
const ACTION_LABEL: Record<string, { label: string; color: string }> = {
  LOGIN: { label: 'Đăng nhập', color: 'blue' },
  START_ATTEMPT: { label: 'Bắt đầu làm bài', color: 'processing' },
  FINALIZE_ATTEMPT: { label: 'Nộp bài', color: 'success' },
  SUBMIT: { label: 'Nộp bài (offline cũ)', color: 'success' },
  DELETE_REPORTS_BULK: { label: 'Xóa bài thi (hàng loạt)', color: 'error' },
  DELETE_CAN_BO: { label: 'Xóa cán bộ', color: 'error' },
  DELETE_CAN_BO_BULK: { label: 'Xóa cán bộ (hàng loạt)', color: 'error' },
  RESET_CAN_BO_PASSWORDS: { label: 'Reset mật khẩu cán bộ', color: 'warning' },
  CLEAR_AUDIT_LOGS: { label: 'Dọn nhật ký quản trị', color: 'error' },
}

function formatMeta(meta: unknown): string {
  if (meta === null || meta === undefined) return '—'
  try {
    return JSON.stringify(meta)
  } catch {
    return '—'
  }
}

export default function AuditLogsPage() {
  const qc = useQueryClient()
  const { message, modal } = App.useApp()
  const [searchName, setSearchName] = useState('')
  const [filterAction, setFilterAction] = useState<string>()
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  // Mặc định BẬT: dọn nhật ký sẽ không đụng tới dòng do chính ADMIN thực hiện,
  // tránh xóa mất dấu vết hành động của quản trị viên (từng có sự cố mất dấu
  // vết audit trước đây — xem admin.service.ts deleteReports()).
  const [excludeAdmin, setExcludeAdmin] = useState(true)
  const [exporting, setExporting] = useState(false)

  const serverFilters = {
    action: filterAction,
    from: dateRange?.[0]?.startOf('day').toISOString(),
    to: dateRange?.[1]?.endOf('day').toISOString(),
  }

  const { data: rows = [], isLoading } = useQuery<AuditLogRow[]>({
    queryKey: ['audit-logs', filterAction, serverFilters.from, serverFilters.to],
    queryFn: () => api.get('/admin/audit-logs', { params: serverFilters }).then((r) => r.data),
  })

  const actionOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.action))]
        .sort()
        .map((a) => ({ value: a, label: ACTION_LABEL[a]?.label ?? a })),
    [rows],
  )

  const filtered = useMemo(() => {
    const q = searchName.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        (r.userName ?? '').toLowerCase().includes(q) ||
        (r.username ?? '').toLowerCase().includes(q),
    )
  }, [rows, searchName])

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/admin/audit-logs/export', { params: serverFilters, responseType: 'blob' })
      const cd = res.headers['content-disposition'] ?? ''
      const match = cd.match(/filename\*=UTF-8''(.+)/) ?? cd.match(/filename="(.+)"/)
      const filename = match ? decodeURIComponent(match[1]) : 'NhatKyQuanTri.xlsx'
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
      message.success('Đã tải xuống file Excel')
    } catch {
      message.error('Lỗi khi xuất Excel')
    } finally {
      setExporting(false)
    }
  }

  const clearMut = useMutation({
    mutationFn: (body: { ids?: string[]; excludeAdmin?: boolean }) =>
      api.delete('/admin/audit-logs', { data: { ...serverFilters, ...body } }).then((r) => r.data),
    onSuccess: (data: { deleted: number }) => {
      qc.invalidateQueries({ queryKey: ['audit-logs'] })
      setSelectedRowKeys([])
      message.success(`Đã xóa ${data.deleted} dòng nhật ký`)
    },
    onError: () => message.error('Lỗi khi xóa nhật ký'),
  })

  function confirmClearSelected() {
    modal.confirm({
      title: `Xóa ${selectedRowKeys.length} dòng nhật ký đã chọn?`,
      content: excludeAdmin
        ? 'Các dòng thuộc tài khoản Admin (nếu có) sẽ được giữ lại. Hành động này không thể hoàn tác.'
        : 'Hành động này không thể hoàn tác.',
      okText: 'Xóa', okButtonProps: { danger: true }, cancelText: 'Hủy',
      onOk: () => clearMut.mutateAsync({ ids: selectedRowKeys as string[], excludeAdmin }),
    })
  }

  function confirmClearAll() {
    modal.confirm({
      title: 'Dọn toàn bộ nhật ký theo bộ lọc hiện tại?',
      content: excludeAdmin
        ? 'Đã áp dụng bộ lọc hành động/thời gian ở trên. Các dòng thuộc tài khoản Admin sẽ được giữ lại. Hành động này không thể hoàn tác.'
        : 'Đã áp dụng bộ lọc hành động/thời gian ở trên, kể cả các dòng của tài khoản Admin. Hành động này không thể hoàn tác.',
      okText: 'Dọn nhật ký', okButtonProps: { danger: true }, cancelText: 'Hủy',
      onOk: () => clearMut.mutateAsync({ excludeAdmin }),
    })
  }

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      width: 170,
      sorter: (a: AuditLogRow, b: AuditLogRow) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      defaultSortOrder: 'descend' as const,
      render: (v: string) => new Date(v).toLocaleString('vi-VN'),
    },
    {
      title: 'Người thực hiện',
      dataIndex: 'userName',
      render: (v: string | null, r: AuditLogRow) => v ?? r.username ?? <Text type="secondary">Hệ thống</Text>,
    },
    {
      title: 'Hành động',
      dataIndex: 'action',
      render: (v: string) => <Tag color={ACTION_LABEL[v]?.color ?? 'default'}>{ACTION_LABEL[v]?.label ?? v}</Tag>,
    },
    {
      title: 'Đối tượng',
      dataIndex: 'entityId',
      render: (v: string | null) => v ? <Text code style={{ fontSize: 12 }}>{v}</Text> : '—',
    },
    {
      title: 'Chi tiết',
      dataIndex: 'meta',
      ellipsis: true,
      render: (v: unknown) => <Text type="secondary" style={{ fontSize: 12 }}>{formatMeta(v)}</Text>,
    },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      width: 130,
      render: (v: string | null) => v ?? '—',
    },
  ]

  return (
    <div className="page-stack">
      <header className="page-title-row" style={{ marginBottom: 16 }}>
        <div>
          <Text className="page-eyebrow">7800Quiz</Text>
          <Typography.Title level={1}>Nhật ký quản trị</Typography.Title>
        </div>
      </header>

      <Space wrap style={{ marginBottom: 12 }}>
        <Input
          placeholder="Tìm theo người thực hiện..."
          style={{ width: 260 }}
          allowClear
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
        />
        <Select
          placeholder="Hành động"
          style={{ width: 220 }}
          allowClear
          value={filterAction}
          onChange={setFilterAction}
          options={actionOptions}
        />
        <RangePicker value={dateRange} onChange={(v) => setDateRange(v)} />
        <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
          Xuất Excel
        </Button>
      </Space>

      <Space wrap style={{ marginBottom: 12 }}>
        <Checkbox checked={excludeAdmin} onChange={(e) => setExcludeAdmin(e.target.checked)}>
          Loại trừ nhật ký của Admin khi xóa
        </Checkbox>
        {selectedRowKeys.length > 0 && (
          <Button
            icon={<DeleteOutlined />}
            danger
            loading={clearMut.isPending}
            onClick={confirmClearSelected}
          >
            Xóa đã chọn ({selectedRowKeys.length})
          </Button>
        )}
        <Button icon={<ClearOutlined />} danger loading={clearMut.isPending} onClick={confirmClearAll}>
          Dọn nhật ký
        </Button>
      </Space>

      <ManageTable<AuditLogRow>
        rowKey="id"
        loading={isLoading}
        dataSource={filtered}
        columns={columns}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          preserveSelectedRowKeys: true,
        }}
        pagination={{ defaultPageSize: 50, showSizeChanger: true, pageSizeOptions: ['20', '50', '100', '200'] }}
        size="small"
        scroll={{ x: 'max-content' }}
        cardHeading={(r) => <Tag color={ACTION_LABEL[r.action]?.color ?? 'default'}>{ACTION_LABEL[r.action]?.label ?? r.action}</Tag>}
        cardMeta={[
          { label: 'Thời gian', render: (r) => new Date(r.createdAt).toLocaleString('vi-VN') },
          { label: 'Người thực hiện', render: (r) => r.userName ?? r.username ?? 'Hệ thống' },
          { label: 'Đối tượng', render: (r) => r.entityId ?? '—' },
          { label: 'Chi tiết', render: (r) => formatMeta(r.meta) },
        ]}
        emptyText="Chưa có nhật ký nào khớp bộ lọc"
      />
    </div>
  )
}
