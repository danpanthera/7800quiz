# ============================================================================
# 7800Quiz — Đăng ký tác vụ sao lưu tự động vào Task Scheduler
# Chạy MỘT LẦN với quyền Administrator:
#   powershell -ExecutionPolicy Bypass -File .\scripts\register-backup-task.ps1
# ============================================================================

$ErrorActionPreference = 'Stop'

$thuMucDuAn = Split-Path $PSScriptRoot -Parent
$duongDanScript = Join-Path $PSScriptRoot 'backup-db.ps1'

$hanhDong = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$duongDanScript`"" `
    -WorkingDirectory $thuMucDuAn

$kichHoat = New-ScheduledTaskTrigger -Daily -At 02:00

# Chạy dưới SYSTEM để không phụ thuộc việc có ai đăng nhập hay không.
# ⚠ SYSTEM phải thuộc nhóm "docker-users" mới gọi được Docker CLI.
#   Kiểm tra: net localgroup docker-users
#   Nếu chưa có, dùng một tài khoản dịch vụ thuộc nhóm đó thay cho SYSTEM.
$danhTinh = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

$tuyChon = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -MultipleInstances IgnoreNew `
    -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 10)

Register-ScheduledTask -TaskName '7800Quiz - Sao luu PostgreSQL' `
    -Action $hanhDong -Trigger $kichHoat -Principal $danhTinh -Settings $tuyChon -Force

Write-Host 'Đã đăng ký tác vụ. Chạy thử ngay để xác nhận...' -ForegroundColor Green
Start-ScheduledTask -TaskName '7800Quiz - Sao luu PostgreSQL'
Start-Sleep -Seconds 30
Get-Content 'C:\7800quiz-backup\backup.log' -Tail 20
