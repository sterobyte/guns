@echo off
cd /d "%~dp0"

netstat -ano | findstr /R /C:"127\.0\.0\.1:3000 .*LISTENING" >nul
if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('server\index.mjs') -WorkingDirectory '%~dp0' -WindowStyle Hidden"
)

netstat -ano | findstr /R /C:"127\.0\.0\.1:5178 .*LISTENING" >nul
if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('scripts\serve.mjs') -WorkingDirectory '%~dp0' -WindowStyle Hidden"
)

netstat -ano | findstr /R /C:"127\.0\.0\.1:5179 .*LISTENING" >nul
if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('scripts\serve.mjs') -WorkingDirectory '%~dp0..\guns-panel' -WindowStyle Hidden"
)

echo GUNS local stack requested.
echo game:    http://127.0.0.1:5178/
echo backend: http://127.0.0.1:3000/health
echo panel:   http://127.0.0.1:5179/
