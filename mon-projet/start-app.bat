@echo off
echo Demarrage de l'application ADB Framework...

REM Demarrer le backend
echo Demarrage du backend...
cd /d "C:\Users\rush\Pictures\ADB Tool\ADB-automation-tool\mon-projet\src\backend"
REM Utilise la venv locale si disponible, sinon fallback sur python du PATH
if exist "..\\..\\.venv\\Scripts\\python.exe" (
    start "Backend" "..\\..\\.venv\\Scripts\\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8007
) else (
    start "Backend" python -m uvicorn main:app --host 127.0.0.1 --port 8007
)

REM Attendre que le backend demarre
echo Attente du demarrage du backend...
timeout /t 5 /nobreak

REM Ouvrir l'application dans le navigateur par defaut
echo Ouverture de l'application...
start http://localhost:8007

echo Application demarree! Appuyez sur une touche pour fermer ce script.
pause
