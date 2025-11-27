---

description: "Nettoyage warnings utcnow/sqlalchemy + test frontend download"

---

# Tasks: Nettoyage warnings

- [ ] T001 Remplacer `datetime.utcnow` dans API/tests ciblés par `datetime.now(timezone.utc)` (imports à ajuster).
- [ ] T002 Remplacer `declarative_base` import déprécié par `sqlalchemy.orm.declarative_base`.
- [ ] T003 Ajuster/valider pytest (backend) pour vérifier disparition des warnings ciblés.
- [ ] T004 (Optionnel si infra) Ajouter un test frontend (mock fetch) pour `downloadDeviceReport` ou documenter son absence.
