---

description: "Robustesse modules RF/SilentLog"

---

# Tasks: Robustesse modules RF/SilentLog

- [ ] T001 Adapter `start_rf_logging`/`stop_rf_logging` (state_confirmed, warning, vérif post-commandes).
- [ ] T002 Ajouter vérification basique (`ls /sdcard/log`) et marquer `success=False` ou `state_confirmed=False` si non concluant.
- [ ] T003 Tests pytest pour succès/unknown/échec.
