@echo off
echo ========================================================
echo Starting x64 Desktop Build for YT Advertisements
echo ========================================================
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" x64
set "PATH=C:\Users\quant\AppData\Local\tauri\WixTools314;%PATH%"
cd /d C:\Users\quant\yt-ads
echo.
echo Running pnpm tauri build --target x86_64-pc-windows-msvc...
call pnpm tauri build --target x86_64-pc-windows-msvc
echo.
echo Build finished with exit code: %ERRORLEVEL%
