import { useCallback, useLayoutEffect, useRef, useState, type Key, type ReactNode } from 'react'
import { Card, Checkbox, List, Table } from 'antd'
import type { ColumnsType, TableProps } from 'antd/es/table'
import type { PaginationConfig } from 'antd/es/pagination'
import { Resizable } from 'react-resizable'
import type { ResizeCallbackData } from 'react-resizable'
import { useDeviceType } from '../hooks/useDeviceType'

export interface ManageTableCardField<T> {
  label: string
  render: (record: T) => ReactNode
}

// Record<string, any> — bắt buộc dùng `any` chứ không phải `unknown` ở đây: các interface record
// hiện có trong repo (Quiz, Question, CanBoItem...) không khai báo index signature, nên chỉ thoả mãn
// ràng buộc generic Record<string, X> khi X là `any` (kiểm chứng bằng tsc: đổi qua `unknown` làm vỡ
// build ở toàn bộ 9 trang đang dùng component này).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ManageTableProps<T extends Record<string, any>>
  extends Omit<TableProps<T>, 'columns' | 'dataSource' | 'rowKey' | 'size'> {
  rowKey: string | ((record: T) => string)
  columns: ColumnsType<T>
  dataSource: T[]
  /** Áp dụng cho nhánh Table (desktop/tablet ngang) — mặc định 'small' như các trang quản lý hiện có */
  size?: TableProps<T>['size']
  /** Dòng tiêu đề đậm trong thẻ (thường là tên/nội dung chính của bản ghi) */
  cardHeading: (record: T) => ReactNode
  /** Badge/trạng thái ở góc phải dòng tiêu đề, tuỳ chọn */
  cardBadge?: (record: T) => ReactNode
  /** Lưới key-value hiển thị dưới tiêu đề — để mảng rỗng nếu không cần */
  cardMeta: ManageTableCardField<T>[]
  /** Khối nội dung phụ (vd danh sách đáp án) — nằm dưới meta, trên actions */
  cardExtra?: (record: T) => ReactNode
  /** Nút thao tác — bỏ qua nếu trang chỉ đọc */
  cardActions?: (record: T) => ReactNode
  emptyText?: string
}

/** Phân trang mặc định cho các trang quản lý — 50 dòng/trang, cho phép đổi */
const PHAN_TRANG_MAC_DINH = {
  defaultPageSize: 50,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100', '200'],
}

/** Khoá nhận diện ổn định của 1 cột — dùng để nhớ độ rộng đã kéo tay qua các lần render. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function layKhoaCot(cot: any, idx: number): string {
  if (cot.key != null) return String(cot.key)
  if (typeof cot.dataIndex === 'string') return cot.dataIndex
  if (Array.isArray(cot.dataIndex)) return cot.dataIndex.join('.')
  return `cot-${idx}`
}

interface OTieuDeProps extends React.HTMLAttributes<HTMLElement> {
  width?: number
  onResize?: (e: React.SyntheticEvent, data: ResizeCallbackData) => void
}

/**
 * Ô tiêu đề cột kéo giãn được bằng chuột. Cột chưa có độ rộng cố định (để máy
 * tự autofit theo nội dung thật nhờ `scroll={{ x: 'max-content' }}` mặc định
 * bên dưới) thì tự đo độ rộng đang hiển thị qua ResizeObserver, để tay kéo
 * luôn bắt đầu đúng chỗ mà không cần từng trang khai báo độ rộng tay.
 */
function OTieuDeKeoGian({ width, onResize, ...restProps }: OTieuDeProps) {
  const thRef = useRef<HTMLTableCellElement>(null)
  const [doRongDo, setDoRongDo] = useState<number>()

  useLayoutEffect(() => {
    if (width !== undefined || !onResize) return
    const el = thRef.current
    if (!el) return
    const quanSat = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setDoRongDo(w)
    })
    quanSat.observe(el)
    return () => quanSat.disconnect()
  }, [width, onResize])

  const doRongHienTai = width ?? doRongDo

  if (!onResize || !doRongHienTai) {
    return <th ref={thRef} {...restProps} />
  }

  return (
    <Resizable
      width={doRongHienTai}
      height={0}
      handle={<span className="manage-table-resize-handle" onClick={(e) => e.stopPropagation()} />}
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} ref={thRef} style={{ ...restProps.style, position: 'relative' }} />
    </Resizable>
  )
}

