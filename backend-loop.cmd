@echo off
cd /d "%~dp0"

:loop
echo [%date% %time%] starting backend >> backend.log
node server\index.mjs >> backend.log 2>> backend.err.log
echo [%date% %time%] backend stopped with code %ERRORLEVEL% >> backend.err.log
timeout /t 2 /nobreak >nul
goto loop
