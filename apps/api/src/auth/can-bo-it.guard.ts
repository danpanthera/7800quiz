import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from './roles.decorator';

export const VAI_TRO_CHO_PHEP_KEY = 'vaiTroChoPhepNgoaiCanBoIt';

/**
 * Mở một endpoint cho các vai trò chỉ định HOẶC cho cán bộ đã được đánh dấu
 * "Cán bộ IT" (CanBo.isItStaff) — dùng cho vài việc kỹ thuật được uỷ quyền
 * riêng, hiện chỉ gồm xem danh sách cán bộ và reset mật khẩu.
 *
 * AdminController đang gắn @Roles(ADMIN) ở cấp lớp nên phải nới @Roles ở cấp
 * phương thức cho mọi vai trò đi qua RolesGuard; quyết định thật sự nằm ở
 * CanBoItGuard bên dưới, dựa trên danh sách vai trò truyền vào đây.
 */
export const VaiTroHoacCanBoIt = (...vaiTro: UserRole[]) =>
  applyDecorators(
    Roles(UserRole.ADMIN, UserRole.TRAINER, UserRole.STAFF),
    SetMetadata(VAI_TRO_CHO_PHEP_KEY, vaiTro),
    UseGuards(CanBoItGuard),
  );

/**
 * Cờ isItStaff được tra thẳng CSDL ở mỗi lần gọi, KHÔNG nhét vào JWT: admin bỏ
 * đánh dấu là quyền mất ngay, không phải chờ token cũ (8 giờ) hết hạn.
 */
@Injectable()
export class CanBoItGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: { role?: UserRole; username?: string };
    }>();
    const user = request.user;
    if (!user?.username) throw new ForbiddenException('Chưa đăng nhập');

    const vaiTroChoPhep =
      this.reflector.getAllAndOverride<UserRole[]>(VAI_TRO_CHO_PHEP_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (user.role && vaiTroChoPhep.includes(user.role)) return true;

    const canBo = await this.prisma.canBo.findFirst({
      where: { username: user.username },
      select: { isItStaff: true },
    });
    if (canBo?.isItStaff) return true;

    throw new ForbiddenException(
      'Chức năng này chỉ dành cho Quản trị viên và Cán bộ IT',
    );
  }
}
