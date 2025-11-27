# Implementation Plan: Sécurisation endpoints devices/report

**Branch**: `chore/ci-governance` | **Date**: 2024-07-01 | **Spec**: specs/022-security-hardening/spec.md  
**Input**: Feature specification from `/specs/022-security-hardening/spec.md`

## Summary
Ajouter une clé API obligatoire (`X-API-Key`) sur les endpoints devices (v1/v2) et report PDF, avec rate limiting en mémoire (par clé, fenêtre 60s). Configurable via settings. Tests pytest pour 401/429 et happy path.

## Technical Context
**Langage**: Python 3.12 / FastAPI  
**Dépendances**: aucune nouvelle  
**Cible**: endpoints devices, report PDF  
**Contraintes**: in-memory rate limit (process unique), simple header API key

## Structure
```
src/backend/core/config.py         # settings API_KEY, RATE_LIMIT_PER_MIN
src/backend/api/security.py        # dépendances auth + rate limit
src/backend/api/devices.py         # dépendances appliquées
src/backend/api/devices_v2.py      # idem
src/backend/tests/test_security_api.py  # tests 401/429/200
```

## Tasks
- Mettre à jour settings (API_KEY, RATE_LIMIT_PER_MIN).
- Ajouter dépendances `require_api_key` + `enforce_rate_limit` (header + compteur mémoire).
- Appliquer aux routers devices/devices_v2/report endpoint.
- Tests pytest (401, 429, 200).
