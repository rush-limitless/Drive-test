@echo off
echo 🔄 Restarting ADB Framework Server...

REM Kill all Python processes
taskkill /F /IM python.exe >nul 2>&1

REM Wait 2 seconds
timeout /t 2 /nobreak >nul

REM Start the server
echo 🚀 Starting server on port 8007...
python simple-server.py

pause