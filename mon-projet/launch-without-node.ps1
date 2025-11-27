# Lancement de l'application sans Node.js (backend seulement)
Write-Host "=== LANCEMENT BACKEND SEULEMENT ===" -ForegroundColor Cyan

# Installation des dépendances Python
Write-Host "Installation des dépendances Python..." -ForegroundColor Yellow
cd src\backend
pip install -r requirements.txt

# Lancement du backend
Write-Host "Lancement du backend FastAPI..." -ForegroundColor Green
Write-Host "API disponible sur: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Documentation: http://localhost:8000/docs" -ForegroundColor Cyan

python main.py