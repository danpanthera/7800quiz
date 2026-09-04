-- ============================================================================
-- Hợp nhất cơ cấu tổ chức về đúng 9 chi nhánh cấp 1
-- ----------------------------------------------------------------------------
-- Bối cảnh: dữ liệu phòng ban đang chồng 3 thế hệ:
--   1. Seed gốc  : 01-HS … 09-NH  + phòng ban con 0X-YY-* (rỗng, chưa có cán bộ)
--   2. Import GAHR26 đợt 1: 7800::… → 7808::… (đang giữ toàn bộ cán bộ)
--   3. Import GAHR26 đợt 2: 7800 … 7808 cấp 1 "Agribank CN … Lai Châu" (trùng lặp)
--
-- Sau migration:
--   - CN Lai Châu (BRCD 7800) hoà chung vào Hội Sở
--   - Phòng Giao dịch số 5 → phòng ban của CN Phong Thổ
--   - Phòng Giao dịch số 6 → phòng ban của CN Than Uyên
--   - Phòng Giao dịch số 1, 2 → phòng ban của CN Đoàn Kết
--   - Phòng Công nghệ Thông tin → phòng ban của Hội Sở
--   - Còn đúng 9 chi nhánh cấp 1, không còn phòng ban trùng tên
--
-- Nguyên tắc gộp: GIỮ phòng ban đang có cán bộ, chuyển mọi tham chiếu của
-- phòng ban trùng sang nó rồi xoá phòng trùng — không cán bộ nào bị mất đơn vị.
-- Trên DB rỗng (deploy mới) toàn bộ câu lệnh dưới đây là no-op.
-- ============================================================================

-- 1. Ánh xạ: phòng ban đang giữ cán bộ → mã chuẩn, tên chuẩn, chi nhánh đích
CREATE TEMP TABLE tmp_dept_canonical (
  old_code  text PRIMARY KEY,
  unit_code text NOT NULL,
  new_code  text NOT NULL,
  new_name  text NOT NULL
);

