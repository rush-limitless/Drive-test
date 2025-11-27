@echo off
echo ========================================
echo  BUILD LINUX - ADB Framework
echo ========================================
echo.

echo [1/3] Preparation de l'environnement WSL...
wsl --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERREUR: WSL n'est pas installe ou configure
    echo Installez WSL avec: wsl --install
    pause
    exit /b 1
)

echo [2/3] Copie des fichiers vers WSL...
wsl cp -r "/mnt/c/Users/rush/Pictures/ADB Tool/ADB-automation-tool/mon-projet" ~/adb-project/

echo [3/3] Build Linux dans WSL...
wsl bash -c "cd ~/adb-project/src/electron && npm install && npm run build && npm run dist:linux"

echo.
echo ========================================
echo  BUILD LINUX TERMINE
echo ========================================
echo Les fichiers Linux sont dans WSL: ~/adb-project/build/electron/
echo Pour les recuperer: wsl cp ~/adb-project/build/electron/*.AppImage /mnt/c/temp/
echo.
pause