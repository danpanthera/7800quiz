import { Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

/**
 * Chặn brute-force ở /api/auth/login — thư viện mặc định ném thông báo tiếng
 * Anh ("ThrottlerException: Too Many Requests"), ghi đè lại để đúng convention
 * thông báo lỗi tiếng Việt của repo.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected throwThrottlingException(): Promise<void> {
    throw new ThrottlerException(
      'Thử đăng nhập quá nhiều lần, vui lòng đợi một phút rồi thử lại',
    );
  }
}
