import { tenHienThi } from './ten-hien-thi.util';

describe('tenHienThi', () => {
  it('có biệt danh → hiện biệt danh', () => {
    expect(tenHienThi('Cú Đêm Bí Ẩn', 'Nguyễn Văn A')).toBe('Cú Đêm Bí Ẩn');
  });

  it('biệt danh chỉ có khoảng trắng → coi như chưa đặt, hiện tên thật', () => {
    expect(tenHienThi('   ', 'Nguyễn Văn A')).toBe('Nguyễn Văn A');
  });

  it('không có biệt danh (null/undefined) → hiện tên thật', () => {
    expect(tenHienThi(null, 'Nguyễn Văn A')).toBe('Nguyễn Văn A');
    expect(tenHienThi(undefined, 'Nguyễn Văn A')).toBe('Nguyễn Văn A');
  });

  it('biệt danh có khoảng trắng thừa 2 đầu → cắt gọn trước khi hiện', () => {
    expect(tenHienThi('  Cú Đêm  ', 'Nguyễn Văn A')).toBe('Cú Đêm');
  });
});
