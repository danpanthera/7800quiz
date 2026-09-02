import 'package:dio/dio.dart';

/// Chuyển lỗi gọi API thành thông báo tiếng Việt dễ hiểu cho người dùng.
///
/// Trước đây các màn hình chỉ đọc `e.response?.data?['message']` — khi mất
/// mạng thì `response` luôn là `null` nên mọi lỗi mạng đều hiện chung chung
/// "Đăng nhập thất bại" (hoặc tương tự), vô nghĩa với người dùng đang cầm
/// điện thoại ở nơi sóng yếu / đang test qua LAN sai IP.
String apiErrorMessage(Object error) {
  if (error is! DioException) return 'Đã có lỗi xảy ra. Vui lòng thử lại.';

  switch (error.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
      return 'Kết nối tới máy chủ quá chậm. Kiểm tra mạng và thử lại.';
    case DioExceptionType.connectionError:
      return 'Không kết nối được máy chủ. Kiểm tra Wi-Fi/dữ liệu di động hoặc liên hệ IT.';
    case DioExceptionType.badCertificate:
      return 'Chứng chỉ bảo mật của máy chủ không hợp lệ. Liên hệ IT để kiểm tra.';
    case DioExceptionType.cancel:
      return 'Yêu cầu đã bị huỷ.';
    case DioExceptionType.badResponse:
      final data = error.response?.data;
      final msg = data is Map ? data['message'] : null;
      if (msg is String && msg.isNotEmpty) return msg;
      final status = error.response?.statusCode;
      return 'Máy chủ phản hồi lỗi (mã $status). Vui lòng thử lại sau.';
    case DioExceptionType.unknown:
      return 'Không kết nối được máy chủ. Kiểm tra mạng hoặc liên hệ IT.';
  }
}
