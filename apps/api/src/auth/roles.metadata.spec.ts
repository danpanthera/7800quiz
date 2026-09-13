import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';
import { AdminController } from '../admin/admin.controller';
import { ArenaController } from '../arena/arena.controller';
import { GamificationController } from '../gamification/gamification.controller';
import { CanBoItGuard, VAI_TRO_CHO_PHEP_KEY } from './can-bo-it.guard';
import { ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

const getRoles = (
  controller: object,
  methodName?: string,
): UserRole[] | undefined => {
  if (!methodName) return Reflect.getMetadata(ROLES_KEY, controller);

  const method = (controller as Record<string, unknown>)[methodName];
  return Reflect.getMetadata(ROLES_KEY, method as object);
};

describe('Ma trận phân quyền API', () => {
  it('mặc định giới hạn AdminController cho ADMIN', () => {
    expect(getRoles(AdminController)).toEqual([UserRole.ADMIN]);
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toContain(
      RolesGuard,
    );
  });

  it.each([
    'getBankQuestions',
    'getQuizzes',
    'createAssignment',
    'getReports',
    'getExamSessions',
    'createExamSession',
  ])('cho TRAINER dùng nghiệp vụ %s', (methodName) => {
    expect(getRoles(AdminController.prototype, methodName)).toEqual([
      UserRole.ADMIN,
      UserRole.TRAINER,
    ]);
  });

  it.each([
    'createAcademicYear',
    'createClass',
    'addClassMember',
    'importCanBo',
    'createCanBo',
    'updateCanBo',
    'deleteCanBo',
    'bulkDeleteCanBo',
    'superDeleteCanBo',
    'hardResetCanBo',
  ])('giữ nghiệp vụ %s ở quyền ADMIN', (methodName) => {
    expect(getRoles(AdminController.prototype, methodName)).toBeUndefined();
  });

  // 3 nghiệp vụ dưới đây cố tình nới @Roles cho mọi vai trò đi qua RolesGuard;
  // quyết định thật sự nằm ở CanBoItGuard (vai trò chỉ định HOẶC cán bộ có cờ
  // isItStaff). Khoá lại đúng cặp "vai trò được phép + có gắn CanBoItGuard".
  it.each([
    ['getDepartments', [UserRole.ADMIN, UserRole.TRAINER]],
    ['getCanBo', [UserRole.ADMIN, UserRole.TRAINER]],
    ['resetCanBoPasswords', [UserRole.ADMIN]],
  ] as [string, UserRole[]][])(
    'uỷ quyền %s cho Cán bộ IT, ngoài ra chỉ %s',
    (methodName, vaiTroChoPhep) => {
      const method = (
        AdminController.prototype as unknown as Record<string, unknown>
      )[methodName] as object;
      expect(Reflect.getMetadata(VAI_TRO_CHO_PHEP_KEY, method)).toEqual(
        vaiTroChoPhep,
      );
      expect(Reflect.getMetadata(GUARDS_METADATA, method)).toContain(
        CanBoItGuard,
      );
    },
  );

  it('không mở endpoint quản trị nào cho STAFF mà quên gắn CanBoItGuard', () => {
    const proto = AdminController.prototype as unknown as Record<
      string,
      unknown
    >;
    const moChoStaff = Object.getOwnPropertyNames(proto)
      .filter((ten) => ten !== 'constructor')
      .filter((ten) => getRoles(proto, ten)?.includes(UserRole.STAFF));

    expect(moChoStaff.length).toBeGreaterThan(0);
    for (const ten of moChoStaff) {
      expect(
        Reflect.getMetadata(GUARDS_METADATA, proto[ten] as object),
      ).toContain(CanBoItGuard);
    }
  });

  it('cho TRAINER điều hành Arena nhưng không gắn quyền vào route join công khai', () => {
    expect(getRoles(ArenaController.prototype, 'create')).toEqual([
      UserRole.ADMIN,
      UserRole.TRAINER,
    ]);
    expect(getRoles(ArenaController.prototype, 'joinInfo')).toBeUndefined();
  });

  it('cho TRAINER quản lý gamification nhưng route cá nhân không yêu cầu vai trò', () => {
    expect(getRoles(GamificationController.prototype, 'createLevel')).toEqual([
      UserRole.ADMIN,
      UserRole.TRAINER,
    ]);
    expect(
      getRoles(GamificationController.prototype, 'getProgress'),
    ).toBeUndefined();
  });
});
