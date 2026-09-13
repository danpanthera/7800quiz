# Phát hiện gian lận khi thi

Tài liệu này ghi lại toàn bộ cơ chế chống/phát hiện gian lận trong lúc làm bài đã triển khai cho **7800Quiz**. Mục đích: giúp người sau (kể cả Claude ở phiên khác) nắm nhanh đã có gì, còn thiếu gì, và vì sao lại thiết kế như vậy — không cần đọc lại toàn bộ lịch sử commit.

> Quy ước trạng thái: ✅ đã xong, kiểm thử đầy đủ (unit test + E2E qua trình duyệt thật/HTTP thật). 🔶 đã xong ở mức backend/logic nhưng chưa có giao diện riêng.

---

## 1. Nguyên tắc thiết kế chung

- **Ghi nhận trước, trừng phạt sau, có ngưỡng.** Mặc định (`Quiz.violationLimit = 0`) mọi hành vi nghi vấn chỉ được **ghi log** để đối chiếu — không tự động chấm rớt. Chỉ khi admin chủ động đặt `violationLimit = N` (cấu hình **riêng theo từng bộ đề**, 0 = tắt) thì tới đúng lần vi phạm thứ N, server mới **tự động nộp bài** theo các câu đã lưu tới thời điểm đó.
- **Vi phạm "cứng" vs "mềm".** Không phải tín hiệu nào cũng đáng tin như nhau:
  - *Cứng* (`TAB_HIDDEN`, `COPY_ATTEMPT`, `WINDOW_BLUR`, `FULLSCREEN_EXIT`, `IDLE_TIMEOUT`, `MULTI_SESSION_LOGIN`) — cộng dồn vào `QuizAttempt.violationCount`, tính vào ngưỡng tự nộp.
  - *Mềm* (`DEVTOOLS_OPEN`, `SCREENSHOT_ATTEMPT`) — độ tin cậy thấp, dễ oan do cấu hình trình duyệt/màn hình/phím tắt hệ điều hành khác nhau giữa từng máy. Vẫn ghi 1 dòng vào `attempt_violations` để admin xem, nhưng **không** cộng dồn/không tự nộp. Xem `SOFT_VIOLATION_TYPES` trong `apps/api/src/attempts/attempts.service.ts`.
- **Bài tự nộp do vi phạm không được cộng XP** (`QuizAttempt.violationSubmitted`), tránh thưởng cho hành vi gian lận dù có làm đúng.
- **Không tự ý khoá quyền truy cập** — hệ thống chưa từng tự động khoá tài khoản hay chặn đăng nhập chỉ vì nghi vấn; mọi cờ "nghi vấn" đều chỉ là gợi ý cho admin tự quyết định, trừ việc tự nộp bài (có ngưỡng rõ ràng, admin tự đặt).

## 2. Bảng tổng hợp toàn bộ loại vi phạm

| Loại (`AttemptViolationType`) | Cứng/Mềm | Phát hiện ở đâu | Mô tả |
|---|---|---|---|
| `TAB_HIDDEN` | Cứng | `QuizPlayerPage.tsx` — sự kiện `visibilitychange` | Chuyển tab / thu nhỏ cửa sổ / ẩn xuống desktop |
| `COPY_ATTEMPT` | Cứng | `QuizPlayerPage.tsx` — sự kiện `copy` | Cố sao chép nội dung đề bài (chặn luôn hành vi, không chỉ ghi log) |
| `WINDOW_BLUR` | Cứng | `QuizPlayerPage.tsx` — sự kiện `blur`/`focus`, chờ 3 giây | Chuyển sang cửa sổ khác (chia đôi màn hình, mở app cạnh bên, màn hình phụ) mà trang KHÔNG bị ẩn — `visibilitychange` không bắt được trường hợp này |
| `FULLSCREEN_EXIT` | Cứng | `QuizPlayerPage.tsx` — sự kiện `fullscreenchange`, chỉ bật khi `Quiz.auditMode = true` | Thoát chế độ toàn màn hình giữa chừng bài thi |
| `IDLE_TIMEOUT` | Cứng | `QuizPlayerPage.tsx` — poll mỗi 10s | Không thao tác chuột/bàn phím/chạm/cuộn suốt 3 phút dù tab vẫn hiển thị và có focus — bắt được kiểu gian lận "rời máy tra tài liệu giấy/hỏi người khác/dùng điện thoại riêng" mà KHÔNG chuyển tab trên máy đang thi |
| `MULTI_SESSION_LOGIN` | Cứng | `auth.service.ts:issueSession()` | Đăng nhập thêm 1 nơi khác (thiết bị/trình duyệt khác) trong lúc còn bài làm dở — gợi ý nhờ người khác hỗ trợ hoặc thi hộ 1 phần |
| `DEVTOOLS_OPEN` | Mềm | `QuizPlayerPage.tsx` — poll mỗi 2s, so `outerWidth/outerHeight` với `innerWidth/innerHeight` | Nghi vấn mở công cụ dành cho lập trình viên (F12) — có thể dùng để xem trộm Network/DOM |
| `SCREENSHOT_ATTEMPT` | Mềm | `QuizPlayerPage.tsx` — sự kiện `keydown` (PrintScreen, Cmd+Shift+3/4/5) | Nghi vấn chụp màn hình — không phải hệ điều hành/trình duyệt nào cũng lộ phím tắt này |

