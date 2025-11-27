@echo off
echo ========================================
echo  NETTOYAGE COMPLET - ADB Framework
echo ========================================
echo.

:: Arrêter tous les processus
echo [1/8] Arrêt des processus...
taskkill /f /im "ADB Framework Telco Automation.exe" 2>nul
taskkill /f /im "adb-framework-telco-automation.exe" 2>nul
taskkill /f /im electron.exe 2>nul

:: Désinstaller via registre
echo [2/8] Désinstallation via registre...
for /f "tokens=1* delims=" %%a in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" /s /f "ADB Framework" 2^>nul ^| findstr "HKEY"') do (
    for /f "tokens=2*" %%c in ('reg query "%%a" /v UninstallString 2^>nul ^| findstr "UninstallString"') do (
        echo Exécution: %%d /S
        "%%d" /S
    )
)

:: Supprimer dossiers d'installation
echo [3/8] Suppression des dossiers d'installation...
rmdir /s /q "%ProgramFiles%\ADB Framework Telco Automation" 2>nul
rmdir /s /q "%ProgramFiles(x86)%\ADB Framework Telco Automation" 2>nul
rmdir /s /q "%LocalAppData%\Programs\ADB Framework Telco Automation" 2>nul

:: Supprimer données utilisateur
echo [4/8] Suppression des données utilisateur...
rmdir /s /q "%AppData%\ADB Framework Telco Automation" 2>nul
rmdir /s /q "%LocalAppData%\ADB Framework Telco Automation" 2>nul
rmdir /s /q "%AppData%\adb-framework-telco-automation" 2>nul
rmdir /s /q "%LocalAppData%\adb-framework-telco-automation" 2>nul

:: Supprimer raccourcis
echo [5/8] Suppression des raccourcis...
del "%Public%\Desktop\ADB Framework Telco Automation.lnk" 2>nul
del "%AppData%\Microsoft\Windows\Start Menu\Programs\ADB Framework Telco Automation.lnk" 2>nul
rmdir /s /q "%AppData%\Microsoft\Windows\Start Menu\Programs\ADB Framework Telco Automation" 2>nul

:: Nettoyer registre
echo [6/8] Nettoyage du registre...
reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\ADB Framework Telco Automation" /f 2>nul
reg delete "HKLM\SOFTWARE\ADB Framework Telco Automation" /f 2>nul
reg delete "HKCU\SOFTWARE\ADB Framework Telco Automation" /f 2>nul
reg delete "HKLM\SOFTWARE\Classes\adb-framework-telco-automation" /f 2>nul

:: Supprimer associations de fichiers
echo [7/8] Suppression des associations de fichiers...
reg delete "HKLM\SOFTWARE\Classes\.adb" /f 2>nul
reg delete "HKLM\SOFTWARE\Classes\adb-framework-file" /f 2>nul

:: Nettoyer fichiers temporaires
echo [8/8] Nettoyage des fichiers temporaires...
del "%TEMP%\*adb-framework*" /q 2>nul
del "%TEMP%\*ADB Framework*" /q 2>nul

echo.
echo ========================================
echo  NETTOYAGE TERMINÉ
echo ========================================
echo Toutes les traces ont été supprimées.
echo Redémarrage recommandé.
echo.
pause