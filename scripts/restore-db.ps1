# ============================================================================
# 7800Quiz — Phục hồi PostgreSQL từ bản sao lưu
#
# ⚠ THAO TÁC PHÁ HUỶ: xoá sạch dữ liệu hiện tại rồi nạp lại từ file dump.
#
# Trước khi chạy, dừng ứng dụng (giữ Postgres chạy):
#   docker compose -f docker-compose.prod.yml stop api web
# Sau khi xong:
#   docker compose -f docker-compose.prod.yml up -d
#
# Dùng:
#   powershell -ExecutionPolicy Bypass -File .\scripts\restore-db.ps1 `
#              -DumpFile C:\7800quiz-backup\quiz7800_2026-09-05_0200.dump
# ============================================================================
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$DumpFile,
    [string]$Container = 'quiz7800_db'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $DumpFile)) { throw "Không tìm thấy file: $DumpFile" }

$pgUser = (docker exec $Container printenv POSTGRES_USER).Trim()
$pgDb   = (docker exec $Container printenv POSTGRES_DB).Trim()

Write-Host "Sẽ GHI ĐÈ toàn bộ cơ sở dữ liệu '$pgDb' trong container '$Container'" -ForegroundColor Red
Write-Host "Nguồn: $DumpFile"
$traLoi = Read-Host "Gõ chính xác YES để tiếp tục"
if ($traLoi -ne 'YES') { Write-Host 'Đã huỷ.'; exit 1 }

# Chốt chặn cuối: chụp lại trạng thái hiện tại trước khi ghi đè
$anhChup = "/tmp/pre_restore_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
docker exec $Container pg_dump -U $pgUser -d $pgDb -Fc -f $anhChup
docker cp "${Container}:${anhChup}" (Join-Path (Split-Path $DumpFile) 'pre_restore_safety.dump')
docker exec $Container rm -f $anhChup | Out-Null
Write-Host 'Đã lưu ảnh chụp an toàn: pre_restore_safety.dump' -ForegroundColor Yellow

docker cp $DumpFile "${Container}:/tmp/restore.dump"

# --clean --if-exists xoá đối tượng cũ trước khi tạo lại; nhờ đó bảng
# _prisma_migrations cũng về đúng trạng thái của bản dump, khớp với mã nguồn
# được đưa về cùng thời điểm.
docker exec $Container pg_restore -U $pgUser -d $pgDb --clean --if-exists --no-owner -v /tmp/restore.dump
docker exec $Container rm -f /tmp/restore.dump | Out-Null

Write-Host 'Phục hồi xong. Chạy tiếp:' -ForegroundColor Green
Write-Host '  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d'
