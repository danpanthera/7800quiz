import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Patch,
  Post,
  HttpCode,
  UseGuards,
  UseInterceptors,
  Request,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request as ExpressRequest } from 'express';
import { AuthService, type LoginMeta } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SetAvatarEmojiDto } from './dto/set-avatar-emoji.dto';
import { SetNicknameDto } from './dto/set-nickname.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginThrottlerGuard } from './login-throttler.guard';

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png']);

// Lấy IP + trình duyệt của lần đăng nhập — dùng cho danh sách phiên đăng nhập
// (việc 16) và cột ip_address của nhật ký quản trị (việc 14).
function readLoginMeta(req: ExpressRequest): LoginMeta {
  return {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Chống brute-force: tối đa 5 lần thử/phút tính theo IP — chỉ áp cho riêng
  // route này, không ảnh hưởng change-password hay bất kỳ API nào khác. Bổ sung
  // thêm khóa tài khoản tạm theo từng tài khoản ở auth.service.ts (việc 15).
  @Post('login')
  @HttpCode(200)
  @UseGuards(LoginThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Request() req: ExpressRequest) {
    return this.authService.login(dto, readLoginMeta(req));
  }

  // Bước 2 khi tài khoản bật xác thực 2 lớp — đổi token tạm + mã TOTP lấy
  // access token thật. Cũng giới hạn tốc độ để mã 6 chữ số không bị dò cạn.
  @Post('login/verify-totp')
  @HttpCode(200)
  @UseGuards(LoginThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  verifyTotpLogin(
    @Body() body: { pendingToken: string; code: string },
    @Request() req: ExpressRequest,
  ) {
    return this.authService.verifyTotpLogin(
      body.pendingToken,
      body.code,
      readLoginMeta(req),
    );
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  changePassword(
    @Request() req: { user: { id: string } },
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(
      req.user.id,
      body.oldPassword,
      body.newPassword,
    );
  }

  // ─── Ảnh đại diện ───────────────────────────────────────────────────────
  @Patch('me/avatar')
  @UseGuards(JwtAuthGuard)
  setAvatarEmoji(
    @Request() req: { user: { id: string } },
    @Body() dto: SetAvatarEmojiDto,
  ) {
    return this.authService.setAvatarEmoji(req.user.id, dto.emoji);
  }

  @Post('me/avatar/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: AVATAR_MAX_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!AVATAR_ALLOWED_MIME.has(file.mimetype)) {
          callback(
            new BadRequestException('Chỉ chấp nhận ảnh JPG hoặc PNG'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadAvatar(
    @Request() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Chưa chọn ảnh');
    return this.authService.setAvatarUpload(req.user.id, file);
  }

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  clearAvatar(@Request() req: { user: { id: string } }) {
    return this.authService.clearAvatar(req.user.id);
  }

  // ─── Biệt danh ───────────────────────────────────────────────────────────
  @Patch('me/nickname')
  @UseGuards(JwtAuthGuard)
  setNickname(
    @Request() req: { user: { id: string } },
    @Body() dto: SetNicknameDto,
  ) {
    return this.authService.setNickname(req.user.id, dto.nickname);
  }
}
