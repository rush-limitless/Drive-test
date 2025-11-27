@echo off
echo Checking device status...

REM Get connected device ID
for /f "tokens=1" %%i in ('adb devices ^| findstr "device" ^| findstr /v "List"') do set DEVICE_ID=%%i

if "%DEVICE_ID%"=="" (
    echo No device connected via ADB
    exit /b 1
)

echo Device ID: %DEVICE_ID%
echo ==================================================

echo 1. GSM Network Type:
adb -s %DEVICE_ID% shell getprop gsm.network.type

echo.
echo 2. Data Network Type:
adb -s %DEVICE_ID% shell dumpsys telephony.registry | findstr /i "mDataNetworkType"

echo.
echo 3. Battery Level:
adb -s %DEVICE_ID% shell dumpsys battery | findstr /i "level"

echo.
echo Done.
pause