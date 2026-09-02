// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'local_db.dart';

// ignore_for_file: type=lint
class $SyncOutboxTableTable extends SyncOutboxTable
    with TableInfo<$SyncOutboxTableTable, SyncOutboxTableData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SyncOutboxTableTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _submissionPayloadMeta =
      const VerificationMeta('submissionPayload');
  @override
  late final GeneratedColumn<String> submissionPayload =
      GeneratedColumn<String>('submission_payload', aliasedName, false,
          type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('PENDING'));
  static const VerificationMeta _retryCountMeta =
      const VerificationMeta('retryCount');
  @override
  late final GeneratedColumn<int> retryCount = GeneratedColumn<int>(
      'retry_count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _lastTriedAtMeta =
      const VerificationMeta('lastTriedAt');
  @override
  late final GeneratedColumn<DateTime> lastTriedAt = GeneratedColumn<DateTime>(
      'last_tried_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _errorMessageMeta =
      const VerificationMeta('errorMessage');
  @override
  late final GeneratedColumn<String> errorMessage = GeneratedColumn<String>(
      'error_message', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        submissionPayload,
        status,
        retryCount,
        createdAt,
        lastTriedAt,
        errorMessage
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sync_outbox_table';
  @override
  VerificationContext validateIntegrity(
      Insertable<SyncOutboxTableData> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('submission_payload')) {
      context.handle(
          _submissionPayloadMeta,
          submissionPayload.isAcceptableOrUnknown(
              data['submission_payload']!, _submissionPayloadMeta));
    } else if (isInserting) {
      context.missing(_submissionPayloadMeta);
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    }
    if (data.containsKey('retry_count')) {
      context.handle(
          _retryCountMeta,
          retryCount.isAcceptableOrUnknown(
              data['retry_count']!, _retryCountMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('last_tried_at')) {
      context.handle(
          _lastTriedAtMeta,
          lastTriedAt.isAcceptableOrUnknown(
              data['last_tried_at']!, _lastTriedAtMeta));
    }
    if (data.containsKey('error_message')) {
      context.handle(
          _errorMessageMeta,
          errorMessage.isAcceptableOrUnknown(
              data['error_message']!, _errorMessageMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  SyncOutboxTableData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SyncOutboxTableData(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      submissionPayload: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}submission_payload'])!,
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      retryCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}retry_count'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      lastTriedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}last_tried_at']),
      errorMessage: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}error_message']),
    );
  }

  @override
  $SyncOutboxTableTable createAlias(String alias) {
    return $SyncOutboxTableTable(attachedDatabase, alias);
  }
}

class SyncOutboxTableData extends DataClass
    implements Insertable<SyncOutboxTableData> {
  final String id;
  final String submissionPayload;
  final String status;
  final int retryCount;
  final DateTime createdAt;
  final DateTime? lastTriedAt;
  final String? errorMessage;
  const SyncOutboxTableData(
      {required this.id,
      required this.submissionPayload,
      required this.status,
      required this.retryCount,
      required this.createdAt,
      this.lastTriedAt,
      this.errorMessage});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['submission_payload'] = Variable<String>(submissionPayload);
    map['status'] = Variable<String>(status);
    map['retry_count'] = Variable<int>(retryCount);
    map['created_at'] = Variable<DateTime>(createdAt);
    if (!nullToAbsent || lastTriedAt != null) {
      map['last_tried_at'] = Variable<DateTime>(lastTriedAt);
    }
    if (!nullToAbsent || errorMessage != null) {
      map['error_message'] = Variable<String>(errorMessage);
    }
    return map;
  }

  SyncOutboxTableCompanion toCompanion(bool nullToAbsent) {
    return SyncOutboxTableCompanion(
      id: Value(id),
      submissionPayload: Value(submissionPayload),
      status: Value(status),
      retryCount: Value(retryCount),
      createdAt: Value(createdAt),
      lastTriedAt: lastTriedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastTriedAt),
      errorMessage: errorMessage == null && nullToAbsent
          ? const Value.absent()
          : Value(errorMessage),
    );
  }

  factory SyncOutboxTableData.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SyncOutboxTableData(
      id: serializer.fromJson<String>(json['id']),
      submissionPayload: serializer.fromJson<String>(json['submissionPayload']),
      status: serializer.fromJson<String>(json['status']),
      retryCount: serializer.fromJson<int>(json['retryCount']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      lastTriedAt: serializer.fromJson<DateTime?>(json['lastTriedAt']),
      errorMessage: serializer.fromJson<String?>(json['errorMessage']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'submissionPayload': serializer.toJson<String>(submissionPayload),
      'status': serializer.toJson<String>(status),
      'retryCount': serializer.toJson<int>(retryCount),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'lastTriedAt': serializer.toJson<DateTime?>(lastTriedAt),
      'errorMessage': serializer.toJson<String?>(errorMessage),
    };
  }

  SyncOutboxTableData copyWith(
          {String? id,
          String? submissionPayload,
          String? status,
          int? retryCount,
          DateTime? createdAt,
          Value<DateTime?> lastTriedAt = const Value.absent(),
          Value<String?> errorMessage = const Value.absent()}) =>
      SyncOutboxTableData(
        id: id ?? this.id,
        submissionPayload: submissionPayload ?? this.submissionPayload,
        status: status ?? this.status,
        retryCount: retryCount ?? this.retryCount,
        createdAt: createdAt ?? this.createdAt,
        lastTriedAt: lastTriedAt.present ? lastTriedAt.value : this.lastTriedAt,
        errorMessage:
            errorMessage.present ? errorMessage.value : this.errorMessage,
      );
  SyncOutboxTableData copyWithCompanion(SyncOutboxTableCompanion data) {
    return SyncOutboxTableData(
      id: data.id.present ? data.id.value : this.id,
      submissionPayload: data.submissionPayload.present
          ? data.submissionPayload.value
          : this.submissionPayload,
      status: data.status.present ? data.status.value : this.status,
      retryCount:
          data.retryCount.present ? data.retryCount.value : this.retryCount,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      lastTriedAt:
          data.lastTriedAt.present ? data.lastTriedAt.value : this.lastTriedAt,
      errorMessage: data.errorMessage.present
          ? data.errorMessage.value
          : this.errorMessage,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SyncOutboxTableData(')
          ..write('id: $id, ')
          ..write('submissionPayload: $submissionPayload, ')
          ..write('status: $status, ')
          ..write('retryCount: $retryCount, ')
          ..write('createdAt: $createdAt, ')
          ..write('lastTriedAt: $lastTriedAt, ')
          ..write('errorMessage: $errorMessage')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, submissionPayload, status, retryCount,
      createdAt, lastTriedAt, errorMessage);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SyncOutboxTableData &&
          other.id == this.id &&
          other.submissionPayload == this.submissionPayload &&
          other.status == this.status &&
          other.retryCount == this.retryCount &&
          other.createdAt == this.createdAt &&
          other.lastTriedAt == this.lastTriedAt &&
          other.errorMessage == this.errorMessage);
}

class SyncOutboxTableCompanion extends UpdateCompanion<SyncOutboxTableData> {
  final Value<String> id;
  final Value<String> submissionPayload;
  final Value<String> status;
  final Value<int> retryCount;
  final Value<DateTime> createdAt;
  final Value<DateTime?> lastTriedAt;
  final Value<String?> errorMessage;
  final Value<int> rowid;
  const SyncOutboxTableCompanion({
    this.id = const Value.absent(),
    this.submissionPayload = const Value.absent(),
    this.status = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.lastTriedAt = const Value.absent(),
    this.errorMessage = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SyncOutboxTableCompanion.insert({
    required String id,
    required String submissionPayload,
    this.status = const Value.absent(),
    this.retryCount = const Value.absent(),
    required DateTime createdAt,
    this.lastTriedAt = const Value.absent(),
    this.errorMessage = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        submissionPayload = Value(submissionPayload),
        createdAt = Value(createdAt);
  static Insertable<SyncOutboxTableData> custom({
    Expression<String>? id,
    Expression<String>? submissionPayload,
    Expression<String>? status,
    Expression<int>? retryCount,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? lastTriedAt,
    Expression<String>? errorMessage,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (submissionPayload != null) 'submission_payload': submissionPayload,
      if (status != null) 'status': status,
      if (retryCount != null) 'retry_count': retryCount,
      if (createdAt != null) 'created_at': createdAt,
      if (lastTriedAt != null) 'last_tried_at': lastTriedAt,
      if (errorMessage != null) 'error_message': errorMessage,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SyncOutboxTableCompanion copyWith(
      {Value<String>? id,
      Value<String>? submissionPayload,
      Value<String>? status,
      Value<int>? retryCount,
      Value<DateTime>? createdAt,
      Value<DateTime?>? lastTriedAt,
      Value<String?>? errorMessage,
      Value<int>? rowid}) {
    return SyncOutboxTableCompanion(
      id: id ?? this.id,
      submissionPayload: submissionPayload ?? this.submissionPayload,
      status: status ?? this.status,
      retryCount: retryCount ?? this.retryCount,
      createdAt: createdAt ?? this.createdAt,
      lastTriedAt: lastTriedAt ?? this.lastTriedAt,
      errorMessage: errorMessage ?? this.errorMessage,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (submissionPayload.present) {
      map['submission_payload'] = Variable<String>(submissionPayload.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (retryCount.present) {
      map['retry_count'] = Variable<int>(retryCount.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (lastTriedAt.present) {
      map['last_tried_at'] = Variable<DateTime>(lastTriedAt.value);
    }
    if (errorMessage.present) {
      map['error_message'] = Variable<String>(errorMessage.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SyncOutboxTableCompanion(')
          ..write('id: $id, ')
          ..write('submissionPayload: $submissionPayload, ')
          ..write('status: $status, ')
          ..write('retryCount: $retryCount, ')
          ..write('createdAt: $createdAt, ')
          ..write('lastTriedAt: $lastTriedAt, ')
          ..write('errorMessage: $errorMessage, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$LocalDatabase extends GeneratedDatabase {
  _$LocalDatabase(QueryExecutor e) : super(e);
  $LocalDatabaseManager get managers => $LocalDatabaseManager(this);
  late final $SyncOutboxTableTable syncOutboxTable =
      $SyncOutboxTableTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [syncOutboxTable];
}

typedef $$SyncOutboxTableTableCreateCompanionBuilder = SyncOutboxTableCompanion
    Function({
  required String id,
  required String submissionPayload,
  Value<String> status,
  Value<int> retryCount,
  required DateTime createdAt,
  Value<DateTime?> lastTriedAt,
  Value<String?> errorMessage,
  Value<int> rowid,
});
typedef $$SyncOutboxTableTableUpdateCompanionBuilder = SyncOutboxTableCompanion
    Function({
  Value<String> id,
  Value<String> submissionPayload,
  Value<String> status,
  Value<int> retryCount,
  Value<DateTime> createdAt,
  Value<DateTime?> lastTriedAt,
  Value<String?> errorMessage,
  Value<int> rowid,
});

class $$SyncOutboxTableTableFilterComposer
    extends Composer<_$LocalDatabase, $SyncOutboxTableTable> {
  $$SyncOutboxTableTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get submissionPayload => $composableBuilder(
      column: $table.submissionPayload,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get retryCount => $composableBuilder(
      column: $table.retryCount, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get lastTriedAt => $composableBuilder(
      column: $table.lastTriedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get errorMessage => $composableBuilder(
      column: $table.errorMessage, builder: (column) => ColumnFilters(column));
}

class $$SyncOutboxTableTableOrderingComposer
    extends Composer<_$LocalDatabase, $SyncOutboxTableTable> {
  $$SyncOutboxTableTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get submissionPayload => $composableBuilder(
      column: $table.submissionPayload,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get retryCount => $composableBuilder(
      column: $table.retryCount, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get lastTriedAt => $composableBuilder(
      column: $table.lastTriedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get errorMessage => $composableBuilder(
      column: $table.errorMessage,
      builder: (column) => ColumnOrderings(column));
}

class $$SyncOutboxTableTableAnnotationComposer
    extends Composer<_$LocalDatabase, $SyncOutboxTableTable> {
  $$SyncOutboxTableTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get submissionPayload => $composableBuilder(
      column: $table.submissionPayload, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get retryCount => $composableBuilder(
      column: $table.retryCount, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get lastTriedAt => $composableBuilder(
      column: $table.lastTriedAt, builder: (column) => column);

  GeneratedColumn<String> get errorMessage => $composableBuilder(
      column: $table.errorMessage, builder: (column) => column);
}

class $$SyncOutboxTableTableTableManager extends RootTableManager<
    _$LocalDatabase,
    $SyncOutboxTableTable,
    SyncOutboxTableData,
    $$SyncOutboxTableTableFilterComposer,
    $$SyncOutboxTableTableOrderingComposer,
    $$SyncOutboxTableTableAnnotationComposer,
    $$SyncOutboxTableTableCreateCompanionBuilder,
    $$SyncOutboxTableTableUpdateCompanionBuilder,
    (
      SyncOutboxTableData,
      BaseReferences<_$LocalDatabase, $SyncOutboxTableTable,
          SyncOutboxTableData>
    ),
    SyncOutboxTableData,
    PrefetchHooks Function()> {
  $$SyncOutboxTableTableTableManager(
      _$LocalDatabase db, $SyncOutboxTableTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SyncOutboxTableTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SyncOutboxTableTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SyncOutboxTableTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> submissionPayload = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<int> retryCount = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime?> lastTriedAt = const Value.absent(),
            Value<String?> errorMessage = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              SyncOutboxTableCompanion(
            id: id,
            submissionPayload: submissionPayload,
            status: status,
            retryCount: retryCount,
            createdAt: createdAt,
            lastTriedAt: lastTriedAt,
            errorMessage: errorMessage,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String submissionPayload,
            Value<String> status = const Value.absent(),
            Value<int> retryCount = const Value.absent(),
            required DateTime createdAt,
            Value<DateTime?> lastTriedAt = const Value.absent(),
            Value<String?> errorMessage = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              SyncOutboxTableCompanion.insert(
            id: id,
            submissionPayload: submissionPayload,
            status: status,
            retryCount: retryCount,
            createdAt: createdAt,
            lastTriedAt: lastTriedAt,
            errorMessage: errorMessage,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$SyncOutboxTableTableProcessedTableManager = ProcessedTableManager<
    _$LocalDatabase,
    $SyncOutboxTableTable,
    SyncOutboxTableData,
    $$SyncOutboxTableTableFilterComposer,
    $$SyncOutboxTableTableOrderingComposer,
    $$SyncOutboxTableTableAnnotationComposer,
    $$SyncOutboxTableTableCreateCompanionBuilder,
    $$SyncOutboxTableTableUpdateCompanionBuilder,
    (
      SyncOutboxTableData,
      BaseReferences<_$LocalDatabase, $SyncOutboxTableTable,
          SyncOutboxTableData>
    ),
    SyncOutboxTableData,
    PrefetchHooks Function()>;

class $LocalDatabaseManager {
  final _$LocalDatabase _db;
  $LocalDatabaseManager(this._db);
  $$SyncOutboxTableTableTableManager get syncOutboxTable =>
      $$SyncOutboxTableTableTableManager(_db, _db.syncOutboxTable);
}
