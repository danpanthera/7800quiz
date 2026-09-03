import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

const DEFAULT_PASSWORD = 'Abcd@1234';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    let user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      include: { department: true },
    });

    // Nếu không tìm thấy User, tự tạo tài khoản theo UserAD; chỉ dùng mã CB khi chưa có UserAD.
    if (!user) {
      const canBo = await this.prisma.canBo.findFirst({
        where: {
          OR: [
            { userAD: dto.username, isActive: true },
            { cbCode: dto.username, userAD: null, isActive: true },
            { cbCode: dto.username, userAD: '', isActive: true },
          ],
        },
        include: { department: true },
      });
      if (canBo) {
        const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
        const username = canBo.userAD?.trim() || canBo.cbCode;
        user = await this.prisma.user.create({
          data: {
            username,
            fullName: canBo.fullName,
            email: canBo.email ?? undefined,
            passwordHash,
            role: 'STAFF',
            isActive: true,
            mustChangePassword: true,
            departmentId: canBo.departmentId ?? undefined,
          },
          include: { department: true },
        });
      }
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Tài khoản không tồn tại hoặc đã bị khóa',
      );
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Sai mật khẩu');
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        meta: { username: user.username },
      },
    });

    const payload = { sub: user.id, username: user.username, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        department: user.department
          ? { id: user.department.id, name: user.department.name }
          : null,
      },
    };
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Mật khẩu cũ không đúng');

    if (newPassword.length < 6)
      throw new BadRequestException('Mật khẩu mới phải tối thiểu 6 ký tự');

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, mustChangePassword: false },
    });

    return { message: 'Đổi mật khẩu thành công' };
  }
}
