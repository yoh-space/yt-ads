$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Write-Host "========================================================"
Write-Host "Starting YT Advertisements x64 Windows Desktop Build"
Write-Host "========================================================"

Set-Location C:\Users\quant\yt-ads

# 1. Clean macOS AppleDouble metadata files
Get-ChildItem -Path C:\Users\quant\yt-ads -Recurse -Force -File -Filter "._*" -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue

# 2. Import Visual Studio MSVC x64 Build Environment
$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
$installationPath = (& $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1).Trim()
if (-not $installationPath) {
    throw "Visual Studio Build Tools is missing the Desktop development with C++ workload."
}

$developerCommand = Join-Path $installationPath "Common7\Tools\VsDevCmd.bat"
$env:VSCMD_SKIP_SENDTELEMETRY = "1"
$environmentLines = & cmd.exe /s /c "`"$developerCommand`" -arch=x64 -host_arch=x64 >nul && set"
if ($LASTEXITCODE -ne 0) {
    throw "Visual Studio's x64 developer environment could not be initialized."
}

foreach ($line in $environmentLines) {
    $separator = $line.IndexOf("=")
    if ($separator -gt 0) {
        Set-Item -Path "Env:$($line.Substring(0, $separator))" -Value $line.Substring($separator + 1)
    }
}

# 3. Configure Node x64, WiX, and Rust x64 Toolchain
$developerProfile = "C:\Users\quant"
$nodeRoot = "C:\Users\quant\Tools\node-v24.19.0-win-x64"
$env:CARGO_HOME = Join-Path $developerProfile ".cargo"
$env:RUSTUP_HOME = Join-Path $developerProfile ".rustup"
$wixPath = "C:\Users\quant\AppData\Local\tauri\WixTools314"
$env:Path = "$nodeRoot;$wixPath;$(Join-Path $env:CARGO_HOME 'bin');$env:Path"
$env:RUSTUP_TOOLCHAIN = "stable-x86_64-pc-windows-msvc"
$env:CARGO_BUILD_TARGET = "x86_64-pc-windows-msvc"

Write-Host "Node:   $(node --version) ($(node -p 'process.arch'))"
Write-Host "Cargo:  $(cargo --version)"
Write-Host "Rust:   $(rustc --version)"
Write-Host "Linker: $((Get-Command link.exe).Source)"

# 4. Execute Tauri Build targeting x86_64
Write-Host "Running pnpm tauri build --target x86_64-pc-windows-msvc..."
& pnpm tauri build --target x86_64-pc-windows-msvc

if ($LASTEXITCODE -ne 0) {
    throw "Tauri x64 build failed with exit code $LASTEXITCODE"
}

Write-Host "========================================================"
Write-Host "WINDOWS X64 DESKTOP BUILD SUCCEEDED!"
Write-Host "========================================================"