INSERT INTO tmp_dept_canonical (old_code, unit_code, new_code, new_name) VALUES
  -- Hội Sở — tiếp nhận toàn bộ phòng ban của CN Lai Châu (BRCD 7800)
  ('7800::Ban Giám Đốc',                     '01-HS',  '01-HS-BGD',    'Ban Giám đốc'),
  ('7800::Phòng Khách hàng Doanh nghiệp',    '01-HS',  '01-HS-KHDN',   'Phòng Khách hàng Doanh nghiệp'),
  ('7800::Phòng Khách hàng Cá nhân',         '01-HS',  '01-HS-KHCN',   'Phòng Khách hàng Cá nhân'),
  ('7800::Phòng Kế hoạch và Quản lý rủi ro', '01-HS',  '01-HS-KHRR',   'Phòng Kế hoạch và Quản lý rủi ro'),
  ('7800::Phòng Kiểm tra, giám sát nội bộ',  '01-HS',  '01-HS-KTGSNB', 'Phòng Kiểm tra, Giám sát nội bộ'),
  ('7800::Phòng Tổng hợp',                   '01-HS',  '01-HS-TH',     'Phòng Tổng hợp'),
  ('7800::Phòng kế toán và ngân quỹ',        '01-HS',  '01-HS-KTNQ',   'Phòng Kế toán và Ngân quỹ'),
  ('IT',                                     '01-HS',  '01-HS-IT',     'Phòng Công nghệ Thông tin'),
  -- CN Bình Lư
  ('7801::Ban Giám Đốc',                     '02-BL',  '02-BL-BGD',    'Ban Giám đốc'),
  ('7801::Phòng Khách hàng',                 '02-BL',  '02-BL-KH',     'Phòng Khách hàng'),
  ('7801::Phòng kế toán và ngân quỹ',        '02-BL',  '02-BL-KTNQ',   'Phòng Kế toán và Ngân quỹ'),
  -- CN Phong Thổ
  ('7802::Ban Giám Đốc',                     '03-PT',  '03-PT-BGD',    'Ban Giám đốc'),
  ('7802::Phòng Khách hàng',                 '03-PT',  '03-PT-KH',     'Phòng Khách hàng'),
  ('7802::Phòng kế toán và ngân quỹ',        '03-PT',  '03-PT-KTNQ',   'Phòng Kế toán và Ngân quỹ'),
  ('7802::Phòng giao dịch Số 5',             '03-PT',  '03-PT-PGD5',   'Phòng Giao dịch số 5'),
  -- CN Sìn Hồ
  ('7803::Ban Giám Đốc',                     '04-SH',  '04-SH-BGD',    'Ban Giám đốc'),
  ('7803::Phòng Khách hàng',                 '04-SH',  '04-SH-KH',     'Phòng Khách hàng'),
  ('7803::Phòng kế toán và ngân quỹ',        '04-SH',  '04-SH-KTNQ',   'Phòng Kế toán và Ngân quỹ'),
  -- CN Bum Tở
  ('7804::Ban Giám Đốc',                     '05-BT',  '05-BT-BGD',    'Ban Giám đốc'),
  ('7804::Phòng Khách hàng',                 '05-BT',  '05-BT-KH',     'Phòng Khách hàng'),
  ('7804::Phòng kế toán và ngân quỹ',        '05-BT',  '05-BT-KTNQ',   'Phòng Kế toán và Ngân quỹ'),
  -- CN Than Uyên
  ('7805::Ban Giám Đốc',                     '06-TU',  '06-TU-BGD',    'Ban Giám đốc'),
  ('7805::Phòng Khách hàng',                 '06-TU',  '06-TU-KH',     'Phòng Khách hàng'),
  ('7805::Phòng kế toán và ngân quỹ',        '06-TU',  '06-TU-KTNQ',   'Phòng Kế toán và Ngân quỹ'),
  ('7805::Phòng giao dịch Số 6',             '06-TU',  '06-TU-PGD6',   'Phòng Giao dịch số 6'),
  -- CN Đoàn Kết
  ('7806::Ban Giám Đốc',                     '07-DK',  '07-DK-BGD',    'Ban Giám đốc'),
  ('7806::Phòng Khách hàng',                 '07-DK',  '07-DK-KH',     'Phòng Khách hàng'),
  ('7806::Phòng kế toán và ngân quỹ',        '07-DK',  '07-DK-KTNQ',   'Phòng Kế toán và Ngân quỹ'),
  ('7806::Phòng giao dịch số 1',             '07-DK',  '07-DK-PGD1',   'Phòng Giao dịch số 1'),
  ('7806::Phòng giao dịch số 2',             '07-DK',  '07-DK-PGD2',   'Phòng Giao dịch số 2'),
  -- CN Tân Uyên
  ('7807::Ban Giám Đốc',                     '08-TAU', '08-TAU-BGD',   'Ban Giám đốc'),
  ('7807::Phòng Khách hàng',                 '08-TAU', '08-TAU-KH',    'Phòng Khách hàng'),
  ('7807::Phòng kế toán và ngân quỹ',        '08-TAU', '08-TAU-KTNQ',  'Phòng Kế toán và Ngân quỹ'),
  ('7807::Phòng Giao dịch số 3',             '08-TAU', '08-TAU-PGD3',  'Phòng Giao dịch số 3'),
  -- CN Nậm Hàng
  ('7808::Ban Giám Đốc',                     '09-NH',  '09-NH-BGD',    'Ban Giám đốc'),
  ('7808::Phòng Khách hàng',                 '09-NH',  '09-NH-KH',     'Phòng Khách hàng'),
  ('7808::Phòng Kế toán và ngân quỹ',        '09-NH',  '09-NH-KTNQ',   'Phòng Kế toán và Ngân quỹ');

-- 2. Lập danh sách cặp gộp: phòng ban giữ lại ← phòng ban trùng sẽ bị xoá
CREATE TEMP TABLE tmp_dept_merge (keep_id text NOT NULL, drop_id text NOT NULL);

