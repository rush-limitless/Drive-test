@echo off
echo Building signed executable for F2G Solutions Inc...

REM Définir les variables d'environnement pour la signature
set CSC_LINK=f2g-codesign.pfx
set CSC_KEY_PASSWORD=YourPassword123

REM Construire l'application
cd mon-projet\src\electron
npm run dist

echo Build terminé avec signature F2G Solutions Inc.
pause