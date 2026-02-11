@echo off
setlocal enabledelayedexpansion

:: 1. Figure out where we are
set "ROOT_PATH=%~dp0"
set "ROOT_PATH=%ROOT_PATH:~0,-1%"
set "RUN_DIR=%ROOT_PATH%\.run"
set "LOG_FILE=%RUN_DIR%\launcher.log"

:: 2. Make sure the folder exists
if not exist "%RUN_DIR%" mkdir "%RUN_DIR%"

:: 3. Stop the "Frontend" and "Backend" using PID files
call :StopService "frontend" "%RUN_DIR%\frontend.pid"
call :StopService "backend" "%RUN_DIR%\backend.pid"

:: 4. Stop other leftover processes using PowerShell (No more WMIC!)
call :StopOrphanProjectProcesses

echo Cleanup complete.
pause
exit /b

:: --- THE TOOLS ---

:StopService
set "NAME=%~1"
set "PID_PATH=%~2"
if not exist "%PID_PATH%" exit /b

set /p PID=<"%PID_PATH%"
if "%PID%"=="" (
    del "%PID_PATH%" /q
    exit /b
)

taskkill /PID %PID% /T /F >nul 2>&1
if %errorlevel% equ 0 (
    call :AppendLog "Stopped %NAME% (PID %PID%)."
) else (
    call :AppendLog "%NAME% process %PID% was already stopped."
)
del "%PID_PATH%" /q
exit /b

:AppendLog
echo %DATE% %TIME% ^| %~1 >> "%LOG_FILE%"
exit /b

:StopOrphanProjectProcesses
:: We use PowerShell to find processes where the 'Path' contains our project folder
set "PROC_NAMES='cmd', 'node', 'java', 'esbuild'"
for /f "tokens=*" %%A in ('powershell -NoProfile -Command "Get-Process | Where-Object { ($_.Name -in %PROC_NAMES%) -and ($_.Path -like '*%ROOT_PATH%*') } | Select-Object -ExpandProperty Id"') do (
    taskkill /PID %%A /T /F >nul 2>&1
    call :AppendLog "Stopped orphan process (PID %%A)."
)
exit /b