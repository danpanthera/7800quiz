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
          7800Quiz là ứng dụng thi trắc nghiệm &amp; ôn luyện nội bộ, chạy hoàn toàn trong mạng
          nội bộ (không public Internet). Ba vai trò tài khoản: <code>STAFF</code> (cán bộ — làm
          bài, xem kết quả của mình), <code>TRAINER</code> (cán bộ đào tạo — soạn câu hỏi/đề,
          giao bài, xem báo cáo), <code>ADMIN</code> (quản trị viên — toàn quyền, thêm quản lý
          cán bộ/tổ chức và bảo mật hệ thống).
        </Paragraph>
        <h5>Luồng yêu cầu (request) tổng quát</h5>
        <ul>
          <li>Trình duyệt gọi vào một tên miền nội bộ duy nhất (HTTPS, chứng chỉ tự ký nội bộ).</li>
          <li>
            Reverse proxy nhận request: đường dẫn <code>/api/*</code> và <code>/socket.io/*</code>{' '}
            chuyển vào container <b>API</b>; mọi đường dẫn còn lại trả về container <b>Web</b>{' '}
            (giao diện React đã build sẵn, phục vụ qua Nginx).
          </li>
          <li>
            API đọc/ghi dữ liệu vào <b>PostgreSQL</b>; kết nối realtime (Đấu trường trực tuyến)
            đi qua WebSocket cùng cổng API.
          </li>
        </ul>
        <h5>Mô hình triển khai vật lý</h5>
        <Paragraph>
          Toàn bộ 4 container Docker (Postgres, API, Web, reverse proxy) chạy trong{' '}
          <b>một máy ảo Ubuntu duy nhất</b>, dựng trên Hyper-V của một máy chủ Windows Server —
          lý do chọn kiến trúc này là PostgreSQL không có image container chính thức cho
          Windows. Mạng hoàn toàn nội bộ, không có kết nối Internet thường trực (chỉ nối tạm khi
          cài đặt/cập nhật).
        </Paragraph>
      </div>
    ),
  },
  {
    id: 'cong-nghe-nen',
    tieuDe: 'Ngôn ngữ lập trình & framework',
    noiDung: (
      <div className="td-content">
        <h5>Backend — apps/api</h5>
        <table>
          <thead>
            <tr><th>Thành phần</th><th>Công nghệ</th></tr>
          </thead>
          <tbody>
            <tr><td>Ngôn ngữ</td><td>TypeScript 5.7</td></tr>
            <tr><td>Framework</td><td>NestJS 11 (Express)</td></tr>
            <tr><td>ORM &amp; cơ sở dữ liệu</td><td>Prisma 6 + PostgreSQL 16</td></tr>
            <tr><td>Realtime</td><td>Socket.IO 4.8 (qua <code>@nestjs/platform-socket.io</code>)</td></tr>
            <tr><td>Xác thực</td><td>Passport + JWT (<code>@nestjs/jwt</code>, <code>passport-jwt</code>), mật khẩu băm bằng bcrypt</td></tr>
            <tr><td>Kiểm tra dữ liệu vào</td><td>class-validator / class-transformer</td></tr>
            <tr><td>Khác</td><td>Multer (tải file), xlsx (xuất/nhập Excel), nspell + từ điển tiếng Việt (kiểm tra chính tả)</td></tr>
            <tr><td>Kiểm thử</td><td>Jest 30 + ts-jest, supertest cho kiểm thử end-to-end</td></tr>
          </tbody>
        </table>
        <h5>Frontend — apps/web</h5>
        <table>
          <thead>
            <tr><th>Thành phần</th><th>Công nghệ</th></tr>
          </thead>
          <tbody>
            <tr><td>Ngôn ngữ</td><td>TypeScript 6</td></tr>
            <tr><td>Framework UI</td><td>React 19</td></tr>
            <tr><td>Công cụ build</td><td>Vite 8</td></tr>
            <tr><td>Thư viện giao diện</td><td>Ant Design (antd) 6</td></tr>
            <tr><td>Định tuyến</td><td>react-router-dom 7</td></tr>
            <tr><td>Gọi API &amp; cache dữ liệu</td><td>axios + @tanstack/react-query 5</td></tr>
            <tr><td>Realtime</td><td>socket.io-client 4.8</td></tr>
            <tr><td>PWA / Service Worker</td><td>vite-plugin-pwa (nền Workbox)</td></tr>
            <tr><td>Hiệu ứng/khác</td><td>canvas-confetti, qrcode/qrcode.react</td></tr>
            <tr><td>Kiểm thử</td><td>Vitest</td></tr>
          </tbody>
        </table>
        <Paragraph>
          <b>Không dùng thư viện biểu đồ nào</b> (không recharts/chart.js/echarts) — các trang báo
          cáo hiện chỉ dùng <code>Table</code>/<code>Progress</code> có sẵn của Ant Design. Muốn
          vẽ biểu đồ phức tạp hơn sẽ cần bổ sung thư viện mới.
        </Paragraph>
      </div>
    ),
  },
  {
    id: 'ha-tang',
    tieuDe: 'Hạ tầng triển khai',
    noiDung: (
      <div className="td-content">
        <h5>Docker Compose — môi trường phát triển</h5>
        <table>
          <thead><tr><th>Container</th><th>Cổng (host:container)</th><th>Ghi chú</th></tr></thead>
          <tbody>
            <tr><td><code>quiz7800_db</code></td><td>15433:5432</td><td>PostgreSQL 16</td></tr>
            <tr><td><code>quiz7800_api</code></td><td>13010:13010</td><td>Build từ <code>apps/api</code></td></tr>
            <tr><td><code>quiz7800_web</code></td><td>15173:80</td><td>Build từ <code>apps/web</code>, Nginx phục vụ file tĩnh</td></tr>
          </tbody>
        </table>
        <h5>Docker Compose — môi trường sản xuất (Production)</h5>
        <Paragraph>
          File cấu hình <b>độc lập hoàn toàn</b> với môi trường phát triển (không được gộp chung).
          Có thêm container <code>quiz7800_proxy</code> (Caddy) là container duy nhất mở cổng ra
          ngoài (80/443); các container còn lại nằm trong mạng nội bộ Docker, không lộ cổng.
          Mạng dữ liệu (Postgres) được cấu hình <code>internal: true</code> — không có đường ra
          Internet dù container có bị chiếm quyền điều khiển.
        </Paragraph>
        <h5>Reverse proxy — Caddy</h5>
        <ul>
          <li>Chứng chỉ TLS <b>tự ký nội bộ</b> (không dùng Let&apos;s Encrypt vì không có Internet thường trực) — chứng chỉ gốc phải cài thủ công vào từng máy trong mạng.</li>
          <li>Chỉ bật giao thức HTTP/1.1 và HTTP/2 (không bật HTTP/3 vì mạng nội bộ có thể chặn UDP).</li>
          <li>Tự thêm các header bảo mật cơ bản (chống dò server, chống nhúng iframe, chính sách referrer...).</li>
          <li>Có trang bảo trì riêng bằng tiếng Việt khi API/Web gặp sự cố.</li>
        </ul>
        <h5>Chính sách cache của Nginx (container Web)</h5>
        <ul>
          <li><code>index.html</code>, file service worker: <b>không cache</b> — bắt buộc để cơ chế cập nhật phiên bản hoạt động đúng.</li>
          <li>File tĩnh có vân tay (hash) trong tên (JS/CSS đã build): cache 1 năm, không đổi.</li>
          <li>Thư mục audio giọng đọc: cache dài hạn nhưng có kiểm tra file tồn tại trước khi trả về (tránh trả nhầm trang lỗi thành file âm thanh).</li>
        </ul>
        <h5>Biến môi trường chính (Production)</h5>
        <table>
          <thead><tr><th>Biến</th><th>Ý nghĩa</th></tr></thead>
          <tbody>
            <tr><td><code>SITE_ADDRESS</code></td><td>Tên miền nội bộ của hệ thống</td></tr>
            <tr><td><code>POSTGRES_USER/DB/PASSWORD</code></td><td>Thông tin kết nối cơ sở dữ liệu (mật khẩu chỉ nên dùng chữ/số)</td></tr>
            <tr><td><code>JWT_SECRET</code></td><td>Khoá ký token đăng nhập — bắt buộc đủ dài, hệ thống <b>từ chối khởi động</b> nếu thiếu hoặc quá ngắn</td></tr>
            <tr><td><code>JWT_EXPIRES_IN</code></td><td>Thời hạn phiên đăng nhập (mặc định 8 giờ)</td></tr>
            <tr><td><code>CORS_ORIGIN</code></td><td>Danh sách nguồn được phép gọi API</td></tr>
            <tr><td><code>TZ</code></td><td>Múi giờ hệ thống (Việt Nam) — ảnh hưởng cách hiển thị thời gian khi xuất báo cáo</td></tr>
          </tbody>
        </table>
        <h5>Quy trình cập nhật hệ thống (tóm tắt)</h5>
        <ol>
          <li>Sao lưu cơ sở dữ liệu.</li>
          <li>Gắn nhãn phiên bản đang chạy là bản dự phòng (để rollback nếu cần).</li>
          <li>Lấy mã nguồn mới, build lại image.</li>
          <li>Tạm dừng dịch vụ, chạy cập nhật cấu trúc dữ liệu (migration).</li>
          <li>Khởi động lại, kiểm tra hoạt động (đăng nhập, mở phòng Đấu trường thử).</li>
          <li>Nếu lỗi ở bước migration: <b>dừng ngay, không khởi động lại</b>, khôi phục bằng bản dự phòng.</li>
        </ol>
        <Paragraph>
          Cơ sở dữ liệu được sao lưu tự động hằng ngày (giữ 14 ngày gần nhất, riêng bản đầu tháng
          giữ 1 năm) và nên diễn tập khôi phục định kỳ để đảm bảo bản sao lưu dùng được.
        </Paragraph>
      </div>
    ),
  },
  {
    id: 'kien-truc-backend',
    tieuDe: 'Kiến trúc Backend',
    noiDung: (
      <div className="td-content">
        <h5>Các khối chức năng (module)</h5>
        <Paragraph>
          Mã nguồn API tổ chức theo module NestJS, mỗi thư mục một nhóm nghiệp vụ: xác thực
          (<code>auth</code>), quản trị tổng hợp (<code>admin</code>), đề thi (<code>quiz</code>),
          giao bài (<code>assignments</code>, <code>assignment-schedule</code>), bài nộp/lượt làm
          bài (<code>submissions</code>, <code>attempts</code>), Đấu trường trực tuyến
          (<code>arena</code>), giải đấu (<code>tournament</code>), điểm thưởng/huy hiệu
          (<code>gamification</code>), câu hỏi mỗi ngày (<code>daily-question</code>), luyện tập
          tự do (<code>practice</code>), ôn tập ngắt quãng (<code>review</code>), thống kê/báo cáo
          (<code>performance</code>), quy trình duyệt câu hỏi (<code>question-approval</code>).
        </Paragraph>
        <h5>Xác thực &amp; phân quyền</h5>
        <ul>
          <li>Đăng nhập trả về một token duy nhất (không có cơ chế làm mới token) — hết hạn phải đăng nhập lại.</li>
          <li>Mỗi phiên đăng nhập được lưu vào cơ sở dữ liệu, có thể <b>thu hồi ngay lập tức</b> (đăng xuất từ xa) mà không cần đợi token hết hạn.</li>
          <li>Hỗ trợ xác thực 2 lớp (TOTP — mã theo thời gian) tuỳ chọn cho từng tài khoản.</li>
          <li>Chống dò mật khẩu: giới hạn số lần đăng nhập trong 1 phút và tự khoá tài khoản sau nhiều lần sai liên tiếp trong 15 phút.</li>
          <li>Phân quyền theo route: mỗi API tự khai báo vai trò được phép gọi, không có cơ chế chặn toàn cục — thêm route mới phải tự khai báo quyền, không mặc định an toàn.</li>
        </ul>
        <h5>Mô hình dữ liệu</h5>
        <Paragraph>
          Cơ sở dữ liệu gồm nhiều nhóm bảng chính: <b>người dùng/tổ chức</b> (tài khoản, hồ sơ cán
          bộ, phòng ban, lớp học), <b>ngân hàng câu hỏi</b> (lĩnh vực, câu hỏi, phương án trả
          lời), <b>đề thi &amp; giao bài</b> (đề, phiên bản đề đã chốt, phân công, lịch giao bài tự
          động), <b>lượt làm bài</b> (lượt làm đang diễn ra và bài đã chấm), <b>giám sát</b> (vi
          phạm khi thi, nhật ký thao tác quản trị), <b>Đấu trường</b> (phiên đấu, đội, vòng câu
          hỏi, lượt bấm chuông), <b>giải đấu</b>, và <b>điểm thưởng/thành tích</b> (kinh nghiệm,
          cấp độ, huy hiệu, chuỗi ngày, ôn tập ngắt quãng).
        </Paragraph>
        <Paragraph>
          Quy ước đặt tên cột trong cơ sở dữ liệu là snake_case (khác với camelCase trong code
          TypeScript) — Prisma tự ánh xạ hai chiều.
        </Paragraph>
        <h5>Kênh realtime (Đấu trường)</h5>
        <Paragraph>
          Một kết nối WebSocket duy nhất, chia thành các &quot;phòng&quot; theo phiên đấu/đội/người
          dùng. Toàn bộ thông báo gửi ra ngoài đi qua <b>một điểm phát duy nhất</b> trong code —
          giúp dễ kiểm soát và gỡ lỗi hơn là phát rải rác nhiều nơi.
        </Paragraph>
      </div>
    ),
  },
  {
    id: 'kien-truc-frontend',
    tieuDe: 'Kiến trúc Frontend & thiết kế giao diện',
    noiDung: (
      <div className="td-content">
        <h5>Cấu trúc thư mục mã nguồn</h5>
        <ul>
          <li><code>pages/</code> — mỗi màn hình/route một file.</li>
          <li><code>components/</code> — thành phần dùng lại được nhiều nơi.</li>
          <li><code>layouts/</code> — khung giao diện chung (sidebar, header) bọc quanh các trang.</li>
          <li><code>hooks/</code> — logic tái sử dụng (đồng bộ đồng hồ server, phát hiện loại thiết bị, đếm ngược...).</li>
          <li><code>lib/</code> — hàm tiện ích, gọi API, kiểm soát quyền truy cập, phát âm thanh...</li>
        </ul>
        <h5>Điều hướng &amp; phân quyền phía giao diện</h5>
        <Paragraph>
          Mọi trang trong khung quản trị đều được bọc bởi lớp kiểm tra: chưa đăng nhập → về trang
          đăng nhập; đăng nhập rồi nhưng sai vai trò → tự chuyển về trang mặc định của vai trò đó
          (không hiện thông báo lỗi, không cho thấy trang bị chặn). Token đăng nhập lưu ở bộ nhớ
          trình duyệt (localStorage); khi API trả lỗi phiên hết hạn, giao diện tự xoá token và
          đưa về trang đăng nhập.
        </Paragraph>
        <h5>Ngôn ngữ thiết kế</h5>
        <ul>
          <li><b>Màu thương hiệu</b>: đỏ mận + vàng, khai báo qua biến CSS dùng chung cho cả CSS thuần lẫn cấu hình theme của Ant Design — đổi màu thương hiệu phải sửa ở cả hai nơi cho khớp nhau.</li>
          <li><b>Sáng/Tối</b>: chuyển theo thuộc tính đặt trên thẻ gốc của trang, người dùng chọn Sáng/Tối/Theo hệ thống.</li>
          <li><b>Phông chữ</b>: một phông chính cho toàn bộ giao diện; 2 phông trang trí chỉ dùng cho vài chữ nhấn ở trang đăng nhập.</li>
          <li>
            <b>Các họ tên lớp CSS theo khu vực chức năng</b> (giúp tránh style của khu vực này ảnh
            hưởng khu vực khác): khung portal quản trị, màn làm bài phản hồi tức thì, Đấu trường,
            thẻ/danh sách đề thi, trang chủ học viên, trang đăng nhập, bảng biểu quản trị — mỗi
            khu vực có tiền tố lớp CSS riêng.
          </li>
        </ul>
        <h5>Ứng dụng web lũy tiến (PWA)</h5>
        <Paragraph>
          Ứng dụng có thể cài vào máy/điện thoại như app thật, hoạt động cả khi có bản cập nhật
          mới đang chờ. <b>Cố ý không tự tải lại trang</b> khi có bản mới (tránh làm gián đoạn
          người đang thi) — hệ thống chỉ hiện thông báo nhỏ, người dùng tự bấm &quot;Tải lại&quot;
          khi thấy tiện, hoặc bản mới sẽ tự áp dụng ở lần tải trang kế tiếp.
        </Paragraph>
        <h5>Đáp ứng nhiều loại thiết bị</h5>
        <Paragraph>
          Giao diện tự nhận diện điện thoại/máy tính bảng/máy tính để chuyển bố cục (ví dụ: menu
          bên trái cố định trên máy tính, menu kéo ra từ cạnh trên điện thoại).
        </Paragraph>
      </div>
    ),
  },
  {
    id: 'luong-lam-bai',
    tieuDe: 'Nghiệp vụ cốt lõi: luồng làm một bài thi',
    noiDung: (
      <div className="td-content">
        <h5>Ba hình thức làm bài</h5>
        <ul>
          <li><b>Thi cổ điển</b> — làm hết rồi nộp một lần, chỉ biết điểm sau khi nộp.</li>
          <li><b>Phản hồi tức thì</b> — biết đúng/sai ngay sau mỗi câu, mỗi câu tự chốt lại khi đã trả lời.</li>
          <li><b>Luyện tập tự do</b> — không lưu lịch sử, không tính điểm, không giới hạn số lần làm.</li>
        </ul>
        <h5>Các bước chính (thi cổ điển/phản hồi tức thì)</h5>
        <ol>
          <li>Được giao bài (thủ công, nhập từ Excel, hoặc theo lịch tự động lặp lại).</li>
          <li>Bắt đầu làm bài: hệ thống chốt lại một bản sao cố định của đề tại thời điểm bắt đầu (dù sau đó đề gốc có bị sửa, bài đang làm/đã làm không đổi theo) và tính thời hạn nộp bài.</li>
          <li>Trả lời từng câu — hệ thống tự lưu theo thời gian thực, không cần bấm lưu.</li>
          <li>Nộp bài (chủ động hoặc hết giờ tự động nộp) — hệ thống chấm điểm và ghi nhận kết quả.</li>
          <li>Điểm thưởng (kinh nghiệm) chỉ được cộng cho lần làm đầu tiên đạt kết quả, và không cộng nếu bài bị tự nộp do vi phạm giám sát.</li>
        </ol>
      </div>
    ),
  },
  {
    id: 'giam-sat',
    tieuDe: 'Cơ chế giám sát & chống gian lận',
    noiDung: (
      <div className="td-content">
        <Paragraph>
          Áp dụng cho các đề thi có bật giám sát. Chia làm 2 mức độ vi phạm:
        </Paragraph>
        <ul>
          <li>
            <b>Vi phạm nặng</b> (tính vào số lần vi phạm, có thể khiến bài tự động bị nộp khi
            vượt ngưỡng cho phép của đề thi): rời khỏi tab/màn hình, cố sao chép nội dung, mất
            tiêu điểm cửa sổ, thoát chế độ toàn màn hình (chỉ tính khi đề bắt buộc toàn màn hình),
            không thao tác quá lâu, đăng nhập cùng lúc trên thiết bị khác.
          </li>
          <li>
            <b>Vi phạm nhẹ</b> (chỉ ghi nhận để tham khảo, không tính vào ngưỡng tự nộp bài): mở
            công cụ dành cho lập trình viên của trình duyệt, có dấu hiệu chụp màn hình.
          </li>
        </ul>
        <Paragraph>
          Ngoài giám sát theo thời gian thực, hệ thống còn có các phân tích để phát hiện gian lận
          sau khi thi: tốc độ trả lời bất thường (điểm cao nhưng trả lời quá nhanh), bài làm bị bỏ
          dở quá lâu không có hoạt động, và nhiều người cùng chọn chung một đáp án sai giống hệt
          nhau (dấu hiệu trao đổi đáp án).
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
          Hình thức thi đối kháng theo đội, thời gian thực qua WebSocket, tính điểm theo tốc độ
          trả lời (trả lời đúng và nhanh hơn được nhiều điểm hơn). Ba vai trò: <b>người dẫn
          chương trình</b> (cán bộ đào tạo/quản trị viên — điều khiển phiên đấu), <b>đội chơi</b>{' '}
          (vào phòng bằng mã, có thể tham gia lại nếu bị rớt mạng/tải lại trang giữa trận),{' '}
          <b>khán giả</b> (chỉ xem, dùng cho màn hình chiếu lớn).
        </Paragraph>
        <h5>Vòng đời một câu hỏi</h5>
        <Paragraph>
          Chuẩn bị (chỉ hiện lĩnh vực câu hỏi, chưa bấm được) → hiển thị câu hỏi, đồng hồ đếm
          ngược do <b>máy chủ làm chủ</b> (không phụ thuộc đồng hồ máy người dẫn chương trình) →
          hết giờ tự khoá → công bố kết quả (có bù trừ độ trễ mạng giữa các đội để công bằng) →
          chuyển câu tiếp theo (tự động hoặc chờ người dẫn chương trình bấm, tuỳ chế độ đã chọn).
        </Paragraph>
        <Paragraph>
          Việc chốt điểm khi công bố kết quả được thiết kế <b>an toàn khi gọi trùng lặp</b> — dù
          người dẫn chương trình bấm nút đúng lúc hệ thống cũng tự động công bố, điểm chỉ được
          cộng đúng một lần.
        </Paragraph>
      </div>
    ),
  },
  {
    id: 'gamification',
    tieuDe: 'Điểm thưởng, cấp độ, huy hiệu (Gamification)',
    noiDung: (
      <div className="td-content">
        <ul>
          <li><b>Điểm kinh nghiệm (XP)</b> tích luỹ từ: hoàn thành bài thi (thưởng thêm nếu đạt điểm tuyệt đối), tham gia/thắng Đấu trường, trả lời câu hỏi mỗi ngày, duy trì chuỗi ngày học liên tục, đạt huy hiệu mới.</li>
          <li><b>Cấp độ</b>: nhiều bậc, càng lên cao càng cần nhiều điểm kinh nghiệm hơn.</li>
          <li><b>Huy hiệu</b>: một bộ huy hiệu cố định theo nhiều chủ đề (thi cử, chuỗi ngày, Đấu trường, tốc độ...) và huy hiệu &quot;chuyên gia&quot; tự động theo từng lĩnh vực câu hỏi khi đạt kết quả xuất sắc nhiều lần.</li>
          <li><b>Chuỗi ngày</b>: có cơ chế &quot;phao cứu&quot; — nghỉ đúng 1 ngày không bị mất chuỗi nếu còn phao, để tránh cảm giác thất vọng vì lỡ quên 1 hôm.</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'giong-doc',
    tieuDe: 'Giọng đọc thuyết minh (chuyển văn bản thành giọng nói)',
    noiDung: (
      <div className="td-content">
        <Paragraph>
          Tính năng đọc to đề bài/đáp án, dùng ở màn làm bài phản hồi tức thì và ở màn hình của
          người dẫn chương trình/khán giả trong Đấu trường (không dùng ở thi cổ điển và không
          dùng ở màn hình của đội chơi trong Đấu trường). Mặc định <b>tắt</b>, mỗi trình duyệt tự
          nhớ trạng thái bật/tắt riêng.
        </Paragraph>
        <Paragraph>
          File âm thanh được <b>sinh sẵn trước</b> (không đọc &quot;live&quot; lúc dùng, vì hệ
          thống chạy trong mạng không có Internet thường trực), lưu riêng ngoài mã nguồn. Nếu nội
          dung câu hỏi/đáp án thay đổi mà chưa sinh lại file âm thanh tương ứng, câu đó sẽ{' '}
          <b>im lặng</b> một cách có chủ đích thay vì báo lỗi.
        </Paragraph>
      </div>
    ),
  },
  {
    id: 'luu-y-phat-trien',
    tieuDe: '⚠️ Lưu ý khi phát triển & nâng cấp phần mềm',
    noiDung: (
      <div className="td-content">
        <div className="td-canh-bao">
          Đây là mục <b>quan trọng nhất</b> của tài liệu — những cạm bẫy thực tế đã từng (hoặc rất
          dễ) gây lỗi khi sửa hệ thống này. Đọc kỹ trước khi thay đổi code.
        </div>

        <h5>1. Sửa code xong mà không thấy gì thay đổi</h5>
        <Paragraph>
          Mã nguồn được &quot;nướng&quot; sẵn vào ảnh Docker lúc build, <b>không</b> đồng bộ trực
          tiếp từ máy vào container đang chạy. Khởi động lại container theo cách thông thường sẽ
          chỉ chạy lại đúng code cũ. Muốn thấy thay đổi phải build lại image rồi mới khởi động.
        </Paragraph>

        <h5>2. Tuyệt đối không chạy nhiều bản sao (instance) của dịch vụ API cùng lúc</h5>
        <Paragraph>
          Một số cơ chế quan trọng (tự động chốt bài hết giờ, hẹn giờ Đấu trường) chạy bằng bộ đếm
          giờ ngay trong tiến trình của một API duy nhất, không dùng dịch vụ điều phối trung tâm
          nào khác. Chạy 2 bản API cùng lúc sẽ khiến các cơ chế này chạy trùng lặp, gây lỗi khó
          phát hiện (ví dụ cộng điểm/kinh nghiệm 2 lần).
        </Paragraph>

        <h5>3. Cấu hình môi trường phát triển và sản xuất là hai bộ độc lập</h5>
        <Paragraph>
          Không được dùng chung/gộp hai bộ cấu hình triển khai — mỗi bộ có giả định riêng về dữ
          liệu khởi tạo ban đầu, dùng nhầm bộ sẽ khiến việc cập nhật cấu trúc dữ liệu thất bại.
        </Paragraph>

        <h5>4. Thay đổi cấu trúc dữ liệu (migration) đôi khi phải sửa tay</h5>
        <Paragraph>
          Công cụ quản lý cơ sở dữ liệu tự sinh ra lệnh thay đổi cấu trúc, nhưng với một số kiểu
          thay đổi (ví dụ: đổi cách lưu thời gian, thêm cột bắt buộc có giá trị vào bảng đã có dữ
          liệu), lệnh tự sinh <b>chưa đủ an toàn</b> và cần chỉnh sửa thủ công trước khi áp dụng.
          Không có cơ chế hoàn tác migration — luôn sao lưu dữ liệu trước khi áp dụng thay đổi cấu
          trúc ở môi trường sản xuất.
        </Paragraph>

        <h5>5. Một số cặp file phải luôn giống hệt nhau giữa hai phía</h5>
        <Paragraph>
          Vì hai phía (giao diện và máy chủ) đều cần tự tính ra cùng một kết quả một cách độc lập
          (ví dụ: tên file âm thanh giọng đọc tính từ nội dung câu hỏi, hoặc định nghĩa các sự
          kiện realtime của Đấu trường), có vài file được <b>chép tay thành 2 bản</b> ở hai phía
          thay vì dùng chung một chỗ. Sửa một bên mà quên sửa bên kia sẽ gây lỗi âm thầm, khó
          nhận ra ngay (ví dụ: giọng đọc im lặng mà không báo lỗi gì).
        </Paragraph>

        <h5>6. Sửa nội dung câu hỏi/đáp án thì nhớ sinh lại giọng đọc</h5>
        <Paragraph>
          Xem thêm mục &quot;Giọng đọc thuyết minh&quot; ở trên — thiếu bước này không gây lỗi ồn
          ào, chỉ đơn giản là người dùng không nghe thấy gì, rất dễ bị bỏ sót khi kiểm thử qua loa.
        </Paragraph>

        <h5>7. Không có hệ thống kiểm tra tự động (CI) chạy nền</h5>
        <Paragraph>
          Trước khi coi một thay đổi là hoàn tất, phải tự tay chạy kiểm thử và kiểm tra kiểu dữ
          liệu (typecheck) ở cả hai phía. Lưu ý: bước build ảnh Docker của giao diện có chạy kèm
          kiểm thử — kiểm thử giao diện lỗi sẽ khiến build ảnh thất bại; bước build ảnh của API
          thì không chạy kiểm thử kèm theo, nên lỗi ở phía API dễ lọt qua nếu chỉ dựa vào việc
          build ảnh thành công.
        </Paragraph>

        <h5>8. Vài bài học đã trả giá thật, nên tránh lặp lại</h5>
        <ul>
          <li>Khai báo route: đường dẫn có tên cố định phải khai báo <b>trước</b> đường dẫn có tham số động trùng vị trí, nếu không đường dẫn cố định sẽ không bao giờ được gọi tới.</li>
          <li>Không áp dụng kiểu "tắt toàn bộ hiệu ứng chuyển động" một cách rộng rãi cho mọi thành phần giao diện khi người dùng bật chế độ giảm chuyển động — từng khiến một nhóm nút thao tác quan trọng không phản hồi khi bấm trên máy có tắt hiệu ứng, vì thành phần giao diện đó chờ hiệu ứng kết thúc mới xử lý hành động.</li>
          <li>Thiếu khoá bảo mật bắt buộc (dùng để ký phiên đăng nhập) ở môi trường sản xuất: hệ thống <b>cố ý dừng khởi động ngay</b> thay vì tự dùng giá trị mặc định không an toàn — đây là hành vi đúng, không nên "sửa" cho hệ thống khởi động được bằng cách bỏ qua kiểm tra này.</li>
          <li>Mất dữ liệu lưu trữ của reverse proxy (chứa chứng chỉ gốc tự ký nội bộ) đồng nghĩa phải cài lại chứng chỉ trên <b>toàn bộ</b> máy trong mạng — cần sao lưu riêng phần dữ liệu này, không chỉ sao lưu cơ sở dữ liệu.</li>
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
          Phân tích thiết kế hệ thống 7800Quiz — từ hạ tầng, ngôn ngữ/framework, cấu hình cơ bản
          đến các lưu ý khi phát triển và nâng cấp phần mềm. Chỉ dành cho quản trị viên.{' '}
          <Tag color="error" style={{ marginLeft: 4 }}>Nội bộ</Tag>
        </>
      }
      cacMuc={cacMuc}
    />
  )
}
