# ============================================================================
# 7800Quiz — Sao lưu PostgreSQL tự động (Windows Server)
#
# Chạy tay:       powershell -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1
# Đặt lịch:       xem scripts\register-backup-task.ps1
#
# ⚠ KỸ THUẬT QUAN TRỌNG: KHÔNG dùng `docker exec ... pg_dump > file.dump`.
#   PowerShell mã hoá lại luồng chuyển hướng sang UTF-16LE và chèn CRLF, làm
#   HỎNG hoàn toàn file dump nhị phân — và chỉ phát hiện ra đúng lúc cần phục
#   hồi. Cách an toàn: pg_dump ghi ra file BÊN TRONG container rồi `docker cp`
#   mang ra ngoài, vì docker cp truyền nhị phân nguyên vẹn.
#
# ⚠ Bản sao lưu chứa dữ liệu nhân sự thật (CCCD, ngày sinh, số điện thoại) nên
#   thư mục lưu phải nằm trong phạm vi kiểm soát truy cập của ngân hàng.
# ============================================================================
[CmdletBinding()]
param(
    [string]$BackupDir           = 'C:\7800quiz-backup',
    [string]$Container           = 'quiz7800_db',
    [int]   $RetainDays          = 14,  # giữ bản hằng ngày trong 14 ngày
    [int]   $RetainMonthlyMonths = 12   # giữ bản ngày mùng 1 trong 12 tháng
)

$ErrorActionPreference = 'Stop'

$nhan      = Get-Date -Format 'yyyy-MM-dd_HHmm'
$laDauThang = (Get-Date).Day -eq 1
$tienTo    = if ($laDauThang) { 'monthly_quiz7800' } else { 'quiz7800' }
$tenFile   = "${tienTo}_${nhan}.dump"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$fileLog = Join-Path $BackupDir 'backup.log'

function Ghi-Log([string]$noiDung) {
    $dong = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $noiDung
    Write-Host $dong
    Add-Content -Path $fileLog -Value $dong -Encoding UTF8
}

try {
    Ghi-Log '=== Bắt đầu sao lưu ==='

    # Đọc user/DB từ chính container để khỏi phải nhân bản cấu hình từ .env.prod
    $pgUser = (docker exec $Container printenv POSTGRES_USER).Trim()
    $pgDb   = (docker exec $Container printenv POSTGRES_DB).Trim()
    if ([string]::IsNullOrWhiteSpace($pgUser)) {
        throw "Không đọc được POSTGRES_USER từ container $Container"
    }
    Ghi-Log "User=$pgUser  DB=$pgDb"

    $fileTrongContainer = "/tmp/$tenFile"

    # -Fc = định dạng custom (đã nén sẵn, phục hồi chọn lọc được bằng pg_restore)
    # --no-owner giúp phục hồi sang cụm máy chủ khác dễ hơn
    docker exec $Container pg_dump -U $pgUser -d $pgDb -Fc -Z 6 --no-owner -f $fileTrongContainer
    if ($LASTEXITCODE -ne 0) { throw "pg_dump thất bại (mã lỗi $LASTEXITCODE)" }

    $fileDich = Join-Path $BackupDir $tenFile
    docker cp "${Container}:${fileTrongContainer}" $fileDich
    if ($LASTEXITCODE -ne 0) { throw 'Không sao chép được file sao lưu ra khỏi container' }

    docker exec $Container rm -f $fileTrongContainer | Out-Null

    # Kiểm tra tính hợp lệ: file phải tồn tại, đủ lớn và pg_restore đọc được mục lục
    $thongTin = Get-Item $fileDich
    if ($thongTin.Length -lt 10KB) {
        throw "File sao lưu quá nhỏ ($($thongTin.Length) byte) — nghi ngờ bị hỏng"
    }

    docker cp $fileDich "${Container}:/tmp/verify.dump" | Out-Null
    docker exec $Container pg_restore --list /tmp/verify.dump > $null 2>&1
    $hopLe = ($LASTEXITCODE -eq 0)
    docker exec $Container rm -f /tmp/verify.dump | Out-Null
    if (-not $hopLe) { throw 'pg_restore --list không đọc được file — FILE HỎNG' }

    Ghi-Log ('OK: {0} ({1:N2} MB) — đã xác minh bằng pg_restore --list' -f $tenFile, ($thongTin.Length / 1MB))

    # ── Dọn theo chính sách lưu trữ ────────────────────────────────────────
    Get-ChildItem $BackupDir -Filter 'quiz7800_*.dump' |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetainDays) } |
        ForEach-Object { Ghi-Log "Xoá bản cũ: $($_.Name)"; Remove-Item $_.FullName -Force }

    Get-ChildItem $BackupDir -Filter 'monthly_quiz7800_*.dump' |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddMonths(-$RetainMonthlyMonths) } |
        ForEach-Object { Ghi-Log "Xoá bản tháng cũ: $($_.Name)"; Remove-Item $_.FullName -Force }

    # ── Sao chép ra kho ngoài ──────────────────────────────────────────────
    # Bản sao lưu nằm cùng máy chủ thì chưa phải là bản sao lưu. Bỏ chú thích
    # và điền đường dẫn kho lưu trữ của ngân hàng:
    # $khoNgoai = '\\fileserver\backup\7800quiz'
    # Copy-Item $fileDich -Destination $khoNgoai -Force
    # Ghi-Log "Đã sao chép sang $khoNgoai"

    Ghi-Log '=== Hoàn tất ==='
    exit 0
}
catch {
    Ghi-Log "LỖI: $($_.Exception.Message)"
    # Ghi vào Event Log để hệ thống giám sát của phòng CNTT bắt được
    try {
        if (-not [System.Diagnostics.EventLog]::SourceExists('7800Quiz')) {
            New-EventLog -LogName Application -Source '7800Quiz'
        }
        Write-EventLog -LogName Application -Source '7800Quiz' -EntryType Error `
                       -EventId 7801 -Message "Sao lưu 7800Quiz thất bại: $($_.Exception.Message)"
    } catch { }
    exit 1
}
