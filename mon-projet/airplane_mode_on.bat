@echo off
echo Activating airplane mode on connected device...

REM Check if device is connected
adb devices | findstr "device" >nul
if %errorlevel% neq 0 (
    echo No device connected via ADB
    exit /b 1
)

REM Enable airplane mode
echo Enabling airplane mode...
adb shell settings put global airplane_mode_on 1

REM Broadcast airplane mode change
echo Broadcasting airplane mode change...
adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true

REM Wait and verify
timeout /t 2 /nobreak >nul
echo Verifying airplane mode status...
for /f %%i in ('adb shell settings get global airplane_mode_on') do set AIRPLANE_STATUS=%%i

if "%AIRPLANE_STATUS%"=="1" (
    echo Airplane mode: ENABLED ✓
) else (
    echo Airplane mode: UNKNOWN
)

echo Done.
pause