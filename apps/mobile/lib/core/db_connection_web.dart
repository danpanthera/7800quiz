// ignore: deprecated_member_use
import 'package:drift/web.dart';
import 'package:drift/drift.dart';

QueryExecutor openConnection() {
  // Web uses sql.js (loaded via CDN in web/index.html)
  // ignore: deprecated_member_use
  return WebDatabase('7800quiz_local');
}
