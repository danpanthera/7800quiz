import { Alert, Tag, Typography } from 'antd'
import KhungHuongDan, { BangNho, type MucHuongDan } from '../components/KhungHuongDan'

const { Title, Paragraph } = Typography

const CAC_MUC: MucHuongDan[] = [
  {
    id: 'bat-dau',
    tieuDe: '1. Đăng nhập lần đầu',
    noiDung: (
      <>
        <ol>
          <li>Mở trình duyệt, vào địa chỉ hệ thống do đơn vị cung cấp, màn hình <b>Đăng nhập</b> hiện ra.</li>
          <li>Ô <b>User AD</b>: gõ tên đăng nhập máy tính của mình (ví dụ <i>datnguyentien2</i>). Nếu chưa có User AD thì dùng <b>mã cán bộ 9 số</b>.</li>
          <li>Ô <b>Mật khẩu</b>: lần đầu dùng <b>mật khẩu tạm</b> do cán bộ IT/quản trị viên cấp cho riêng bạn. Đây là mật khẩu riêng của hệ thống thi, <b>không liên quan</b> tới mật khẩu vào máy tính — <b>không</b> gõ mật khẩu Windows/email vào đây.</li>
          <li>Bấm <b>Đăng nhập</b>. Hệ thống bắt đổi mật khẩu ngay lần đầu: nhập mật khẩu hiện tại, mật khẩu mới (<b>tối thiểu 6 ký tự</b>) và nhập lại cho khớp, bấm <b>Cập nhật mật khẩu</b>.</li>
          <li>Đổi xong là vào thẳng trang <b>Bài kiểm tra của tôi</b>.</li>
        </ol>
        <Title level={5}>Lưu ý về tài khoản</Title>
        <ul>
          <li>Nhập sai mật khẩu <b>5 lần liên tiếp</b> thì tài khoản bị <b>khoá tạm 15 phút</b>, sau đó tự mở. Không phải gọi ai.</li>
          <li>Một phiên đăng nhập có hiệu lực <b>8 tiếng</b>, sau đó phải đăng nhập lại.</li>
          <li>Quên mật khẩu: liên hệ cán bộ IT/quản trị viên để được cấp <b>mật khẩu tạm mới</b>, lần đăng nhập sau sẽ phải đổi lại mật khẩu mới.</li>
          <li>Nếu tài khoản đã bật <b>Xác thực 2 lớp</b>, sau bước mật khẩu sẽ có thêm bước nhập mã 6 chữ số trong ứng dụng Authenticator.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'man-hinh-chinh',
    tieuDe: '2. Màn hình chính "Bài kiểm tra của tôi"',
    noiDung: (
      <>
        <Paragraph>Đây là nơi bạn bắt đầu mọi việc. Từ trên xuống dưới gồm:</Paragraph>
        <ul>
          <li><b>Thẻ chào</b> — họ tên, cấp độ hiện tại và thanh XP, kèm dòng "Còn X XP để lên cấp N".</li>
          <li><b>Thống kê nhanh</b> — chuỗi ngày học liên tục, tổng bài đã làm, số lần vô địch Đấu trường, hạng toàn hệ thống.</li>
          <li><b>Câu hỏi khởi động hôm nay</b> — mỗi ngày 1 câu, trả lời đúng được <b>+5 XP</b>. Không bắt buộc, không tính vào điểm thi.</li>
          <li><b>Lĩnh vực cần cải thiện</b> — tối đa 3 lĩnh vực bạn đang làm sai nhiều nhất.</li>
          <li><b>Danh sách bài được giao</b> — phần quan trọng nhất, xem chi tiết bên dưới.</li>
          <li><b>Huy hiệu của tôi</b> và <b>Hoạt động gần đây</b> (lịch sử cộng XP).</li>
        </ul>
        <Title level={5}>Hiểu các nhãn trạng thái trên thẻ bài thi</Title>
        <BangNho
          cot={[{ title: 'Nhãn', dataIndex: 'nhan' }, { title: 'Nghĩa là gì / cần làm gì', dataIndex: 'y' }]}
          dong={[
            { nhan: 'Chưa làm', y: 'Bài mới, bấm "Bắt đầu làm bài".' },
            { nhan: 'Đang làm dở', y: 'Bạn đã vào thi nhưng chưa nộp. Bấm "Tiếp tục làm bài" — đồng hồ vẫn đang chạy.' },
            { nhan: 'Đã nộp', y: 'Đã hoàn thành, bấm "Xem kết quả".' },
            { nhan: 'Có thể làm lại', y: 'Bộ đề cho phép thi nhiều lần, bấm "Làm lại".' },
            { nhan: 'Đã hết giờ', y: 'Quá hạn nộp, không vào được nữa.' },
            { nhan: 'Còn Xh', y: 'Cảnh báo sát hạn — còn dưới 24 giờ, nên làm ngay.' },
          ]}
        />
        <Alert
          type="warning"
          showIcon
          message="Bấm 'Bắt đầu làm bài' là đồng hồ chạy ngay"
          description="Thời gian không dừng lại khi bạn thoát ra hay tắt máy. Chỉ bấm khi đã sẵn sàng ngồi làm liền mạch."
        />
      </>
    ),
  },
  {
    id: 'lam-bai-thuong',
    tieuDe: '3. Làm bài thi thường (nộp một lần ở cuối)',
    noiDung: (
      <>
        <ol>
          <li>Đọc câu hỏi ở giữa màn hình. Nhãn phía trên cho biết loại câu: <b>Chọn một đáp án</b>, <b>Chọn nhiều đáp án</b> hay <b>Sắp xếp đúng thứ tự</b>.</li>
          <li>Chọn đáp án. Câu sắp xếp thì dùng 2 nút mũi tên <b>lên/xuống</b> để đưa các mục về đúng trình tự.</li>
          <li>Đi lại giữa các câu bằng nút <b>Câu trước</b> / <b>Câu tiếp</b>, hoặc bấm thẳng vào số câu ở cột <b>Danh sách câu hỏi</b> bên trái. Câu đã trả lời được tô khác màu.</li>
          <li>Được quay lại sửa đáp án thoải mái — hệ thống chỉ chấm khi bạn nộp.</li>
          <li>Làm xong bấm <b>Nộp bài</b>.</li>
        </ol>
        <Title level={5}>Bài được lưu tự động, không sợ mất</Title>
        <ul>
          <li>Mỗi lần chọn đáp án, hệ thống lưu ngay vào máy rồi gửi lên máy chủ sau khoảng 1 giây. Dòng trạng thái luôn hiện: <b>Đã lưu trên hệ thống</b> / <b>Đang lưu</b> / <b>Đang chờ lưu</b>.</li>
          <li><b>Mất mạng vẫn làm tiếp được</b>: hiện banner vàng "Bạn vẫn có thể tiếp tục làm bài", các lựa chọn được giữ trên máy và tự gửi lên khi có mạng trở lại.</li>
          <li>Nút <b>Nộp bài</b> chỉ sáng khi dữ liệu đã lưu xong — nếu nút mờ, chờ vài giây.</li>
          <li>Máy hết pin, lỡ tắt trình duyệt: đăng nhập lại và bấm <b>Tiếp tục làm bài</b>, đáp án cũ vẫn còn.</li>
        </ul>
        <Title level={5}>Hết giờ thì sao?</Title>
        <Paragraph style={{ marginBottom: 0 }}>
          Đồng hồ đếm lùi ở góc phải, chuyển màu cảnh báo khi còn <b>5 phút</b>. Về 00:00 hệ thống <b>tự nộp và chấm theo các câu đã lưu</b> —
          bài không bị huỷ, các câu đã làm vẫn được tính điểm. Vì vậy hãy làm câu chắc chắn trước, đừng để trống chờ quay lại.
        </Paragraph>
      </>
    ),
  },
  {
    id: 'phan-hoi-tuc-thi',
    tieuDe: '4. Làm bài chế độ "phản hồi tức thì"',
    noiDung: (
      <>
        <Paragraph>
          Một số bộ đề (thường là đề luyện tập) bật chế độ này. Giao diện khác hẳn: biết đúng/sai ngay sau mỗi câu.
        </Paragraph>
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="Chốt đáp án là KHÔNG sửa lại được"
          description="Câu một đáp án: chạm vào đáp án là chốt luôn, không hỏi lại. Câu nhiều đáp án / sắp xếp: chọn xong rồi bấm 'Chốt đáp án'. Cân nhắc kỹ trước khi chạm."
        />
        <ul>
          <li>Chốt xong hiện ngay <b>Chính xác!</b> hoặc <b>Chưa đúng rồi</b>, đáp án đúng được tô xanh kèm phần giải thích.</li>
          <li>Chỉ đi tới, <b>không quay lại câu trước</b>. Dãy chấm màu phía trên cho biết câu nào đúng (xanh), sai (đỏ).</li>
          <li><b>Chuỗi N</b>: đếm số câu đúng liên tiếp, từ câu thứ 2 trở đi.</li>
          <li>Thanh công cụ trên cùng có: công tắc <b>Tự động chuyển câu sau 5s</b> (mặc định bật, tắt thì tự bấm <b>Tiếp tục</b>), nút loa <b>bật/tắt âm thanh</b>, nút micro <b>bật/tắt giọng đọc</b>, và đồng hồ.</li>
          <li><b>Giọng đọc thuyết minh</b> mặc định tắt. Bật lên hệ thống sẽ đọc lĩnh vực, đề bài và các đáp án mỗi khi sang câu mới — nhớ dùng tai nghe nếu ngồi phòng chung.</li>
          <li>Chế độ này <b>cần có mạng</b> để chốt từng câu, không làm offline được như thi thường.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'quy-dinh-thi',
    tieuDe: '5. Quy định khi làm bài và giám sát chống gian lận',
    noiDung: (
      <>
        <Title level={5}>Những nguyên tắc bắt buộc</Title>
        <ul>
          <li><b>Số lần thi</b>: mỗi bộ đề có giới hạn riêng, thường là <b>1 lần</b>. Đề ghi "Không giới hạn" thì thi lại bao nhiêu cũng được.</li>
          <li><b>Hạn nộp</b> lấy theo mốc nào đến trước: hết thời gian làm bài của đề, hoặc hết hạn phân công. Phân công đóng lúc 17h thì 16h50 vào thi chỉ còn 10 phút.</li>
          <li><b>Điểm đạt</b> mặc định là <b>60/100</b> (một số bộ đề đặt mức khác, xem trên thẻ bài thi).</li>
          <li>Câu <b>chọn nhiều đáp án</b> phải đúng <b>trọn vẹn</b> mới được điểm — chọn thiếu hoặc thừa đều tính sai, không có điểm một phần.</li>
          <li>Câu <b>sắp xếp thứ tự</b> phải đúng toàn bộ trình tự mới được điểm.</li>
          <li>Câu bỏ trống tính là sai. Không trừ điểm khi trả lời sai, nên <b>đừng bỏ trống câu nào</b>.</li>
        </ul>

        <Title level={5}>Hệ thống ghi nhận những hành vi nào</Title>
        <Paragraph>
          Các kiểm tra dưới đây <b>chỉ hoạt động với đề có bật "Giám sát nghiêm ngặt (audit)"</b> (xem thẻ bài thi hoặc phân công), trừ dòng "Đăng nhập thêm nơi khác" luôn áp dụng cho mọi đề.
          Đề không bật giám sát (đa số đề luyện tập/thi thử) thì không kiểm tra rời tab/đổi cửa sổ/sao chép/chuột phải — thoải mái làm bài.
        </Paragraph>
        <BangNho
          cot={[{ title: 'Hành vi', dataIndex: 'hv' }, { title: 'Khi nào bị ghi nhận', dataIndex: 'khi' }]}
          dong={[
            { hv: 'Rời tab / thu nhỏ cửa sổ', khi: 'Chuyển sang tab khác hoặc thu nhỏ trình duyệt (đề bật giám sát)' },
            { hv: 'Chuyển sang cửa sổ khác', khi: 'Bấm sang ứng dụng khác quá 3 giây (đề bật giám sát)' },
            { hv: 'Cố sao chép đề bài', khi: 'Bôi đen rồi nhấn Ctrl+C (đề bật giám sát)' },
            { hv: 'Thoát toàn màn hình', khi: 'Nhấn Esc hoặc thoát ra giữa lúc đang làm bài (đề bật giám sát)' },
            { hv: 'Vắng mặt bất thường', khi: 'Không chạm chuột/bàn phím quá 3 phút (đề bật giám sát)' },
            { hv: 'Đăng nhập thêm nơi khác', khi: 'Tài khoản của bạn đăng nhập ở máy khác khi bài đang dở — áp dụng cho MỌI đề' },
          ]}
        />
        <Paragraph>
          Ngoài ra với đề bật giám sát, hệ thống còn ghi nhận <i>nghi vấn mở công cụ lập trình</i> và <i>nghi vấn chụp màn hình</i> — hai loại này chỉ lưu để đối chiếu, <b>không</b> cộng vào số lần vi phạm.
          Bấm chuột phải bị chặn (chỉ khi đề bật giám sát) nhưng <b>không</b> tính là vi phạm.
        </Paragraph>

        <Title level={5}>Hậu quả</Title>
        <ul>
          <li>Đề <b>không đặt ngưỡng</b>: chỉ hiện banner vàng đếm số lần, lưu lại để đơn vị đối chiếu khi cần.</li>
          <li>Đề <b>có đặt ngưỡng</b>: ngay từ đầu bài có dòng báo trước "tự động nộp bài nếu rời màn hình N lần". Mỗi lần vi phạm hiện banner đỏ <b>Đã vi phạm x/N lần</b>. Chạm ngưỡng là hệ thống <b>tự nộp bài ngay</b>, hiện hộp thoại <b>"Bạn đã vi phạm quá số lần được phép"</b> kèm liệt kê lý do.</li>
          <li>Bài bị tự nộp do vi phạm vẫn được chấm điểm theo các câu đã lưu, nhưng <b>không được cộng XP</b>.</li>
          <li>Hệ thống <b>không</b> tự khoá tài khoản vì vi phạm. Mọi vi phạm đều được lưu và quản trị viên xem được.</li>
        </ul>

        <Title level={5}>Đề bật "giám sát nghiêm ngặt"</Title>
        <ul style={{ marginBottom: 0 }}>
          <li>Trước khi thấy đề, phải bấm <b>"Vào toàn màn hình &amp; bắt đầu làm bài"</b>.</li>
          <li>Thoát toàn màn hình giữa chừng (nhấn Esc, chuyển màn hình) sẽ bị che bởi màn chắn, đồng thời tính <b>1 lần vi phạm</b>. Bấm <b>"Quay lại chế độ toàn màn hình"</b> để làm tiếp.</li>
          <li>Mẹo: tắt các thông báo tự bật (Outlook, Zalo, Teams) trước khi vào thi, tránh bị kéo ra khỏi màn hình làm bài.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'ket-qua',
    tieuDe: '6. Xem kết quả và xem lại bài làm',
    noiDung: (
      <>
        <ul>
          <li>Nộp xong là ra ngay trang kết quả: <b>điểm trên thang 100</b>, số câu đúng, và kết luận <b>đạt</b> hay <b>chưa đạt</b>.</li>
          <li>Nếu lên cấp hoặc mở khoá huy hiệu mới, trang kết quả sẽ báo ngay tại đó.</li>
          <li>Khối <b>Xem lại bài làm</b>: thanh điều hướng nhanh (xanh = đúng, đỏ = sai), bấm số để nhảy tới câu. Mỗi câu hiện đáp án <b>bạn chọn</b>, đáp án <b>đúng</b> và phần <b>giải thích</b>.</li>
          <li>Xem lại bất cứ lúc nào bằng nút <b>Xem kết quả</b> trên thẻ bài thi ở trang chính.</li>
          <li>Một số kỳ thi được cấu hình <b>hiện kết quả sau khi hết hạn</b> hoặc <b>không hiện kết quả</b> — khi đó bạn sẽ không thấy điểm ngay, đây là quy định của kỳ thi chứ không phải lỗi.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'luyen-tap',
    tieuDe: '7. Luyện tập tự do và Ôn tập ngắt quãng',
    noiDung: (
      <>
        <Title level={5}>Luyện tập tự do</Title>
        <ul>
          <li>Chọn lĩnh vực (hoặc <b>Tất cả lĩnh vực</b>), chọn số câu (1–50, mặc định 10), bấm <b>Bắt đầu luyện tập</b>.</li>
          <li><b>Không tính điểm chính thức, không tính vào thống kê, không giám sát vi phạm, không có đồng hồ.</b> Làm bao nhiêu lần tuỳ thích.</li>
          <li>Nộp xong xem ngay số câu đúng và giải thích từng câu sai. Bấm <b>Lấy bộ câu hỏi khác</b> để đổi đề.</li>
        </ul>
        <Title level={5}>Ôn tập ngắt quãng</Title>
        <ul style={{ marginBottom: 0 }}>
          <li>Hệ thống tự gom lại <b>những câu bạn từng làm sai</b> trong các bài thi thật và nhắc ôn lại đúng lúc sắp quên.</li>
          <li>Trả lời đúng thì lần ôn tiếp theo giãn ra xa hơn; trả lời sai thì mai ôn lại ngay.</li>
          <li>Mỗi ngày chỉ cần làm hết phần "tới hạn hôm nay" là đủ — đây là cách rẻ nhất để không trượt bài kiểm tra sau.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'dau-truong',
    tieuDe: '8. Đấu trường — thi đấu trực tiếp theo đội',
    noiDung: (
      <>
        <Title level={5}>Tham gia thế nào</Title>
        <ol>
          <li>Phải <b>đăng nhập</b> trước (Đấu trường không cho người lạ vào).</li>
          <li>Vào menu <b>Đấu trường</b>, gõ <b>mã tham gia 6 ký tự</b> do người tổ chức đọc, hoặc quét mã QR trên màn chiếu.</li>
          <li>Nếu ban tổ chức đã chia đội sẵn: <b>chọn đội</b> trong danh sách (đội đủ 5 người sẽ hiện "Đầy"). Nếu chưa chia: gõ <b>tên đội / tên bạn</b>.</li>
          <li>Nhập <b>mật khẩu phòng</b> nếu có, rồi bấm <b>Tham gia ngay</b> và chờ trên màn hình phòng chờ.</li>
        </ol>
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Mỗi đội chỉ được gửi MỘT đáp án cho mỗi câu"
          description="Ai trong đội bấm trước là chốt cho cả đội, người sau không gửi được nữa. Hãy thống nhất trong đội xem ai là người bấm."
        />
        <Title level={5}>Luật chơi và cách tính điểm</Title>
        <ul>
          <li>Mỗi câu có <b>thời gian đếm ngược</b> (mặc định 20 giây), trước đó có 3 giây chuẩn bị hiện tên lĩnh vực.</li>
          <li>Câu một đáp án: <b>chạm là gửi ngay</b>. Câu nhiều đáp án / sắp xếp: chọn xong bấm <b>Gửi đáp án</b>.</li>
          <li>Điểm tính theo <b>thứ hạng trả lời đúng</b>, không phải theo số giây còn lại: đội đúng nhanh nhất được nhiều điểm nhất, rồi giảm dần (mặc định <b>10 – 7 – 5 – 3 – 2 – 2 …</b>).</li>
          <li>Trả lời <b>sai</b> hoặc <b>không kịp trả lời</b>: 0 điểm (một số phiên có cấu hình trừ điểm khi sai, người tổ chức sẽ thông báo trước).</li>
          <li>Đồng điểm thì xếp theo: nhiều câu đúng hơn → tổng thời gian trả lời các câu đúng ngắn hơn → vào phòng sớm hơn.</li>
          <li>Mạng nhà bạn chậm hơn người khác một chút cũng không bị thiệt — hệ thống <b>tự trừ hao phần đó</b> khi tính điểm.</li>
          <li>Kết thúc phiên: mỗi người tham gia được <b>+10 XP</b>, thành viên đội vô địch được thêm <b>+30 XP</b>.</li>
        </ul>
        <Title level={5}>Mất mạng giữa chừng</Title>
        <Paragraph style={{ marginBottom: 0 }}>
          Cứ vào lại bằng mã cũ — hệ thống nhớ bạn thuộc đội nào, không phải nhập lại mật khẩu và cũng không mất điểm đã có.
          Riêng câu bị lỡ trong lúc mất mạng thì tính là không trả lời.
        </Paragraph>
      </>
    ),
  },
  {
    id: 'xp-huy-hieu',
    tieuDe: '9. XP, cấp độ, huy hiệu và bảng xếp hạng',
    noiDung: (
      <>
        <Title level={5}>XP được cộng khi nào</Title>
        <BangNho
          cot={[{ title: 'Hoạt động', dataIndex: 'hd' }, { title: 'XP', dataIndex: 'xp' }]}
          dong={[
            { hd: 'Làm bài đạt yêu cầu', xp: '+50' },
            { hd: 'Làm bài chưa đạt (vẫn được ghi nhận nỗ lực)', xp: '+20' },
            { hd: 'Đạt điểm tuyệt đối 100', xp: '+50 (cộng thêm, tổng 100)' },
            { hd: 'Trả lời đúng câu hỏi khởi động hằng ngày', xp: '+5' },
            { hd: 'Tham gia một phiên Đấu trường', xp: '+10' },
            { hd: 'Vô địch Đấu trường', xp: '+30 (cộng thêm)' },
            { hd: 'Chuỗi ngày học liên tục 7 / 30 / 90 ngày', xp: '+100 / +500 / +1.500' },
          ]}
        />
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Chỉ lần làm bài ĐẦU TIÊN của mỗi bài được giao mới được cộng XP"
          description="Làm lại vẫn được chấm điểm và vẫn cập nhật kết quả, nhưng không cộng thêm XP. Bài bị tự động nộp do vi phạm cũng không được XP."
        />
        <ul style={{ marginBottom: 0 }}>
          <li><b>Cấp độ</b> lên theo tổng XP tích luỹ, từ cấp 1 "Tân binh" tới cấp 12 "Huyền thoại chi nhánh".</li>
          <li><b>Huy hiệu</b> mở khoá tự động khi đạt điều kiện (số bài đã làm, điểm tuyệt đối, chuỗi ngày, tốc độ trả lời, thành tích Đấu trường…). Một số huy hiệu ẩn, chỉ hiện "???" cho tới khi đạt được.</li>
          <li><b>Chuỗi ngày liên tục</b>: nghỉ đúng 1 ngày sẽ được hệ thống tự dùng "phao cứu" để giữ chuỗi (tối đa 2 phao, được cấp lại 1 phao sau mỗi 30 ngày).</li>
          <li><b>Bảng xếp hạng</b> xem theo Toàn thời gian / Tháng này / Tuần này; dòng của bạn được tô nổi bật và gắn nhãn "Bạn".</li>
        </ul>
      </>
    ),
  },
  {
    id: 'bao-mat',
    tieuDe: '10. Bảo mật tài khoản',
    noiDung: (
      <>
        <ul style={{ marginBottom: 0 }}>
          <li><b>Xác thực 2 lớp (2FA)</b>: vào menu <b>Bảo mật tài khoản</b> → <b>Bật xác thực 2 lớp</b> → quét mã hoặc dán mã bí mật vào ứng dụng Google Authenticator / Microsoft Authenticator → nhập mã 6 số để xác nhận. Từ lần sau, đăng nhập cần thêm mã này.</li>
          <li><b>Thiết bị đang đăng nhập</b>: xem toàn bộ máy đang dùng tài khoản của bạn (trình duyệt, IP, thời điểm). Thấy thiết bị lạ thì bấm <b>Đăng xuất</b> ở dòng đó, hoặc <b>Đăng xuất thiết bị khác</b> để dọn hết một lượt rồi đổi mật khẩu ngay.</li>
          <li><b>Không đưa tài khoản cho người khác</b>. Khi bài đang làm dở mà tài khoản được đăng nhập ở nơi khác, hệ thống ghi nhận <b>1 lần vi phạm</b> vào bài thi của bạn.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'dien-thoai',
    tieuDe: '11. Dùng trên điện thoại',
    noiDung: (
      <>
        <ul style={{ marginBottom: 0 }}>
          <li>Mọi chức năng đều dùng được trên điện thoại. Menu nằm trong nút <b>☰</b> góc trên bên trái; các bảng dữ liệu tự chuyển thành danh sách thẻ cho dễ đọc.</li>
          <li><b>Cài như một ứng dụng</b>: Android/Chrome mở trình đơn trình duyệt chọn <i>Thêm vào màn hình chính</i>; iPhone/Safari bấm nút Chia sẻ rồi chọn <i>Thêm vào MH chính</i>. Sau đó mở như app bình thường, chạy toàn màn hình.</li>
          <li>Khi có bản cập nhật, góc dưới hiện thông báo <b>"Có phiên bản mới của 7800Quiz"</b> — <b>đang thi thì nộp bài xong hãy bấm Tải lại ngay</b>.</li>
          <li>Nên thi bằng máy tính nếu bài dài; điện thoại phù hợp cho Đấu trường, luyện tập và ôn tập.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'su-co',
    tieuDe: '12. Sự cố thường gặp và cách xử lý',
    noiDung: (
      <BangNho
        cot={[{ title: 'Tình huống', dataIndex: 'th' }, { title: 'Cách xử lý', dataIndex: 'xl' }]}
        dong={[
          { th: 'Đăng nhập báo "Sai tài khoản hoặc mật khẩu"', xl: 'Kiểm tra User AD (không phải email), thử mã cán bộ 9 số. Sai 5 lần sẽ bị khoá 15 phút, chờ rồi thử lại.' },
          { th: 'Không thấy bài kiểm tra nào', xl: 'Bài chỉ hiện trong khoảng thời gian được mở. Liên hệ người phụ trách đào tạo để kiểm tra phân công.' },
          { th: 'Nút "Nộp bài" bị mờ', xl: 'Đang chờ lưu dữ liệu. Chờ vài giây tới khi hiện "Đã lưu trên hệ thống".' },
          { th: 'Mất mạng giữa chừng', xl: 'Cứ làm tiếp, đáp án được giữ trên máy và tự gửi khi có mạng. Đừng đóng trình duyệt.' },
          { th: 'Lỡ thoát ra khi đang thi', xl: 'Đăng nhập lại, bấm "Tiếp tục làm bài". Lưu ý thời gian vẫn chạy trong lúc bạn thoát ra.' },
          { th: 'Báo "Bài làm đã thay đổi ở một nơi khác"', xl: 'Bạn đang mở cùng bài trên 2 thiết bị. Đóng bớt một cái rồi tải lại trang.' },
          { th: 'Đang thi bị hiện hộp thoại vi phạm và nộp bài', xl: 'Bộ đề có ngưỡng tự nộp và bạn đã chạm ngưỡng. Bấm "Đã hiểu" để xem điểm; liên hệ đơn vị nếu cho rằng bị oan.' },
          { th: 'Quên mật khẩu / tài khoản bị khoá lâu', xl: 'Liên hệ cán bộ IT/quản trị viên để được cấp mật khẩu tạm mới hoặc mở khoá.' },
        ]}
      />
    ),
  },
]

export default function HuongDanNguoiDungPage() {
  return (
    <KhungHuongDan
      tieuDe="Hướng dẫn sử dụng dành cho Người dùng"
      moTa={
        <>
          Dành cho cán bộ tham gia học và kiểm tra trên hệ thống 7800Quiz. Đọc lướt mục <b>1</b> và <b>3</b> là làm được bài;
          mục <b>5</b> là các quy định bắt buộc phải biết trước khi vào thi. <Tag color="geekblue">Có thắc mắc, liên hệ cán bộ phụ trách đào tạo của đơn vị</Tag>
        </>
      }
      cacMuc={CAC_MUC}
    />
  )
}
