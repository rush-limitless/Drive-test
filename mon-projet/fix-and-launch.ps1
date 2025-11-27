# Correction et lancement rapide
Write-Host "Installation de pydantic-settings..." -ForegroundColor Yellow
cd src\backend
pip install pydantic-settings

Write-Host "Lancement du serveur..." -ForegroundColor Green
Write-Host "Interface: http://localhost:8000" -ForegroundColor Cyan

python main.py