/**
 * Bảng dữ liệu thích ứng thiết bị: hiển thị Table antd bình thường từ tablet ngang/desktop (≥768px),
 * chuyển sang danh sách thẻ (List/Card) trên phone — tổng quát hoá pattern đã dùng ở QuizzesPage.
 *
 * Nhánh Table nhận nguyên mọi prop Table antd khác (components, expandable, onChange, rowClassName...)
 * qua passthrough — migrate 1 bảng đang có sẵn chỉ cần bọc lại, không mất tính năng ở desktop/tablet ngang.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ManageTable<T extends Record<string, any>>(props: ManageTableProps<T>) {
  const {
    cardHeading, cardBadge, cardMeta, cardExtra, cardActions, emptyText,
    columns, dataSource, rowKey, loading, rowSelection, size, pagination,
    scroll, components,
    ...restTableProps
  } = props
  const { screens } = useDeviceType()
  const isCardView = !screens.md
  // `pagination={false}` (tắt hẳn) vẫn được giữ nguyên, chỉ điền mặc định khi trang không khai báo
  const phanTrang = pagination ?? PHAN_TRANG_MAC_DINH
  // Nhớ độ rộng các cột Sếp đã tự kéo tay, theo khoá ổn định (key/dataIndex), không theo index
  // render — tránh trường hợp trang tự tính lại mảng columns mỗi lần render làm mất độ rộng vừa kéo.
  const [doRongTuyChinh, setDoRongTuyChinh] = useState<Record<string, number>>({})

  const handleResize = useCallback(
    (khoa: string) => (_: React.SyntheticEvent, { size: kichThuoc }: ResizeCallbackData) => {
      setDoRongTuyChinh((prev) => ({ ...prev, [khoa]: kichThuoc.width }))
    },
    [],
  )

  const getKey = (record: T): string =>
    typeof rowKey === 'function' ? rowKey(record) : String(record[rowKey])

  if (!isCardView) {
    // Không cột nào khai báo width thì để Table tự autofit theo nội dung thật (nhờ
    // scroll.x='max-content' bên dưới) — cột nào Sếp đã kéo tay thì khoá đúng độ rộng đó.
    // Luôn bọc onHeaderCell để MỌI cột (kể cả cột thao tác không khai báo width) đều kéo được.
    const cotHienThi: ColumnsType<T> = columns.map((cot, idx) => {
      const khoa = layKhoaCot(cot, idx)
      const daKeo = doRongTuyChinh[khoa]
      const laCotCuoi = idx === columns.length - 1
      return {
        ...cot,
        width: daKeo ?? cot.width,
        // Cột cuối cùng theo quy ước luôn là cột thao tác — ghim cố định bên phải để
        // luôn thấy trọn vẹn nút bấm, không phụ thuộc Sếp có nhớ cuộn ngang hay không
        // (thanh cuộn macOS mặc định ẩn, trông y như bị mất nội dung nếu không ghim).
        fixed: laCotCuoi ? (cot.fixed ?? 'right') : cot.fixed,
        onHeaderCell: (c: { width?: number | string }) => ({
          width: typeof c.width === 'number' ? c.width : undefined,
          onResize: handleResize(khoa),
        }),
      }
    }) as ColumnsType<T>

    return (
      <Table<T>
        rowKey={rowKey}
        columns={cotHienThi}
        dataSource={dataSource}
        loading={loading}
        size={size ?? 'small'}
        pagination={phanTrang}
        rowSelection={rowSelection}
        // Mặc định cho phép cuộn ngang thay vì cắt cụt nội dung khi bảng rộng hơn khung nhìn
        // (khung ngoài .ant-table-wrapper có overflow:hidden để bo góc — không có scroll.x thì
        // nội dung tràn, vd. cột thao tác nhiều nút, sẽ bị CẮT MẤT thay vì cuộn được tới).
        scroll={scroll ?? { x: 'max-content' }}
        components={{ ...components, header: { ...components?.header, cell: OTieuDeKeoGian } }}
        {...restTableProps}
      />
    )
  }

  const selectedKeys = (rowSelection?.selectedRowKeys ?? []) as Key[]

  return (
    <List
      className="manage-card-list"
      loading={loading}
      dataSource={dataSource}
      // Cấu hình phân trang Table/List của antd tương thích cấu trúc nhưng khai báo type riêng — ép kiểu về đúng type của List
      pagination={phanTrang as PaginationConfig | false | undefined}
      locale={{ emptyText: emptyText ?? 'Không có dữ liệu' }}
      renderItem={(record) => {
        const key = getKey(record)
        const checked = selectedKeys.includes(key)
        return (
          <List.Item key={key}>
            <Card className="manage-record-card" bordered={false}>
              <div className="manage-record-heading">
                {rowSelection && (
                  <span className="manage-record-select">
                    <Checkbox
                      checked={checked}
                      onChange={(e) => {
                        const nextKeys = e.target.checked
                          ? [...selectedKeys, key]
                          : selectedKeys.filter((k) => k !== key)
                        const nextRows = dataSource.filter((r) => nextKeys.includes(getKey(r)))
                        rowSelection.onChange?.(nextKeys, nextRows, { type: 'multiple' })
                      }}
                    />
                  </span>
                )}
                <div>{cardHeading(record)}</div>
                {cardBadge?.(record)}
              </div>

              {cardMeta.length > 0 && (
                <dl className="manage-record-meta">
                  {cardMeta.map((field) => (
                    <div key={field.label}>
                      <dt>{field.label}</dt>
                      <dd>{field.render(record)}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {cardExtra && <div className="manage-record-extra">{cardExtra(record)}</div>}
              {cardActions && <div className="manage-record-actions">{cardActions(record)}</div>}
            </Card>
          </List.Item>
        )
      }}
    />
  )
}
