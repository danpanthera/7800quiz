import { Injectable, Logger } from '@nestjs/common';
import { Client, InvalidCredentialsError } from 'ldapts';

// Kết quả 1 lần thử bind — phân biệt rõ "sai mật khẩu" (lỗi của người dùng,
// tính vào bộ đếm khoá tài khoản như mật khẩu nội bộ) với "AD không phản
// hồi" (lỗi hạ tầng, KHÔNG được tính là 1 lần sai, càng không được lùi về
// xác thực nội bộ — fail-closed đã chốt với Sếp).
export type KetQuaBindAD =
  | { ok: true }
  | { ok: false; lyDo: 'saiMatKhau' | 'khongKetNoiDuoc' };

@Injectable()
export class LdapAuthService {
  private readonly logger = new Logger(LdapAuthService.name);

  // Giá trị mặc định khớp đúng kết quả đã dò được trên RODC PROD
  // (7800-RODC-01.corp.agribank.com.vn, cổng 636 LDAPS) — xem
  // scripts/kiem-tra-ldap-rodc.sh. Cho phép ghi đè bằng biến môi trường nếu
  // sau này đổi máy chủ, không cần build lại image.
  // Dùng .trim() || thay vì ?? — docker-compose truyền biến không đặt trong
  // .env.prod thành CHUỖI RỖNG (không phải undefined), ?? sẽ không bắt được.
  private readonly url =
    process.env.LDAP_URL?.trim() ||
    'ldaps://7800-RODC-01.corp.agribank.com.vn:636';
  // Định dạng tên đăng nhập gửi lên AD khi bind — "%s" thay bằng username.
  // Mặc định kiểu "down-level" CORP\username — theo đúng xác nhận của Sếp:
  // đây là cách cán bộ vẫn gõ ở màn hình đăng nhập Windows/AD của ngân hàng
  // (CORP là NetBIOS domain, cũng thấy trong SAN chứng chỉ RODC). CHƯA thử
  // bind thật lần nào — nếu tài khoản test vẫn báo sai mật khẩu dù gõ đúng
  // mật khẩu AD thật, thử đổi biến này sang kiểu UPN "%s@corp.agribank.com.vn"
  // rồi khởi động lại container, KHÔNG cần build lại.
  private readonly bindTemplate =
    process.env.LDAP_BIND_TEMPLATE?.trim() || 'CORP\\%s';
  private readonly timeoutMs = Number(process.env.LDAP_TIMEOUT_MS) || 5000;

  // Bind pass-through: gửi thẳng username/password người dùng vừa gõ lên AD
  // để chính AD tự xác thực — không dùng tài khoản dịch vụ, không lưu, không
  // đồng bộ mật khẩu AD về phía ứng dụng. Kết quả bind NÀY chính là kết quả
  // xác thực, dùng đúng 1 lần rồi bỏ.
  async binhBangMatKhauAD(
    username: string,
    password: string,
  ): Promise<KetQuaBindAD> {
    const client = new Client({
      url: this.url,
      connectTimeout: this.timeoutMs,
      timeout: this.timeoutMs,
    });
    try {
      await client.bind(this.bindTemplate.replace('%s', username), password);
      return { ok: true };
    } catch (err: unknown) {
      // resultCode 49 (InvalidCredentialsError) gộp chung mọi lý do AD từ
      // chối bind — sai mật khẩu, tài khoản khoá/hết hạn/ngoài giờ đăng nhập
      // (AD phân biệt bằng mã phụ "data 52e/525/530/..." trong message, IT
      // tra ở log nếu cần) — với người dùng thì đều là "không vào được", nên
      // gộp thành 1 thông báo quen thuộc.
      if (err instanceof InvalidCredentialsError) {
        return { ok: false, lyDo: 'saiMatKhau' };
      }
      const thongDiep = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Bind AD thất bại cho "${username}" — không phải do sai mật khẩu: ${thongDiep}`,
      );
      return { ok: false, lyDo: 'khongKetNoiDuoc' };
    } finally {
      try {
        await client.unbind();
      } catch {
        // Bỏ qua — bind có thể chưa từng thành công nên chưa có gì để unbind.
      }
    }
  }
}
