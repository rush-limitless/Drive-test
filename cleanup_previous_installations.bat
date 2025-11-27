@echo off
echo ========================================
echo  Nettoyage des Installations Precedentes
echo  ADB Framework Telco Automation
echo ========================================
echo.

REM Demander confirmation
set /p confirm="Voulez-vous supprimer toutes les traces des installations precedentes? (y/n): "
if /i not "%confirm%"=="y" (
    echo Operation annulee.
    pause
    exit /b 0
)

echo.
echo Nettoyage en cours...
echo.

REM 1. Arreter tous les processus lies a l'application
echo [1/8] Arret des processus en cours...
taskkill /f /im "ADB Framework Telco Automation.exe" >nul 2>&1
taskkill /f /im "adb-framework-telco-automation.exe" >nul 2>&1
taskkill /f /im "TelcoADBServer.exe" >nul 2>&1
taskkill /f /im "python.exe" /fi "WINDOWTITLE eq *telco*" >nul 2>&1

REM 2. Desinstaller via le registre Windows (si installe)
echo [2/8] Recherche et desinstallation automatique...
for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" /s /f "ADB Framework" 2^>nul ^| findstr "UninstallString"') do (
    echo Desinstallation trouvee: %%b
    "%%b" /S >nul 2>&1
)

REM 3. Supprimer les dossiers d'installation
echo [3/8] Suppression des dossiers d'installation...
if exist "%ProgramFiles%\ADB Framework Telco Automation" (
    echo Suppression: %ProgramFiles%\ADB Framework Telco Automation
    rmdir /s /q "%ProgramFiles%\ADB Framework Telco Automation" >nul 2>&1
)

if exist "%ProgramFiles(x86)%\ADB Framework Telco Automation" (
    echo Suppression: %ProgramFiles(x86)%\ADB Framework Telco Automation
    rmdir /s /q "%ProgramFiles(x86)%\ADB Framework Telco Automation" >nul 2>&1
)

if exist "%LOCALAPPDATA%\ADB Framework Telco Automation" (
    echo Suppression: %LOCALAPPDATA%\ADB Framework Telco Automation
    rmdir /s /q "%LOCALAPPDATA%\ADB Framework Telco Automation" >nul 2>&1
)

if exist "%LOCALAPPDATA%\adb-framework-telco-automation" (
    echo Suppression: %LOCALAPPDATA%\adb-framework-telco-automation
    rmdir /s /q "%LOCALAPPDATA%\adb-framework-telco-automation" >nul 2>&1
)

REM 4. Supprimer les donnees utilisateur
echo [4/8] Suppression des donnees utilisateur...
if exist "%APPDATA%\ADB Framework Telco Automation" (
    echo Suppression: %APPDATA%\ADB Framework Telco Automation
    rmdir /s /q "%APPDATA%\ADB Framework Telco Automation" >nul 2>&1
)

if exist "%APPDATA%\adb-framework-telco-automation" (
    echo Suppression: %APPDATA%\adb-framework-telco-automation
    rmdir /s /q "%APPDATA%\adb-framework-telco-automation" >nul 2>&1
)

REM 5. Supprimer les raccourcis
echo [5/8] Suppression des raccourcis...
del "%USERPROFILE%\Desktop\ADB Framework Telco Automation.lnk" >nul 2>&1
del "%USERPROFILE%\Desktop\Telco ADB Automation.lnk" >nul 2>&1
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\ADB Framework Telco Automation.lnk" >nul 2>&1
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Telco ADB Automation.lnk" >nul 2>&1

REM Supprimer dossier du menu demarrer
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\F2G Telco" (
    rmdir /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\F2G Telco" >nul 2>&1
)

REM 6. Nettoyer le registre
echo [6/8] Nettoyage du registre...
reg delete "HKCU\SOFTWARE\ADB Framework Telco Automation" /f >nul 2>&1
reg delete "HKCU\SOFTWARE\adb-framework-telco-automation" /f >nul 2>&1
reg delete "HKCU\SOFTWARE\F2G Telco" /f >nul 2>&1
reg delete "HKLM\SOFTWARE\ADB Framework Telco Automation" /f >nul 2>&1
reg delete "HKLM\SOFTWARE\adb-framework-telco-automation" /f >nul 2>&1
reg delete "HKLM\SOFTWARE\F2G Telco" /f >nul 2>&1

REM Nettoyer les entrees de desinstallation
for /f "tokens=1" %%a in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" /s /f "ADB Framework" 2^>nul ^| findstr "HKEY"') do (
    reg delete "%%a" /f >nul 2>&1
)

REM 7. Supprimer les associations de fichiers (si presentes)
echo [7/8] Suppression des associations de fichiers...
reg delete "HKCR\.yaml" /v "" /f >nul 2>&1
reg delete "HKCR\telco-adb" /f >nul 2>&1

REM 8. Nettoyer les fichiers temporaires
echo [8/8] Nettoyage des fichiers temporaires...
del "%TEMP%\*telco*" /q >nul 2>&1
del "%TEMP%\*adb-framework*" /q >nul 2>&1

REM Vider le cache Electron
if exist "%APPDATA%\Electron" (
    rmdir /s /q "%APPDATA%\Electron" >nul 2>&1
)

echo.
echo ========================================
echo  Nettoyage Termine !
echo ========================================
echo.
echo Toutes les traces des installations precedentes ont ete supprimees:
echo  - Processus arretes
echo  - Applications desinstallees
echo  - Dossiers supprimes
echo  - Donnees utilisateur effacees
echo  - Raccourcis supprimes
echo  - Registre nettoye
echo  - Associations de fichiers supprimees
echo  - Fichiers temporaires effaces
echo.
echo Vous pouvez maintenant installer la nouvelle version en toute securite.
echo.
echo Redemarrage recommande pour finaliser le nettoyage.
set /p restart="Voulez-vous redemarrer maintenant? (y/n): "
if /i "%restart%"=="y" (
    shutdown /r /t 10 /c "Redemarrage pour finaliser le nettoyage..."
    echo Redemarrage dans 10 secondes...
) else (
    echo Redemarrage annule. Pensez a redemarrer manuellement.
)

echo.
echo Appuyez sur une touche pour fermer...
pause >nul