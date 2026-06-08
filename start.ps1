# start.ps1
# Chuc nang: Script khoi dong thu cong cho Windows Terminal Control Center.
# Kiem tra moi truong (Node.js), cai dat dependencies neu can, va chay server.

$ErrorActionPreference = 'Stop'

# Chuyen ve thu muc chua script
Set-Location $PSScriptRoot

# Kiem tra Node.js co trong PATH khong
try {
    $null = Get-Command node
} catch {
    Write-Host "LOI: Khong tim thay 'node' trong PATH." -ForegroundColor Red
    Write-Host "Vui long cai dat Node.js phien ban 18 tro len tu https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "Sau khi cai dat, dong PowerShell va mo lai de cap nhat PATH."
    exit 1
}

# In phien ban Node.js
$nodeVersion = node --version
Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green

# Cai dat dependencies neu chua co node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "Thu muc node_modules chua ton tai. Dang chay 'npm install'..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "LUU Y: node-pty can Visual Studio Build Tools hoac prebuilt binaries." -ForegroundColor Yellow
    Write-Host "Neu gap loi build native module, hay cai dat mot trong cac cach sau:" -ForegroundColor Yellow
    Write-Host "  1. Visual Studio Build Tools voi C++ workload" -ForegroundColor Yellow
    Write-Host "  2. npm install --global windows-build-tools (chay voi quyen Admin)" -ForegroundColor Yellow
    Write-Host ""
    npm install
}

# Tao config.json tu config.example.json neu chua co
if (-not (Test-Path "config.json")) {
    Copy-Item "config.example.json" "config.json"
    Write-Host "Da tao config.json tu config.example.json. Hay chinh sua theo nhu cau." -ForegroundColor Cyan
}

# Khoi dong server
Write-Host "Dang khoi dong WTCC server..." -ForegroundColor Green
node src/server.js
