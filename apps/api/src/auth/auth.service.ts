import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AttemptStatus, AttemptViolationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { buildOtpauthUrl, generateTotpSecret, verifyTotpCode } from './totp';
import * as bcrypt from 'bcrypt';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { AVATARS_DIR, AVATARS_URL_PREFIX } from '../common/uploads-dir';
import { sinhMatKhauTam } from '../common/mat-khau-tam.util';

// Việc 15 — khóa tài khoản tạm: sai mật khẩu (hoặc sai mã 2 lớp) liên tiếp đủ
// ngưỡng thì khóa trong LOCK_MINUTES phút. Bổ sung cho giới hạn tốc độ theo IP
// sẵn có ở LoginThrottlerGuard (chặn theo IP, không chặn theo tài khoản) — kẻ
// tấn công đổi IP vẫn bị chặn ở đây vì đếm theo từng tài khoản.
const FAILED_LOGIN_THRESHOLD = 5;
const LOCK_MINUTES = 15;

// Thông tin thiết bị/mạng của lần đăng nhập — dùng cho UserSession (việc 16) và
// cột ip_address của AuditLog (hoàn thiện việc 14).
export interface LoginMeta {
  userAgent?: string;
  ipAddress?: string;
}

interface UserForSession {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  mustChangePassword: boolean;
  avatarEmoji: string | null;
  avatarUrl: string | null;
  nickname: string | null;
  department: {
    id: string;
    name: string;
    parent: { id: string; name: string } | null;
  } | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, meta: LoginMeta = {}) {
    let user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      include: { department: { include: { parent: true } } },
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
        include: { department: { include: { parent: true } } },
      });
      if (canBo) {
        // Mật khẩu tạm sinh RIÊNG cho người này (không còn hằng số chung) —
        // lưu dạng chữ rõ ở initialPassword để cán bộ IT đọc lại được ở trang
        // Quản lý cán bộ; người vừa gõ ở request này chưa thể biết mật khẩu
        // này nên KHÔNG đăng nhập được ngay, phải chờ IT cấp lại.
        const initialPassword = sinhMatKhauTam();
        const passwordHash = await bcrypt.hash(initialPassword, 10);
        const username = canBo.userAD?.trim() || canBo.cbCode;
        user = await this.prisma.user.create({
          data: {
            username,
            fullName: canBo.fullName,
            email: canBo.email ?? undefined,
            passwordHash,
            initialPassword,
            role: 'STAFF',
            isActive: true,
            mustChangePassword: true,
            departmentId: canBo.departmentId ?? undefined,
          },
          include: { department: { include: { parent: true } } },
        });
      }
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Tài khoản không tồn tại hoặc đã bị khóa',
      );
    }

    this.assertNotLocked(user.lockedUntil);

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      await this.registerFailedAttempt(user.id);
      throw new UnauthorizedException('Sai mật khẩu');
    }

    await this.clearFailedAttempts(user.id);

    // Bật xác thực 2 lớp: CHƯA phát access token thật, chỉ trả 1 token tạm
    // sống 5 phút để đổi lấy token thật sau khi nhập đúng mã TOTP.
    if (user.totpEnabled) {
      const pendingToken = this.jwtService.sign(
        { sub: user.id, type: 'totp_pending' },
        { expiresIn: '5m' },
      );
      return { requiresTotp: true as const, pendingToken };
    }

    await this.writeLoginAuditLog(user.id, user.username, meta);
    return this.issueSession(user, meta);
  }

  // Bước 2 của đăng nhập khi tài khoản bật xác thực 2 lớp (việc 17).
  async verifyTotpLogin(
    pendingToken: string,
    code: string,
    meta: LoginMeta = {},
  ) {
    let payload: { sub: string; type?: string };
    try {
      payload = this.jwtService.verify<{ sub: string; type?: string }>(
        pendingToken,
      );
    } catch {
      throw new UnauthorizedException(
        'Phiên xác thực đã hết hạn, vui lòng đăng nhập lại',
      );
    }
    if (payload.type !== 'totp_pending') {
      throw new UnauthorizedException('Token xác thực không hợp lệ');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { department: { include: { parent: true } } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Tài khoản không tồn tại hoặc đã bị khóa',
      );
    }

    // Sai mã 2 lớp cũng tính vào ngưỡng khóa tài khoản — nếu không, mã 6 chữ số
    // có thể bị dò cạn kiệt bằng cách lặp lại bước 2 với cùng 1 pendingToken.
    this.assertNotLocked(user.lockedUntil);

    if (!user.totpSecret || !verifyTotpCode(user.totpSecret, code)) {
      await this.registerFailedAttempt(user.id);
      throw new UnauthorizedException('Mã xác thực không đúng');
    }

    await this.clearFailedAttempts(user.id);
    await this.writeLoginAuditLog(user.id, user.username, meta, true);
    return this.issueSession(user, meta);
  }

  // Ghi nhận vi phạm MULTI_SESSION_LOGIN cho mọi bài đang làm dở của user này.
  // Cố tình KHÔNG dùng AttemptsService.reportViolation() ở đây để tránh vòng
  // phụ thuộc module (AuthModule → AttemptsModule → GamificationModule →
  // AuthModule) — chỉ ghi log + tăng bộ đếm bằng Prisma trực tiếp. Việc tự nộp
  // khi chạm ngưỡng được xử lý sau đó bởi vòng quét định kỳ
  // AttemptsService.finalizeViolationExceededAttempts() (tối đa trễ 1 phút —
  // chấp nhận được vì không có tab nào đang chờ phản hồi ngay cho trường hợp này).
  private async flagMultiSessionIfActiveAttempt(userId: string) {
    const activeAttempts = await this.prisma.quizAttempt.findMany({
      where: { userId, status: AttemptStatus.IN_PROGRESS },
      select: { id: true },
    });
    if (!activeAttempts.length) return;

    await this.prisma.$transaction(
      activeAttempts.flatMap((a) => [
        this.prisma.attemptViolation.create({
          data: {
            attemptId: a.id,
            type: AttemptViolationType.MULTI_SESSION_LOGIN,
          },
        }),
        this.prisma.quizAttempt.update({
          where: { id: a.id },
          data: { violationCount: { increment: 1 } },
        }),
      ]),
    );
  }

  private assertNotLocked(lockedUntil: Date | null): void {
    if (!lockedUntil || lockedUntil <= new Date()) return;
    const minutesLeft = Math.max(
      1,
      Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000),
    );
    throw new ForbiddenException(
      `Tài khoản đang bị khóa tạm do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${minutesLeft} phút.`,
    );
  }

  private async registerFailedAttempt(userId: string): Promise<void> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (updated.failedLoginCount < FAILED_LOGIN_THRESHOLD) return;

    // Đạt ngưỡng: khóa tạm và reset bộ đếm để sau khi hết khóa lại được thử
    // trọn ngưỡng lần nữa (thay vì bị khóa lại ngay lần sai kế tiếp).
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000),
        failedLoginCount: 0,
      },
    });
  }

  private async clearFailedAttempts(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }

  private async writeLoginAuditLog(
    userId: string,
    username: string,
    meta: LoginMeta,
    viaTotp = false,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'LOGIN',
        ipAddress: meta.ipAddress,
        meta: { username, userAgent: meta.userAgent ?? null, viaTotp },
      },
    });
  }

  // Tạo 1 dòng UserSession rồi nhúng id phiên (sid) vào JWT — jwt.strategy.ts
  // kiểm tra phiên còn sống ở MỌI request, nhờ đó thu hồi phiên có hiệu lực ngay
  // (việc 16) thay vì phải chờ token hết hạn.
  private async issueSession(user: UserForSession, meta: LoginMeta) {
    const [session, canBo] = await Promise.all([
      this.prisma.userSession.create({
        data: {
          userId: user.id,
          userAgent: meta.userAgent?.slice(0, 300),
          ipAddress: meta.ipAddress,
        },
      }),
      // Chức vụ (Giám đốc/Phó giám đốc/Trưởng phòng/Phó phòng...) chỉ có ở hồ
      // sơ CanBo, chưa đồng bộ sang User — tra theo username (đã đảm bảo khớp
      // với User.username qua syncCanBoUser, xem admin.service.ts).
      this.prisma.canBo.findFirst({
        where: { username: user.username },
        select: { position: true, isItStaff: true },
      }),
    ]);

    // Đăng nhập lần này KHÔNG phải mở thêm tab của cùng trình duyệt (JWT lưu
    // sẵn chỉ tự gắn kèm request, không gọi lại issueSession) — chỉ chạy khi
    // thật sự gõ lại thông tin đăng nhập, nên đây là tín hiệu tương đối đáng
    // tin: đang có người khác (hoặc chính người này ở máy khác) đăng nhập
    // trong lúc còn bài làm dở. Không được để lỗi ở đây làm hỏng cả lượt đăng
    // nhập — chỉ ghi log, không throw.
    try {
      await this.flagMultiSessionIfActiveAttempt(user.id);
    } catch (error: unknown) {
      this.logger.warn(
        `Không ghi được vi phạm đăng nhập nhiều nơi cho user ${user.id}: ${String(error)}`,
      );
    }

    const token = this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
      sid: session.id,
    });

    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        avatarEmoji: user.avatarEmoji,
        avatarUrl: user.avatarUrl,
        nickname: user.nickname,
        position: canBo?.position ?? null,
        // Cán bộ IT: được xem thêm hướng dẫn quản trị và vài chức năng kỹ thuật,
        // nhưng KHÔNG phải quyền quản trị — mọi trang /manage vẫn chặn theo role.
        isItStaff: canBo?.isItStaff ?? false,
        department: user.department
          ? {
              id: user.department.id,
              name: user.department.name,
              parentName: user.department.parent?.name ?? null,
            }
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

    // Route này chỉ cần JWT hợp lệ để gọi (JwtAuthGuard), không đi qua
    // LoginThrottlerGuard theo IP như /auth/login — nếu không tự khóa tạm ở
    // đây thì một token bị lộ có thể dò mật khẩu cũ không giới hạn số lần.
    this.assertNotLocked(user.lockedUntil);

    if (!oldPassword?.trim())
      throw new BadRequestException('Vui lòng nhập mật khẩu cũ');

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      await this.registerFailedAttempt(userId);
      throw new UnauthorizedException('Mật khẩu cũ không đúng');
    }
    await this.clearFailedAttempts(userId);

    if (newPassword.length < 6)
      throw new BadRequestException('Mật khẩu mới phải tối thiểu 6 ký tự');

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        initialPassword: null,
      },
    });

    return { message: 'Đổi mật khẩu thành công' };
  }

  // ─── Ảnh đại diện ─────────────────────────────────────────────────────
  // 2 kiểu loại trừ nhau: chọn emoji thì xoá avatarUrl (kèm xoá file cũ trên
  // đĩa nếu có, tránh rác), tải ảnh lên thì xoá avatarEmoji. Trả về đúng 2
  // field này để frontend merge vào AuthUser đang lưu, không cần đăng nhập lại.

  async setAvatarEmoji(userId: string, emoji: string) {
    const trimmed = emoji.trim();
    if (!trimmed) throw new BadRequestException('Biểu tượng không hợp lệ');
    await this.deleteUploadedAvatarFile(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarEmoji: trimmed, avatarUrl: null },
      select: { avatarEmoji: true, avatarUrl: true },
    });
  }

  async setAvatarUpload(userId: string, file: Express.Multer.File) {
    const ext = file.mimetype === 'image/png' ? 'png' : 'jpg';
    // Hậu tố thời gian — tên file cũ (nếu có) vẫn còn nằm trên đĩa cho tới khi
    // deleteUploadedAvatarFile xoá xong, tránh trùng tên đè lên chính nó.
    const filename = `${userId}-${Date.now()}.${ext}`;
    await mkdir(AVATARS_DIR, { recursive: true });
    await writeFile(join(AVATARS_DIR, filename), file.buffer);

    await this.deleteUploadedAvatarFile(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: `${AVATARS_URL_PREFIX}/${filename}`,
        avatarEmoji: null,
      },
      select: { avatarEmoji: true, avatarUrl: true },
    });
  }

  async clearAvatar(userId: string) {
    await this.deleteUploadedAvatarFile(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarEmoji: null, avatarUrl: null },
      select: { avatarEmoji: true, avatarUrl: true },
    });
  }

  // ─── Biệt danh ────────────────────────────────────────────────────────
  // Chỉ đổi cách hiển thị ở Bảng xếp hạng/Đấu trường (xem ten-hien-thi.util.ts)
  // — không đụng tới fullName thật, mọi nơi khác không bị ảnh hưởng.
  async setNickname(userId: string, nickname: string) {
    const trimmed = nickname.trim();
    return this.prisma.user.update({
      where: { id: userId },
      data: { nickname: trimmed || null },
      select: { nickname: true },
    });
  }

  // Chỉ xoá file thật khi avatarUrl trỏ vào đúng thư mục avatars quản lý ở đây
  // — phòng trường hợp giá trị cũ (nếu tương lai có nguồn avatarUrl khác) trỏ
  // ra ngoài, tránh xoá nhầm file không phải của mình.
  private async deleteUploadedAvatarFile(userId: string): Promise<void> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    if (!current?.avatarUrl?.startsWith(`${AVATARS_URL_PREFIX}/`)) return;

    const filename = current.avatarUrl.slice(AVATARS_URL_PREFIX.length + 1);
    try {
      await unlink(join(AVATARS_DIR, filename));
    } catch {
      // File đã bị xoá/không tồn tại — bỏ qua, không phải lỗi nghiêm trọng
    }
  }

  // ─── Việc 17: Xác thực 2 lớp (TOTP) ──────────────────────────────────────

  async getTotpStatus(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { totpEnabled: true, totpSecret: true },
    });
    return {
      enabled: user.totpEnabled,
      // Đã sinh secret nhưng chưa xác nhận mã lần đầu — cho phép UI hiện lại
      // bước nhập mã thay vì bắt sinh secret mới từ đầu.
      pendingSetup: !user.totpEnabled && Boolean(user.totpSecret),
    };
  }

  async setupTotp(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true, totpEnabled: true },
    });
    if (user.totpEnabled)
      throw new BadRequestException(
        'Tài khoản đã bật xác thực 2 lớp — hãy tắt trước nếu muốn thiết lập lại',
      );

    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret, totpEnabled: false },
    });

    return {
      secret,
      otpauthUrl: buildOtpauthUrl(secret, user.username),
    };
  }

  async confirmTotp(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { totpSecret: true },
    });
    if (!user.totpSecret)
      throw new BadRequestException(
        'Chưa thiết lập xác thực 2 lớp — hãy bấm "Thiết lập" trước',
      );
    if (!verifyTotpCode(user.totpSecret, code))
      throw new BadRequestException(
        'Mã xác thực không đúng — kiểm tra lại đồng hồ điện thoại rồi thử mã mới',
      );

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });
    return { message: 'Đã bật xác thực 2 lớp cho tài khoản' };
  }

  // Bắt buộc nhập lại mật khẩu để tắt — tránh người khác mượn máy đang mở sẵn
  // phiên đăng nhập rồi vô hiệu hoá lớp bảo vệ thứ 2.
  async disableTotp(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, lockedUntil: true },
    });

    // Cùng lý do với changePassword: route chỉ cần JWT hợp lệ, phải tự khóa
    // tạm ở đây để token bị lộ không dò được mật khẩu không giới hạn số lần.
    this.assertNotLocked(user.lockedUntil);

    if (!password?.trim())
      throw new BadRequestException('Vui lòng nhập mật khẩu');

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await this.registerFailedAttempt(userId);
      throw new UnauthorizedException('Mật khẩu không đúng');
    }
    await this.clearFailedAttempts(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabled: false },
    });
    return { message: 'Đã tắt xác thực 2 lớp' };
  }

  // ─── Việc 16: Kiểm soát phiên đăng nhập ──────────────────────────────────

  async listMySessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      isCurrent: s.id === currentSessionId,
    }));
  }

  async revokeMySession(userId: string, sessionId: string) {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId)
      throw new NotFoundException('Không tìm thấy phiên đăng nhập này');

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    return { message: 'Đã đăng xuất phiên đăng nhập đó' };
  }

  async revokeMyOtherSessions(userId: string, currentSessionId: string) {
    const result = await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null, id: { not: currentSessionId } },
      data: { revokedAt: new Date() },
    });
    return { message: `Đã đăng xuất ${result.count} thiết bị khác` };
  }

  // ─── Việc 15 + 16: Trang quản trị bảo mật (chỉ ADMIN) ────────────────────

  async adminListSessions(userId?: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { revokedAt: null, ...(userId ? { userId } : {}) },
      orderBy: { lastSeenAt: 'desc' },
      take: 500,
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(sessions.map((s) => s.userId))] } },
      select: { id: true, username: true, fullName: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      username: userById.get(s.userId)?.username ?? null,
      fullName: userById.get(s.userId)?.fullName ?? null,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
    }));
  }

  async adminRevokeSession(sessionId: string) {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });
    if (!session)
      throw new NotFoundException('Không tìm thấy phiên đăng nhập này');

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    return { message: 'Đã buộc đăng xuất phiên đăng nhập' };
  }

  async adminListLockedUsers() {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { lockedUntil: { gt: new Date() } },
          { failedLoginCount: { gt: 0 } },
        ],
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        failedLoginCount: true,
        lockedUntil: true,
        totpEnabled: true,
      },
      orderBy: { lockedUntil: 'desc' },
    });
    return users.map((u) => ({
      ...u,
      isLocked: Boolean(u.lockedUntil && u.lockedUntil > new Date()),
    }));
  }

  async adminUnlockUser(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    return { message: 'Đã mở khóa tài khoản' };
  }
}
