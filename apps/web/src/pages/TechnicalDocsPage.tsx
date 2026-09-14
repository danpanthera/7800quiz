import { Tag, Typography } from 'antd'
import KhungHuongDan, { type MucHuongDan } from '../components/KhungHuongDan'

const { Paragraph } = Typography

// Nội dung tĩnh, không gọi API — tài liệu tham khảo cho quản trị viên, cập
// nhật thủ công khi kiến trúc hệ thống thay đổi đáng kể (đổi framework, đổi
// hạ tầng, thêm ràng buộc mới). Không mô tả số liệu vận hành thời gian thực
// (số câu hỏi, dung lượng ổ đĩa...) vì các con số này đổi liên tục.

const cacMuc: MucHuongDan[] = [
  {
    id: 'tong-quan',
    tieuDe: 'Tổng quan hệ thống',
    noiDung: (
      <div className="td-content">
        <Paragraph>
          7800Quiz là ứng dụng thi trắc nghiệm &amp; ôn luyện, chạy trong mạng nội bộ, không nối
          ra Internet bên ngoài. Có 3 loại tài khoản: <code>STAFF</code> (cán bộ thường — làm bài,
          xem kết quả của mình), <code>TRAINER</code> (cán bộ đào tạo — soạn câu hỏi/đề, giao bài,
          xem báo cáo), <code>ADMIN</code> (quản trị viên — toàn quyền, thêm cả quản lý cán bộ/tổ
          chức và bảo mật hệ thống).
        </Paragraph>
        <h5>Một yêu cầu đi từ trình duyệt tới lúc có kết quả như thế nào</h5>
        <ul>
          <li>Trình duyệt gọi vào đúng 1 địa chỉ web nội bộ duy nhất (dùng HTTPS, kèm chứng chỉ bảo mật do hệ thống tự cấp, không phải mua từ bên ngoài).</li>
          <li>
            Một lớp &quot;gác cổng&quot; đứng trước, nhận hết mọi yêu cầu rồi chia đường: địa chỉ
            bắt đầu bằng <code>/api/</code> hoặc <code>/socket.io/</code> thì chuyển vào phần{' '}
            <b>API</b> xử lý; còn lại (các trang giao diện) thì trả về phần <b>Web</b> — các trang
            đã dựng sẵn từ trước, phục vụ qua một máy chủ web nhẹ (Nginx).
          </li>
          <li>
            Phần <b>API</b> đọc/ghi dữ liệu vào <b>PostgreSQL</b> — phần mềm quản lý cơ sở dữ liệu.
            Riêng tính năng Đấu trường (chạy thời gian thực) dùng một kiểu kết nối luôn-mở gọi là
            WebSocket, đi chung cổng với API.
          </li>
        </ul>
        <h5>Chạy trên máy nào</h5>
        <Paragraph>
          Cả 4 phần của hệ thống (cơ sở dữ liệu Postgres, phần API, phần Web, lớp gác cổng) đều
          được đóng gói riêng bằng Docker (một cách đóng gói phần mềm để chạy độc lập, không đụng
          lẫn nhau) và chạy chung trong <b>một máy ảo Ubuntu duy nhất</b>. Máy ảo này dựng trên nền
          ảo hoá Hyper-V của một máy chủ Windows Server thật. Chọn cách này vì Postgres không có
          bản đóng gói Docker chính thức cho Windows. Máy chạy trong mạng nội bộ ngân hàng, không
          nối Internet thường xuyên — chỉ nối tạm lúc cài đặt hoặc cập nhật phần mềm.
        </Paragraph>
      </div>
    ),
  },
  {
    id: 'cong-nghe-nen',
    tieuDe: 'Công nghệ dùng để xây dựng hệ thống',
    noiDung: (
      <div className="td-content">
        <h5>Phần API (Backend) — apps/api</h5>
        <table>
          <thead>
            <tr><th>Thành phần</th><th>Công nghệ</th></tr>
          </thead>
          <tbody>
            <tr><td>Ngôn ngữ lập trình</td><td>TypeScript 5.7</td></tr>
            <tr><td>Bộ khung xử lý (framework)</td><td>NestJS 11 (chạy trên nền Express)</td></tr>
            <tr><td>Cách nối vào cơ sở dữ liệu</td><td>Prisma 6 + PostgreSQL 16</td></tr>
            <tr><td>Kết nối thời gian thực</td><td>Socket.IO 4.8</td></tr>
            <tr><td>Xác thực đăng nhập</td><td>Passport + JWT, mật khẩu băm bằng bcrypt (một chiều, không giải mã ngược lại được)</td></tr>
            <tr><td>Kiểm tra dữ liệu gửi lên</td><td>class-validator / class-transformer</td></tr>
            <tr><td>Khác</td><td>Multer (nhận file tải lên), xlsx (đọc/ghi Excel), nspell + từ điển tiếng Việt (kiểm tra chính tả)</td></tr>
            <tr><td>Kiểm thử tự động</td><td>Jest 30, supertest cho kiểm thử toàn luồng</td></tr>
          </tbody>
        </table>
        <h5>Phần giao diện (Frontend) — apps/web</h5>
        <table>
          <thead>
            <tr><th>Thành phần</th><th>Công nghệ</th></tr>
          </thead>
          <tbody>
            <tr><td>Ngôn ngữ lập trình</td><td>TypeScript 6</td></tr>
            <tr><td>Bộ khung giao diện (framework)</td><td>React 19</td></tr>
            <tr><td>Công cụ đóng gói</td><td>Vite 8</td></tr>
            <tr><td>Thư viện giao diện có sẵn</td><td>Ant Design (antd) 6</td></tr>
            <tr><td>Chuyển trang</td><td>react-router-dom 7</td></tr>
            <tr><td>Gọi API &amp; lưu tạm dữ liệu</td><td>axios + @tanstack/react-query 5</td></tr>
            <tr><td>Kết nối thời gian thực</td><td>socket.io-client 4.8</td></tr>
            <tr><td>Cài như app thật (PWA)</td><td>vite-plugin-pwa</td></tr>
            <tr><td>Hiệu ứng/khác</td><td>canvas-confetti (hiệu ứng pháo giấy), qrcode (tạo mã QR)</td></tr>
            <tr><td>Kiểm thử tự động</td><td>Vitest</td></tr>
          </tbody>
        </table>
        <Paragraph>
          <b>Chưa dùng thư viện vẽ biểu đồ nào</b> (không recharts/chart.js/echarts) — các trang báo
          cáo hiện chỉ dùng bảng và thanh tiến trình có sẵn của Ant Design. Muốn có biểu đồ phức
          tạp hơn (đường, cột nhiều lớp...) sẽ phải thêm thư viện mới.
        </Paragraph>
      </div>
    ),
  },
  {
    id: 'ha-tang',
    tieuDe: 'Cài đặt & hạ tầng chạy hệ thống',
    noiDung: (
      <div className="td-content">
        <h5>Docker Compose — môi trường phát triển (máy lập trình viên)</h5>
        <table>
          <thead><tr><th>Container</th><th>Cổng (máy thật:bên trong)</th><th>Ghi chú</th></tr></thead>
          <tbody>
            <tr><td><code>quiz7800_db</code></td><td>15433:5432</td><td>PostgreSQL 16</td></tr>
            <tr><td><code>quiz7800_api</code></td><td>13010:13010</td><td>Dựng từ thư mục <code>apps/api</code></td></tr>
            <tr><td><code>quiz7800_web</code></td><td>15173:80</td><td>Dựng từ thư mục <code>apps/web</code>, Nginx phục vụ file tĩnh</td></tr>
          </tbody>
        </table>
        <h5>Docker Compose — môi trường thật (Production)</h5>
        <Paragraph>
          File cấu hình <b>tách biệt hoàn toàn</b> với môi trường phát triển, không được gộp
          chung. Có thêm 1 phần tên <code>quiz7800_proxy</code> (Caddy) — đây là phần <b>duy
          nhất</b> mở cổng ra ngoài (80/443, tức cổng web thông thường); các phần còn lại nằm
          trong mạng nội bộ riêng của Docker, không ai từ ngoài gọi thẳng vào được. Riêng mạng
          chứa Postgres còn được khoá chặt hơn nữa — không có đường ra Internet, kể cả nếu có ai
          chiếm được quyền điều khiển một phần khác trong hệ thống.
        </Paragraph>
        <h5>Lớp gác cổng — Caddy</h5>
        <ul>
          <li>Chứng chỉ bảo mật (TLS) <b>tự cấp nội bộ</b>, không mua từ bên ngoài (Let&apos;s Encrypt) vì máy không có Internet thường xuyên — chứng chỉ gốc phải cài tay vào từng máy trong mạng thì trình duyệt mới không báo cảnh báo.</li>
          <li>Chỉ dùng 2 chuẩn kết nối quen thuộc HTTP/1.1 và HTTP/2 (không bật HTTP/3 vì mạng nội bộ ngân hàng có thể chặn kiểu kết nối đó).</li>
          <li>Tự thêm sẵn một số lớp bảo vệ cơ bản cho trình duyệt: giấu bớt thông tin máy chủ, chặn trang bị nhúng vào khung của trang khác, hạn chế thông tin gửi kèm khi người dùng bấm link ra ngoài...</li>
          <li>Có trang báo bảo trì riêng bằng tiếng Việt, hiện ra khi phần API hoặc Web đang gặp sự cố.</li>
        </ul>
        <h5>Cách trình duyệt lưu tạm (cache) file của trang Web</h5>
        <ul>
          <li><code>index.html</code> và file service worker: <b>không lưu tạm</b> — bắt buộc phải vậy để cơ chế báo &quot;có bản cập nhật mới&quot; hoạt động đúng.</li>
          <li>File JS/CSS đã build (tên file có kèm một dãy ký tự riêng để nhận diện phiên bản): lưu tạm 1 năm, không đổi.</li>
          <li>Thư mục audio giọng đọc: lưu tạm lâu dài, nhưng có kiểm tra file có tồn tại thật không trước khi trả về — tránh trả nhầm trang báo lỗi thành ra một file âm thanh.</li>
        </ul>
        <h5>Các thông tin cấu hình chính (Production)</h5>
        <table>
          <thead><tr><th>Tên biến</th><th>Dùng để làm gì</th></tr></thead>
          <tbody>
            <tr><td><code>SITE_ADDRESS</code></td><td>Địa chỉ web nội bộ của hệ thống</td></tr>
            <tr><td><code>POSTGRES_USER/DB/PASSWORD</code></td><td>Thông tin đăng nhập vào cơ sở dữ liệu (mật khẩu chỉ nên gồm chữ và số)</td></tr>
            <tr><td><code>JWT_SECRET</code></td><td>Chuỗi bí mật dùng để &quot;ký&quot; vé đăng nhập — bắt buộc đủ dài, hệ thống <b>từ chối khởi động</b> nếu thiếu hoặc quá ngắn</td></tr>
            <tr><td><code>JWT_EXPIRES_IN</code></td><td>Một lượt đăng nhập có hiệu lực bao lâu (mặc định 8 giờ)</td></tr>
            <tr><td><code>CORS_ORIGIN</code></td><td>Danh sách địa chỉ web được phép gọi vào API này</td></tr>
            <tr><td><code>TZ</code></td><td>Múi giờ hệ thống (Việt Nam) — ảnh hưởng cách hiển thị thời gian khi xuất báo cáo</td></tr>
          </tbody>
        </table>
        <h5>Các bước cập nhật hệ thống lên bản mới (tóm tắt)</h5>
        <ol>
          <li>Sao lưu cơ sở dữ liệu.</li>
          <li>Đánh dấu bản đang chạy là bản dự phòng, để còn quay lại được nếu cần.</li>
          <li>Lấy mã nguồn mới, dựng (build) lại các phần cần cập nhật.</li>
          <li>Tạm dừng dịch vụ, chạy cập nhật cấu trúc dữ liệu nếu có.</li>
          <li>Khởi động lại, thử đăng nhập và mở thử một phòng Đấu trường để chắc chắn mọi thứ còn chạy tốt.</li>
          <li>Nếu bước cập nhật cấu trúc dữ liệu bị lỗi: <b>dừng ngay, không khởi động lại</b>, khôi phục từ bản dự phòng.</li>
        </ol>
        <Paragraph>
          Cơ sở dữ liệu được sao lưu tự động mỗi ngày (giữ lại 14 ngày gần nhất, riêng bản đầu mỗi
          tháng giữ tới 1 năm). Nên thỉnh thoảng thử khôi phục lại từ bản sao lưu để chắc chắn nó
          còn dùng được, không chỉ tin là nó chạy đúng.
        </Paragraph>
      </div>
    ),
  },
  {
    id: 'kien-truc-backend',
    tieuDe: 'Cách tổ chức phần API (Backend)',
    noiDung: (
      <div className="td-content">
        <h5>Các nhóm chức năng (module)</h5>
        <Paragraph>
          Mã nguồn API chia theo từng nhóm nghiệp vụ, mỗi thư mục một nhóm: xác thực (
          <code>auth</code>), quản trị tổng hợp (<code>admin</code>), đề thi (<code>quiz</code>),
          giao bài (<code>assignments</code>, <code>assignment-schedule</code>), bài nộp/lượt làm
          bài (<code>submissions</code>, <code>attempts</code>), Đấu trường (<code>arena</code>),
          giải đấu (<code>tournament</code>), điểm thưởng/huy hiệu (<code>gamification</code>),
          câu hỏi mỗi ngày (<code>daily-question</code>), luyện tập tự do (<code>practice</code>),
          ôn tập ngắt quãng (<code>review</code>), thống kê/báo cáo (<code>performance</code>),
          duyệt câu hỏi (<code>question-approval</code>).
        </Paragraph>
        <h5>Đăng nhập &amp; phân quyền</h5>
        <ul>
          <li>Đăng nhập xong được cấp một &quot;vé&quot; (token) duy nhất — vé này không tự gia hạn được, hết hạn là phải đăng nhập lại từ đầu.</li>
          <li>Mỗi lượt đăng nhập đều được ghi lại trong cơ sở dữ liệu, nên có thể <b>buộc đăng xuất ngay lập tức</b> từ xa, không cần chờ tới lúc vé hết hạn.</li>
          <li>Có thể bật thêm xác thực 2 lớp cho từng tài khoản — dùng mã 6 số tự đổi theo thời gian, kiểu ứng dụng Google/Microsoft Authenticator.</li>
          <li>Chống đoán mật khẩu: giới hạn số lần thử đăng nhập trong 1 phút, và tự khoá tài khoản 15 phút nếu sai liên tiếp quá nhiều lần.</li>
          <li>Phân quyền theo từng API riêng lẻ, không có một công tắc chặn chung cho toàn hệ thống — mỗi API tự khai báo ai được phép gọi. Nghĩa là thêm một API mới mà quên khai báo quyền thì API đó sẽ <b>không</b> tự động an toàn, người viết code phải luôn nhớ khai báo.</li>
        </ul>
        <h5>Các nhóm dữ liệu chính trong cơ sở dữ liệu</h5>
        <ul>
          <li><b>Người dùng/tổ chức</b> — tài khoản, hồ sơ cán bộ, phòng ban, lớp học.</li>
          <li><b>Ngân hàng câu hỏi</b> — lĩnh vực, câu hỏi, các phương án trả lời.</li>
          <li><b>Đề thi &amp; giao bài</b> — đề, các phiên bản đề đã chốt, phân công, lịch giao bài tự động.</li>
          <li><b>Lượt làm bài</b> — lượt đang làm dở và bài đã chấm xong.</li>
          <li><b>Giám sát</b> — vi phạm khi thi, nhật ký thao tác của quản trị viên.</li>
          <li><b>Đấu trường</b> — phiên đấu, đội, từng vòng câu hỏi, lượt bấm chuông.</li>
          <li><b>Giải đấu</b>, và <b>điểm thưởng/thành tích</b> — kinh nghiệm, cấp độ, huy hiệu, chuỗi ngày, ôn tập ngắt quãng.</li>
        </ul>
        <Paragraph>
          Một điều nhỏ nên biết: tên cột trong cơ sở dữ liệu viết kiểu <code>có_gạch_dưới</code>,
          còn trong code lại viết kiểu <code>camelCase</code> (dính liền, viết hoa chữ đầu mỗi từ
          sau từ đầu tiên) — công cụ Prisma tự động đổi qua lại giữa 2 kiểu này nên không phải lo,
          chỉ cần biết là tên hơi khác nhau nếu có lúc cần tra thẳng vào cơ sở dữ liệu.
        </Paragraph>
        <h5>Kênh kết nối thời gian thực (Đấu trường)</h5>
        <Paragraph>
          Dùng một kiểu kết nối luôn-mở gọi là WebSocket (khác cách gọi API thông thường là hỏi
          một câu rồi nhận một câu trả lời). Mỗi phiên đấu/đội/người xem được xếp vào một
          &quot;phòng&quot; riêng. Mọi tin nhắn gửi cho người chơi đều đi qua đúng <b>một chỗ duy
          nhất</b> trong code — giúp dễ dò lỗi hơn nhiều so với việc để rải rác ở nhiều nơi.
        </Paragraph>
      </div>
    ),
  },
  {
    id: 'kien-truc-frontend',
    tieuDe: 'Cách tổ chức phần giao diện (Frontend)',
    noiDung: (
      <div className="td-content">
        <h5>Cấu trúc thư mục mã nguồn</h5>
        <ul>
          <li><code>pages/</code> — mỗi màn hình một file.</li>
          <li><code>components/</code> — các mảnh giao diện dùng lại được ở nhiều màn hình.</li>
          <li><code>layouts/</code> — khung giao diện chung (menu bên, thanh trên cùng) bọc quanh các trang.</li>
          <li><code>hooks/</code> — logic dùng lại được (đồng bộ giờ với máy chủ, nhận biết loại thiết bị, đếm ngược...).</li>
          <li><code>lib/</code> — các hàm tiện ích: gọi API, kiểm tra quyền, phát âm thanh...</li>
        </ul>
        <h5>Kiểm tra quyền khi chuyển trang</h5>
        <Paragraph>
          Mọi trang trong khu quản trị đều được kiểm tra trước khi cho xem: chưa đăng nhập thì đẩy
          về trang đăng nhập; đăng nhập rồi nhưng không đúng vai trò thì tự chuyển sang trang mặc
          định của vai trò đó — không báo lỗi, không để lộ ra là có một trang đang bị chặn ở đó.
          &quot;Vé&quot; đăng nhập được lưu ngay trên trình duyệt của người dùng; khi vé hết hạn,
          giao diện tự xoá vé và đưa về lại trang đăng nhập.
        </Paragraph>
        <h5>Cách phối màu &amp; giao diện</h5>
        <ul>
          <li><b>Màu chủ đạo</b>: đỏ mận + vàng. Màu này khai báo ở 2 chỗ trong code (một cho CSS thường, một cho thư viện giao diện Ant Design) — muốn đổi màu thương hiệu phải sửa cả 2 chỗ cho khớp nhau, quên một chỗ là bị lệch màu.</li>
          <li><b>Sáng/Tối</b>: người dùng tự chọn Sáng, Tối, hoặc theo đúng cài đặt máy — hệ thống chuyển đổi bằng cách đổi một thuộc tính duy nhất ở gốc trang.</li>
          <li><b>Phông chữ</b>: một phông chính dùng cho toàn bộ giao diện; 2 phông trang trí chỉ dùng cho vài chữ nhấn ở trang đăng nhập.</li>
          <li>
            Mỗi khu vực chính của giao diện (khung quản trị, màn thi phản hồi tức thì, Đấu trường,
            thẻ/danh sách đề thi, trang chủ học viên, trang đăng nhập, bảng biểu quản trị) dùng
            riêng một tiền tố đặt tên CSS — để sửa giao diện của khu này không lỡ tay ảnh hưởng
            sang khu khác.
          </li>
        </ul>
        <h5>Cài đặt như một ứng dụng thật (PWA)</h5>
        <Paragraph>
          Ứng dụng có thể cài vào máy tính/điện thoại như một app thật, vẫn chạy được kể cả khi có
          bản cập nhật mới đang chờ. Hệ thống <b>cố ý không tự tải lại trang</b> khi có bản mới
          (tránh làm gián đoạn người đang thi dở) — chỉ hiện một thông báo nhỏ, người dùng tự bấm
          &quot;Tải lại&quot; khi thấy tiện, hoặc bản mới sẽ tự áp dụng vào lần mở trang kế tiếp.
        </Paragraph>
        <h5>Hiển thị đẹp trên mọi loại màn hình</h5>
        <Paragraph>
          Giao diện tự nhận biết đang mở trên điện thoại, máy tính bảng hay máy tính để chuyển bố
          cục cho phù hợp — ví dụ menu nằm cố định bên trái trên máy tính, nhưng kéo ra từ cạnh
          trên khi mở bằng điện thoại.
        </Paragraph>
      </div>
    ),
  },
  {
    id: 'luong-lam-bai',
    tieuDe: 'Nghiệp vụ cốt lõi: một lượt làm bài thi diễn ra thế nào',
    noiDung: (
      <div className="td-content">
        <h5>Ba hình thức làm bài</h5>
        <ul>
          <li><b>Thi cổ điển</b> — làm hết cả bài rồi mới nộp một lần, chỉ biết điểm sau khi nộp.</li>
          <li><b>Phản hồi tức thì</b> — biết đúng/sai ngay sau mỗi câu, mỗi câu tự chốt lại ngay khi đã trả lời, không sửa được nữa.</li>
          <li><b>Luyện tập tự do</b> — không lưu lịch sử, không tính điểm, làm bao nhiêu lần cũng được.</li>
        </ul>
        <h5>Các bước chính (thi cổ điển/phản hồi tức thì)</h5>
        <ol>
          <li>Được giao bài — bằng tay, nhập từ Excel, hoặc theo lịch tự động lặp lại.</li>
          <li>Bắt đầu làm bài: hệ thống chốt lại một bản sao cố định của đề ngay tại thời điểm bắt đầu — dù sau đó đề gốc có bị sửa, bài đang làm/đã làm cũng không đổi theo — rồi tính hạn nộp bài.</li>
          <li>Trả lời từng câu — hệ thống tự lưu ngay khi chọn, không cần bấm nút lưu.</li>
          <li>Nộp bài (tự bấm nộp, hoặc hết giờ tự động nộp) — hệ thống chấm điểm và ghi lại kết quả.</li>
          <li>Điểm thưởng (kinh nghiệm) chỉ cộng cho lần làm đầu tiên của mỗi bài được giao, và không cộng nếu bài bị tự nộp do vi phạm giám sát.</li>
        </ol>
      </div>
    ),
  },
  {
    id: 'giam-sat',
    tieuDe: 'Giám sát & phát hiện gian lận khi thi',
    noiDung: (
      <div className="td-content">
        <Paragraph>
          Chỉ áp dụng cho các đề thi có bật giám sát. Chia làm 2 mức:
        </Paragraph>
        <Paragraph style={{ marginBottom: 4 }}>
          <b>Vi phạm nặng</b> — tính vào số lần vi phạm, chạm ngưỡng cho phép của đề là bài bị tự động nộp:
        </Paragraph>
        <ul>
          <li>Rời khỏi tab hoặc thu nhỏ màn hình</li>
          <li>Cố sao chép nội dung đề bài</li>
          <li>Chuyển sang cửa sổ hoặc ứng dụng khác</li>
          <li>Thoát chế độ toàn màn hình (chỉ tính khi đề bắt buộc phải toàn màn hình)</li>
          <li>Không chạm chuột/bàn phím quá lâu</li>
          <li>Đăng nhập cùng lúc trên một thiết bị khác</li>
        </ul>
        <Paragraph style={{ marginBottom: 4 }}>
          <b>Vi phạm nhẹ</b> — chỉ ghi lại để tham khảo, không tính vào ngưỡng tự nộp bài:
        </Paragraph>
        <ul>
          <li>Mở công cụ dành cho lập trình viên của trình duyệt</li>
          <li>Có dấu hiệu chụp màn hình</li>
        </ul>
        <Paragraph>
          Ngoài giám sát ngay trong lúc thi, hệ thống còn tự rà soát sau khi thi xong để tìm dấu
          hiệu bất thường: trả lời nhanh khác thường so với điểm đạt được, bài bị bỏ dở quá lâu
          không có thao tác gì, và nhiều người cùng chọn chung một đáp án <b>sai giống hệt
          nhau</b> (dấu hiệu có thể đã trao đổi đáp án với nhau).
        </Paragraph>
      </div>
    ),
  },
  {
    id: 'dau-truong',
    tieuDe: 'Đấu trường trực tuyến (Arena)',
    noiDung: (
      <div className="td-content">
        <Paragraph>
          Hình thức thi đối kháng theo đội, chạy thời gian thực, tính điểm theo tốc độ trả lời —
          đúng và nhanh hơn thì được nhiều điểm hơn. Có 3 vai trò: <b>người dẫn chương trình</b>{' '}
          (cán bộ đào tạo/quản trị viên — điều khiển phiên đấu), <b>đội chơi</b> (vào phòng bằng
          mã, rớt mạng hay tải lại trang giữa trận vẫn vào lại được), <b>khán giả</b> (chỉ xem,
          dùng cho màn hình chiếu lớn).
        </Paragraph>
        <h5>Một câu hỏi diễn ra theo trình tự nào</h5>
        <Paragraph>
          Chuẩn bị (chỉ hiện tên lĩnh vực câu hỏi, chưa bấm được gì) → hiện câu hỏi, đồng hồ đếm
          ngược tính theo giờ máy chủ (không phụ thuộc đồng hồ máy tính của người dẫn chương
          trình) → hết giờ tự khoá lại → công bố kết quả (có bù trừ độ trễ đường mạng giữa các đội
          cho công bằng) → chuyển sang câu tiếp theo (tự động, hoặc chờ người dẫn chương trình
          bấm nút, tuỳ chế độ đã chọn từ đầu).
        </Paragraph>
        <Paragraph>
          Bước chốt điểm lúc công bố kết quả được làm cẩn thận để dù bị gọi 2 lần (ví dụ người dẫn
          chương trình bấm đúng lúc hệ thống cũng tự công bố) thì điểm <b>vẫn chỉ được cộng đúng
          một lần</b>, không bị nhân đôi.
        </Paragraph>
      </div>
    ),
  },
  {
    id: 'gamification',
    tieuDe: 'Điểm thưởng, cấp độ, huy hiệu',
    noiDung: (
      <div className="td-content">
        <ul>
          <li><b>Điểm kinh nghiệm (XP)</b> cộng dồn từ: hoàn thành bài thi (thưởng thêm nếu đạt điểm tuyệt đối), tham gia/thắng Đấu trường, trả lời câu hỏi mỗi ngày, giữ chuỗi ngày học liên tục, đạt huy hiệu mới.</li>
          <li><b>Cấp độ</b>: nhiều bậc, càng lên cao càng cần nhiều điểm kinh nghiệm hơn mới lên tiếp được.</li>
          <li><b>Huy hiệu</b>: một bộ cố định theo nhiều chủ đề (thi cử, chuỗi ngày, Đấu trường, tốc độ...), cộng thêm huy hiệu &quot;chuyên gia&quot; tự trao theo từng lĩnh vực khi đạt kết quả xuất sắc nhiều lần liên tiếp.</li>
          <li><b>Chuỗi ngày học</b>: có &quot;phao cứu&quot; — nghỉ đúng 1 ngày không bị mất chuỗi nếu còn phao, để đỡ nản khi lỡ quên mất 1 hôm.</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'giong-doc',
    tieuDe: 'Giọng đọc thuyết minh',
    noiDung: (
      <div className="td-content">
        <Paragraph>
          Tính năng đọc to đề bài/đáp án, dùng ở màn làm bài phản hồi tức thì và ở màn hình người
          dẫn chương trình/khán giả trong Đấu trường (không dùng ở thi cổ điển, cũng không dùng ở
          màn hình của đội chơi trong Đấu trường). Mặc định <b>tắt</b>, mỗi trình duyệt tự nhớ
          trạng thái bật/tắt riêng của mình.
        </Paragraph>
        <Paragraph>
          Các file âm thanh được <b>làm sẵn từ trước</b>, không đọc &quot;trực tiếp&quot; lúc dùng
          — vì hệ thống chạy trong mạng không có Internet thường xuyên nên không gọi được dịch vụ
          đọc chữ thành giọng nói theo thời gian thực. Nếu nội dung câu hỏi/đáp án bị sửa mà chưa
          làm lại file âm thanh tương ứng, câu đó sẽ <b>im lặng</b> một cách có chủ đích, thay vì
          báo lỗi.
        </Paragraph>
      </div>
    ),
  },
  {
    id: 'luu-y-phat-trien',
    tieuDe: '⚠️ Lưu ý khi sửa code & nâng cấp phần mềm',
    noiDung: (
      <div className="td-content">
        <div className="td-canh-bao">
          Đây là mục <b>quan trọng nhất</b> của tài liệu — những cái bẫy thực tế đã từng gây lỗi
          (hoặc rất dễ gây lỗi) khi sửa hệ thống này. Đọc kỹ trước khi đổi code.
        </div>

        <h5>1. Sửa code xong mà không thấy gì đổi khác</h5>
        <Paragraph>
          Mã nguồn được &quot;đóng gói cứng&quot; vào bên trong ảnh Docker ngay lúc dựng (build),
          <b> không</b> tự đồng bộ từ máy đang sửa code vào phần đang chạy. Khởi động lại theo
          cách thông thường chỉ chạy lại đúng code cũ. Muốn thấy thay đổi thật sự phải dựng
          (build) lại rồi mới khởi động.
        </Paragraph>

        <h5>2. Tuyệt đối không chạy 2 bản sao của phần API cùng lúc</h5>
        <Paragraph>
          Vài việc quan trọng (tự động chốt bài hết giờ, hẹn giờ Đấu trường) đang chạy bằng bộ đếm
          giờ ngay bên trong một phần API duy nhất, không có gì đứng ra điều phối chung nếu chạy
          nhiều bản. Chạy 2 bản API cùng lúc sẽ khiến các việc này chạy trùng lặp, gây lỗi rất khó
          phát hiện (ví dụ cộng điểm/kinh nghiệm 2 lần cho cùng một người).
        </Paragraph>

        <h5>3. Cấu hình môi trường phát triển và môi trường thật là 2 bộ tách biệt</h5>
        <Paragraph>
          Không được dùng chung hay gộp 2 bộ cấu hình lại — mỗi bộ có những giả định riêng về dữ
          liệu ban đầu, dùng nhầm bộ sẽ khiến bước cập nhật cấu trúc dữ liệu bị lỗi.
        </Paragraph>

        <h5>4. Đổi cấu trúc dữ liệu (migration) đôi khi phải tự sửa tay</h5>
        <Paragraph>
          Công cụ quản lý cơ sở dữ liệu tự sinh ra lệnh thay đổi cấu trúc, nhưng với một số kiểu
          thay đổi (ví dụ: đổi cách lưu thời gian, hoặc thêm một cột bắt buộc phải có giá trị vào
          bảng đã sẵn có dữ liệu), lệnh tự sinh ra <b>chưa đủ an toàn</b> và cần chỉnh tay trước khi
          chạy thật. Không có cách hoàn tác lại bước này — luôn sao lưu dữ liệu trước khi áp dụng
          thay đổi cấu trúc ở hệ thống thật.
        </Paragraph>

        <h5>5. Một vài file bắt buộc phải giống hệt nhau ở cả 2 phía</h5>
        <Paragraph>
          Có những chỗ mà cả giao diện lẫn máy chủ đều phải tự tính ra đúng cùng một kết quả một
          cách độc lập (ví dụ: tên file âm thanh giọng đọc được tính từ nội dung câu hỏi, hoặc các
          quy ước của Đấu trường) — nên có vài file được <b>chép tay thành 2 bản</b> ở 2 phía thay
          vì dùng chung một chỗ. Sửa bên này mà quên sửa bên kia sẽ gây lỗi âm thầm, không dễ nhận
          ra ngay (ví dụ: giọng đọc bỗng im lặng mà không báo lỗi gì cả).
        </Paragraph>

        <h5>6. Sửa nội dung câu hỏi/đáp án thì nhớ làm lại giọng đọc</h5>
        <Paragraph>
          Xem thêm mục &quot;Giọng đọc thuyết minh&quot; ở trên — quên bước này không gây lỗi ồn
          ào gì cả, chỉ đơn giản là người dùng không nghe thấy tiếng, nên rất dễ bị bỏ sót nếu chỉ
          kiểm tra qua loa.
        </Paragraph>

        <h5>7. Chưa có hệ thống tự động kiểm tra code chạy nền (CI)</h5>
        <Paragraph>
          Trước khi coi một thay đổi là xong, phải tự tay chạy kiểm thử và kiểm tra kiểu dữ liệu
          ở cả 2 phía. Lưu ý: bước dựng ảnh Docker của phần giao diện có chạy kèm kiểm thử — kiểm
          thử lỗi là dựng ảnh thất bại luôn; còn bước dựng ảnh của phần API thì <b>không</b> chạy
          kiểm thử kèm theo, nên lỗi ở phía API dễ lọt qua nếu chỉ tin vào việc dựng ảnh thành
          công.
        </Paragraph>

        <h5>8. Vài bài học đã phải trả giá thật, tránh lặp lại</h5>
        <ul>
          <li>Khai báo đường dẫn API: đường dẫn có tên cố định phải khai báo <b>trước</b> đường dẫn có phần thay đổi được nằm ở cùng vị trí — nếu không, đường dẫn cố định sẽ không bao giờ được gọi tới.</li>
          <li>Đừng tắt hết mọi hiệu ứng chuyển động một cách tràn lan khi người dùng bật chế độ &quot;giảm chuyển động&quot; trên máy — từng khiến một nhóm nút bấm quan trọng không phản hồi gì trên máy có tắt hiệu ứng, vì phần giao diện đó chờ hiệu ứng chạy xong mới chịu xử lý hành động.</li>
          <li>Thiếu chuỗi bí mật bắt buộc dùng để ký vé đăng nhập ở hệ thống thật: hệ thống <b>cố ý dừng khởi động ngay</b> thay vì tự dùng một giá trị mặc định không an toàn — đây là hành vi <b>đúng</b>, không nên &quot;sửa&quot; cho nó khởi động được bằng cách bỏ bớt kiểm tra này đi.</li>
          <li>Mất dữ liệu lưu trữ của lớp gác cổng (chứa chứng chỉ gốc tự cấp nội bộ) đồng nghĩa phải cài lại chứng chỉ trên <b>toàn bộ</b> máy trong mạng — cần sao lưu riêng phần dữ liệu này, không chỉ sao lưu mỗi cơ sở dữ liệu.</li>
        </ul>
      </div>
    ),
  },
]

export default function TechnicalDocsPage() {
  return (
    <KhungHuongDan
      tieuDe="Tài liệu kỹ thuật"
      moTa={
        <>
          Giải thích cách hệ thống 7800Quiz được xây dựng — từ hạ tầng, công nghệ dùng, cấu hình
          cơ bản đến các lưu ý khi sửa code và nâng cấp phần mềm. Viết theo lối dễ hiểu, không cần
          biết lập trình vẫn đọc được, chỉ dành cho quản trị viên.{' '}
          <Tag color="error" style={{ marginLeft: 4 }}>Nội bộ</Tag>
        </>
      }
      cacMuc={cacMuc}
    />
  )
}
