import { Alert, Tag, Typography } from 'antd'
import KhungHuongDan, { BangNho, type MucHuongDan } from '../components/KhungHuongDan'

const { Title, Paragraph } = Typography

const CAC_MUC: MucHuongDan[] = [
  {
    id: 'vai-tro',
    tieuDe: '1. Vai trò và phân quyền',
    noiDung: (
      <>
        <Paragraph>Hệ thống có 3 vai trò tài khoản, cộng thêm 1 dấu hiệu phụ là "Cán bộ IT".</Paragraph>
        <BangNho
          cot={[{ title: 'Vai trò', dataIndex: 'vt' }, { title: 'Làm được gì', dataIndex: 'lg' }]}
          dong={[
            { vt: 'Cán bộ (STAFF)', lg: 'Chỉ phần của mình: làm bài, luyện tập, ôn tập, Đấu trường, bảng xếp hạng, bảo mật tài khoản.' },
            { vt: 'Cán bộ đào tạo (TRAINER)', lg: 'Toàn bộ nghiệp vụ đào tạo: ngân hàng câu hỏi, bộ đề, phân công, kỳ thi, Đấu trường, báo cáo, giám sát vi phạm. KHÔNG quản lý được cán bộ, phòng ban, năm học, lớp, nhật ký, bảo mật. Tạo được câu hỏi nhưng KHÔNG tự duyệt được.' },
            { vt: 'Quản trị viên (ADMIN)', lg: 'Toàn quyền, gồm cả quản lý cán bộ/phòng ban/năm học/lớp học, duyệt câu hỏi, nhật ký quản trị và giám sát bảo mật.' },
          ]}
        />
        <Title level={5}>Cán bộ IT</Title>
        <ul>
          <li>Đánh dấu ở <b>Quản lý cán bộ</b> → sửa hồ sơ → tích ô <b>Cán bộ IT</b>. Trong danh sách, người được đánh dấu có nhãn <Tag color="geekblue">Cán bộ IT</Tag> cạnh họ tên.</li>
          <li>Đây <b>không phải</b> quyền quản trị: cán bộ IT vẫn không vào được các trang <i>/manage</i>, không sửa được dữ liệu nghiệp vụ.</li>
          <li>Hiện tại dấu hiệu này cho phép xem <b>chính trang hướng dẫn quản trị này</b>, và là chỗ để gắn thêm các quyền kỹ thuật đặc biệt về sau mà không phải cấp quyền admin.</li>
          <li>Cờ được nạp vào lúc đăng nhập — người vừa được đánh dấu phải <b>đăng xuất rồi đăng nhập lại</b> mới thấy menu mới.</li>
        </ul>
        <Alert
          type="warning"
          showIcon
          message="Nguyên tắc cấp quyền"
          description="Chỉ cấp vai trò Quản trị viên cho người thực sự chịu trách nhiệm hệ thống. Cần người hỗ trợ kỹ thuật thì dùng dấu Cán bộ IT, không nâng lên admin."
        />
      </>
    ),
  },
  {
    id: 'thu-tu-dung',
    tieuDe: '2. Thứ tự triển khai chuẩn (làm lần đầu theo đúng trình tự này)',
    noiDung: (
      <>
        <ol>
          <li><b>Chi nhánh/Phòng ban</b> — dựng cây đơn vị 2 cấp trước, vì cán bộ phải gắn vào phòng ban.</li>
          <li><b>Quản lý cán bộ</b> — import danh sách từ file GAHR26 hoặc thêm tay.</li>
          <li><b>Ngân hàng câu hỏi</b> — tạo lĩnh vực rồi nhập câu hỏi (nhập tay hoặc import Excel).</li>
          <li><b>Bộ đề</b> — tạo đề, chọn câu hỏi, đặt thời gian, điểm đạt và các mức chống gian lận.</li>
          <li><b>Phân công</b> — giao bộ đề cho cán bộ/phòng ban kèm mốc thời gian mở–đóng.</li>
          <li>(Nếu thi theo lớp) <b>Năm học</b> → <b>Lớp học</b> → <b>Kỳ thi</b>.</li>
          <li>Trong lúc thi: theo dõi ở <b>Báo cáo</b>, <b>Cảnh báo nguy cơ</b>, <b>Giám sát vi phạm</b>.</li>
        </ol>
        <Paragraph style={{ marginBottom: 0 }}>
          Bỏ qua bước trước sẽ kẹt ở bước sau: chưa có phòng ban thì không gán được cán bộ; chưa có câu hỏi thì bộ đề rỗng; chưa phân công thì cán bộ không thấy bài nào.
        </Paragraph>
      </>
    ),
  },
  {
    id: 'to-chuc-can-bo',
    tieuDe: '3. Chi nhánh/Phòng ban và Quản lý cán bộ',
    noiDung: (
      <>
        <Title level={5}>Chi nhánh/Phòng ban</Title>
        <ul>
          <li>Cấu trúc <b>2 cấp</b>: để trống ô <b>Chi nhánh cha</b> là tạo chi nhánh; chọn chi nhánh cha là tạo phòng ban trực thuộc.</li>
          <li>Mã đặt theo quy ước sẵn có (<i>01-HS</i>, <i>02-BL</i>…) vì danh sách cán bộ sắp xếp theo mã này.</li>
          <li>Không xoá được đơn vị còn phòng ban con hoặc còn cán bộ — nút xoá sẽ bị mờ.</li>
        </ul>

        <Title level={5}>Thêm cán bộ</Title>
        <ul>
          <li><b>Mã CB</b> bắt buộc và phải đúng <b>9 chữ số</b>; <b>Họ tên</b> bắt buộc.</li>
          <li><b>User AD</b> là tên đăng nhập của cán bộ. Bỏ trống thì hệ thống lấy mã CB làm tên đăng nhập.</li>
          <li>Bật <b>Đăng nhập bằng AD</b> thì cán bộ đó vào hệ thống bằng đúng mật khẩu Windows/AD của họ (phải điền User AD trước), không cần chờ cấp mật khẩu tạm. Chỉ nên bật khi đã được duyệt và có kiểm tra nội bộ (đường mạng tới máy chủ AD).</li>
          <li>Không chọn phòng ban cụ thể thì cán bộ được gắn thẳng vào chi nhánh.</li>
          <li>Tài khoản đăng nhập được tạo kèm một <b>mật khẩu tạm ngẫu nhiên riêng</b> cho từng người (không còn mật khẩu mặc định dùng chung), hiện ở cột <b>Mật khẩu tạm</b> trong danh sách để đọc cho cán bộ; bắt buộc đổi ở lần đăng nhập đầu, đổi xong cột này tự trống.</li>
        </ul>

        <Title level={5}>Import GAHR26 (nhập hàng loạt)</Title>
        <ul>
          <li>Nhận file <code>.csv</code>, <code>.xls</code>, <code>.xlsx</code> có các cột <code>EMPNO, BRCD, BRNM, DEPTNM, POSITION, SEX, BIRTHDT</code>.</li>
          <li>Tên đăng nhập luôn lấy theo <b>EMPNO</b>. Kết quả trả về phân loại rõ: Thêm mới / Cập nhật / Bỏ qua / Lỗi.</li>
          <li>Chạy lại nhiều lần an toàn — người đã có sẽ được cập nhật chứ không nhân đôi.</li>
        </ul>

        <Title level={5}>Reset mật khẩu và xoá cán bộ</Title>
        <ul>
          <li><b>Reset mật khẩu</b> (từng người hoặc tích chọn nhiều người): sinh <b>mật khẩu tạm ngẫu nhiên mới</b> cho từng người, hiện ngay trong bảng kết quả (có nút copy) và vẫn xem lại được ở cột <b>Mật khẩu tạm</b>; cán bộ bắt buộc đổi ở lần đăng nhập kế tiếp. Bảng kết quả phân biệt <i>Đã reset</i> và <i>Chưa có TK</i>.</li>
          <li><b>Reset cứng huy hiệu/cấp độ</b> (trong nút <b>…</b>): đưa XP, cấp độ, huy hiệu về mốc ban đầu nhưng <b>giữ nguyên</b> bài nộp và lượt thi.</li>
          <li><b>Xoá thường</b> sẽ thất bại nếu cán bộ đã có lịch sử làm bài — hệ thống cố tình chặn lại như vậy để tránh mất dữ liệu, không phải lỗi.</li>
        </ul>
        <Alert
          type="error"
          showIcon
          message="Xoá triệt để (Super Delete) — không thể hoàn tác"
          description="Xoá sạch phân công, bài nộp, lượt thi, huy hiệu, XP, thẻ ôn tập và cả tài khoản đăng nhập, bỏ qua mọi chốt chặn. Phải gõ đúng mã CB mới bấm được. Chỉ dùng cho dữ liệu nhập sai hoặc tài khoản thử nghiệm, tuyệt đối không dùng cho cán bộ đã nghỉ việc — trường hợp đó chỉ cần chuyển trạng thái sang Đã nghỉ."
        />
      </>
    ),
  },
  {
    id: 'ngan-hang-cau-hoi',
    tieuDe: '4. Ngân hàng câu hỏi',
    noiDung: (
      <>
        <Title level={5}>Lĩnh vực và câu hỏi</Title>
        <ul>
          <li>Cột trái là danh sách <b>Lĩnh vực</b> (ví dụ "Nghiệp vụ Tín dụng"). Mọi câu hỏi đều phải thuộc một lĩnh vực — đây cũng là đơn vị để trộn đề tự động và để phân tích điểm yếu của cán bộ.</li>
          <li><b>Thêm câu hỏi</b>: chọn lĩnh vực, nhập nội dung, chọn <b>Loại</b> (<i>Chọn 1</i> / <i>Chọn nhiều</i> / <i>Sắp xếp thứ tự</i>), nhập 4 đáp án và tích ô vuông ở đáp án đúng, thêm <b>Giải thích</b> và <b>Điểm</b> (mặc định 1).</li>
          <li>Câu <b>Sắp xếp thứ tự</b>: nhập các mục theo đúng trình tự đúng, hệ thống tự xáo khi cán bộ làm bài.</li>
          <li>Rời khỏi ô nội dung, hệ thống <b>tự kiểm tra trùng lặp và chính tả</b> (chỉ khi thêm mới): báo "đã tồn tại" hoặc "tương tự" kèm % giống. Đây là cảnh báo, vẫn lưu được nếu thực sự cần.</li>
        </ul>

        <Title level={5}>Import Excel</Title>
        <ol>
          <li><b>Chọn lĩnh vực trước</b>, nếu không sẽ bị chặn.</li>
          <li>File <b>không có dòng tiêu đề</b>. Cột A = câu hỏi, B–E = 4 đáp án, F = số thứ tự đáp án đúng (<b>1=B, 2=C, 3=D, 4=E</b>), G = giải thích.</li>
          <li>Bấm <b>Kiểm tra</b> để xem trước: đếm rõ <i>Câu mới</i>, <i>Trùng (sẽ bỏ qua)</i>, <i>Tương tự</i>, <i>Cảnh báo chính tả</i>. Sửa được từng dòng ngay tại màn hình xem trước, và hệ thống import theo bản đã sửa.</li>
          <li>Mặc định <b>bỏ qua câu trùng</b>. Chỉ bật công tắc import cả câu trùng khi thực sự chủ ý.</li>
          <li>Bấm <b>Xác nhận import</b>.</li>
        </ol>

        <Title level={5}>Duyệt câu hỏi mới</Title>
        <ul>
          <li>Câu hỏi do <b>Cán bộ đào tạo</b> tạo phải được <b>Quản trị viên duyệt</b> mới được đưa vào bộ đề và Đấu trường.</li>
          <li>Vào <b>Duyệt câu hỏi mới</b>, đọc nội dung + đáp án đúng, bấm <b>Duyệt</b> hoặc <b>Từ chối</b> (nên ghi lý do để người soạn sửa).</li>
        </ul>
        <Alert
          type="warning"
          showIcon
          message="Cẩn trọng với nút Xoá toàn bộ"
          description="Ở màn ngân hàng câu hỏi, 'Xoá toàn bộ' sẽ xoá hết câu hỏi của lĩnh vực đang chọn — hoặc toàn bộ ngân hàng nếu đang ở mục 'Tất cả'. Không hoàn tác được."
        />
      </>
    ),
  },
  {
    id: 'bo-de',
    tieuDe: '5. Bộ đề',
    noiDung: (
      <>
        <Title level={5}>Các tham số khi tạo/sửa bộ đề</Title>
        <BangNho
          cot={[{ title: 'Tham số', dataIndex: 'ts' }, { title: 'Mặc định', dataIndex: 'md' }, { title: 'Ý nghĩa', dataIndex: 'yn' }]}
          dong={[
            { ts: 'Thời gian (phút)', md: '30', yn: 'Thời gian làm bài tính từ lúc cán bộ bấm Bắt đầu.' },
            { ts: 'Điểm đạt (%)', md: '70', yn: 'Ngưỡng đạt. Để trống thì hệ thống dùng 60.' },
            { ts: 'Số lần thi tối đa', md: '1', yn: '0 = không giới hạn. Chỉ đếm các lượt đã chấm trong cùng một phân công.' },
            { ts: 'Phản hồi tức thì', md: 'Tắt', yn: 'Bật = hiện đáp án đúng ngay sau mỗi câu. CHỈ dùng cho đề luyện tập.' },
            { ts: 'Chế độ giám sát nghiêm ngặt', md: 'Tắt', yn: 'Công tắc TỔNG: bắt buộc toàn màn hình + ghi nhận rời tab/chuyển cửa sổ/sao chép đề/chặn chuột phải. Tắt = bỏ qua toàn bộ, kể cả khi có đặt ngưỡng vi phạm bên dưới.' },
            { ts: 'Tự nộp bài khi vi phạm', md: '0 (tắt)', yn: 'Chỉ có tác dụng khi đã bật giám sát nghiêm ngặt ở trên. Số lần vi phạm cứng tối đa; chạm ngưỡng là hệ thống tự nộp bài.' },
          ]}
        />

        <Title level={5}>Đưa câu hỏi vào bộ đề — 2 cách</Title>
        <ul>
          <li><b>Trộn tự động theo tỷ lệ lĩnh vực</b> (chỉ có lúc <i>tạo mới</i>): nhập tổng số câu và tỷ lệ % từng lĩnh vực, tổng phải đủ <b>100%</b>. Màn hình xem trước quy ra số câu và cảnh báo đỏ nếu ngân hàng không đủ câu.</li>
          <li><b>Lấy câu ngẫu nhiên</b> (nút tia sét trên từng dòng, dùng được cả sau khi đã tạo): chọn lĩnh vực + số câu. Công tắc <b>Thay thế toàn bộ câu hỏi hiện tại</b> mặc định tắt, tức là <b>cộng thêm</b> vào đề.</li>
        </ul>

        <Title level={5}>Các nút thao tác trên từng bộ đề</Title>
        <ul>
          <li><b>Xem câu hỏi</b> — kiểm tra nội dung đề trước khi giao.</li>
          <li><b>Lấy câu ngẫu nhiên</b> — bổ sung/thay câu từ ngân hàng.</li>
          <li><b>Nhân bản bộ đề</b> — tạo bản sao để chỉnh cho đợt sau. <b>Bản sao ở trạng thái Tắt</b>, nhớ bật lại trước khi giao.</li>
          <li><b>Đối chiếu đáp án trùng lặp</b> — dò dấu hiệu chép bài, xem mục 9.</li>
          <li><b>Xoá bộ đề</b> — không xoá được khi đã có người làm bài hoặc đã gắn kỳ thi; phải gỡ phân công trước.</li>
        </ul>
        <Alert
          type="info"
          showIcon
          message="Sửa bộ đề đang có người thi"
          description="Mỗi lần đổi danh sách câu hỏi, hệ thống lưu thành một phiên bản đề mới; bài đã nộp vẫn giữ nguyên đề cũ nên điểm cũ không bị xô lệch. Tuy vậy vẫn nên tránh sửa đề khi đợt thi đang mở."
        />
      </>
    ),
  },
  {
    id: 'phan-cong',
    tieuDe: '6. Phân công và Lịch giao bài tự động',
    noiDung: (
      <>
        <Title level={5}>Giao bài</Title>
        <ul>
          <li>Chọn <b>Bộ đề</b>, rồi chọn 1 trong 3 cách giao: <b>Tất cả người dùng</b> / <b>Chọn cá nhân cụ thể</b> / <b>Theo phòng ban</b>.</li>
          <li><b>Trạng thái</b>: chỉ <b>Đang mở</b> mới hiện cho cán bộ. <i>Nháp</i> để chuẩn bị trước, <i>Đã đóng</i> để ngưng.</li>
          <li><b>Mở từ</b> / <b>Đến</b>: để trống là không giới hạn. Cán bộ chỉ thấy bài trong khoảng này.</li>
          <li><b>Import phân công (Excel)</b>: file 1 cột chứa mã cán bộ / User AD, mỗi dòng một người; mã không tìm thấy sẽ được liệt kê lại.</li>
          <li><b>Gia hạn hàng loạt</b>: đổi hạn cho mọi phân công khớp bộ lọc hiện tại — dùng khi cần nới hạn cho cả phòng ban.</li>
        </ul>
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Hạn nộp lấy theo mốc nào đến trước"
          description="Thời hạn của một lượt thi = min(giờ bắt đầu + thời gian của bộ đề, hạn Đến của phân công). Đặt hạn phân công lúc 17h00 thì người vào thi lúc 16h50 chỉ còn 10 phút, dù đề cho 30 phút."
        />

        <Title level={5}>Lịch giao bài tự động</Title>
        <ul style={{ marginBottom: 0 }}>
          <li>Tạo lịch theo chu kỳ <b>Mỗi ngày / Mỗi tuần / Mỗi tháng</b>, chọn phòng ban (bỏ trống = toàn bộ cán bộ), đặt <b>số ngày mở bài</b> (mặc định 7).</li>
          <li>Hệ thống tự kiểm tra <b>mỗi giờ</b> và mỗi lịch chỉ chạy tối đa <b>1 lần/ngày</b>.</li>
          <li>Nút <b>Chạy ngay</b> tạo phân công tức thì — bấm nhiều lần sẽ tạo thêm nhiều lần, cần lưu ý.</li>
          <li>Tạm ngưng bằng công tắc <b>Hoạt động</b> thay vì xoá, để giữ lại lịch sử.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'ky-thi',
    tieuDe: '7. Kỳ thi theo lớp',
    noiDung: (
      <>
        <Paragraph>
          Dùng khi cần tổ chức thành đợt có danh sách lớp, bảng điểm và chứng nhận. Trình tự: <b>Năm học</b> → <b>Lớp học</b> (thêm học viên) → <b>Kỳ thi</b>.
        </Paragraph>
        <Title level={5}>Tạo đợt thi</Title>
        <ul>
          <li><b>Tên đợt thi</b>, <b>Bộ đề</b>, <b>Lớp thi</b>, <b>Thời gian thi</b> (bắt buộc, khoảng từ–đến).</li>
          <li><b>Tính điểm theo</b>: <b>Điểm cao nhất</b> (mặc định) / Lần đầu tiên / Lần cuối cùng / Trung bình — đây là điểm chốt trên bảng điểm khi cho thi nhiều lần.</li>
          <li><b>Override thời gian</b>: để trống là dùng thời gian của bộ đề.</li>
          <li><b>Hiện kết quả</b>: Ngay sau khi nộp / Sau khi hết hạn đợt thi / Không hiện — chọn "sau khi hết hạn" cho kỳ thi nghiêm túc để tránh truyền đáp án.</li>
          <li>Công tắc <b>Xáo câu hỏi</b>, <b>Xáo đáp án</b> (mặc định tắt) và <b>Cho xem lại bài</b> (mặc định bật).</li>
        </ul>
        <Title level={5}>Vận hành</Title>
        <ul style={{ marginBottom: 0 }}>
          <li>Đợt thi tạo ra ở trạng thái <b>Nháp</b>; bấm nút ▶ để <b>mở</b>, nút ⏹ để <b>đóng</b>.</li>
          <li><b>Bảng điểm</b> có 4 tab: Bảng điểm (bấm tên học viên xem lịch sử từng lần thi, học viên đạt có nút <b>Cấp chứng nhận</b> để in), Leaderboard, Phân tích câu hỏi, và <b>Chưa làm</b> (có nút <b>Copy danh sách</b> để nhắc qua email/Zalo).</li>
          <li>Xuất số liệu bằng nút <b>Export Excel</b>.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'dau-truong',
    tieuDe: '8. Đấu trường và Giải đấu',
    noiDung: (
      <>
        <Title level={5}>Tổ chức một phiên</Title>
        <ol>
          <li><b>Tạo phiên mới</b>: đặt tên; chọn <b>bộ đề có sẵn</b> hoặc bật <b>trộn câu hỏi theo tỷ lệ lĩnh vực</b>.</li>
          <li>Chọn <b>Chế độ điều khiển</b>: <i>Manual</i> (MC bấm từng bước — nên dùng khi có người dẫn) hoặc <i>Auto</i> (tự chạy).</li>
          <li>Đặt <b>thời gian mỗi câu</b> (mặc định 20 giây), <b>điểm theo thứ tự đúng</b> (mặc định 10,7,5,3,2…), <b>điểm trừ khi sai</b> (mặc định 0), <b>mật khẩu phòng</b> nếu cần.</li>
          <li>Có thể lập sẵn <b>đội</b> (tối đa 10 đội, mỗi đội tối đa 5 người) và <b>danh sách mời</b> — mời ai thì chỉ người đó vào được.</li>
          <li>Mở <b>màn trình chiếu</b> trên máy nối máy chiếu, đọc <b>mã tham gia 6 ký tự</b> hoặc cho quét mã QR.</li>
          <li>Đủ <b>ít nhất 2 đội có người</b> mới bấm được <b>Bắt đầu</b>. Trong khi chạy: <b>Reveal đáp án</b> → <b>Câu tiếp theo</b>; nút <b>Kết thúc</b> dừng phiên bất cứ lúc nào.</li>
        </ol>

        <Title level={5}>Luật tính điểm (nói rõ cho người chơi trước khi bắt đầu)</Title>
        <ul>
          <li>Điểm tính theo <b>thứ hạng trả lời đúng</b>, không phải theo số giây còn lại.</li>
          <li><b>Mỗi đội chỉ gửi được 1 đáp án cho mỗi câu</b> — ai bấm trước là chốt cho cả đội.</li>
          <li>Trả lời sai hoặc không kịp: 0 điểm (trừ khi phiên có đặt điểm trừ).</li>
          <li>Đồng điểm xếp theo: số câu đúng nhiều hơn → tổng thời gian trả lời đúng ngắn hơn → vào phòng sớm hơn.</li>
          <li>Kết thúc phiên hệ thống tự cộng <b>+10 XP</b> cho mọi người tham gia và <b>+30 XP</b> cho thành viên đội vô địch.</li>
        </ul>

        <Title level={5}>Lưu ý khi vận hành</Title>
        <ul>
          <li>Mở màn người chơi <b>sớm vài giây</b> trước câu đầu để hệ thống đo được độ trễ đường truyền và bù cho công bằng.</li>
          <li><b>Giọng đọc chỉ nên bật ở một máy</b> (máy nối loa), bật nhiều máy sẽ chồng tiếng.</li>
          <li>Giọng đọc chỉ đọc <b>đề bài</b> và bị cắt khi hết giờ câu — câu quá dài sẽ đọc không hết, nên soạn câu Đấu trường ngắn gọn.</li>
          <li>Bấm <b>Câu tiếp theo</b> khi câu đang chạy thì hệ thống vẫn chốt điểm đầy đủ cho câu đó, không mất điểm của ai.</li>
          <li>Trộn đề tự động sẽ <b>tạo một bộ đề mới thật sự</b> trong danh mục Bộ đề; xoá phiên không xoá bộ đề đó, thỉnh thoảng nên dọn.</li>
          <li><b>Giải đấu loại trực tiếp</b>: số đội phải là luỹ thừa của 2 (4, 8, 16…); mỗi trận bấm bắt đầu sẽ sinh ra một phiên Đấu trường, vận hành xong quay lại chốt kết quả trận.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'chong-gian-lan',
    tieuDe: '9. Chống gian lận: cấu hình và xử lý',
    noiDung: (
      <>
        <Title level={5}>Hai công tắc cấu hình trên từng bộ đề</Title>
        <ul>
          <li><b>Chế độ giám sát nghiêm ngặt</b> là công tắc TỔNG: bắt buộc toàn màn hình, đồng thời bật toàn bộ các kiểm tra ở bảng bên dưới. <b>Tắt</b> (mặc định cho đề luyện tập/thi thử) = không kiểm tra gì cả, cán bộ được rời tab, chuyển cửa sổ, sao chép đề, bấm chuột phải thoải mái. Chỉ nên bật cho thi tập trung tại hội trường/phòng máy.</li>
          <li><b>Tự nộp bài khi vi phạm</b> = 0 là tắt (chỉ ghi nhận để đối chiếu). Đặt <b>từ 3 trở lên</b> cho kỳ thi nghiêm túc — đặt 1–2 rất dễ oan do thông báo tự bật của Outlook/Zalo. <b>Chỉ có tác dụng khi đã bật giám sát nghiêm ngặt</b> — nếu tắt giám sát, đặt ngưỡng này cũng vô nghĩa vì không có gì được ghi nhận để đếm.</li>
          <li><b>Kỳ thi tự dùng đúng cấu hình chống gian lận của bộ đề</b>, không có công tắc riêng cho kỳ thi.</li>
        </ul>

        <Title level={5}>Các loại vi phạm hệ thống ghi nhận được</Title>
        <BangNho
          cot={[{ title: 'Loại', dataIndex: 'loai' }, { title: 'Điều kiện áp dụng', dataIndex: 'ap' }, { title: 'Tính vào ngưỡng?', dataIndex: 'tinh' }]}
          dong={[
            { loai: 'Rời tab / thu nhỏ cửa sổ', ap: 'Đã bật giám sát', tinh: 'Có (vi phạm cứng)' },
            { loai: 'Chuyển sang cửa sổ khác (quá 3 giây)', ap: 'Đã bật giám sát', tinh: 'Có' },
            { loai: 'Cố sao chép đề bài', ap: 'Đã bật giám sát', tinh: 'Có' },
            { loai: 'Thoát toàn màn hình', ap: 'Đã bật giám sát', tinh: 'Có' },
            { loai: 'Vắng mặt bất thường (không thao tác 3 phút)', ap: 'Đã bật giám sát', tinh: 'Có' },
            { loai: 'Nghi vấn mở công cụ lập trình', ap: 'Đã bật giám sát', tinh: 'Không — dễ báo nhầm, chỉ lưu lại để xem' },
            { loai: 'Nghi vấn chụp màn hình', ap: 'Đã bật giám sát', tinh: 'Không — dễ báo nhầm, chỉ lưu lại để xem' },
            { loai: 'Đăng nhập thêm nơi khác khi đang thi', ap: 'MỌI bộ đề, không phụ thuộc công tắc giám sát', tinh: 'Có (xử lý trễ tối đa 1 phút)' },
          ]}
        />

        <Title level={5}>Ba công cụ đối chiếu khi nghi ngờ</Title>
        <ul>
          <li><b>Giám sát vi phạm</b> — nhật ký từng lần vi phạm, lọc theo loại/người/bộ đề.</li>
          <li><b>Đối chiếu đáp án trùng lặp</b> (nút chuông trên dòng bộ đề) — liệt kê câu mà từ 2 người trở lên cùng chọn <b>một đáp án SAI giống hệt</b>.</li>
          <li><b>Tốc độ bất thường</b> (nhãn tím ở trang Báo cáo) — điểm từ 80 trở lên nhưng tốc độ trả lời trung bình dưới 3 giây/câu.</li>
        </ul>
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Đây là dấu hiệu để đối chiếu, không phải bằng chứng"
          description="Hai người cùng sai giống nhau có thể vì cùng hiểu nhầm một chỗ. Trả lời nhanh có thể vì đã ôn kỹ. Luôn xác minh thêm trước khi kết luận, và nên nói rõ quy định giám sát cho cán bộ TRƯỚC kỳ thi."
        />
        <Title level={5}>Giới hạn cần biết</Title>
        <ul style={{ marginBottom: 0 }}>
          <li>Việc phát hiện dựa vào trình duyệt của người thi tự báo về, nên người cố tình tắt JavaScript có thể né được. Khi đó dấu vết còn lại là bài "treo" bất thường, xem ở <b>Cảnh báo nguy cơ</b>.</li>
          <li>Hệ thống <b>không</b> giám sát qua camera/micro và <b>không</b> phát hiện được thi hộ hay tra cứu bằng điện thoại riêng.</li>
          <li>Hệ thống <b>không tự khoá tài khoản</b> vì vi phạm — chỉ tự nộp bài. Việc xử lý là quyết định của đơn vị.</li>
          <li>Bài bị tự nộp do vi phạm vẫn được chấm nhưng <b>không được cộng XP</b>.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'bao-cao',
    tieuDe: '10. Báo cáo và giám sát',
    noiDung: (
      <>
        <ul>
          <li><b>Báo cáo</b> — toàn bộ bài thi, lọc theo cán bộ (tìm được cả không dấu), chi nhánh, phòng ban, bộ đề, mức điểm. Các chỉ số Điểm TB / Đạt chỉ tính <b>bài điểm cao nhất của mỗi người mỗi bộ đề</b>.</li>
          <li><b>Xu hướng điểm</b> — diễn biến theo tuần/tháng, dùng cho báo cáo định kỳ.</li>
          <li><b>So sánh chi nhánh</b> — xếp đơn vị điểm thấp lên đầu, gắn nhãn "Cần chú ý" cho đơn vị dưới 60%.</li>
          <li><b>Cảnh báo nguy cơ</b> — 4 nhóm cần can thiệp: sắp hết hạn chưa nộp, trượt bài trong 30 ngày, vi phạm nhiều, và bài đang treo bất thường (im lặng quá 20 phút).</li>
          <li><b>Phân tích câu hỏi</b> — tỷ lệ trả lời đúng và mức chênh lệch giữa người giỏi/người kém khi làm câu đó; câu bị gắn <i>Quá khó</i>, <i>Quá dễ</i> hay <i>Cần xem lại</i> nên được soạn lại.</li>
        </ul>
        <Alert
          type="error"
          showIcon
          message="Xoá bài thi kéo theo tính lại thành tích"
          description="Xoá một bài thi (hoặc xoá hàng loạt theo bộ lọc) sẽ làm hệ thống tính lại XP, huy hiệu và bảng xếp hạng của những người liên quan — huy hiệu đã trao có thể bị thu hồi. Không hoàn tác được."
        />
      </>
    ),
  },
  {
    id: 'xp-cap-do',
    tieuDe: '11. XP, cấp độ và huy hiệu',
    noiDung: (
      <>
        <ul>
          <li>XP cộng tự động: <b>đạt +50</b>, <b>chưa đạt +20</b>, <b>điểm tuyệt đối +50 nữa</b>, câu hỏi khởi động hằng ngày <b>+5</b>, Đấu trường <b>+10</b> (vô địch thêm <b>+30</b>), mốc chuỗi ngày 7/30/90 ngày <b>+100/+500/+1.500</b>.</li>
          <li><b>Chỉ lần nộp đầu tiên của mỗi phân công</b> mới được cộng XP; thi lại không cộng thêm. Bài tự nộp do vi phạm không được XP.</li>
          <li><b>Cấp độ</b> quy định ở menu <b>Cấp độ</b> (12 cấp mặc định, từ "Tân binh" tới "Huyền thoại chi nhánh"). Sửa mốc XP sẽ làm cấp độ toàn hệ thống đổi theo, và không xoá được cấp đang có người đứng.</li>
          <li><b>Huy hiệu</b> trao tự động theo điều kiện, không cấp tay được. Xem danh sách và số người đạt ở menu <b>Thành tích</b>.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'bao-mat',
    tieuDe: '12. Bảo mật và nhật ký',
    noiDung: (
      <>
        <Title level={5}>Quy tắc tài khoản</Title>
        <BangNho
          cot={[{ title: 'Nội dung', dataIndex: 'nd' }, { title: 'Giá trị', dataIndex: 'gt' }]}
          dong={[
            { nd: 'Mật khẩu tạm khi tạo/reset', gt: 'Sinh ngẫu nhiên riêng từng người (10 ký tự), xem ở cột "Mật khẩu tạm"; bắt buộc đổi ở lần đăng nhập kế tiếp' },
            { nd: 'Độ dài mật khẩu tối thiểu', gt: '6 ký tự (không bắt buộc chữ hoa/số/ký tự đặc biệt)' },
            { nd: 'Khoá tạm tài khoản', gt: 'Sai 5 lần liên tiếp → khoá 15 phút, tự mở' },
            { nd: 'Chặn dò mật khẩu theo IP', gt: 'Tối đa 5 lần đăng nhập/60 giây' },
            { nd: 'Thời hạn một phiên đăng nhập', gt: '8 giờ' },
            { nd: 'Đăng nhập nhiều nơi', gt: 'Không bị chặn, nhưng ghi 1 vi phạm nếu đang có bài thi dở' },
          ]}
        />
        <Title level={5}>Hai màn hình cần theo dõi</Title>
        <ul style={{ marginBottom: 0 }}>
          <li><b>Giám sát bảo mật</b> — tài khoản đang bị khoá (mở khoá thủ công được), và toàn bộ phiên đăng nhập đang hoạt động kèm IP/thiết bị, có nút <b>Buộc đăng xuất</b>.</li>
          <li><b>Nhật ký quản trị</b> — lưu lại các thao tác quan trọng (đăng nhập, bắt đầu/nộp bài, xoá bài thi, xoá cán bộ, reset mật khẩu) kèm người thực hiện và IP. Đây là chỗ tra cứu đầu tiên khi có khiếu nại.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'can-nho',
    tieuDe: '13. Những thao tác KHÔNG thể hoàn tác',
    noiDung: (
      <>
        <Paragraph>Kiểm tra kỹ trước khi bấm — hệ thống không có thùng rác cho các thao tác sau:</Paragraph>
        <ul>
          <li><b>Xoá triệt để (Super Delete)</b> hồ sơ cán bộ — mất toàn bộ lịch sử thi của người đó.</li>
          <li><b>Xoá toàn bộ</b> câu hỏi của một lĩnh vực hoặc cả ngân hàng.</li>
          <li><b>Xoá bài thi</b> (đơn lẻ, theo bộ lọc, hoặc reset toàn bộ) — kéo theo tính lại XP, huy hiệu, bảng xếp hạng.</li>
          <li><b>Xoá phiên Đấu trường</b> — mất hết đội, câu hỏi và kết quả của phiên.</li>
          <li><b>Xoá lĩnh vực</b> — kéo theo toàn bộ câu hỏi thuộc lĩnh vực đó.</li>
        </ul>
        <Alert
          type="info"
          showIcon
          message="Thói quen tốt trước mỗi kỳ thi"
          description="Tự đăng nhập bằng một tài khoản cán bộ thử để làm thử đúng bộ đề sắp giao; kiểm tra thời gian, điểm đạt, số lần thi và mức chống gian lận. Năm phút kiểm tra tiết kiệm cả buổi xử lý khiếu nại."
        />
      </>
    ),
  },
]

export default function HuongDanQuanTriPage() {
  return (
    <KhungHuongDan
      tieuDe="Hướng dẫn sử dụng dành cho Quản trị hệ thống"
      moTa={
        <>
          Dành cho Quản trị viên và Cán bộ IT. Triển khai lần đầu thì đọc theo thứ tự mục <b>2 → 7</b>;
          vận hành hằng ngày xem mục <b>9</b> và <b>10</b>. <Tag color="red">Mục 13 liệt kê các thao tác không thể hoàn tác</Tag>
        </>
      }
      cacMuc={CAC_MUC}
    />
  )
}
