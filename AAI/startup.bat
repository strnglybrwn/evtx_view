@echo off
REM AAI startup/shutdown script for Windows
REM Usage: startup.bat [start|stop|restart]

setlocal enabledelayedexpansion

set PROJECT_NAME=AAI
set PID_FILE=.aai.pid
set PORT=3000

if "%1"=="" (
  set COMMAND=start
) else (
  set COMMAND=%1
)

if /i "%COMMAND%"=="start" goto start
if /i "%COMMAND%"=="stop" goto stop
if /i "%COMMAND%"=="restart" goto restart
if /i "%COMMAND%"=="status" goto status
goto usage

:start
if exist %PID_FILE% (
  echo Server may already be running. Check with: startup.bat status
)

echo.
echo Installing dependencies...
call npm install
if errorlevel 1 goto error

echo.
echo Launching %PROJECT_NAME% server...
start "AAI Server" cmd /k npm run dev
echo.
echo Server is starting...
echo Open http://localhost:%PORT% in your browser
goto done

:stop
echo Stopping %PROJECT_NAME% server...
for /f %%i in ('tasklist ^| find /c "node"') do set count=%%i
if %count% gtr 0 (
  taskkill /IM node.exe /F
  echo Server stopped
) else (
  echo No Node.js process found
)
if exist %PID_FILE% del %PID_FILE%
goto done

:restart
call :stop
timeout /t 1 /nobreak
call :start
goto done

:status
tasklist | find /i "node.exe" >nul
if errorlevel 1 (
  echo Server is not running
) else (
  echo Server is running
  echo Open http://localhost:%PORT% in your browser
)
goto done

:usage
echo Usage: startup.bat [start^|stop^|restart^|status]
echo.
echo Commands:
echo   start    - Install deps and start the server
echo   stop     - Stop the running server
echo   restart  - Stop and restart the server
echo   status   - Check if server is running
exit /b 1

:error
echo Error occurred during installation
exit /b 1

:done
