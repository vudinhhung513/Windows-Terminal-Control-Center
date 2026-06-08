# install-service.ps1
# Chuc nang: Cai dat Windows Terminal Control Center lam Windows Service thong qua nssm.
# Yeu cau chay voi quyen Administrator.

$ErrorActionPreference = 'Stop'

# Kiem tra quyen Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "LOI: Hay chay PowerShell as Administrator de cai dat service." -ForegroundColor Red
    exit 1
}

# Kiem tra nssm co trong PATH khong
try {
    $null = Get-Command nssm
} catch {
    Write-Host "LOI: Khong tim thay 'nssm' trong PATH." -ForegroundColor Red
    Write-Host "Vui long tai nssm tu https://nssm.cc va them vao PATH." -ForegroundColor Yellow
    Write-Host "Sau khi cai dat, dong PowerShell va mo lai de cap nhat PATH."
    exit 1
}

# Cau hinh service
$serviceName = 'WindowsTerminalControlCenter'
$nodeExe = (Get-Command node).Source
$appPath = Join-Path $PSScriptRoot 'src\server.js'

# Cai dat service bang nssm
Write-Host "Dang cai dat service '$serviceName'..." -ForegroundColor Cyan

nssm install $serviceName $nodeExe $appPath
nssm set $serviceName AppDirectory $PSScriptRoot
nssm set $serviceName AppEnvironmentExtra "WTCC_SERVICE=1"
nssm set $serviceName Start SERVICE_AUTO_START
nssm set $serviceName AppExit Default Restart

# Khoi dong service
nssm start $serviceName

Write-Host ""
Write-Host "Service '$serviceName' da duoc cai dat va khoi dong thanh cong!" -ForegroundColor Green
Write-Host ""
Write-Host "Quan ly service:" -ForegroundColor Cyan
Write-Host "  nssm status $serviceName    - Xem trang thai"
Write-Host "  nssm stop $serviceName      - Dung service"
Write-Host "  nssm restart $serviceName   - Khoi dong lai"
Write-Host ""
Write-Host "Xem log: Windows Event Viewer, hoac cau hinh duong dan log:" -ForegroundColor Cyan
Write-Host "  nssm set $serviceName AppStdout C:\path\to\stdout.log"
Write-Host "  nssm set $serviceName AppStderr C:\path\to\stderr.log"
