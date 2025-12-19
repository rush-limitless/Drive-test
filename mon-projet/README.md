# Telco ADB Automation Framework

<div align="center">
    <h3><em>Full telecom automation toolkit powered by ADB</em></h3>
    <p><strong>29 test modules • Modern web/Electron UI • Multi-device orchestration • Spec-driven development</strong></p>
</div>

---

## 🚀 Quick Start

```bash
# Start the FastAPI backend
python simple-server.py

# Open the dashboard
http://localhost:8003
```

### First Call Test
1. Connect your Android phone via USB and enable USB debugging.
2. Visit the dashboard → **Test Modules** → **Call Test** → **▶ Run Test**.
3. Provide phone number, duration, and number of attempts.
4. Track progress live on the dashboard or via the Electron shell (see below).

---

## 🖥️ Electron Desktop Setup

Detailed steps to install every dependency, build the bundles, and run the Electron shell.

### Prerequisites
- Python **3.11+** with `pip`
- Node.js **18+** (npm 9+)
- Git + terminal (PowerShell on Windows, bash/zsh on macOS/Linux)
- ADB in `PATH`, Android device with USB debugging enabled

### 1. Clone & create a virtual environment
```bash
git clone <repo-url>
cd mon-projet
python -m venv .venv

.\.venv\Scripts\activate        # PowerShell
source .venv/bin/activate       # macOS/Linux
```

### 2. Install backend dependencies
```bash
pip install --upgrade pip
pip install -r src/backend/requirements.txt
```

### 3. Install Node packages
```bash
npm install                     # root / Electron wrapper
cd src/frontend && npm install  # React dashboard
cd ../src/electron && npm install
```

### 4. Build the frontend & copy static assets
```bash
cd ../frontend
npm run build
..\scripts\deploy-frontend.ps1   # Windows helper
# or manually copy build/* into src/backend/static/
```

### 5. Build the Electron main process
```bash
cd ../electron
npm run build
```

### 6. Start the FastAPI backend
```bash
cd ../..
$env:PYTHONPATH = "$PWD\src;$PWD\src\backend"   # PowerShell
python simple-server.py
# macOS/Linux:
# export PYTHONPATH="$PWD/src:$PWD/src/backend"
# python simple-server.py
```
Leave this terminal running; it serves both the API and the static dashboard.

### Multi-device backend (parallel mode)

Pour déclencher des modules sur plusieurs téléphones *en parallèle* (start RF logging, workflows, etc.), utilise le script PowerShell qui lance `uvicorn` avec des workers simultanés et les logs d’accès :

```powershell
cd mon-projet
.\scripts\start-backend-parallel.ps1 -Workers 2 -Port 8007
```

Ajoute le flag `-Reload` si tu modifies le backend pendant l’exploration (il passe `uvicorn --reload`). Chaque requête affiche son horodatage pour suivre instantanément l’exécution sur chaque `device_id`.

### 7. Launch the Electron shell
```bash
cd mon-projet
node_modules\.bin\electron.cmd src\electron   # Windows
npx electron src/electron                     # macOS/Linux
```

Re-run `npm run build` inside `src/frontend` or `src/electron` whenever you change UI or main-process code, then restart Electron.

**Helper scripts**
- `scripts\deploy-frontend.ps1` rebuilds React and mirrors assets into `src/backend/static/`.
- `scripts\launch-app.ps1` installs prerequisites and boots the dev stack end to end (Windows).

---

## 🧭 Spec-Driven Development (SDD)

This repository follows the Spec Kit methodology: **aucune implémentation n’est acceptée sans triptyque spec → plan → tasks validé**. Chaque feature vit dans `specs/<id>-<slug>/`.

- Modèles : `.specify/templates/spec-template.md`, `.specify/templates/plan-template.md`, `.specify/templates/tasks-template.md`
- Validation obligatoire (avant merge) :
  ```bash
  npm run spec:check
  ```
  Vérifie la présence et la complétude de `spec.md`, `plan.md`, `tasks.md` avec les sections requises.
- Pull requests : l’ID de spec doit être référencé, et le template PR (`.github/pull_request_template.md`) impose la case à cocher pour spec/plan/tasks validés.
- Workflow :
  1. Copier les templates dans `specs/<id>-<slug>/` (ex. `cp .specify/templates/spec-template.md specs/010-new-feature/spec.md`).
  2. Remplir `spec.md` (quoi/pourquoi), puis `plan.md` (approche technique), puis `tasks.md` (tâches exécutables).
  3. Exiger validation / approbation de ces trois artefacts.
  4. Lancer `npm run spec:check` et inclure le résultat dans la PR.

---

## ✨ Key Features

### Dashboard
- Real-time status cards and logs
- Multi-device management with automatic ADB discovery
- 29 telecom test modules + 10 predefined workflows
- Live execution tracking and historical reports

### Telecom Modules (sample)

**Voice & Messaging**
- `voice_call_test` – programmable voice call scenarios (duration & repeats)
- `initiate_call`, `reject_incoming_call`, `send_sms`, `delete_sms`

**Network Controls**
- `enable_airplane_mode`, `force_phone_to_lte/3g/2g`
- `enable_wifi`, `enable_mobile_data`
- `check_signal_strength`, `check_ip`

**Sessions & Device Ops**
- `start_data_session`, `network_perf`
- `capture_screenshot`, `power_off_device`, `install_app`, `force_close_app`, etc.

---

## 🏗️ Architecture Overview

```
simple-server.py                # FastAPI entry point (port 8003)
src/backend/modules/            # 29 ADB-powered modules
src/backend/static/             # Built React dashboard
specs/                          # Spec Kit artifacts
adb_scripts/                    # Supporting shell/Python utilities
```

**Stack**
- Backend: FastAPI + Pydantic
- Frontend: React (CRA) bundled into `src/backend/static/`
- Electron shell for desktop packaging
- ADB integration via Python helpers + shell scripts

---

## 📋 Prerequisites

### System
- Python 3.11+
- Node.js 18+
- ADB (Android Platform Tools) in PATH
- Android device with USB debugging

### Install ADB
```bash
# Windows
choco install adb

# macOS
brew install android-platform-tools

# Ubuntu/Debian
sudo apt install android-tools-adb
```

---

## 📦 Windows EXE (optional)

Use PyInstaller to ship the backend as a standalone executable.

```powershell
cd mon-projet
./build/build-exe.ps1
```

The script creates `.venv-build`, installs deps, runs PyInstaller with `build/simple-server.spec`, and outputs `dist/TelcoADBServer/TelcoADBServer.exe`.

---

## 🎮 Usage Guide

### Device prep
```bash
adb devices         # should list your device as "device"
```
If not, reconnect the phone, confirm the USB debugging prompt, and retry.

### Starting the framework
```bash
python simple-server.py
# Console output:
# Starting Telco ADB Automation
# Interface: http://localhost:8003
# API Documentation: http://localhost:8003/docs
```

### Running modules
- Use the web dashboard or Electron shell to launch tests.
- Each module exposes parameters and real-time logs.
- Workflow executions are monitored from `/api/v1/executions` or the UI.

---

## 🤝 Contribution Workflow

1. Create/update a spec in `specs/` (Spec Kit workflow).
2. Implement changes under `src/backend`, `src/frontend`, or `src/electron`.
3. Run:
   ```bash
   npm run spec:check
   cd src/frontend && npm run build && cd ../..
   cd src/electron && npm run build && cd ../..
   ```
4. Launch the backend (`python simple-server.py`) and Electron to validate.
5. Commit with the spec ID, push, and open a PR.

---

## 📄 License

MIT License – see `LICENSE` for details.
