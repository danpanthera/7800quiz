import 'package:drift/drift.dart';
import 'db_connection_native.dart'
    if (dart.library.html) 'db_connection_web.dart';

part 'local_db.g.dart';

// ─── Tables ───────────────────────────────────────────────────────────────────

class SyncOutboxTable extends Table {
  TextColumn get id => text()();
  TextColumn get submissionPayload => text()(); // JSON string
  TextColumn get status => text().withDefault(const Constant('PENDING'))();
  // PENDING | SYNCING | SYNCED | FAILED
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get lastTriedAt => dateTime().nullable()();
  TextColumn get errorMessage => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

// ─── Database ─────────────────────────────────────────────────────────────────

@DriftDatabase(tables: [SyncOutboxTable])
class LocalDatabase extends _$LocalDatabase {
  LocalDatabase() : super(openConnection());

  @override
  int get schemaVersion => 1;

  // ── Outbox CRUD ──────────────────────────────────────────────────────────────

  Future<void> enqueueSubmission(String id, String payloadJson) {
    return into(syncOutboxTable).insertOnConflictUpdate(
      SyncOutboxTableCompanion.insert(
        id: id,
        submissionPayload: payloadJson,
        createdAt: DateTime.now(),
      ),
    );
  }

  Future<List<SyncOutboxTableData>> getPendingOutbox() {
    return (select(syncOutboxTable)
          ..where((t) => t.status.isIn(['PENDING', 'FAILED']))
          ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
        .get();
  }

  Future<void> markSyncing(String id) {
    return (update(syncOutboxTable)..where((t) => t.id.equals(id))).write(
      SyncOutboxTableCompanion(
        status: const Value('SYNCING'),
        lastTriedAt: Value(DateTime.now()),
      ),
    );
  }

  Future<void> markSynced(String id) {
    return (update(syncOutboxTable)..where((t) => t.id.equals(id))).write(
      const SyncOutboxTableCompanion(status: Value('SYNCED')),
    );
  }

  Future<void> markFailed(String id, String error, int retryCount) {
    return (update(syncOutboxTable)..where((t) => t.id.equals(id))).write(
      SyncOutboxTableCompanion(
        status: const Value('FAILED'),
        errorMessage: Value(error),
        retryCount: Value(retryCount),
        lastTriedAt: Value(DateTime.now()),
      ),
    );
  }

  /// Reset retryCount về 0 cho các item FAILED đã vượt quá limit — dùng khi user bấm "Thử lại"
  Future<void> resetFailedRetryCount() {
    return (update(syncOutboxTable)..where((t) => t.status.equals('FAILED'))).write(
      const SyncOutboxTableCompanion(
        retryCount: Value(0),
        status: Value('PENDING'),
      ),
    );
  }

  Stream<List<SyncOutboxTableData>> watchOutbox() {
    return (select(syncOutboxTable)
          ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
        .watch();
  }

  Future<int> getPendingCount() async {
    final rows = await getPendingOutbox();
    return rows.length;
  }
}
