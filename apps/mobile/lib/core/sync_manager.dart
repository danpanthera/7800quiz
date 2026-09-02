import 'dart:async';
import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'local_db.dart';
import 'api_client.dart';
import '../features/achievement/gamification_provider.dart';

// ─── Trạng thái sync ─────────────────────────────────────────────────────────

enum SyncStatus { idle, syncing, done, error }

class SyncState {
  final SyncStatus status;
  final int pendingCount;
  final String? lastError;

  const SyncState({
    this.status = SyncStatus.idle,
    this.pendingCount = 0,
    this.lastError,
  });

  SyncState copyWith({SyncStatus? status, int? pendingCount, String? lastError}) {
    return SyncState(
      status: status ?? this.status,
      pendingCount: pendingCount ?? this.pendingCount,
      lastError: lastError ?? this.lastError,
    );
  }
}

// ─── Sync Manager ─────────────────────────────────────────────────────────────

class SyncManager extends StateNotifier<SyncState> {
  final Ref _ref;
  final LocalDatabase _db;
  Timer? _retryTimer;
  StreamSubscription? _connectivitySub;

  static const int _maxRetry = 5;
  static const Duration _retryInterval = Duration(minutes: 2);

  SyncManager(this._ref, this._db) : super(const SyncState()) {
    _init();
  }

  Future<void> _init() async {
    // Cập nhật pending count ban đầu
    final count = await _db.getPendingCount();
    state = state.copyWith(pendingCount: count);

    // Lắng nghe kết nối mạng — sync ngay khi có mạng
    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      final hasNet = results.any((r) => r != ConnectivityResult.none);
      if (hasNet) sync();
    });

    // Retry timer định kỳ
    _retryTimer = Timer.periodic(_retryInterval, (_) => sync());

    // Sync lần đầu khi khởi động
    sync();
  }

  // ── Enqueue submission ──────────────────────────────────────────────────────

  Future<void> enqueue(Map<String, dynamic> payload) async {
    final id = payload['id'] as String;
    await _db.enqueueSubmission(id, jsonEncode(payload));
    state = state.copyWith(pendingCount: state.pendingCount + 1);
    sync(); // thử sync ngay
  }

  // ── Sync loop ───────────────────────────────────────────────────────────────

  Future<void> sync({bool force = false}) async {
    if (state.status == SyncStatus.syncing) return;

    // Nếu force (bấm "Thử lại"), reset retryCount cho các item bị vượt quá limit
    if (force) {
      await _db.resetFailedRetryCount();
    }

    final pending = await _db.getPendingOutbox();
    if (pending.isEmpty) {
      state = state.copyWith(status: SyncStatus.idle, pendingCount: 0);
      return;
    }

    // Kiểm tra có mạng không
    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity.every((r) => r == ConnectivityResult.none)) {
      state = state.copyWith(pendingCount: pending.length);
      return;
    }

    state = state.copyWith(status: SyncStatus.syncing);

    final dio = _ref.read(dioProvider);

    for (final item in pending) {
      if (item.retryCount >= _maxRetry) continue; // bỏ qua nếu quá retry

      await _db.markSyncing(item.id);

      try {
        final payload = jsonDecode(item.submissionPayload) as Map<String, dynamic>;
        final res = await dio.post('/submissions', data: payload);
        await _db.markSynced(item.id);
        // Capture gamification result nếu có levelUp
        final resData = res.data as Map<String, dynamic>?;
        if (resData != null && resData['levelUp'] == true) {
          _ref.read(gamificationEventProvider.notifier).state = resData;
        }
      } on DioException catch (e) {
        final statusCode = e.response?.statusCode ?? 0;
        // 409 Conflict = đã nộp rồi (idempotent) → coi như thành công
        if (statusCode == 409) {
          await _db.markSynced(item.id);
        } else {
          await _db.markFailed(
            item.id,
            e.message ?? 'Unknown error',
            item.retryCount + 1,
          );
        }
      } catch (e) {
        await _db.markFailed(item.id, e.toString(), item.retryCount + 1);
      }
    }

    final remaining = await _db.getPendingCount();
    state = state.copyWith(
      status: remaining == 0 ? SyncStatus.done : SyncStatus.error,
      pendingCount: remaining,
      lastError: remaining > 0 ? 'Còn $remaining bài chờ đồng bộ' : null,
    );
  }

  @override
  void dispose() {
    _retryTimer?.cancel();
    _connectivitySub?.cancel();
    super.dispose();
  }
}

// ─── Providers ───────────────────────────────────────────────────────────────

final localDbProvider = Provider<LocalDatabase>((ref) {
  final db = LocalDatabase();
  ref.onDispose(db.close);
  return db;
});

final syncManagerProvider = StateNotifierProvider<SyncManager, SyncState>((ref) {
  final db = ref.watch(localDbProvider);
  return SyncManager(ref, db);
});
