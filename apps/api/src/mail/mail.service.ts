import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Gửi mail đứng tên CHÍNH admin/cán bộ IT đang thao tác — dùng đúng mật khẩu
 * hộp mail họ vừa gõ ngay lúc thao tác (KHÔNG bao giờ lưu vào DB, xem
 * admin.service.ts:resetCanBoPasswords). Máy chủ mail nội bộ ngân hàng dùng
 * chung xác thực với tài khoản Windows/AD, nên coi mật khẩu này nhạy cảm y
 * hệt mật khẩu AD thật — không log, không đưa vào lỗi trả về client.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  /**
   * null nếu chưa cấu hình máy chủ mail (MAIL_SMTP_HOST) trên server.
   * tenDangNhap: tài khoản ĐĂNG NHẬP SMTP — theo cấu hình POP/SMTP thật của
   * Agribank là username THUẦN (VD "datnguyentien2"), KHÔNG kèm đuôi
   * "@agribank.com.vn" — khác với địa chỉ hiển thị ở "From:" (xem guiMatKhauTam).
   */
  taoTransporter(
    tenDangNhap: string,
    matKhauMail: string,
  ): nodemailer.Transporter | null {
    const host = process.env.MAIL_SMTP_HOST?.trim();
    if (!host) return null;
    const secure = process.env.MAIL_SMTP_SECURE === 'true';
    return nodemailer.createTransport({
      host,
      port: Number(process.env.MAIL_SMTP_PORT ?? 587),
      secure,
      // Cổng 587 (mặc định) dùng STARTTLS chứ không phải TLS ngầm định như
      // cổng 465 — bắt buộc nâng cấp lên mã hoá, không âm thầm gửi chữ rõ nếu
      // máy chủ vì lý do gì đó không chào STARTTLS.
      requireTLS: !secure,
      auth: { user: tenDangNhap, pass: matKhauMail },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
    });
  }

  /**
   * Xác minh ĐÚNG 1 LẦN trước khi gửi hàng loạt — máy chủ mail nội bộ dùng
   * chung mật khẩu AD, nếu gõ sai mà cứ thử lại theo từng người trong danh
   * sách reset hàng loạt thì mỗi lần thử là một lần sai mật khẩu AD THẬT của
   * chính admin/cán bộ IT, có thể tự khoá luôn tài khoản Windows của họ.
   */
  async xacMinhKetNoi(
    transporter: nodemailer.Transporter,
  ): Promise<{ ok: true } | { ok: false; loi: string }> {
    try {
      await transporter.verify();
      return { ok: true };
    } catch (err: unknown) {
      this.logger.warn(
        `Xac minh ket noi mail that bai: ${err instanceof Error ? err.message : 'khong ro loi'}`,
      );
      return {
        ok: false,
        loi: 'Không đăng nhập được vào hộp mail — kiểm tra lại mật khẩu hoặc thử lại sau.',
      };
    }
  }

  async guiMatKhauTam(
    transporter: nodemailer.Transporter,
    nguoiGuiEmail: string,
    params: { nguoiNhanEmail: string; tenNguoiNhan: string; matKhauTam: string },
  ): Promise<{ ok: true } | { ok: false; loi: string }> {
    try {
      await transporter.sendMail({
        from: nguoiGuiEmail,
        to: params.nguoiNhanEmail,
        subject: 'Cấp lại mật khẩu đăng nhập 7800Quiz',
        text: [
          `Chào ${params.tenNguoiNhan},`,
          '',
          `Tài khoản 7800Quiz của bạn vừa được cấp mật khẩu tạm mới: ${params.matKhauTam}`,
          '',
          'Mật khẩu này CHỈ dùng để đăng nhập hệ thống 7800Quiz, không liên quan tới mật khẩu máy tính/email. Bạn sẽ phải đổi mật khẩu ngay trong lần đăng nhập đầu tiên.',
          '',
          'Nếu không yêu cầu việc này, hãy liên hệ ngay bộ phận CNTT chi nhánh.',
        ].join('\n'),
      });
      return { ok: true };
    } catch (err: unknown) {
      this.logger.warn(
        `Gui mail that bai toi ${params.nguoiNhanEmail}: ${err instanceof Error ? err.message : 'khong ro loi'}`,
      );
      return {
        ok: false,
        loi: 'Gửi mail thất bại — kiểm tra lại địa chỉ nhận hoặc thử lại sau.',
      };
    }
  }
}
