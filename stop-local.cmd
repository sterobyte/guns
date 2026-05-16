@echo off
setlocal

call :stop_port 3000 backend
call :stop_port 5178 game
call :stop_port 5179 panel

echo GUNS local stack stop requested.
exit /b 0

:stop_port
set "PORT=%~1"
set "NAME=%~2"
set "FOUND="

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  set "FOUND=1"
  echo stopping %NAME% on port %PORT% pid %%P
  taskkill /PID %%P /F >nul 2>nul
)

if not defined FOUND (
  echo %NAME% on port %PORT% is not running
)

exit /b 0