Ngoài các loại vi phạm ghi vào `attempt_violations`, còn 3 cơ chế **phân tích** (không phải "vi phạm" theo đúng nghĩa, không lưu bảng riêng, chỉ tính động lúc admin xem):

| Cơ chế | Ở đâu | Mô tả |
|---|---|---|
| Tốc độ trả lời bất thường (`suspiciousSpeed`) | `admin.service.ts:getReports()`, Tag ở trang Báo cáo | Điểm cao (≥80) + trả lời trung bình rất nhanh (<3 giây/câu, tối thiểu 3 câu) → gợi ý đã biết trước đáp án |
| Bài đang treo bất thường (`staleAttempts`) | `admin.service.ts:getAtRiskStaff()`, thẻ mới ở trang "Cảnh báo nguy cơ" | Đang làm dở, còn hạn nộp, nhưng KHÔNG có lần lưu nào trong ≥20 phút — tín hiệu DUY NHẤT phía server còn phát hiện được nếu ai đó tắt JS/chặn request để né toàn bộ 7 cơ chế phía trên |
| Đối chiếu đáp án trùng lặp (`getAnswerCollusion`) | `admin.service.ts`, nút "Đối chiếu đáp án trùng lặp" ở trang Quản lý bộ đề | Liệt kê những câu mà ≥2 cán bộ cùng chọn CHUNG 1 đáp án SAI giống hệt nhau (đáp án đúng giống nhau là chuyện bình thường, không tính) — nghi vấn chép bài/dùng chung "phao" |

**Trạng thái: ✅** (toàn bộ đã kiểm thử qua unit test + E2E thật trên môi trường DEV bằng dữ liệu tiền tố `ZZVP_`/`ZZAM_`/`ZZGL_`, đã dọn sạch)

## 3. Cấu hình theo bộ đề

Mỗi bộ đề (`Quiz`) có 2 công tắc độc lập, admin bật/tắt khi tạo/sửa (`QuizzesPage.tsx`):

- **`violationLimit`** (số, mặc định 0 = tắt) — "Tự nộp bài khi vi phạm": tới đúng lần vi phạm CỨNG thứ N thì tự nộp.
- **`auditMode`** (bật/tắt, mặc định tắt) — "Chế độ giám sát nghiêm ngặt (audit)": bắt buộc toàn màn hình trước khi vào bài, thoát ra giữa chừng tính 1 vi phạm cứng (`FULLSCREEN_EXIT`).

2 công tắc này **độc lập** — có thể bật audit mà không bật tự nộp (chỉ ghi log), hoặc ngược lại. **Mặc định cả 2 đều TẮT cho đề luyện tập/thi thử**, chỉ bật cho kỳ thi chính thức.

Riêng "Kỳ thi" (`ExamSession`) không có công tắc riêng — nó chỉ là lớp lịch/cấu hình phủ lên trên 1 `Quiz` có sẵn (thời gian, số lần thi override...), việc thi vẫn đi qua đúng luồng `Assignment → QuizAttempt` như bình thường nên cấu hình ở `Quiz` đã áp dụng cho mọi kỳ thi dùng bộ đề đó.

## 4. Vì sao cần 1 vòng quét định kỳ riêng cho tự nộp

Phần lớn vi phạm (`TAB_HIDDEN`, `WINDOW_BLUR`, `FULLSCREEN_EXIT`, `IDLE_TIMEOUT`...) được phát hiện NGAY trên chính tab đang làm bài, nên khi chạm ngưỡng, `attempts.service.ts:reportViolation()` tự nộp **đồng bộ** và trả `autoSubmitted: true` để frontend điều hướng ngay sang trang kết quả.

`MULTI_SESSION_LOGIN` thì khác — nó được phát hiện ở **nơi đăng nhập mới** (`auth.service.ts`), không phải trên tab đang thi, nên không có ai đang chờ phản hồi ngay. Cố tình **không** inject `AttemptsService` vào `AuthModule` để tránh vòng phụ thuộc module (`AuthModule → AttemptsModule → GamificationModule → AuthModule`) — `AuthService` chỉ ghi log + tăng `violationCount` thẳng qua Prisma.

