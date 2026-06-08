# uninstall-service.ps1
# Chuc nang: Go bo Windows Terminal Control Center khoi danh sach Windows Service.
# Yeu cau chay voi quyen Administrator.

$ErrorActionPreference = 'Stop'

# Kiem tra quyen Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "LOI: Hay chay PowerShell as Administrator de go bo service." -ForegroundColor Red
    exit 1
}

$serviceName = 'WindowsTerminalControlCenter'

# Dung service (bo qua loi neu service khong chay)
try {
    nssm stop $serviceName
} catch {
    # Service co the da dung hoac khong ton tai, bo qua
}

# Go bo service
nssm remove $serviceName confirm

Write-Host ""
Write-Host "Service '$serviceName' da duoc go bo thanh cong." -ForegroundColor Green
