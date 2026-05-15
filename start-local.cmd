@echo off
cd /d "%~dp0"

netstat -ano | findstr /R /C:"127\.0\.0\.1:3000 .*LISTENING" >nul
if errorlevel 1 (
  start "GUNS backend" /min cmd /k "cd /d %~dp0 && backend-loop.cmd"
)

netstat -ano | findstr /R /C:"127\.0\.0\.1:5178 .*LISTENING" >nul
if errorlevel 1 (
  start "GUNS game" /min cmd /k "cd /d %~dp0 && node scripts\serve.mjs"
)

netstat -ano | findstr /R /C:"127\.0\.0\.1:5179 .*LISTENING" >nul
if errorlevel 1 (
  start "GUNS panel" /min cmd /k "cd /d %~dp0..\guns-panel && node scripts\serve.mjs"
)

echo GUNS local stack requested.
echo game:    http://127.0.0.1:5178/
echo backend: http://127.0.0.1:3000/health
echo panel:   http://127.0.0.1:5179/
