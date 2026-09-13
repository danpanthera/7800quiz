import type { ReactNode } from 'react'
import { Alert, Anchor, Card, Col, Row, Table, Typography } from 'antd'

/**
 * Bảng tra cứu nhỏ trong trang hướng dẫn. Cố tình KHÔNG bật cuộn ngang: ô chứa
 * câu văn dài nên để chữ tự xuống dòng vừa bề ngang thẻ, dễ đọc hơn là phải
 * kéo ngang (thanh cuộn trên macOS lại mặc định ẩn, nhìn như bị cắt mất chữ).
 */
export function BangNho({
  cot, dong,
}: {
  cot: { title: string; dataIndex: string }[]
  dong: Record<string, string>[]
}) {
  return (
    <Table
      size="small"
      pagination={false}
      style={{ margin: '10px 0' }}
      rowKey={(r) => Object.values(r).join('|')}
      columns={cot}
      dataSource={dong}
    />
  )
}

export interface MucHuongDan {
  /** Dùng cho cả id neo trong trang lẫn khoá của mục lục bên phải */
  id: string
  tieuDe: string
  noiDung: ReactNode
}

/**
 * Khung chung cho các trang "Hướng dẫn sử dụng": tiêu đề, lời dẫn, mục lục neo
 * bên phải (ẩn trên màn hẹp vì đã có tiêu đề từng phần để cuộn) và thân nội
 * dung chia thành từng thẻ theo mục.
 */
export default function KhungHuongDan({
  tieuDe, moTa, cacMuc,
}: {
  tieuDe: string
  moTa: ReactNode
  cacMuc: MucHuongDan[]
}) {
  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>{tieuDe}</Typography.Title>
      <Alert type="info" showIcon message={moTa} style={{ marginBottom: 16 }} />

      <Row gutter={16}>
        <Col xs={24} lg={18}>
          {cacMuc.map((muc) => (
            <Card key={muc.id} id={muc.id} size="small" style={{ marginBottom: 16 }}>
              <Typography.Title level={4} style={{ marginTop: 0 }}>{muc.tieuDe}</Typography.Title>
              <div className="noi-dung-huong-dan">{muc.noiDung}</div>
            </Card>
          ))}
        </Col>
        <Col xs={0} lg={6}>
          <Anchor
            offsetTop={88}
            items={cacMuc.map((muc) => ({ key: muc.id, href: `#${muc.id}`, title: muc.tieuDe }))}
          />
        </Col>
      </Row>
    </>
  )
}