--   2a. Phòng ban rỗng do seed tạo đang chiếm sẵn mã chuẩn
INSERT INTO tmp_dept_merge (keep_id, drop_id)
SELECT keep.id, dup.id
FROM tmp_dept_canonical m
JOIN departments keep ON keep.code = m.old_code
JOIN departments dup  ON dup.code = m.new_code AND dup.id <> keep.id;

--   2b. Bản trùng của PGD số 5 / số 6 do import tạo lệch chữ hoa - thường
INSERT INTO tmp_dept_merge (keep_id, drop_id)
SELECT keep.id, dup.id
FROM (VALUES
        ('7802::Phòng giao dịch Số 5', '7802::Phòng giao dịch số 5'),
        ('7805::Phòng giao dịch Số 6', '7805::Phòng giao dịch số 6')
     ) AS v(keep_code, drop_code)
JOIN departments keep ON keep.code = v.keep_code
JOIN departments dup  ON dup.code = v.drop_code;

-- 3. Chuyển mọi tham chiếu sang phòng ban giữ lại, rồi xoá phòng ban trùng
UPDATE can_bo      t SET department_id = m.keep_id FROM tmp_dept_merge m WHERE t.department_id = m.drop_id;
UPDATE users       t SET department_id = m.keep_id FROM tmp_dept_merge m WHERE t.department_id = m.drop_id;
UPDATE assignments t SET department_id = m.keep_id FROM tmp_dept_merge m WHERE t.department_id = m.drop_id;
UPDATE departments t SET parent_id     = m.keep_id FROM tmp_dept_merge m WHERE t.parent_id     = m.drop_id;
DELETE FROM departments d USING tmp_dept_merge m WHERE d.id = m.drop_id;

-- 4. Chuẩn hoá mã + tên và gắn phòng ban giữ lại vào đúng chi nhánh cấp 1
UPDATE departments d
SET code = m.new_code, name = m.new_name, parent_id = unit.id
FROM tmp_dept_canonical m
JOIN departments unit ON unit.code = m.unit_code
WHERE d.code = m.old_code;

-- 5. Gộp 9 chi nhánh cấp 1 dư thừa (BRCD 7800…7808) vào 9 chi nhánh chuẩn
CREATE TEMP TABLE tmp_branch_merge (keep_id text NOT NULL, drop_id text NOT NULL);

INSERT INTO tmp_branch_merge (keep_id, drop_id)
SELECT unit.id, old.id
FROM (VALUES
        ('7800','01-HS'), ('7801','02-BL'),  ('7802','03-PT'),
        ('7803','04-SH'), ('7804','05-BT'),  ('7805','06-TU'),
        ('7806','07-DK'), ('7807','08-TAU'), ('7808','09-NH')
     ) AS v(old_code, unit_code)
JOIN departments old  ON old.code  = v.old_code
JOIN departments unit ON unit.code = v.unit_code;

UPDATE can_bo      t SET department_id = m.keep_id FROM tmp_branch_merge m WHERE t.department_id = m.drop_id;
UPDATE users       t SET department_id = m.keep_id FROM tmp_branch_merge m WHERE t.department_id = m.drop_id;
UPDATE assignments t SET department_id = m.keep_id FROM tmp_branch_merge m WHERE t.department_id = m.drop_id;
UPDATE departments t SET parent_id     = m.keep_id FROM tmp_branch_merge m WHERE t.parent_id     = m.drop_id;
DELETE FROM departments d USING tmp_branch_merge m WHERE d.id = m.drop_id;

-- 6. Chốt chặn: không được phép còn quá 9 chi nhánh cấp 1
--    (DB rỗng lúc deploy mới cho 0 chi nhánh — vẫn hợp lệ)
DO $$
DECLARE so_chi_nhanh int;
BEGIN
  SELECT count(*) INTO so_chi_nhanh FROM departments WHERE parent_id IS NULL;
  IF so_chi_nhanh > 9 THEN
    RAISE EXCEPTION 'Hợp nhất thất bại: còn % chi nhánh cấp 1, tối đa cho phép là 9', so_chi_nhanh;
  END IF;
END $$;

DROP TABLE tmp_dept_canonical;
DROP TABLE tmp_dept_merge;
DROP TABLE tmp_branch_merge;