Việc thật sự tự nộp khi chạm ngưỡng do `MULTI_SESSION_LOGIN` được xử lý bởi **`AttemptsService.finalizeViolationExceededAttempts()`** — quét mỗi phút (chung interval với `finalizeExpiredAttempts()` đang có sẵn để tự nộp bài hết giờ), tự nộp mọi `QuizAttempt` đang `IN_PROGRESS` đã đạt `violationLimit`. Đây cũng là **lưới an toàn chung** cho mọi nguồn ghi vi phạm không đi qua `reportViolation()` — độ trễ tối đa 1 phút, chấp nhận được vì không ảnh hưởng tới trải nghiệm real-time của người đang làm bài.

## 5. File chính

- **Backend**: `apps/api/src/attempts/attempts.service.ts` (`reportViolation`, `finalize`, `finalizeViolationExceededAttempts`, `SOFT_VIOLATION_TYPES`), `apps/api/src/auth/auth.service.ts` (`issueSession`, `flagMultiSessionIfActiveAttempt`), `apps/api/src/admin/admin.service.ts` (`getReports`, `getAtRiskStaff`, `getAnswerCollusion`), `apps/api/prisma/schema.prisma` (`AttemptViolationType`, `Quiz.violationLimit`, `Quiz.auditMode`, `QuizAttempt.violationCount/violationSubmitted`).
- **Frontend**: `apps/web/src/pages/QuizPlayerPage.tsx` (toàn bộ cơ chế phát hiện + màn chắn toàn màn hình + banner cảnh báo), `apps/web/src/pages/QuizzesPage.tsx` (2 công tắc cấu hình + nút đối chiếu đáp án), `apps/web/src/pages/AttemptViolationsPage.tsx` (danh sách vi phạm, có bộ lọc), `apps/web/src/pages/AtRiskStaffPage.tsx` (thẻ "Bài đang treo bất thường"), `apps/web/src/pages/ReportsPage.tsx` (Tag "Tốc độ bất thường"), `apps/web/src/pages/QuizResultPage.tsx` (Alert khi bài bị tự nộp do vi phạm).

## 6. Đã cân nhắc nhưng KHÔNG làm (ngoài khả năng của 1 trình duyệt)

- **Tra cứu AI/hỏi người khác qua điện thoại riêng hoặc máy thứ 2** — không để lại dấu vết gì trên máy đang thi, không có cách phát hiện qua JS chạy trên trình duyệt. Tín hiệu gián tiếp duy nhất là tốc độ trả lời bất thường (mục 2) hoặc so lịch sử điểm số (chưa làm).
- **Thi hộ (người khác đăng nhập dùm)** — chỉ giải quyết được bằng xác thực bổ sung (OTP, camera nhận diện khuôn mặt...), nằm ngoài kiến trúc hiện tại (không có phần cứng camera, không tích hợp OTP SMS).
- **Giám sát qua camera/microphone (proctoring thật sự)** — cần hạ tầng hoàn toàn khác (WebRTC, lưu trữ video, quy định pháp lý về giám sát), chưa được yêu cầu.

## 7. Lỗ hổng đã biết, chấp nhận được

- `DEVTOOLS_OPEN`/`SCREENSHOT_ATTEMPT` dựa trên heuristic (đo kích thước cửa sổ, phím tắt) — không phải trình duyệt/hệ điều hành nào cũng lộ tín hiệu, và ngưỡng rộng (220px) có thể vẫn còn oan/sót tuỳ máy. Đây là lý do thiết kế chúng thành vi phạm "mềm" — không ảnh hưởng tới việc tự nộp bài.
- Toàn bộ 6 loại vi phạm "cứng" ở mục 2 (trừ `MULTI_SESSION_LOGIN`) đều do **chính máy đang thi tự báo lên** — nếu tắt hẳn JavaScript hoặc chặn request tới server, các cơ chế này hoàn toàn vô hiệu. `staleAttempts` (mục 2, phân tích) là lớp phòng thủ cuối cho đúng trường hợp này, nhưng chỉ là gợi ý xem sau, không ngăn được ngay lúc đang xảy ra.
- `IDLE_TIMEOUT` 3 phút là con số cố định trong code (`IDLE_THRESHOLD_MS` ở `QuizPlayerPage.tsx`), chưa cho phép admin tuỳ chỉnh theo từng bộ đề như `violationLimit`/`auditMode` — nếu cần tinh chỉnh riêng, phải sửa code.
