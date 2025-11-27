---

description: "Clé API + rate limit pour endpoints devices/report"

---

# Tasks: Sécurisation endpoints devices/report

## Phase 1: Backend
- [ ] T001 [US1] Ajouter `API_KEY` et `RATE_LIMIT_PER_MIN` dans `core/config.py`.
- [ ] T002 [US1] Créer `api/security.py` avec `require_api_key` (header `X-API-Key`) et rate limiter en mémoire (par clé).
- [ ] T003 [US1] Appliquer les dépendances aux routers devices (`api/devices.py`, `api/devices_v2.py`) et à l’endpoint report PDF.

## Phase 2: Tests
- [ ] T004 [US1/US2] Ajouter tests pytest (401 sans clé, 401 clé invalide, 200 clé valide, 429 après dépassement quota).

## Phase 3: Validation
- [ ] T005 Exécuter `python -m pytest` (backend) + `npm run build:electron` et consigner les résultats.
