# Lancement de l'interface utilisateur
Write-Host "=== LANCEMENT TELCO ADB AUTOMATION UI ===" -ForegroundColor Cyan

# Installation des dépendances Python
Write-Host "Installation des dépendances..." -ForegroundColor Yellow
cd src\backend
pip install fastapi uvicorn python-multipart

# Lancement du serveur
Write-Host "Démarrage du serveur..." -ForegroundColor Green
Write-Host "Interface web: http://localhost:8000" -ForegroundColor Cyan
Write-Host "API documentation: http://localhost:8000/docs" -ForegroundColor Cyan

python main.py