import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ── Cơ cấu tổ chức ─────────────────────────────────────────────────────
  // Top-level units (code prefix 01..09 để giữ thứ tự khi sort)
  const units = [
    { code: '01-HS',  name: 'Hội Sở' },
    { code: '02-BL',  name: 'CN Bình Lư' },
    { code: '03-PT',  name: 'CN Phong Thổ' },
    { code: '04-SH',  name: 'CN Sìn Hồ' },
    { code: '05-BT',  name: 'CN Bum Tở' },
    { code: '06-TU',  name: 'CN Than Uyên' },
    { code: '07-DK',  name: 'CN Đoàn Kết' },
    { code: '08-TAU', name: 'CN Tân Uyên' },
    { code: '09-NH',  name: 'CN Nậm Hàng' },
  ];
  const unitMap: Record<string, string> = {};
  for (const u of units) {
    const r = await prisma.department.upsert({ where: { code: u.code }, update: { name: u.name }, create: { code: u.code, name: u.name } });
    unitMap[u.code] = r.id;
  }

  // Sub-departments
  const subDepts = [
    // Hội Sở
    { code: '01-HS-BGD',    name: 'Ban Giám đốc',   parent: '01-HS' },
    { code: '01-HS-KHDN',   name: 'Phòng KHDN',     parent: '01-HS' },
    { code: '01-HS-KHCN',   name: 'Phòng KHCN',     parent: '01-HS' },
    { code: '01-HS-KTGSNB', name: 'Phòng KTGSNB',   parent: '01-HS' },
    { code: '01-HS-TH',     name: 'Phòng Tổng hợp', parent: '01-HS' },
    { code: '01-HS-KTNQ',   name: 'Phòng KTNQ',     parent: '01-HS' },
    { code: '01-HS-KHRR',   name: 'Phòng KHRR',     parent: '01-HS' },
    // Bình Lư
    { code: '02-BL-BGD',  name: 'Ban Giám đốc',   parent: '02-BL' },
    { code: '02-BL-KH',   name: 'Phòng Khách hàng', parent: '02-BL' },
    { code: '02-BL-KTNQ', name: 'Phòng KTNQ',     parent: '02-BL' },
    // Phong Thổ
    { code: '03-PT-BGD',  name: 'Ban Giám đốc',   parent: '03-PT' },
    { code: '03-PT-KH',   name: 'Phòng Khách hàng', parent: '03-PT' },
    { code: '03-PT-KTNQ', name: 'Phòng KTNQ',     parent: '03-PT' },
    { code: '03-PT-PGD5', name: 'PGD Số 5',       parent: '03-PT' },
    // Sìn Hồ
    { code: '04-SH-BGD',  name: 'Ban Giám đốc',   parent: '04-SH' },
    { code: '04-SH-KH',   name: 'Phòng Khách hàng', parent: '04-SH' },
    { code: '04-SH-KTNQ', name: 'Phòng KTNQ',     parent: '04-SH' },
    // Bum Tở
    { code: '05-BT-BGD',  name: 'Ban Giám đốc',   parent: '05-BT' },
    { code: '05-BT-KH',   name: 'Phòng Khách hàng', parent: '05-BT' },
    { code: '05-BT-KTNQ', name: 'Phòng KTNQ',     parent: '05-BT' },
    // Than Uyên
    { code: '06-TU-BGD',  name: 'Ban Giám đốc',   parent: '06-TU' },
    { code: '06-TU-KH',   name: 'Phòng Khách hàng', parent: '06-TU' },
    { code: '06-TU-KTNQ', name: 'Phòng KTNQ',     parent: '06-TU' },
    { code: '06-TU-PGD6', name: 'PGD Số 6',       parent: '06-TU' },
    // Đoàn Kết
    { code: '07-DK-BGD',  name: 'Ban Giám đốc',   parent: '07-DK' },
    { code: '07-DK-KH',   name: 'Phòng Khách hàng', parent: '07-DK' },
    { code: '07-DK-KTNQ', name: 'Phòng KTNQ',     parent: '07-DK' },
    { code: '07-DK-PGD1', name: 'PGD Số 1',       parent: '07-DK' },
    { code: '07-DK-PGD2', name: 'PGD Số 2',       parent: '07-DK' },
    // Tân Uyên
    { code: '08-TAU-BGD',  name: 'Ban Giám đốc',   parent: '08-TAU' },
    { code: '08-TAU-KH',   name: 'Phòng Khách hàng', parent: '08-TAU' },
    { code: '08-TAU-KTNQ', name: 'Phòng KTNQ',     parent: '08-TAU' },
    { code: '08-TAU-PGD3', name: 'PGD Số 3',       parent: '08-TAU' },
    // Nậm Hàng
    { code: '09-NH-BGD',  name: 'Ban Giám đốc',   parent: '09-NH' },
    { code: '09-NH-KH',   name: 'Phòng Khách hàng', parent: '09-NH' },
    { code: '09-NH-KTNQ', name: 'Phòng KTNQ',     parent: '09-NH' },
  ];
  for (const s of subDepts) {
    await prisma.department.upsert({
      where: { code: s.code },
      update: { name: s.name },
      create: { code: s.code, name: s.name, parentId: unitMap[s.parent] },
    });
  }

  // ── Map các phòng ban cũ (flat) vào đơn vị cha tương ứng ─────────────
  // ── Chuẩn hóa tên + gán parentId cho các phòng ban legacy ───────────
  const legacyMapping: { code: string; unitCode: string; name: string }[] = [
    // Hội Sở
    { code: 'HoiSoBgd',     unitCode: '01-HS', name: 'Hội Sở - Ban Giám đốc' },
    { code: 'HoiSoKhcn',    unitCode: '01-HS', name: 'Hội Sở - P.KHCN' },
    { code: 'HoiSoKhdn',    unitCode: '01-HS', name: 'Hội Sở - P.KHDN' },
    { code: 'HoiSoKhqlrr',  unitCode: '01-HS', name: 'Hội Sở - P.KHRR' },
    { code: 'HoiSoKtgs',    unitCode: '01-HS', name: 'Hội Sở - P.KTGSNB' },
    { code: 'HoiSoKtnq',    unitCode: '01-HS', name: 'Hội Sở - P.KTNQ' },
    { code: 'HoiSoTonghop', unitCode: '01-HS', name: 'Hội Sở - P.Tổng hợp' },
    // Bình Lư
    { code: 'CnBinhLuBgd',  unitCode: '02-BL', name: 'CN Bình Lư - Ban Giám đốc' },
    { code: 'CnBinhLuKh',   unitCode: '02-BL', name: 'CN Bình Lư - P.Khách hàng' },
    { code: 'CnBinhLuKtnq', unitCode: '02-BL', name: 'CN Bình Lư - P.KTNQ' },
    // Phong Thổ
    { code: 'CnPhongThoBgd',    unitCode: '03-PT', name: 'CN Phong Thổ - Ban Giám đốc' },
    { code: 'CnPhongThoKh',     unitCode: '03-PT', name: 'CN Phong Thổ - P.Khách hàng' },
    { code: 'CnPhongThoKtnq',   unitCode: '03-PT', name: 'CN Phong Thổ - P.KTNQ' },
    { code: 'CnPhongThoPgdSo5', unitCode: '03-PT', name: 'CN Phong Thổ - PGD Số 5' },
    // Sìn Hồ
    { code: 'CnSinHoBgd',   unitCode: '04-SH', name: 'CN Sìn Hồ - Ban Giám đốc' },
    { code: 'CnSinHoKh',    unitCode: '04-SH', name: 'CN Sìn Hồ - P.Khách hàng' },
    { code: 'CnSinHoKtnq',  unitCode: '04-SH', name: 'CN Sìn Hồ - P.KTNQ' },
    // Bum Tở / Mường Tè
    { code: 'CnBumToBgd',   unitCode: '05-BT', name: 'CN Bum Tở - Ban Giám đốc' },
    { code: 'CnBumToKh',    unitCode: '05-BT', name: 'CN Bum Tở - P.Khách hàng' },
    { code: 'CnBumToKtnq',  unitCode: '05-BT', name: 'CN Bum Tở - P.KTNQ' },
    // Than Uyên
    { code: 'CnThanUyenBgd',    unitCode: '06-TU', name: 'CN Than Uyên - Ban Giám đốc' },
    { code: 'CnThanUyenKh',     unitCode: '06-TU', name: 'CN Than Uyên - P.Khách hàng' },
    { code: 'CnThanUyenKtnq',   unitCode: '06-TU', name: 'CN Than Uyên - P.KTNQ' },
    { code: 'CnThanUyenPgdSo6', unitCode: '06-TU', name: 'CN Than Uyên - PGD Số 6' },
    // Đoàn Kết
    { code: 'CnDoanKetBgd',    unitCode: '07-DK', name: 'CN Đoàn Kết - Ban Giám đốc' },
    { code: 'CnDoanKetKh',     unitCode: '07-DK', name: 'CN Đoàn Kết - P.Khách hàng' },
    { code: 'CnDoanKetKtnq',   unitCode: '07-DK', name: 'CN Đoàn Kết - P.KTNQ' },
    { code: 'CnDoanKetPgdso1', unitCode: '07-DK', name: 'CN Đoàn Kết - PGD Số 1' },
    { code: 'CnDoanKetPgdso2', unitCode: '07-DK', name: 'CN Đoàn Kết - PGD Số 2' },
    // Tân Uyên
    { code: 'CnTanUyenBgd',    unitCode: '08-TAU', name: 'CN Tân Uyên - Ban Giám đốc' },
    { code: 'CnTanUyenKh',     unitCode: '08-TAU', name: 'CN Tân Uyên - P.Khách hàng' },
    { code: 'CnTanUyenKtnq',   unitCode: '08-TAU', name: 'CN Tân Uyên - P.KTNQ' },
    { code: 'CnTanUyenPgdso3', unitCode: '08-TAU', name: 'CN Tân Uyên - PGD Số 3' },
    // Nậm Hàng
    { code: 'CnNamHangBgd',   unitCode: '09-NH', name: 'CN Nậm Hàng - Ban Giám đốc' },
    { code: 'CnNamHangKh',    unitCode: '09-NH', name: 'CN Nậm Hàng - P.Khách hàng' },
    { code: 'CnNamHangKtnq',  unitCode: '09-NH', name: 'CN Nậm Hàng - P.KTNQ' },
  ];
  for (const { code, unitCode, name } of legacyMapping) {
    await prisma.department.updateMany({
      where: { code },
      data: { name, parentId: unitMap[unitCode] },
    });
  }

  // Giữ dept cũ (IT) để không break foreign key cũ nếu có
  const dept = await prisma.department.upsert({
    where: { code: 'IT' },
    update: {},
    create: { name: 'Phòng Công nghệ Thông tin', code: 'IT' },
  });

  // Users
  const adminHash = await bcrypt.hash('Admin@1234', 10);
  const staffHash = await bcrypt.hash('Staff@1234', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminHash,
      fullName: 'Quản trị viên',
      email: 'admin@bank.local',
      role: 'ADMIN',
      departmentId: dept.id,
    },
  });

  await prisma.user.upsert({
    where: { username: 'nhanvien01' },
    update: {},
    create: {
      username: 'nhanvien01',
      passwordHash: staffHash,
      fullName: 'Nguyễn Văn A',
      email: 'nva@bank.local',
      role: 'STAFF',
      departmentId: dept.id,
    },
  });

  // Quiz
  const quiz = await prisma.quiz.upsert({
    where: { id: 'quiz-demo-001' },
    update: {},
    create: {
      id: 'quiz-demo-001',
      title: 'Kiểm tra nghiệp vụ tín dụng cơ bản',
      description: 'Quiz mẫu kiểm tra kiến thức tín dụng cơ bản cho nhân viên mới',
      topic: 'Tín dụng',
      durationMin: 30,
      passScore: 70,
      isActive: true,
    },
  });

  // Quiz version snapshot
  const qv = await prisma.quizVersion.upsert({
    where: { quizId_version: { quizId: quiz.id, version: 1 } },
    update: {},
    create: {
      quizId: quiz.id,
      version: 1,
      snapshot: { title: quiz.title, topic: quiz.topic },
    },
  });

  // Questions
  const q1 = await prisma.question.create({
    data: {
      quizId: quiz.id,
      content: 'Lãi suất cho vay thông thường được tính theo đơn vị nào?',
      questionType: 'SINGLE',
      points: 10,
      orderIndex: 1,
      options: {
        create: [
          { content: '%/năm', isCorrect: true, orderIndex: 1 },
          { content: 'VND/tháng', isCorrect: false, orderIndex: 2 },
          { content: 'USD/ngày', isCorrect: false, orderIndex: 3 },
          { content: 'Điểm/kỳ', isCorrect: false, orderIndex: 4 },
        ],
      },
    },
  });

  const q2 = await prisma.question.create({
    data: {
      quizId: quiz.id,
      content: 'Những tài liệu nào cần thiết khi thẩm định hồ sơ vay?',
      questionType: 'MULTIPLE',
      points: 20,
      orderIndex: 2,
      options: {
        create: [
          { content: 'CMND/CCCD', isCorrect: true, orderIndex: 1 },
          { content: 'Sổ hộ khẩu', isCorrect: true, orderIndex: 2 },
          { content: 'Giấy phép lái xe', isCorrect: false, orderIndex: 3 },
          { content: 'Hợp đồng lao động', isCorrect: true, orderIndex: 4 },
        ],
      },
    },
  });

  // Assignment cho staff user
  const staff = await prisma.user.findUnique({ where: { username: 'nhanvien01' } });
  if (staff) {
    await prisma.assignment.create({
      data: {
        quizId: quiz.id,
        userId: staff.id,
        startAt: new Date(),
        endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
    });
  }

  console.log('✅ Seed hoàn thành:');
  console.log('  👤 admin / Admin@1234 (role: ADMIN)');
  console.log('  👤 nhanvien01 / Staff@1234 (role: STAFF)');
  console.log('  📝 Quiz: Kiểm tra nghiệp vụ tín dụng cơ bản');
  console.log('  📋 Assignment: nhanvien01 → quiz demo (7 ngày)');

  // ── Sprint 9: Seed LevelDefinition ──────────────────────────────────────
  const levels = [
    { level: 1,  name: 'Tân binh',            minXp: 0,     color: '#9E9E9E' },
    { level: 2,  name: 'Học viên',             minXp: 100,   color: '#4CAF50' },
    { level: 3,  name: 'Học viên khá',         minXp: 300,   color: '#8BC34A' },
    { level: 4,  name: 'Học viên giỏi',        minXp: 600,   color: '#03A9F4' },
    { level: 5,  name: 'Chuyên viên',          minXp: 1000,  color: '#2196F3' },
    { level: 6,  name: 'Chuyên viên cấp cao',  minXp: 1500,  color: '#3F51B5' },
    { level: 7,  name: 'Chuyên gia',           minXp: 2500,  color: '#9C27B0' },
    { level: 8,  name: 'Chuyên gia xuất sắc',  minXp: 4000,  color: '#E91E63' },
    { level: 9,  name: 'Bậc thầy',             minXp: 6000,  color: '#FF5722' },
    { level: 10, name: 'Huyền thoại',          minXp: 10000, color: '#FFB300' },
  ];
  for (const l of levels) {
    await prisma.levelDefinition.upsert({
      where: { level: l.level },
      update: { name: l.name, minXp: l.minXp, color: l.color },
      create: l,
    });
  }
  console.log('  🏆 10 LevelDefinition seeded');

  // ── Sprint 9: Seed BadgeDefinition ───────────────────────────────────────
  const badges = [
    { code: 'first_exam',    name: 'Bước đầu tiên',      description: 'Hoàn thành bài thi đầu tiên',          iconSlug: 'badge_first_exam',    category: 'EXAM'     as const, conditionJson: { type: 'submission_count', value: 1  }, xpBonus: 0   },
    { code: 'exam_10',       name: 'Siêng năng',          description: 'Hoàn thành 10 bài thi',                iconSlug: 'badge_exam_10',       category: 'EXAM'     as const, conditionJson: { type: 'submission_count', value: 10 }, xpBonus: 50  },
    { code: 'exam_50',       name: 'Chăm chỉ',            description: 'Hoàn thành 50 bài thi',                iconSlug: 'badge_exam_50',       category: 'EXAM'     as const, conditionJson: { type: 'submission_count', value: 50 }, xpBonus: 200 },
    { code: 'perfect_score', name: 'Hoàn hảo',            description: 'Đạt điểm tuyệt đối 100%',             iconSlug: 'badge_perfect',       category: 'EXAM'     as const, conditionJson: { type: 'perfect_score',    value: 1  }, xpBonus: 100 },
    { code: 'pass_streak_5', name: 'Chuỗi thắng',         description: 'Đạt 5 bài liên tiếp',                 iconSlug: 'badge_pass_streak',   category: 'EXAM'     as const, conditionJson: { type: 'consecutive_pass', value: 5  }, xpBonus: 50  },
    { code: 'streak_7',      name: 'Chuyên cần 7 ngày',   description: 'Học liên tiếp 7 ngày',                 iconSlug: 'badge_streak_7',      category: 'STREAK'   as const, conditionJson: { type: 'streak_days',      value: 7  }, xpBonus: 0   },
    { code: 'streak_30',     name: 'Kiên trì 30 ngày',    description: 'Học liên tiếp 30 ngày',                iconSlug: 'badge_streak_30',     category: 'STREAK'   as const, conditionJson: { type: 'streak_days',      value: 30 }, xpBonus: 200 },
    { code: 'arena_first',   name: 'Chiến binh',          description: 'Tham gia đấu trường lần đầu',          iconSlug: 'badge_arena_first',   category: 'ARENA'    as const, conditionJson: { type: 'arena_win_count',  value: 0  }, xpBonus: 0   },
    { code: 'arena_winner',  name: 'Vô địch',             description: 'Thắng đấu trường lần đầu',             iconSlug: 'badge_arena_winner',  category: 'ARENA'    as const, conditionJson: { type: 'arena_win_count',  value: 1  }, xpBonus: 100 },
    { code: 'arena_5wins',   name: 'Đấu sĩ',              description: 'Thắng 5 lần đấu trường',               iconSlug: 'badge_arena_5wins',   category: 'ARENA'    as const, conditionJson: { type: 'arena_win_count',  value: 5  }, xpBonus: 300 },
    { code: 'speed_demon',   name: 'Thần tốc',            description: 'Trả lời đúng nhanh nhất 3 lần',        iconSlug: 'badge_speed',         category: 'ARENA'    as const, conditionJson: { type: 'arena_win_count',  value: 3  }, xpBonus: 50  },
    { code: 'level_5',       name: 'Chuyên viên',         description: 'Đạt cấp độ 5',                        iconSlug: 'badge_level_5',       category: 'LEVEL'    as const, conditionJson: { type: 'level_reached',    value: 5  }, xpBonus: 0   },
    { code: 'level_10',      name: 'Huyền thoại',         description: 'Đạt cấp độ 10 — đỉnh cao',            iconSlug: 'badge_level_10',      category: 'LEVEL'    as const, conditionJson: { type: 'level_reached',    value: 10 }, xpBonus: 500 },
    { code: 'department_top',name: 'Ngôi sao phòng ban',  description: 'Đứng đầu bảng xếp hạng phòng ban',    iconSlug: 'badge_dept_top',      category: 'PROGRESS' as const, conditionJson: { type: 'pass_count',       value: 20 }, xpBonus: 0   },
    { code: 'early_bird',    name: 'Người tiên phong',    description: 'Là 1 trong 10 người đầu hoàn thành bài', iconSlug: 'badge_early_bird',  category: 'PROGRESS' as const, conditionJson: { type: 'submission_count', value: 5  }, xpBonus: 0   },
  ];
  for (const b of badges) {
    await prisma.badgeDefinition.upsert({
      where: { code: b.code },
      update: { name: b.name, description: b.description, iconSlug: b.iconSlug, conditionJson: b.conditionJson, xpBonus: b.xpBonus },
      create: b,
    });
  }
  console.log('  🏅 15 BadgeDefinition seeded');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
